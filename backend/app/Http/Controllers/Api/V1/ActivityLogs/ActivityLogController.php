<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\ActivityLogs;

use App\Enums\ActivityLogType;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\ResponseResource;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Member and Admin activity logs and CSV export (BE-26, LG-01..LG-04, FR41, SEC-LOG-01..04).
 */
class ActivityLogController extends Controller
{
    public function myActivity(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = $this->buildMemberQuery($user, $request);
        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (ActivityLog $log) => $this->formatLog($log));
    }

    public function exportMyActivity(Request $request): StreamedResponse
    {
        $user = $request->user();
        $logs = $this->buildMemberQuery($user, $request)->limit(1000)->get();

        return $this->streamCsv($logs, 'my-activity-logs.csv');
    }

    public function adminIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = $this->buildAdminQuery($request);
        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (ActivityLog $log) => $this->formatLog($log));
    }

    public function adminExport(Request $request): StreamedResponse
    {
        $logs = $this->buildAdminQuery($request)->limit(2000)->get();

        return $this->streamCsv($logs, 'platform-activity-logs.csv');
    }

    public function adminShow(Request $request, ActivityLog $activityLog)
    {
        $activityLog->load('actor');

        return ResponseResource::make($this->formatLog($activityLog, includeFullDetail: true));
    }

    private function buildMemberQuery(User $user, Request $request): Builder
    {
        $petId = $user->pet?->id;
        $homeId = $user->homeProfile?->id;

        $requestIds = AdoptionRequest::query()
            ->when($petId, fn ($q) => $q->where('pet_id', $petId))
            ->when($homeId, fn ($q) => $q->orWhere('home_profile_id', $homeId))
            ->pluck('id')
            ->all();

        $query = ActivityLog::query()
            ->with('actor')
            ->where(function ($q) use ($user, $petId, $homeId, $requestIds): void {
                $q->where('actor_user_id', $user->id)
                    ->orWhere(function ($sub) use ($user): void {
                        $sub->where('subject_type', User::class)->where('subject_id', $user->id);
                    });

                if ($petId) {
                    $q->orWhere(function ($sub) use ($petId): void {
                        $sub->where('subject_type', Pet::class)->where('subject_id', $petId);
                    });
                }

                if ($homeId) {
                    $q->orWhere(function ($sub) use ($homeId): void {
                        $sub->where('subject_type', HomeProfile::class)->where('subject_id', $homeId);
                    });
                }

                if ($requestIds !== []) {
                    $q->orWhere(function ($sub) use ($requestIds): void {
                        $sub->where('subject_type', AdoptionRequest::class)->whereIn('subject_id', $requestIds);
                    });
                }
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $type = $request->string('type')->toString();
            if (ActivityLogType::tryFrom($type) !== null) {
                $query->where('type', $type);
            }
        }

        return $query;
    }

    private function buildAdminQuery(Request $request): Builder
    {
        $query = ActivityLog::query()
            ->with('actor')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $types = array_values(array_filter(explode(',', $request->string('type')->toString())));
            if ($types !== []) {
                $query->whereIn('type', $types);
            }
        }

        if ($request->filled('actor_user_id')) {
            $query->where('actor_user_id', (int) $request->query('actor_user_id'));
        }

        if ($request->filled('actor_role')) {
            $actorRole = strtolower(trim($request->string('actor_role')->toString()));
            if ($actorRole === 'system') {
                $query->whereNull('actor_user_id');
            } elseif (in_array($actorRole, ['admin', 'pet', 'human'], true)) {
                $query->whereHas('actor', fn ($u) => $u->where('role', $actorRole));
            }
        }

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(function ($sub) use ($like): void {
                    $sub->where('action', 'like', $like)
                        ->orWhere('reason', 'like', $like)
                        ->orWhere('before_value', 'like', $like)
                        ->orWhere('after_value', 'like', $like);
                });
            }
        }

        return $query;
    }

    private function streamCsv($logs, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($logs): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, ['ID', 'When', 'Who', 'Type', 'Action', 'Before', 'After', 'Reason']);

            foreach ($logs as $log) {
                $who = $log->actor ? $log->actor->displayName() : 'System';

                fputcsv($handle, [
                    (string) $log->id,
                    $log->created_at?->toISOString() ?? '',
                    $this->sanitizeCsvCell($who),
                    $this->sanitizeCsvCell((string) $log->type),
                    $this->sanitizeCsvCell((string) $log->action),
                    $this->sanitizeCsvCell((string) ($log->before_value ?? '')),
                    $this->sanitizeCsvCell((string) ($log->after_value ?? '')),
                    $this->sanitizeCsvCell((string) ($log->reason ?? '')),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Prevent CSV formula injection when opened in spreadsheet tools.
     */
    private function sanitizeCsvCell(string $value): string
    {
        if ($value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatLog(ActivityLog $log, bool $includeFullDetail = false): array
    {
        $data = [
            'id' => $log->id,
            'type' => $log->type,
            'action' => $log->action,
            'actor' => $log->actor ? [
                'id' => $log->actor->id,
                'display_name' => $log->actor->displayName(),
                'role' => $log->actor->getRole()->value,
            ] : [
                'id' => null,
                'display_name' => 'System',
                'role' => 'system',
            ],
            'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
            'subject_id' => $log->subject_id,
            'before_value' => $log->before_value,
            'after_value' => $log->after_value,
            'reason' => $log->reason,
            'created_at' => $log->created_at?->toISOString(),
        ];

        if ($includeFullDetail) {
            $data['user_agent'] = $log->user_agent;
            $data['is_append_only'] = true;
        }

        return $data;
    }
}
