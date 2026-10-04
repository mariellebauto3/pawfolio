<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Accounts;

use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\DetailChangeRequestStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Enums\Role;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
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
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin account directory, detail view, suspend/reactivate/deactivate actions, and locked-field change request review (BE-23, AC-03, AC-06..AC-10, FR34).
 */
class AdminAccountController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = User::query()
            ->with(['pet.photos', 'homeProfile'])
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('tab')) {
            $tab = strtolower(trim($request->string('tab')->toString()));
            if ($tab === 'pet') {
                $query->where('role', Role::Pet->value);
            } elseif ($tab === 'human') {
                $query->where('role', Role::Human->value);
            } elseif ($tab === 'alumni') {
                $query->where('role', Role::Pet->value)
                    ->whereHas('pet', fn ($p) => $p->where('status', PetStatus::AdoptedHired->value));
            }
        }

        if ($request->filled('role')) {
            $role = $request->string('role')->toString();
            if (in_array($role, [Role::Pet->value, Role::Human->value], true)) {
                $query->where('role', $role);
            }
        }

        if ($request->filled('status')) {
            $statuses = array_values(array_filter(explode(',', $request->string('status')->toString())));
            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
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
            'homeProfile',
            'accountActions.performedBy',
            'verificationSubmissions.documents',
            'reportsAgainst',
            'detailChangeRequests',
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
            ->limit(20)
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
                'created_at' => $aa->created_at?->toISOString(),
            ])
            ->values()
            ->all();
        $data['reports_against_count'] = $account->reportsAgainst->count();
        $data['detail_change_requests'] = $account->detailChangeRequests
            ->sortByDesc('created_at')
            ->map(fn (DetailChangeRequest $cr) => [
                'id' => $cr->id,
                'field' => $cr->field,
                'new_value' => $cr->new_value,
                'reason' => $cr->reason,
                'status' => $cr->status,
                'reviewed_at' => $cr->reviewed_at?->toISOString(),
                'created_at' => $cr->created_at?->toISOString(),
            ])
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

        $admin = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(function () use ($account, $admin, $reason, $request): void {
            $beforeStatus = $account->getStatus()->value;

            $account->status = AccountStatus::Suspended;
            $account->save();

            $aa = new AccountAction;
            $aa->user_id = $account->id;
            $aa->performed_by_user_id = $admin->id;
            $aa->action = AccountActionEnum::Suspend->value;
            $aa->reason = $reason;
            $aa->save();

            DB::table(config('session.table', 'sessions'))->where('user_id', $account->id)->delete();
            $account->tokens()->delete();

            $this->notifications->store(
                recipient: $account,
                type: NotificationType::AccountAction->value,
                title: 'Your account has been suspended',
                body: $reason,
                data: [
                    'category' => 'Account',
                    'action' => 'suspend',
                    'reason' => $reason,
                ],
                urgency: 'urgent',
            );

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'account_suspended',
                actor: $admin,
                subject: $account,
                before: $beforeStatus,
                after: AccountStatus::Suspended->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        });

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'homeProfile'])));
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

        if (! $account->isSuspended() && ! $account->isDeactivated()) {
            return ErrorResource::conflict('Only a suspended or deactivated account can be reactivated.', 'not_suspended')->toResponse($request);
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

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'homeProfile'])));
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

        DB::transaction(function () use ($account, $admin, $reason, $request): void {
            $beforeStatus = $account->getStatus()->value;

            $account->status = AccountStatus::Deactivated;
            $account->save();

            $aa = new AccountAction;
            $aa->user_id = $account->id;
            $aa->performed_by_user_id = $admin->id;
            $aa->action = AccountActionEnum::Deactivate->value;
            $aa->reason = $reason;
            $aa->save();

            if ($account->pet) {
                AdoptionRequest::query()
                    ->where('pet_id', $account->pet->id)
                    ->open()
                    ->update([
                        'status' => AdoptionRequestStatus::Closed->value,
                        'closed_at' => now(),
                        'expires_at' => null,
                    ]);
            }

            if ($account->homeProfile) {
                $account->homeProfile->is_open_to_adopt = false;
                $account->homeProfile->save();

                $inProcessRequests = AdoptionRequest::query()
                    ->with('pet')
                    ->where('home_profile_id', $account->homeProfile->id)
                    ->inProcess()
                    ->get();

                foreach ($inProcessRequests as $req) {
                    if ($req->pet) {
                        AdoptionRequestController::releasePetFromInProcess($req->pet, 'Counterpart human account deactivated');
                    }
                }

                AdoptionRequest::query()
                    ->where('home_profile_id', $account->homeProfile->id)
                    ->open()
                    ->update([
                        'status' => AdoptionRequestStatus::Closed->value,
                        'closed_at' => now(),
                        'expires_at' => null,
                    ]);
            }

            DB::table(config('session.table', 'sessions'))->where('user_id', $account->id)->delete();
            $account->tokens()->delete();

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'account_deactivated',
                actor: $admin,
                subject: $account,
                before: $beforeStatus,
                after: AccountStatus::Deactivated->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        });

        return ResponseResource::make($this->formatAccountSummary($account->fresh(['pet.photos', 'homeProfile'])));
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
            'id' => $cr->id,
            'user_id' => $cr->user_id,
            'user_display_name' => $cr->user?->displayName(),
            'user_role' => $cr->user?->getRole()->value,
            'field' => $cr->field,
            'new_value' => $cr->new_value,
            'reason' => $cr->reason,
            'status' => $cr->status,
            'reviewed_by' => $cr->reviewedBy?->displayName(),
            'reviewed_at' => $cr->reviewed_at?->toISOString(),
            'created_at' => $cr->created_at?->toISOString(),
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
            'reason' => ['nullable', 'string', 'max:1000'],
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
                $this->notifications->store(
                    recipient: $owner,
                    type: NotificationType::AccountAction->value,
                    title: $decision === DetailChangeRequestStatus::Approved
                        ? "Change request for '{$changeRequest->field}' approved"
                        : "Change request for '{$changeRequest->field}' denied",
                    body: $decision === DetailChangeRequestStatus::Approved
                        ? "Your request to update '{$changeRequest->field}' to '{$changeRequest->new_value}' was approved."
                        : ('Your request to update '.$changeRequest->field.' was denied. '.($validated['reason'] ?? '')),
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

        return ResponseResource::make([
            'id' => $changeRequest->id,
            'field' => $changeRequest->field,
            'new_value' => $changeRequest->new_value,
            'status' => $changeRequest->status,
            'reviewed_at' => $changeRequest->reviewed_at?->toISOString(),
        ]);
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
            'created_at' => $account->created_at?->toISOString(),
        ];
    }
}
