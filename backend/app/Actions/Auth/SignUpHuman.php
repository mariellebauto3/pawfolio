<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\Role;
use App\Enums\VerificationDocumentType;
use App\Enums\VerificationSubmissionStatus;
use App\Http\Requests\Auth\SignUpHumanRequest;
use App\Models\HomeProfile;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Uploads\FileUploadService;
use App\Support\Provinces;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SignUpHuman
{
    public function __construct(
        private readonly FileUploadService $uploads,
    ) {}

    public function __invoke(SignUpHumanRequest $request): User
    {
        /** @var UploadedFile $validIdFile */
        $validIdFile = $request->file('valid_id');
        $storedValidId = $this->uploads->storePrivateDocument($validIdFile, 'verification/ids', 'valid_id');

        $user = DB::transaction(function () use ($request, $storedValidId): User {
            $user = new User;
            $user->name = $request->string('full_name')->toString();
            $user->email = mb_strtolower(trim($request->string('email')->toString()));
            $user->password = Hash::make($request->string('password')->toString());
            $user->role = Role::Human;
            $user->status = AccountStatus::PendingVerification;
            $user->terms_accepted_at = now();
            $user->save();

            $homeProfile = new HomeProfile;
            $homeProfile->user_id = $user->id;
            $homeProfile->full_name = $request->string('full_name')->toString();
            $homeProfile->birthdate = $request->string('birthdate')->toString();
            $homeProfile->contact_number = Provinces::normalizeContactNumber(
                $request->string('contact_number')->toString(),
            );
            $homeProfile->city = $request->string('city')->toString();
            $homeProfile->province = $request->string('province')->toString();
            $homeProfile->street_address = $request->string('street_address')->toString();
            $homeProfile->is_open_to_adopt = false;
            $homeProfile->save();

            $submission = new VerificationSubmission;
            $submission->user_id = $user->id;
            $submission->status = VerificationSubmissionStatus::Pending->value;
            $submission->submitted_at = now();
            $submission->save();

            $submission->documents()->create([
                'document_type' => VerificationDocumentType::ValidId->value,
                'id_type' => $request->string('id_type')->toString(),
                'file_path' => $storedValidId['file_path'],
                'mime_type' => $storedValidId['mime_type'],
                'size_bytes' => $storedValidId['size_bytes'],
            ]);

            $user->createNotificationPreference();

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'signed_up',
                actor: $user,
                subject: $user,
                before: null,
                after: AccountStatus::PendingVerification->value,
                userAgent: $request->userAgent(),
            );

            return $user;
        });

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return $user->load(['pet', 'homeProfile']);
    }
}
