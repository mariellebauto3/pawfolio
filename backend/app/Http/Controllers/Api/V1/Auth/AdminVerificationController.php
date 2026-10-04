<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\DenialReason;
use App\Enums\Role;
use App\Enums\VerificationSubmissionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\User;
use App\Models\VerificationDocument;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Admin verification queue, account review, private document streaming, and approve/deny actions (BE-08, AU-22..AU-26).
 */
class AdminVerificationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        $roleFilter = $request->query('role');
        $statusFilter = $request->query('status', 'pending');
        $search = is_string($request->query('q')) ? trim($request->query('q')) : '';

        $query = User::query()
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->with(['pet', 'homeProfile', 'verificationSubmissions.documents']);

        if (is_string($roleFilter) && in_array($roleFilter, [Role::Pet->value, Role::Human->value], true)) {
            $query->where('role', $roleFilter);
        }

        if ($statusFilter === 'pending') {
            $query->where('status', AccountStatus::PendingVerification->value);
        } elseif ($statusFilter === 'denied') {
            $query->where('status', AccountStatus::Denied->value);
        } elseif ($statusFilter === 'approved') {
            $query->where('status', AccountStatus::Active->value);
        }

        if ($search !== '') {
            $like = '%'.mb_strtolower($search).'%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like])
                    ->orWhereHas('pet', function ($petQ) use ($like) {
                        $petQ->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(caretaker_name) LIKE ?', [$like]);
                    })
                    ->orWhereHas('homeProfile', function ($homeQ) use ($like) {
                        $homeQ->whereRaw('LOWER(full_name) LIKE ?', [$like]);
                    });
            });
        }

        // Oldest submission first (AU-22).
        $query->orderByRaw('(SELECT MAX(submitted_at) FROM verification_submissions WHERE verification_submissions.user_id = users.id) ASC')
            ->orderBy('id', 'asc');

        $paginator = $query->paginate($perPage);

        $items = collect($paginator->items())->map(fn (User $account) => $this->formatVerificationAccount($account))->all();

        return ResponseResource::paginated($paginator, $items);
    }

    public function show(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::notFound('Verification account not found.')->toResponse($request);
        }

        $account->load(['pet', 'homeProfile', 'verificationSubmissions.documents', 'verificationSubmissions.reviewedBy']);

        // Queue position among pending accounts (AU-23, AU-24).
        $pendingIds = User::query()
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->where('status', AccountStatus::PendingVerification->value)
            ->orderByRaw('(SELECT MAX(submitted_at) FROM verification_submissions WHERE verification_submissions.user_id = users.id) ASC')
            ->orderBy('id', 'asc')
            ->pluck('id')
            ->values();

        $index = $pendingIds->search($account->id);
        $position = $index !== false ? $index + 1 : null;
        $nextId = ($index !== false && $pendingIds->count() > 1)
            ? $pendingIds->get(($index + 1) % $pendingIds->count())
            : null;

        $payload = $this->formatVerificationAccount($account, includeFullDetails: true);
        $payload['queue'] = [
            'position' => $position,
            'total_pending' => $pendingIds->count(),
            'next_account_id' => $nextId,
        ];

        return ResponseResource::make($payload);
    }

    public function streamDocument(Request $request, VerificationDocument $document)
    {
        $disk = Storage::disk('local')->exists($document->file_path)
            ? 'local'
            : (Storage::disk('public')->exists($document->file_path) ? 'public' : null);

        if ($disk === null) {
            return ErrorResource::notFound('Document file not found.')->toResponse($request);
        }

        $contents = Storage::disk($disk)->get($document->file_path);
        $filename = basename($document->file_path);

        return response($contents, 200, [
            'Content-Type' => $document->mime_type,
            'Content-Length' => (string) strlen($contents),
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    public function approve(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::notFound('Account not found.')->toResponse($request);
        }

        $submission = $account->verificationSubmissions()
            ->where('status', VerificationSubmissionStatus::Pending->value)
            ->latest('id')
            ->first();

        if (! $submission || ! $account->isPendingVerification()) {
            return ErrorResource::conflict(
                'This account is not awaiting verification approval.',
                'not_pending_verification',
            )->toResponse($request);
        }

        /** @var User $admin */
        $admin = $request->user();
        $reason = is_string($request->input('reason')) && trim($request->input('reason')) !== ''
            ? trim($request->input('reason'))
            : 'Documents complete';

        DB::transaction(function () use ($account, $submission, $admin, $reason, $request): void {
            $beforeStatus = $account->getStatus()->value;

            $submission->status = VerificationSubmissionStatus::Approved->value;
            $submission->reviewed_by_user_id = $admin->id;
            $submission->reviewed_at = now();
            $submission->save();

            $account->status = AccountStatus::Active;
            $account->email_verified_at = $account->email_verified_at ?? now();
            $account->save();

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'account_approved',
                actor: $admin,
                subject: $account,
                before: $beforeStatus,
                after: AccountStatus::Active->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );

            $body = $account->isPet()
                ? 'Welcome to Pawfolio! Complete your résumé to go live.'
                : 'Welcome to Pawfolio! Complete your Home Profile and lifestyle quiz to start matching.';

            $this->notifications->store(
                recipient: $account,
                type: 'verification_approved',
                title: 'Account approved',
                body: $body,
                data: [
                    'category' => 'Account',
                    'title' => 'Account approved',
                    'message' => $body,
                    'link' => '/me',
                ],
                urgency: 'info',
                actionUrl: '/me',
            );
        });

        $account->load(['pet', 'homeProfile', 'verificationSubmissions.documents']);

        return ResponseResource::make($this->formatVerificationAccount($account, includeFullDetails: true));
    }

    public function deny(Request $request, User $account)
    {
        if ($account->isAdmin()) {
            return ErrorResource::notFound('Account not found.')->toResponse($request);
        }

        $denialReasons = array_map(fn (DenialReason $r) => $r->value, DenialReason::cases());
        $validated = $request->validate([
            'denial_reason' => ['required', 'string', Rule::in($denialReasons)],
            'message_to_owner' => ['required', 'string', 'max:1000'],
        ], [
            'denial_reason.required' => 'Choose a reason for denying the account.',
            'denial_reason.in' => 'Choose a valid denial reason.',
            'message_to_owner.required' => 'Enter a message explaining what the owner needs to fix.',
        ]);

        $submission = $account->verificationSubmissions()
            ->where('status', VerificationSubmissionStatus::Pending->value)
            ->latest('id')
            ->first();

        if (! $submission || ! $account->isPendingVerification()) {
            return ErrorResource::conflict(
                'This account is not awaiting verification review.',
                'not_pending_verification',
            )->toResponse($request);
        }

        /** @var User $admin */
        $admin = $request->user();

        DB::transaction(function () use ($account, $submission, $admin, $validated, $request): void {
            $beforeStatus = $account->getStatus()->value;

            $submission->status = VerificationSubmissionStatus::Denied->value;
            $submission->reviewed_by_user_id = $admin->id;
            $submission->reviewed_at = now();
            $submission->denial_reason = $validated['denial_reason'];
            $submission->message_to_owner = trim($validated['message_to_owner']);
            $submission->save();

            $account->status = AccountStatus::Denied;
            $account->save();

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'account_denied',
                actor: $admin,
                subject: $account,
                before: $beforeStatus,
                after: AccountStatus::Denied->value,
                reason: $validated['denial_reason'].': '.trim($validated['message_to_owner']),
                userAgent: $request->userAgent(),
            );

            $this->notifications->store(
                recipient: $account,
                type: 'verification_denied',
                title: 'Verification update needed',
                body: trim($validated['message_to_owner']),
                data: [
                    'category' => 'Account',
                    'title' => 'Verification update needed',
                    'message' => trim($validated['message_to_owner']),
                    'denial_reason' => $validated['denial_reason'],
                    'link' => '/account/edit',
                ],
                urgency: 'warning',
                actionUrl: '/account/edit',
            );
        });

        $account->load(['pet', 'homeProfile', 'verificationSubmissions.documents']);

        return ResponseResource::make($this->formatVerificationAccount($account, includeFullDetails: true));
    }

    /**
     * @return array<string, mixed>
     */
    private function formatVerificationAccount(User $account, bool $includeFullDetails = false): array
    {
        $submissions = $account->verificationSubmissions->sortByDesc('id')->values();
        $latest = $submissions->first();
        $previousDenied = $submissions->skip(1)->firstWhere('status', VerificationSubmissionStatus::Denied->value)
            ?? ($account->isDenied() ? $latest : null);

        $docs = $latest
            ? $latest->documents->map(fn (VerificationDocument $doc) => [
                'id' => $doc->id,
                'document_type' => $doc->document_type,
                'id_type' => $doc->id_type,
                'mime_type' => $doc->mime_type,
                'size_bytes' => (int) $doc->size_bytes,
                'uploaded_at' => ($doc->created_at ?? now())->toISOString(),
                'download_url' => "/api/v1/admin/verification-documents/{$doc->id}",
            ])->values()->all()
            : [];

        $base = [
            'id' => $account->id,
            'role' => $account->getRole()->value,
            'status' => $account->getStatus()->value,
            'email' => $account->email,
            'display_name' => $account->displayName(),
            'submitted_at' => $latest?->submitted_at?->toISOString(),
            'submission_status' => $latest?->status ?? 'pending',
            'is_resubmission' => $submissions->count() > 1,
            'previous_denial' => $previousDenied ? [
                'denial_reason' => $previousDenied->denial_reason,
                'message_to_owner' => $previousDenied->message_to_owner,
                'reviewed_at' => $previousDenied->reviewed_at?->toISOString(),
            ] : null,
            'documents' => $docs,
        ];

        if ($account->isPet()) {
            $pet = $account->pet;
            $base['caretaker_name'] = $pet?->caretaker_name;
            if ($includeFullDetails) {
                $base['details'] = [
                    'role' => 'pet',
                    'name' => $pet?->name,
                    'species' => $pet?->species,
                    'breed' => $pet?->breed,
                    'approximate_age_months' => $pet?->approximate_age_months,
                    'currently_at' => $pet?->currently_at,
                    'city' => $pet?->city,
                    'province' => $pet?->province,
                    'caretaker_name' => $pet?->caretaker_name,
                    'caretaker_contact_number' => $pet?->caretaker_contact_number,
                ];
            }
        } else {
            $home = $account->homeProfile;
            $dob = $home?->birthdate ? Carbon::parse($home->birthdate) : null;
            $ageYears = $dob ? (int) $dob->diffInYears(Carbon::now()) : null;
            if ($includeFullDetails) {
                $base['details'] = [
                    'role' => 'human',
                    'full_name' => $home?->full_name,
                    'birthdate' => $dob?->format('Y-m-d'),
                    'age_years' => $ageYears,
                    'is_18_plus' => $ageYears !== null && $ageYears >= 18,
                    'contact_number' => $home?->contact_number,
                    'city' => $home?->city,
                    'province' => $home?->province,
                    'street_address' => $home?->street_address,
                ];
            }
        }

        return $base;
    }
}
