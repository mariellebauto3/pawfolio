<?php

namespace App\Services\Discovery;

use App\Enums\AccountStatus;
use App\Enums\PetStatus;
use App\Models\Adoption;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class RecentlyHired
{
    public function items(): array
    {
        $store = config('performance.read_cache_store');
        // Never publish data read inside a transaction under a committed revision.
        if (! $store || DB::transactionLevel() > 0 || ! in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            return $this->present($this->rows());
        }

        // PostgreSQL is authoritative even when Redis has missed writes or recovered
        // from an outage. Trigger updates commit/roll back with the business rows.
        $revision = DB::table('read_cache_versions')->where('name', 'recently-hired')->value('version');
        $key = 'public:recently-hired:v1:'.$revision;
        $cache = null;
        try {
            $cache = Cache::store($store);
            $rows = $cache->get($key);
            if (is_array($rows)) {
                return $this->present($rows);
            }
        } catch (Throwable $error) {
            $this->cacheFailure($error);
            $cache = null;
        }

        // Keep database and storage errors outside the Redis failure handler.
        $rows = $this->rows();
        if ($cache) {
            try {
                $cache->put($key, $rows, config('performance.recently_hired_ttl'));
            } catch (Throwable $error) {
                $this->cacheFailure($error);
            }
        }

        return $this->present($rows);
    }

    private function rows(): array
    {
        return Adoption::query()
            ->select(['id', 'pet_id', 'adopted_at'])
            ->with(['pet:id,name', 'pet.photos:id,pet_id,file_path,sort_order'])
            ->whereNotNull('adopted_at')
            ->whereNull('link_removed_at')
            ->whereHas('pet', fn ($pet) => $pet
                ->where('status', PetStatus::AdoptedHired->value)
                ->whereHas('user', fn ($user) => $user->where('status', AccountStatus::Active->value)))
            ->orderByDesc('adopted_at')->orderByDesc('id')->limit(4)->get()
            ->map(fn (Adoption $adoption) => [
                'name' => $adoption->pet->name,
                'hired_at' => $adoption->adopted_at->toISOString(),
                'photos' => $adoption->pet->photos->sortBy('sort_order')->pluck('file_path')->values()->all(),
            ])->all();
    }

    private function present(array $rows): array
    {
        $disk = Storage::disk('public');

        return array_map(function (array $row) use ($disk): array {
            // Files can disappear without a database change. Preserve the existing
            // first-existing-photo behavior on every request, including cache hits.
            $photo = null;
            foreach ($row['photos'] as $path) {
                if ($disk->exists($path)) {
                    $photo = $disk->url($path);
                    break;
                }
            }

            return ['name' => $row['name'], 'photo_url' => $photo, 'hired_at' => $row['hired_at']];
        }, $rows);
    }

    private function cacheFailure(Throwable $error): void
    {
        // Redis exception messages may contain connection credentials.
        Log::warning('Optional read cache unavailable.', ['exception_class' => $error::class]);
    }
}
