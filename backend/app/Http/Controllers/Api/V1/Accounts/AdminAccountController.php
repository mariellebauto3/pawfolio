<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Accounts;

use App\Actions\Accounts\DeactivateAccount;
use App\Actions\Accounts\SuspendAccount;
use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\DetailChangeRequestStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\AccountAction;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\DetailChangeRequest;
use App\Models\Report;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use App\Services\Uploads\FileUploadService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Admin account directory, detail view, suspend/reactivate/deactivate actions, and locked-field change request review (BE-23, AC-03, AC-06..AC-10, FR34).
 */
class AdminAccountController extends Controller
{
    /** The locked fields in the words of the screens, for a notification the owner reads (AC-03). */
    private const FIELD_LABELS = [
        'name' => 'name',
        'species' => 'species',
        'breed' => 'breed',
        'approximate_age_months' => 'approximate age',
        'full_name' => 'full name',
        'birthdate' => 'birthdate',
        'city' => 'city',
        'province' => 'province',
    ];

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MatchScoreCalculator $matcher,
        private readonly SuspendAccount $suspendAccount,
        private readonly DeactivateAccount $deactivateAccount,
    ) {}

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        // Filters are allow-listed: an unknown value is refused, not passed on (SEC-INPUT-03).
        $filters = $request->validate([
            'tab' => ['sometimes', 'string', Rule::in(['all', 'pet', 'human', 'alumni'])],
            'role' => ['sometimes', 'string', Rule::in([Role::Pet->value, Role::Human->value])],
            'status' => ['sometimes', 'string', Rule::in(array_map(fn ($c) => $c->value, AccountStatus::cases()))],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $query = User::query()
            ->with(['pet.photos', 'pet.publishedAdoption.homeProfile', 'homeProfile'])
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $tab = $filters['tab'] ?? 'all';
        if ($tab === 'pet' || $tab === 'human') {
            $query->where('role', $tab);
        } elseif ($tab === 'alumni') {
            $query->where('role', Role::Pet->value)
                ->whereHas('pet', fn ($p) => $p->where('status', PetStatus::AdoptedHired->value));
        }

        if (isset($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(function ($sub) use ($like): void {
                    $sub->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhereHas('pet', fn ($p) => $p->where('name', 'like', $like))
                        ->orWhereHas('homeProfile', fn ($h) => $h->where('full_name', 'like', $like));
                });
            }
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (User $account) => $this->formatAccountSummary($account));
    }

    public function show(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::notFound('Account not found.')->toResponse($request);
        }

        $account->load([
            'pet.photos',
            'pet.publishedAdoption.homeProfile',
            'homeProfile',
            'accountActions.performedBy',
            'detailChangeRequests.reviewedBy',
        ]);

        $recentLogs = ActivityLog::query()
            ->where(function ($q) use ($account): void {
                $q->where('actor_user_id', $account->id)
                    ->orWhere(function ($sub) use ($account): void {
                        $sub->where('subject_type', User::class)
                            ->where('subject_id', $account->id);
                    });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'type' => $log->type,
                'action' => $log->action,
                'before_value' => $log->before_value,
                'after_value' => $log->after_value,
                'reason' => $log->reason,
                'created_at' => $log->created_at?->toISOString(),
            ])
            ->values()
            ->all();

        $data = $this->formatAccountSummary($account);
        $data['account_actions'] = $account->accountActions
            ->sortByDesc('created_at')
            ->map(fn (AccountAction $aa) => [
                'id' => $aa->id,
                'action' => $aa->getAction()->value,
                'reason' => $aa->reason,
                'performed_by' => $aa->performedBy?->displayName(),
                // The owner closing their own account, rather than an admin acting on it.
                'by_owner' => $aa->performed_by_user_id === $aa->user_id,
                'created_at' => $aa->created_at?->toISOString(),
            ])
            ->values()
            ->all();
        $data['verification'] = $this->formatVerification($account);
        $data['requests'] = $this->formatRequests($account);
        $data['reports_against'] = $this->formatReportsAgainst($account);
        $data['reports_against_count'] = $data['reports_against']['total'];
        $data['detail_change_requests'] = $account->detailChangeRequests
            ->sortByDesc('created_at')
            ->map(fn (DetailChangeRequest $cr) => $this->formatChangeRequest($cr, $account))
            ->values()
            ->all();
        $data['recent_activity'] = $recentLogs;

        return ResponseResource::make($data);
    }

    public function suspend(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::forbidden('Admin accounts cannot be suspended.')->toResponse($request);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Enter a reason for suspending the account.',
        ]);

        if ($account->isSuspended()) {
            return ErrorResource::conflict('This account is already suspended.', 'already_suspended')->toResponse($request);
        }

        // Pending and Denied accounts are decided in Verification, and a deactivated one is already closed.
        if (! $account->isActive()) {
            return ErrorResource::conflict('Only an Active account can be suspended.', 'cannot_suspend')->toResponse($request);
        }

        $admin = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(fn () => $this->suspendAccount->handle($account, $admin, $reason, userAgent: $request->userAgent()));

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'pet.publishedAdoption.homeProfile', 'homeProfile'])));
    }

    public function reactivate(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::notFound('Account not found.')->toResponse($request);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Enter a log note for reactivating the account.',
        ]);

        // A deactivated account stays closed: its owner or an admin removed it (proposal §5.1).
        if (! $account->isSuspended()) {
            return ErrorResource::conflict('Only a suspended account can be reactivated.', 'not_suspended')->toResponse($request);
        }

        $admin = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(function () use ($account, $admin, $reason, $request): void {
            $beforeStatus = $account->getStatus()->value;

            $account->status = AccountStatus::Active;
            $account->save();

            $aa = new AccountAction;
            $aa->user_id = $account->id;
            $aa->performed_by_user_id = $admin->id;
            $aa->action = AccountActionEnum::Reactivate->value;
            $aa->reason = $reason;
            $aa->save();

            $this->notifications->store(
                recipient: $account,
                type: NotificationType::AccountAction->value,
                title: 'Your account has been reactivated',
                body: 'Your Pawfolio account is Active again.',
                data: [
                    'category' => 'Account',
                    'action' => 'reactivate',
                ],
                urgency: 'info',
                actionUrl: '/me',
            );

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'account_reactivated',
                actor: $admin,
                subject: $account,
                before: $beforeStatus,
                after: AccountStatus::Active->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        });

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'pet.publishedAdoption.homeProfile', 'homeProfile'])));
    }

    public function deactivate(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::forbidden('Admin accounts cannot be deactivated here.')->toResponse($request);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Enter a reason for deactivating the account.',
        ]);

        if ($account->isDeactivated()) {
            return ErrorResource::conflict('This account is already deactivated.', 'already_deactivated')->toResponse($request);
        }

        $admin = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(fn () => $this->deactivateAccount->handle(
            $account->load(['pet', 'homeProfile']),
            $admin,
            $reason,
            'account_deactivated',
            $request->userAgent(),
        ));

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'pet.publishedAdoption.homeProfile', 'homeProfile'])));
    }

    public function changeRequestsIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        $status = $request->string('status', DetailChangeRequestStatus::Pending->value)->toString();

        $query = DetailChangeRequest::query()
            ->with(['user.pet', 'user.homeProfile', 'reviewedBy'])
            ->orderByDesc('created_at');

        if (DetailChangeRequestStatus::tryFrom($status) !== null) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (DetailChangeRequest $cr) => [
            'user_id' => $cr->user_id,
            'user_display_name' => $cr->user?->displayName(),
            'user_role' => $cr->user?->getRole()->value,
            ...$this->formatChangeRequest($cr, $cr->user),
        ]);
    }

    /**
     * The supporting document of a change request (AC-03), read with the admin's session: the file itself, never a
     * link to it (SEC-PRIV-01). Only a JPG, PNG or PDF is ever stored; anything else answers like a missing file.
     */
    public function changeRequestDocument(DetailChangeRequest $changeRequest): Response
    {
        $path = $changeRequest->document_path;
        $mime = $path !== null && Storage::disk('local')->exists($path) ? Storage::disk('local')->mimeType($path) : null;

        if ($path === null || ! is_string($mime) || ! array_key_exists($mime, FileUploadService::DOCUMENT_MIMES)) {
            abort(404, "We couldn't find that document.");
        }

        return response(Storage::disk('local')->get($path), 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function reviewChangeRequest(Request $request, DetailChangeRequest $changeRequest)
    {
        $admin = $request->user();

        $validated = $request->validate([
            'decision' => ['required', 'string', Rule::in([
                DetailChangeRequestStatus::Approved->value,
                DetailChangeRequestStatus::Denied->value,
            ])],
            // A denial says why (SEC-AUTHZ-07); an approval may add a note.
            'reason' => ['nullable', 'required_if:decision,'.DetailChangeRequestStatus::Denied->value, 'string', 'max:1000'],
        ], [
            'reason.required_if' => 'Enter a reason for denying the change. The owner reads it.',
        ]);

        if ($changeRequest->status !== DetailChangeRequestStatus::Pending->value) {
            return ErrorResource::conflict('This change request has already been reviewed.', 'already_reviewed')->toResponse($request);
        }

        $decision = DetailChangeRequestStatus::from($validated['decision']);
        $changeRequest->load(['user.pet', 'user.homeProfile']);
        $owner = $changeRequest->user;

        DB::transaction(function () use ($changeRequest, $decision, $admin, $owner, $validated, $request): void {
            $beforeValue = null;

            if ($decision === DetailChangeRequestStatus::Approved && $owner) {
                if ($owner->isPet() && $owner->pet) {
                    $pet = $owner->pet;
                    $field = $changeRequest->field;
                    $beforeValue = (string) ($pet->{$field} ?? '');

                    if ($field === 'approximate_age_months') {
                        $pet->approximate_age_months = (int) $changeRequest->new_value;
                    } elseif (in_array($field, ['name', 'species', 'breed'], true)) {
                        $pet->{$field} = $changeRequest->new_value;
                    }
                    $pet->save();

                    if ($field === 'name') {
                        $owner->name = $changeRequest->new_value;
                        $owner->save();
                    }
                } elseif ($owner->isHuman() && $owner->homeProfile) {
                    $home = $owner->homeProfile;
                    $field = $changeRequest->field;
                    $beforeValue = (string) ($home->{$field} ?? '');

                    if (in_array($field, ['full_name', 'birthdate', 'city', 'province'], true)) {
                        $home->{$field} = $changeRequest->new_value;
                        $home->save();
                    }

                    if ($field === 'full_name') {
                        $owner->name = $changeRequest->new_value;
                        $owner->save();
                    }
                }
            }

            $changeRequest->status = $decision->value;
            $changeRequest->reviewed_by_user_id = $admin->id;
            $changeRequest->reviewed_at = now();
            $changeRequest->save();

            if ($owner) {
                $label = self::FIELD_LABELS[$changeRequest->field] ?? 'detail';
                $this->notifications->store(
                    recipient: $owner,
                    type: NotificationType::AccountAction->value,
                    title: $decision === DetailChangeRequestStatus::Approved
                        ? "Your {$label} was changed"
                        : "Your request to change your {$label} was denied",
                    body: $decision === DetailChangeRequestStatus::Approved
                        ? "An admin approved your request. Your {$label} is updated."
                        : trim("An admin denied your request to change your {$label}. ".($validated['reason'] ?? '')),
                    data: [
                        'category' => 'Account',
                        'change_request_id' => $changeRequest->id,
                        'link' => '/settings',
                    ],
                    urgency: 'info',
                    actionUrl: '/settings',
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: "detail_change_{$decision->value}",
                actor: $admin,
                subject: $changeRequest,
                before: $beforeValue,
                after: $changeRequest->new_value,
                reason: $validated['reason'] ?? $changeRequest->reason,
                userAgent: $request->userAgent(),
            );
        });

        if ($decision === DetailChangeRequestStatus::Approved && $owner) {
            if ($owner->isPet() && $owner->pet) {
                $this->matcher->recalculateForPet($owner->pet->fresh());
            } elseif ($owner->isHuman() && $owner->homeProfile) {
                $this->matcher->recalculateForHome($owner->homeProfile->fresh());
            }
        }

        return ResponseResource::make($this->formatChangeRequest($changeRequest->fresh(['reviewedBy']), $owner?->fresh(['pet', 'homeProfile'])));
    }

    /**
     * A change request as an admin reads it: what the account says now, what is asked for, and why.
     *
     * @return array<string, mixed>
     */
    private function formatChangeRequest(DetailChangeRequest $cr, ?User $owner): array
    {
        $profile = $owner?->isPet() ? $owner->pet : $owner?->homeProfile;
        $current = $profile?->{$cr->field};

        return [
            'id' => $cr->id,
            'field' => $cr->field,
            'current_value' => $current instanceof \DateTimeInterface ? $current->format('Y-m-d') : ($current === null ? null : (string) $current),
            'new_value' => $cr->new_value,
            'reason' => $cr->reason,
            'status' => $cr->status,
            'has_document' => $cr->document_path !== null,
            'reviewed_by' => $cr->reviewedBy?->displayName(),
            'reviewed_at' => $cr->reviewed_at?->toISOString(),
            'created_at' => $cr->created_at?->toISOString(),
        ];
    }

    /**
     * The account's latest verification round, without the files: the review page shows those (AU-23, AU-24).
     *
     * @return array<string, mixed>|null
     */
    private function formatVerification(User $account): ?array
    {
        /** @var VerificationSubmission|null $submission */
        $submission = $account->verificationSubmissions()
            ->with(['documents', 'reviewedBy'])
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->first();

        if ($submission === null) {
            return null;
        }

        return [
            'status' => $submission->status,
            'submitted_at' => $submission->submitted_at?->toISOString(),
            'reviewed_at' => $submission->reviewed_at?->toISOString(),
            'reviewed_by' => $submission->reviewedBy?->displayName(),
            'documents' => $submission->documents
                ->map(fn ($document) => ['id' => $document->id, 'type' => $document->documentType()->value])
                ->values()
                ->all(),
        ];
    }

    /**
     * The account's adoption requests, newest first: sent by a pet, received by a human (AC-07).
     *
     * @return list<array<string, mixed>>
     */
    private function formatRequests(User $account): array
    {
        $petId = $account->pet?->id;
        $homeId = $account->homeProfile?->id;
        if ($petId === null && $homeId === null) {
            return [];
        }

        return AdoptionRequest::query()
            ->with(['pet', 'homeProfile'])
            ->where(fn ($q) => $q->where('pet_id', $petId ?? 0)->orWhere('home_profile_id', $homeId ?? 0))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (AdoptionRequest $ar) => [
                'id' => $ar->id,
                'pet_name' => $ar->pet?->name,
                'home_name' => $ar->homeProfile?->full_name,
                'status' => $ar->getStatus()->value,
                'created_at' => $ar->created_at?->toISOString(),
            ])
            ->values()
            ->all();
    }

    /**
     * How often the account was reported, and the latest reports against it (AC-07).
     *
     * @return array{total: int, open: int, latest: list<array<string, mixed>>}
     */
    private function formatReportsAgainst(User $account): array
    {
        $reports = Report::query()->where('reported_user_id', $account->id);

        return [
            'total' => (clone $reports)->count(),
            'open' => (clone $reports)->open()->count(),
            'latest' => (clone $reports)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn (Report $report) => [
                    'id' => $report->id,
                    'target_type' => $report->target_type,
                    'reason' => $report->reason,
                    'status' => $report->status,
                    'created_at' => $report->created_at?->toISOString(),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAccountSummary(User $account): array
    {
        return [
            'id' => $account->id,
            'role' => $account->getRole()->value,
            'status' => $account->getStatus()->value,
            'email' => $account->email,
            'display_name' => $account->displayName(),
            'avatar_url' => $account->avatarUrl(),
            'profile_id' => $account->profileId(),
            'pet' => $account->pet ? PetResource::summary($account->pet) : null,
            'home_profile' => $account->homeProfile ? HomeProfileResource::summary($account->homeProfile) : null,
            // Who answers for a pet account. Admins only (SEC-PRIV-02); no number or address here.
            'caretaker_name' => $account->pet?->caretaker_name,
            // An adopted pet's Furparent, for the Alumni tab (AC-06).
            'adoption' => ($adoption = $account->pet?->publishedAdoption) ? [
                'id' => $adoption->id,
                'furparent_name' => $adoption->homeProfile?->full_name,
                'adopted_at' => $adoption->adopted_at?->toISOString(),
            ] : null,
            'created_at' => $account->created_at?->toISOString(),
        ];
    }
}
