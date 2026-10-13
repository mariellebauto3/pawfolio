<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneRegistrationUploadsCommand extends Command
{
    protected $signature = 'uploads:prune-registration-orphans {--delete : Delete identified files; otherwise preview only} {--hours=24 : Minimum age, at least 24 hours}';

    protected $description = 'Reconcile old private registration uploads left by interrupted requests or failed cleanup';

    public function handle(): int
    {
        $hours = filter_var($this->option('hours'), FILTER_VALIDATE_INT);
        if ($hours === false || $hours < 24) {
            $this->error('The minimum age must be at least 24 hours.');

            return self::FAILURE;
        }
        $disk = Storage::disk('local');
        $cutoff = now()->subHours($hours)->timestamp;
        $batch = [];
        $orphans = 0;
        foreach (['verification/ids', 'verification/pet-photos', 'verification/vet-records'] as $directory) {
            // Flysystem listing is iterable, so large buckets do not require
            // loading the complete list or issuing a DB query for every file.
            foreach ($disk->getDriver()->listContents($directory, true) as $file) {
                if (! $file->isFile() || ! preg_match('/\/[a-f0-9-]{36}\.(jpg|png|pdf)$/i', $file->path())) {
                    continue;
                }
                $modified = $file->lastModified() ?? $disk->lastModified($file->path());
                if ($modified >= $cutoff) {
                    continue;
                }
                $batch[] = $file->path();
                if (count($batch) === 200) {
                    $orphans += $this->reconcile($batch);
                    $batch = [];
                }
            }
        }
        if ($batch !== []) {
            $orphans += $this->reconcile($batch);
        }
        $this->info($orphans.' unreferenced file(s) '.($this->option('delete') ? 'deleted.' : 'identified; preview only.'));

        return self::SUCCESS;
    }

    private function reconcile(array $paths): int
    {
        $references = DB::table('verification_documents')->whereIn('file_path', $paths)->pluck('file_path')
            ->merge(DB::table('pet_vet_records')->whereIn('file_path', $paths)->pluck('file_path'))
            ->flip();
        $count = 0;
        foreach ($paths as $path) {
            if ($references->has($path)) {
                continue;
            }
            if ($this->option('delete') && ! Storage::disk('local')->delete($path)) {
                throw new \RuntimeException('Unable to delete orphan registration upload: '.$path);
            }
            $this->line($path);
            $count++;
        }

        return $count;
    }
}
