<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Accounts;

use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\DetailChangeRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResponseResource;
use App\Models\AccountAction;
use App\Models\AdoptionRequest;
use App\Models\DetailChangeRequest;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Uploads\FileUploadService;
use App\Support\PasswordRules;
use App\Support\Provinces;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Member account settings, contact info, notification preferences, password change, self-deactivation, and locked-field change requests (BE-23, AC-01..AC-05).
 */
class SettingsController extends Controller
{
    private const PET_LOCKED_FIELDS = ['name', 'species', 'breed', 'approximate_age_months'];

    private const HUMAN_LOCKED_FIELDS = ['full_name', 'birthdate', 'city', 'province'];

    public function __construct(
        private readonly FileUploadService $uploads,
    ) {}

    public function show(Request $request)
    {
        $user = $request->user()->load(['pet', 'homeProfile', 'notificationPreference', 'detailChangeRequests']);
        $preference = $user->notificationPreference ?? $user->createNotificationPreference();

        $lockedDetails = [];
        $contactDetails = [];

        if ($user->isPet() && $user->pet) {
            $lockedDetails = [
                'name' => $user->pet->name,
                'species' => $user->pet->species,
                'breed' => $user->pet->breed,
                'approximate_age_months' => (int) $user->pet->approximate_age_months,
            ];
            $contactDetails = [
                'caretaker_name' => $user->pet->caretaker_name,
                'caretaker_contact_number' => $user->pet->caretaker_contact_number,
                'currently_at' => $user->pet->currently_at,
                'city' => $user->pet->city,
                'province' => $user->pet->province,
            ];
        } elseif ($user->isHuman() && $user->homeProfile) {
            $lockedDetails = [
                'full_name' => $user->homeProfile->full_name,
                'birthdate' => $user->homeProfile->birthdate instanceof CarbonInterface
                    ? $user->homeProfile->birthdate->format('Y-m-d')
                    : (string) ($user->homeProfile->birthdate ?? ''),
                'city' => $user->homeProfile->city,
                'province' => $user->homeProfile->province,
            ];
            $contactDetails = [
                'contact_number' => $user->homeProfile->contact_number,
                'street_address' => $user->homeProfile->street_address,
                'city' => $user->homeProfile->city,
                'province' => $user->homeProfile->province,
            ];
        }

        return ResponseResource::make([
            'account' => [
                'id' => $user->id,
                'role' => $user->getRole()->value,
                'status' => $user->getStatus()->value,
                'email' => $user->email,
                'display_name' => $user->displayName(),
            ],
            'locked_details' => $lockedDetails,
            'contact_details' => $contactDetails,
            'notification_preferences' => [
                'requests_and_invites' => $preference->shouldRequestAndInvite(),
                'meet_and_greets' => $preference->shouldMeetAndGreet(),
                'post_activity' => $preference->shouldPostActivity(),
                'announcements' => $preference->shouldAnnouncements(),
            ],
            'change_requests' => $user->detailChangeRequests
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
                ->all(),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'caretaker_name' => ['sometimes', 'required', 'string', 'max:120'],
            'caretaker_contact_number' => ['sometimes', 'required', 'string', 'max:32'],
            'contact_number' => ['sometimes', 'required', 'string', 'max:32'],
            'street_address' => ['sometimes', 'required', 'string', 'max:255'],
            'notification_preferences' => ['sometimes', 'array'],
            'notification_preferences.requests_and_invites' => ['sometimes', 'boolean'],
            'notification_preferences.meet_and_greets' => ['sometimes', 'boolean'],
            'notification_preferences.post_activity' => ['sometimes', 'boolean'],
            'notification_preferences.announcements' => ['sometimes', 'boolean'],
            'requests_and_invites' => ['sometimes', 'boolean'],
            'meet_and_greets' => ['sometimes', 'boolean'],
            'post_activity' => ['sometimes', 'boolean'],
            'announcements' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['caretaker_contact_number']) && ! Provinces::isValidContactNumber($validated['caretaker_contact_number'])) {
            throw ValidationException::withMessages([
                'caretaker_contact_number' => ['Enter a valid Philippine mobile number, like 0917 123 4567.'],
            ]);
        }

        if (isset($validated['contact_number']) && ! Provinces::isValidContactNumber($validated['contact_number'])) {
            throw ValidationException::withMessages([
                'contact_number' => ['Enter a valid Philippine mobile number, like 0917 123 4567.'],
            ]);
        }

        DB::transaction(function () use ($user, $validated, $request): void {
            if ($user->isPet() && $user->pet) {
                if (isset($validated['caretaker_name'])) {
                    $user->pet->caretaker_name = trim($validated['caretaker_name']);
                }
                if (isset($validated['caretaker_contact_number'])) {
                    $user->pet->caretaker_contact_number = Provinces::normalizeContactNumber($validated['caretaker_contact_number']);
                }
                $user->pet->save();
            } elseif ($user->isHuman() && $user->homeProfile) {
                if (isset($validated['contact_number'])) {
                    $user->homeProfile->contact_number = Provinces::normalizeContactNumber($validated['contact_number']);
                }
                if (isset($validated['street_address'])) {
                    $user->homeProfile->street_address = trim($validated['street_address']);
                }
                $user->homeProfile->save();
            }

            $prefPayload = $validated['notification_preferences'] ?? [];
            foreach (['requests_and_invites', 'meet_and_greets', 'post_activity', 'announcements'] as $key) {
                if (array_key_exists($key, $validated)) {
                    $prefPayload[$key] = (bool) $validated[$key];
                }
            }

            if ($prefPayload !== []) {
                $preference = $user->notificationPreference ?? $user->createNotificationPreference();
                $preference->update($prefPayload);
            }

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'account_settings_updated',
                actor: $user,
                subject: $user,
                userAgent: $request->userAgent(),
            );
        });

        return $this->show($request);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        $request->validate(
            array_merge(
                ['current_password' => ['required', 'string']],
                PasswordRules::rules('password'),
            ),
            array_merge(
                ['current_password.required' => 'Enter your current password.'],
                PasswordRules::messages('password'),
            ),
        );

        if (! Hash::check($request->string('current_password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        $user->password = Hash::make($request->string('password')->toString());
        $user->save();

        // Sign out other devices while preserving the current session if present (AC-04).
        $currentSessionId = $request->hasSession() ? $request->session()->getId() : null;
        $sessionQuery = DB::table(config('session.table', 'sessions'))->where('user_id', $user->id);
        if ($currentSessionId) {
            $sessionQuery->where('id', '!=', $currentSessionId);
        }
        $sessionQuery->delete();
        $user->tokens()->delete();

        ActivityLogger::log(
            type: ActivityLogType::Security,
            action: 'password_changed',
            actor: $user,
            subject: $user,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::make(['password_changed' => true]);
    }

    public function deactivate(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], [
            'password.required' => 'Enter your password to confirm deactivating your account.',
        ]);

        if (! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Your password is incorrect.'],
            ]);
        }

        DB::transaction(function () use ($user, $validated, $request): void {
            $beforeStatus = $user->getStatus()->value;
            $reason = isset($validated['reason']) && trim($validated['reason']) !== ''
                ? trim($validated['reason'])
                : 'Closed by account owner';

            $user->status = AccountStatus::Deactivated;
            $user->save();

            $action = new AccountAction;
            $action->user_id = $user->id;
            $action->performed_by_user_id = $user->id;
            $action->action = AccountActionEnum::Deactivate->value;
            $action->reason = $reason;
            $action->save();

            if ($user->pet) {
                AdoptionRequest::query()
                    ->where('pet_id', $user->pet->id)
                    ->open()
                    ->update([
                        'status' => AdoptionRequestStatus::Closed->value,
                        'closed_at' => now(),
                        'expires_at' => null,
                    ]);
            }

            if ($user->homeProfile) {
                $user->homeProfile->is_open_to_adopt = false;
                $user->homeProfile->save();

                AdoptionRequest::query()
                    ->where('home_profile_id', $user->homeProfile->id)
                    ->open()
                    ->update([
                        'status' => AdoptionRequestStatus::Closed->value,
                        'closed_at' => now(),
                        'expires_at' => null,
                    ]);
            }

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'account_deactivated_by_owner',
                actor: $user,
                subject: $user,
                before: $beforeStatus,
                after: AccountStatus::Deactivated->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        });

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
        DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
        $user->tokens()->delete();

        return ResponseResource::make(['deactivated' => true]);
    }

    public function storeChangeRequest(Request $request)
    {
        $user = $request->user();
        $allowedFields = $user->isPet() ? self::PET_LOCKED_FIELDS : self::HUMAN_LOCKED_FIELDS;

        $validated = $request->validate([
            'field' => ['required', 'string', Rule::in($allowedFields)],
            'new_value' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:1000'],
            'document' => ['nullable', 'file'],
        ]);

        $documentPath = null;
        if ($request->hasFile('document') && $request->file('document') instanceof UploadedFile) {
            $stored = $this->uploads->storePrivateDocument($request->file('document'), 'verification/change-requests', 'document');
            $documentPath = $stored['file_path'];
        }

        $cr = new DetailChangeRequest;
        $cr->user_id = $user->id;
        $cr->field = $validated['field'];
        $cr->new_value = trim($validated['new_value']);
        $cr->reason = trim($validated['reason']);
        $cr->document_path = $documentPath;
        $cr->status = DetailChangeRequestStatus::Pending->value;
        $cr->save();

        ActivityLogger::log(
            type: ActivityLogType::Account,
            action: 'detail_change_requested',
            actor: $user,
            subject: $cr,
            after: "{$cr->field} -> {$cr->new_value}",
            reason: $cr->reason,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::created([
            'id' => $cr->id,
            'field' => $cr->field,
            'new_value' => $cr->new_value,
            'reason' => $cr->reason,
            'status' => $cr->status,
            'created_at' => $cr->created_at?->toISOString(),
        ]);
    }
}
