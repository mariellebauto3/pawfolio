<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Reports;

use App\Actions\Accounts\SuspendAccount;
use App\Enums\ActivityLogType;
use App\Enums\NotificationType;
use App\Enums\ReportAction as ReportActionEnum;
use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTargetType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\ResponseResource;
use App\Models\Comment;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\Report;
use App\Models\ReportAction;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Member reporting and Admin moderation queue & actions (BE-22, RP-01..RP-05, FR16, FR32, FR35).
 */
class ReportController extends Controller
{
    /** What an action did, in the words the owner of the reported item reads in their notification (RP-05). */
    private const ACTION_OUTCOMES = [
        'remove_content' => 'removed what you posted',
        'suspend_account' => 'suspended your account',
        'remove_content_and_suspend' => 'removed what you posted and suspended your account',
    ];

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function store(Request $request)
    {
        $reporter = $request->user();

        $validated = $request->validate([
            'target_type' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, ReportTargetType::cases()))],
            'reason' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, ReportReason::cases()))],
            // "Something else" names no problem by itself, so the details carry it (RP-01).
            'details' => ['nullable', 'required_if:reason,'.ReportReason::SomethingElse->value, 'string', 'max:1000'],
            'target_id' => ['nullable', 'integer'],
            'reported_user_id' => ['nullable', 'integer'],
            'pet_id' => ['nullable', 'integer'],
            'home_profile_id' => ['nullable', 'integer'],
            'post_id' => ['nullable', 'integer'],
            'comment_id' => ['nullable', 'integer'],
        ], [
            'details.required_if' => 'Tell us what is wrong, so an admin knows what to look for.',
        ]);

        $targetType = ReportTargetType::from($validated['target_type']);
        $reportedUserId = isset($validated['reported_user_id']) ? (int) $validated['reported_user_id'] : null;
        $postId = isset($validated['post_id']) ? (int) $validated['post_id'] : null;
        $commentId = isset($validated['comment_id']) ? (int) $validated['comment_id'] : null;
        $targetId = isset($validated['target_id']) ? (int) $validated['target_id'] : null;

        if ($targetType === ReportTargetType::Post) {
            $postId = $postId ?? $targetId;
            $post = $postId ? Post::query()->find($postId) : null;
            if (! $post) {
                return ErrorResource::notFound('Post not found.')->toResponse($request);
            }
            $reportedUserId = $post->author_user_id;
        } elseif ($targetType === ReportTargetType::Comment) {
            $commentId = $commentId ?? $targetId;
            $comment = $commentId ? Comment::query()->find($commentId) : null;
            if (! $comment) {
                return ErrorResource::notFound('Comment not found.')->toResponse($request);
            }
            $reportedUserId = $comment->user_id;
            $postId = $comment->post_id;
        } elseif ($targetType === ReportTargetType::Profile) {
            if (! empty($validated['pet_id'])) {
                $pet = Pet::query()->find((int) $validated['pet_id']);
                $reportedUserId = $pet?->user_id;
            } elseif (! empty($validated['home_profile_id'])) {
                $home = HomeProfile::query()->find((int) $validated['home_profile_id']);
                $reportedUserId = $home?->user_id;
            } elseif ($reportedUserId === null && $targetId !== null) {
                $userCandidate = User::query()->find($targetId);
                $petCandidate = Pet::query()->find($targetId);
                $homeCandidate = HomeProfile::query()->find($targetId);
                $reportedUserId = $userCandidate?->id ?? $petCandidate?->user_id ?? $homeCandidate?->user_id;
            }
        } elseif ($targetType === ReportTargetType::Account) {
            $reportedUserId = $reportedUserId ?? $targetId;
        }

        // Only a pet or a human account can be reported; an admin's id is answered like one that doesn't exist.
        $reportedUser = $reportedUserId ? User::query()->find($reportedUserId) : null;
        if (! $reportedUser || $reportedUser->isAdmin()) {
            return ErrorResource::notFound('Reported account not found.')->toResponse($request);
        }

        if ($reportedUserId === $reporter->id) {
            return ErrorResource::unprocessable('You cannot report your own content or account.', [
                'target_id' => ['You cannot report your own content or account.'],
            ])->toResponse($request);
        }

        // One open report per reporter per item; once it is resolved the item can be reported again (SEC-AUTHZ-08).
        $alreadyOpen = Report::query()
            ->open()
            ->where('reporter_user_id', $reporter->id)
            ->where('reported_user_id', $reportedUserId)
            ->where('target_type', $targetType->value)
            ->where('post_id', $postId)
            ->where('comment_id', $commentId)
            ->exists();
        if ($alreadyOpen) {
            return ErrorResource::conflict('You already reported this. An admin is reviewing it.', 'report_already_open')
                ->toResponse($request);
        }

        $report = new Report;
        $report->reporter_user_id = $reporter->id;
        $report->reported_user_id = $reportedUserId;
        $report->target_type = $targetType->value;
        $report->post_id = $postId;
        $report->comment_id = $commentId;
        $report->reason = $validated['reason'];
        $report->details = isset($validated['details']) && trim($validated['details']) !== '' ? trim($validated['details']) : null;
        $report->status = ReportStatus::Open->value;
        $report->save();

        ActivityLogger::log(
            type: ActivityLogType::Moderation,
            action: 'report_submitted',
            actor: $reporter,
            subject: $report,
            reason: $report->reason,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::created([
            'id' => $report->id,
            'target_type' => $report->target_type,
            'reason' => $report->reason,
            'status' => $report->status,
            'created_at' => $report->created_at?->toISOString(),
        ]);
    }

    public function adminIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        // Filters are allow-listed: an unknown value is refused, not passed on (SEC-INPUT-03).
        $filters = $request->validate([
            'status' => ['sometimes', 'string', Rule::in(array_map(fn ($c) => $c->value, ReportStatus::cases()))],
            'target_type' => ['sometimes', 'string', Rule::in(array_map(fn ($c) => $c->value, ReportTargetType::cases()))],
            'reason' => ['sometimes', 'string', Rule::in(array_map(fn ($c) => $c->value, ReportReason::cases()))],
        ]);

        $query = Report::query()
            ->with(['reporter', 'reportedUser.pet', 'reportedUser.homeProfile', 'post', 'comment', 'reportAction.admin'])
            ->where('status', $filters['status'] ?? ReportStatus::Open->value);

        if (isset($filters['target_type'])) {
            $query->where('target_type', $filters['target_type']);
        }

        if (isset($filters['reason'])) {
            $query->where('reason', $filters['reason']);
        }

        // RP-03: one row per reported item, its latest report standing for the others, most reported first, then
        // newest. The SQL is made of constants only (SEC-INPUT-02).
        $query->whereRaw('reports.id = (SELECT MAX(r2.id) FROM reports r2 WHERE '.Report::SAME_ITEM.')')
            ->orderByRaw('(SELECT COUNT(*) FROM reports r2 WHERE '.Report::SAME_ITEM.') DESC')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (Report $report) => $this->formatReport($report));
    }

    public function adminShow(Request $request, Report $report)
    {
        $report->load(['reporter', 'reportedUser.pet', 'reportedUser.homeProfile', 'post.photos', 'comment', 'reportAction.admin']);

        // Every report on this item, resolved ones included, so the admin reads its whole history (RP-04).
        $siblingReports = $this->reportsOnSameItem($report)
            ->with('reporter')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Report $r) => [
                'id' => $r->id,
                'reporter_id' => $r->reporter_user_id,
                'reporter_name' => $r->reporter?->displayName(),
                'reason' => $r->reason,
                'details' => $r->details,
                'status' => $r->status,
                'created_at' => $r->created_at?->toISOString(),
            ])
            ->values()
            ->all();

        $data = $this->formatReport($report, includeContentPreview: true);
        $data['sibling_reports'] = $siblingReports;

        return ResponseResource::make($data);
    }

    public function takeAction(Request $request, Report $report)
    {
        $admin = $request->user();

        $allowedActions = array_merge(
            array_map(fn ($c) => $c->value, ReportActionEnum::cases()),
            ['restore_content'],
        );

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in($allowedActions)],
            'reason' => ['required', 'string', 'max:1000'],
            'notify_reporters' => ['sometimes', 'boolean'],
        ], [
            'reason.required' => 'Enter a reason for this moderation action.',
        ]);

        $actionValue = $validated['action'];
        $reason = trim($validated['reason']);
        $notifyReporters = (bool) ($validated['notify_reporters'] ?? true);

        $report->load(['reportedUser', 'post', 'comment']);

        // What the report is about: the comment when there is one (its post comes along only as context), else the post.
        $content = $report->comment ?? $report->post;

        if ($actionValue === 'restore_content') {
            // Only what an admin removed can be put back (RP-05, "Removed content can be restored from Resolved").
            if (! $content || $content->removed_at === null) {
                return ErrorResource::conflict('There is nothing to restore: this content is not removed.', 'nothing_to_restore')
                    ->toResponse($request);
            }

            DB::transaction(function () use ($content, $admin, $reason, $request): void {
                $content->removed_at = null;
                $content->save();

                ActivityLogger::log(
                    type: ActivityLogType::Moderation,
                    action: 'reported_content_restored',
                    actor: $admin,
                    subject: $content,
                    before: 'removed',
                    after: 'visible',
                    reason: $reason,
                    userAgent: $request->userAgent(),
                );
            });

            return ResponseResource::make(
                $this->formatReport($report->fresh(['reporter', 'reportedUser.pet', 'reportedUser.homeProfile', 'post.photos', 'comment', 'reportAction.admin']), true),
            );
        }

        $actionEnum = ReportActionEnum::from($actionValue);

        // Two admins on one report: the second is told, and nothing is done twice.
        if ($report->getStatus() !== ReportStatus::Open) {
            return ErrorResource::conflict('This report was already resolved.', 'report_already_resolved')->toResponse($request);
        }

        $removes = in_array($actionEnum, [ReportActionEnum::RemoveContent, ReportActionEnum::RemoveContentAndSuspend], true);
        if ($removes && ! $content) {
            return ErrorResource::unprocessable('A profile or an account has nothing to remove.', [
                'action' => ['A profile or an account has nothing to remove. Suspend the account or dismiss the report.'],
            ])->toResponse($request);
        }

        $suspends = in_array($actionEnum, [ReportActionEnum::SuspendAccount, ReportActionEnum::RemoveContentAndSuspend], true);
        if ($suspends && ! $report->reportedUser?->isActive()) {
            return ErrorResource::unprocessable('Only an Active account can be suspended.', [
                'action' => ['This account is not Active, so it cannot be suspended.'],
            ])->toResponse($request);
        }

        DB::transaction(function () use ($report, $admin, $actionEnum, $reason, $notifyReporters, $request): void {
            // 1. Remove content if requested.
            if (in_array($actionEnum, [ReportActionEnum::RemoveContent, ReportActionEnum::RemoveContentAndSuspend], true)) {
                if ($report->comment) {
                    $report->comment->removed_at = now();
                    $report->comment->save();
                } elseif ($report->post) {
                    $report->post->removed_at = now();
                    $report->post->save();
                }
            }

            // 2. Suspend reported account if requested.
            $reportedUser = $report->reportedUser;
            if ($reportedUser && in_array($actionEnum, [ReportActionEnum::SuspendAccount, ReportActionEnum::RemoveContentAndSuspend], true)) {
                // The same suspension as the account page's (AC-08): sessions end and open requests close. The
                // owner's notification is this report's own, written below.
                app(SuspendAccount::class)->handle(
                    $reportedUser,
                    $admin,
                    $reason,
                    'account_suspended_from_report',
                    notify: false,
                    userAgent: $request->userAgent(),
                );
            }

            // 3. Record ReportAction and resolve all open sibling reports for the same target.
            $ra = new ReportAction;
            $ra->admin_user_id = $admin->id;
            $ra->target_type = $report->target_type;
            $ra->reported_user_id = $report->reported_user_id;
            $ra->post_id = $report->post_id;
            $ra->comment_id = $report->comment_id;
            $ra->action = $actionEnum->value;
            $ra->reason = $reason;
            $ra->notify_reporters = $notifyReporters;
            $ra->save();

            $siblingReports = $this->reportsOnSameItem($report)
                ->with('reporter')
                ->where('status', ReportStatus::Open->value)
                ->get();

            if (! $siblingReports->contains('id', $report->id)) {
                $siblingReports->push($report);
            }

            foreach ($siblingReports as $sibling) {
                $sibling->status = ReportStatus::Resolved->value;
                $sibling->report_action_id = $ra->id;
                $sibling->save();
            }

            // 4. Notify reported owner when action was taken (not dismissed).
            if ($reportedUser && $actionEnum !== ReportActionEnum::Dismiss) {
                $this->notifications->store(
                    recipient: $reportedUser,
                    type: NotificationType::AccountAction->value,
                    title: 'Moderation update on your account',
                    body: 'An admin '.self::ACTION_OUTCOMES[$actionEnum->value]." after a report: {$reason}",
                    data: [
                        'category' => 'Account',
                        'report_action_id' => $ra->id,
                        'action' => $actionEnum->value,
                        'reason' => $reason,
                        'link' => '/me',
                    ],
                    urgency: 'urgent',
                    actionUrl: '/me',
                );
            }

            // 5. Notify reporters if enabled.
            if ($notifyReporters) {
                $notifiedReporterIds = [];
                foreach ($siblingReports as $sibling) {
                    if ($sibling->reporter && ! in_array($sibling->reporter_user_id, $notifiedReporterIds, true) && $sibling->reporter_user_id !== $report->reported_user_id) {
                        $notifiedReporterIds[] = $sibling->reporter_user_id;
                        $this->notifications->store(
                            recipient: $sibling->reporter,
                            type: NotificationType::AccountAction->value,
                            title: 'Update on your report',
                            body: 'Thank you for helping keep Pawfolio safe. Our moderation team reviewed your report and resolved it.',
                            data: [
                                'category' => 'Account',
                                'report_id' => $sibling->id,
                                'link' => '/notifications',
                            ],
                            urgency: 'info',
                            actionUrl: '/notifications',
                        );
                    }
                }
            }

            ActivityLogger::log(
                type: ActivityLogType::Moderation,
                action: "report_resolved_{$actionEnum->value}",
                actor: $admin,
                subject: $report,
                before: ReportStatus::Open->value,
                after: ReportStatus::Resolved->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        });

        return ResponseResource::make(
            $this->formatReport($report->fresh(['reporter', 'reportedUser.pet', 'reportedUser.homeProfile', 'post.photos', 'comment', 'reportAction.admin']), true),
        );
    }

    /** Every report on the item `$report` is about, whatever its status. */
    private function reportsOnSameItem(Report $report): Builder
    {
        return Report::query()
            ->where('reported_user_id', $report->reported_user_id)
            ->where('target_type', $report->target_type)
            ->where('post_id', $report->post_id)
            ->where('comment_id', $report->comment_id);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatReport(Report $report, bool $includeContentPreview = false): array
    {
        // The reports that share this one's row in the queue: same item, same status (RP-03).
        $siblingCount = $this->reportsOnSameItem($report)->where('status', $report->status)->count();

        $data = [
            'id' => $report->id,
            'target_type' => $report->target_type,
            'reason' => $report->reason,
            'details' => $report->details,
            'status' => $report->status,
            'reports_count' => $siblingCount,
            'post_id' => $report->post_id,
            'comment_id' => $report->comment_id,
            'reporter' => $report->reporter ? [
                'id' => $report->reporter->id,
                'display_name' => $report->reporter->displayName(),
                'role' => $report->reporter->getRole()->value,
            ] : null,
            'reported_user' => $report->reportedUser ? [
                'id' => $report->reportedUser->id,
                'display_name' => $report->reportedUser->displayName(),
                'role' => $report->reportedUser->getRole()->value,
                'status' => $report->reportedUser->getStatus()->value,
                'profile_id' => $report->reportedUser->profileId(),
            ] : null,
            'report_action' => $report->reportAction ? [
                'id' => $report->reportAction->id,
                'action' => $report->reportAction->action,
                'reason' => $report->reportAction->reason,
                'notify_reporters' => $report->reportAction->notify_reporters,
                'performed_by' => $report->reportAction->admin?->displayName(),
                'created_at' => $report->reportAction->created_at?->toISOString(),
            ] : null,
            'created_at' => $report->created_at?->toISOString(),
        ];

        if ($includeContentPreview) {
            // The reported account as the admin weighs it (RP-04): when it joined and how often it was reported.
            if ($report->reportedUser) {
                $data['reported_user']['joined_at'] = $report->reportedUser->created_at?->toISOString();
                $data['reported_user']['reports_against_count'] = Report::query()
                    ->where('reported_user_id', $report->reported_user_id)
                    ->count();
            }

            $data['content_preview'] = [
                'post' => $report->post ? [
                    'id' => $report->post->id,
                    'type' => $report->post->getPostType()->value,
                    'title' => $report->post->title,
                    'body' => $report->post->body,
                    'photos' => $report->post->photos->map(fn ($photo) => [
                        'id' => $photo->id,
                        'url' => Storage::disk('public')->url($photo->file_path),
                    ])->values()->all(),
                    'is_removed' => $report->post->isRemoved(),
                    'is_deleted' => $report->post->deleted_at !== null,
                    'created_at' => $report->post->created_at?->toISOString(),
                ] : null,
                'comment' => $report->comment ? [
                    'id' => $report->comment->id,
                    'body' => $report->comment->body,
                    'is_removed' => $report->comment->removed_at !== null,
                    'created_at' => $report->comment->created_at?->toISOString(),
                ] : null,
            ];
        }

        return $data;
    }
}
