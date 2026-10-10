<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\ActivityLogs;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivityLogs\ListActivityLogsRequest;
use App\Http\Requests\ActivityLogs\ListMyActivityRequest;
use App\Http\Resources\ResponseResource;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogPresenter;
use App\Support\PhilippineTime;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Member and Admin activity logs and CSV export (BE-26, LG-01..LG-04, FR41, SEC-LOG-01..04).
 *
 * Read-only: the log has no update and no delete, here or anywhere (SEC-LOG-04).
 */
class ActivityLogController extends Controller
{
    /** The newest rows an export carries. */
    public const MEMBER_EXPORT_LIMIT = 1000;

    public const ADMIN_EXPORT_LIMIT = 2000;

    private const LIKE_ESCAPE = '!';

    public function __construct(
        private readonly ActivityLogPresenter $presenter,
    ) {}

    public function myActivity(ListMyActivityRequest $request)
    {
        $user = $request->user();

        return $this->page($this->memberQuery($user, $request->types())->paginate($request->perPage()), $user);
    }

    public function exportMyActivity(ListMyActivityRequest $request): StreamedResponse
    {
        $user = $request->user();
        $logs = $this->memberQuery($user, $request->types())->limit(self::MEMBER_EXPORT_LIMIT)->get();

        return $this->streamCsv($logs, $user, 'my-activity.csv');
    }

    public function adminIndex(ListActivityLogsRequest $request)
    {
        return $this->page($this->adminQuery($request)->paginate($request->perPage()), $request->user());
    }

    public function adminExport(ListActivityLogsRequest $request): StreamedResponse
    {
        $logs = $this->adminQuery($request)->limit(self::ADMIN_EXPORT_LIMIT)->get();

        return $this->streamCsv($logs, $request->user(), 'activity-logs.csv');
    }

    public function adminShow(Request $request, ActivityLog $activityLog)
    {
        $activityLog->load('actor');

        return ResponseResource::make($this->presenter->present(collect([$activityLog]), $request->user(), withDetail: true)[0]);
    }

    private function page(LengthAwarePaginator $paginator, User $viewer): ResponseResource
    {
        return ResponseResource::paginated($paginator, $this->presenter->present($paginator->getCollection(), $viewer));
    }

    /**
     * An account's own activity: what it did, and what was done to the account, its pet or Home Profile and its
     * requests (the system's status changes, an admin's decisions, the other side's answers). Nothing else is in
     * reach: an account with no pet and no Home Profile is matched by its own id only (SEC-AUTHZ-02).
     *
     * @param  list<string>  $types
     */
    private function memberQuery(User $user, array $types): Builder
    {
        $petId = $user->pet?->id;
        $homeId = $user->homeProfile?->id;

        return ActivityLog::query()
            ->with('actor')
            ->where(function (Builder $mine) use ($user, $petId, $homeId): void {
                $mine->where('actor_user_id', $user->id)
                    ->orWhere(fn (Builder $about) => $about->where('subject_type', User::class)->where('subject_id', $user->id));

                if ($petId !== null) {
                    $mine->orWhere(fn (Builder $about) => $about->where('subject_type', Pet::class)->where('subject_id', $petId))
                        ->orWhere(fn (Builder $about) => $about->where('subject_type', AdoptionRequest::class)
                            ->whereIn('subject_id', AdoptionRequest::query()->select('id')->where('pet_id', $petId)));
                }

                if ($homeId !== null) {
                    $mine->orWhere(fn (Builder $about) => $about->where('subject_type', HomeProfile::class)->where('subject_id', $homeId))
                        ->orWhere(fn (Builder $about) => $about->where('subject_type', AdoptionRequest::class)
                            ->whereIn('subject_id', AdoptionRequest::query()->select('id')->where('home_profile_id', $homeId)));
                }
            })
            ->when($types !== [], fn (Builder $query) => $query->whereIn('type', $types))
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    private function adminQuery(ListActivityLogsRequest $request): Builder
    {
        $query = ActivityLog::query()
            ->with('actor')
            ->when($request->types() !== [], fn (Builder $logs) => $logs->whereIn('type', $request->types()))
            ->when($request->actorUserId() !== null, fn (Builder $logs) => $logs->where('actor_user_id', $request->actorUserId()))
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $role = $request->actorRole();
        if ($role === 'system') {
            $query->whereNull('actor_user_id');
        } elseif ($role !== null) {
            $query->whereHas('actor', fn (Builder $actor) => $actor->where('role', $role));
        }

        if (($term = $request->search()) !== null) {
            // Lower case on both sides and an explicit escape, so the search reads the same on every database
            // engine and a typed % or _ is a character, not a wildcard (SEC-INPUT-02: values are bound).
            $words = $this->likePattern($term);
            // An action is stored as a name such as `account_suspended`, so "account suspended" finds it too.
            $name = $this->likePattern(str_replace(' ', '_', $term));
            $matches = fn (Builder $q, string $column, string $like) => $q->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE ?", [$like, self::LIKE_ESCAPE]);
            $query->where(function (Builder $sub) use ($matches, $words, $name): void {
                $matches($sub, 'action', $name);
                foreach (['reason', 'before_value', 'after_value'] as $column) {
                    $matches($sub, $column, $words);
                }
            });
        }

        return $query;
    }

    /**
     * The entries as a spreadsheet, newest first, with what each reader may see: a member's file has no Reason
     * column and names no admin (ActivityLogPresenter).
     *
     * @param  Collection<int, ActivityLog>  $logs
     */
    private function streamCsv(Collection $logs, User $viewer, string $filename): StreamedResponse
    {
        $rows = $this->presenter->present($logs, $viewer);
        $forAdmin = $viewer->isAdmin();

        return response()->streamDownload(function () use ($rows, $forAdmin): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, ['When (Philippine time)', 'Who', 'Type', 'Action', 'About', 'Before', 'After', ...($forAdmin ? ['Reason'] : []), 'Device']);

            foreach ($rows as $row) {
                $cells = [
                    $row['created_at'] ? Carbon::parse($row['created_at'])->setTimezone(PhilippineTime::TIME_ZONE)->format('Y-m-d H:i') : '',
                    $row['actor']['display_name'],
                    $row['type'],
                    $row['action'],
                    $row['subject_label'] ?? '',
                    $row['before_value'] ?? '',
                    $row['after_value'] ?? '',
                    ...($forAdmin ? [$row['reason'] ?? ''] : []),
                    $row['device'] ?? '',
                ];

                fputcsv($handle, array_map(fn ($cell) => $this->sanitizeCsvCell((string) $cell), $cells));
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** "%selling%", with the wildcards a person typed made literal. */
    private function likePattern(string $term): string
    {
        $escaped = str_replace([self::LIKE_ESCAPE, '%', '_'], [self::LIKE_ESCAPE.self::LIKE_ESCAPE, self::LIKE_ESCAPE.'%', self::LIKE_ESCAPE.'_'], mb_strtolower($term));

        return "%{$escaped}%";
    }

    /**
     * Prevent CSV formula injection when opened in spreadsheet tools: a cell that would start a formula, also after
     * leading spaces, is written as text.
     */
    private function sanitizeCsvCell(string $value): string
    {
        $start = ltrim($value, ' ');
        if ($start !== '' && in_array($start[0], ['=', '+', '-', '@', "\t", "\r", "\n"], true)) {
            return "'".$value;
        }

        return $value;
    }
}
