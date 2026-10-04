<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\PetStatus;
use App\Enums\Role;
use App\Enums\VerificationDocumentType;
use App\Enums\VerificationSubmissionStatus;
use App\Http\Requests\Auth\SignUpPetRequest;
use App\Models\Pet;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Uploads\FileUploadService;
use App\Support\Provinces;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SignUpPet
{
    public function __construct(
        private readonly FileUploadService $uploads,
    ) {}

    public function __invoke(SignUpPetRequest $request): User
    {
        /** @var list<UploadedFile> $photos */
        $photos = array_values($request->file('photos', []));
        $storedPhotos = [];
        foreach ($photos as $index => $photo) {
            $storedPhotos[] = $this->uploads->storePublicPhoto($photo, 'pets/photos', "photos.{$index}");
        }

        /** @var UploadedFile $validIdFile */
        $validIdFile = $request->file('valid_id');
        $storedValidId = $this->uploads->storePrivateDocument($validIdFile, 'verification/ids', 'valid_id');

        $storedVetRecord = null;
        if ($request->hasFile('vet_record') && $request->file('vet_record') instanceof UploadedFile) {
            $storedVetRecord = $this->uploads->storePrivateDocument(
                $request->file('vet_record'),
                'verification/vet-records',
                'vet_record',
            );
        }

        $user = DB::transaction(function () use ($request, $storedPhotos, $storedValidId, $storedVetRecord): User {
            $user = new User;
            $user->name = $request->string('name')->toString();
            $user->email = mb_strtolower(trim($request->string('email')->toString()));
            $user->password = Hash::make($request->string('password')->toString());
            $user->role = Role::Pet;
            $user->status = AccountStatus::PendingVerification;
            $user->terms_accepted_at = now();
            $user->save();

            $pet = new Pet;
            $pet->user_id = $user->id;
            $pet->name = $request->string('name')->toString();
            $pet->species = $request->string('species')->toString();
            $pet->breed = $request->string('breed')->toString();
            $pet->approximate_age_months = $request->integer('approximate_age_months');
            $pet->currently_at = $request->string('currently_at')->toString();
            $pet->city = $request->string('city')->toString();
            $pet->province = $request->string('province')->toString();
            $pet->caretaker_name = $request->string('caretaker_name')->toString();
            $pet->caretaker_contact_number = Provinces::normalizeContactNumber(
                $request->string('caretaker_contact_number')->toString(),
            );
            $pet->status = PetStatus::Draft;
            $pet->save();

            $submission = new VerificationSubmission;
            $submission->user_id = $user->id;
            $submission->status = VerificationSubmissionStatus::Pending->value;
            $submission->submitted_at = now();
            $submission->save();

            $submission->documents()->create([
                'document_type' => VerificationDocumentType::ValidId->value,
                'id_type' => null,
                'file_path' => $storedValidId['file_path'],
                'mime_type' => $storedValidId['mime_type'],
                'size_bytes' => $storedValidId['size_bytes'],
            ]);

            foreach ($storedPhotos as $idx => $photoMeta) {
                $pet->photos()->create([
                    'file_path' => $photoMeta['file_path'],
                    'caption' => null,
                    'sort_order' => $idx + 1,
                ]);

                $submission->documents()->create([
                    'document_type' => VerificationDocumentType::PetPhoto->value,
                    'id_type' => null,
                    'file_path' => $photoMeta['file_path'],
                    'mime_type' => $photoMeta['mime_type'],
                    'size_bytes' => $photoMeta['size_bytes'],
                ]);
            }

            if ($storedVetRecord !== null) {
                $pet->vetRecords()->create([
                    'file_path' => $storedVetRecord['file_path'],
                    'mime_type' => $storedVetRecord['mime_type'],
                    'size_bytes' => $storedVetRecord['size_bytes'],
                ]);

                $submission->documents()->create([
                    'document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
                    'id_type' => null,
                    'file_path' => $storedVetRecord['file_path'],
                    'mime_type' => $storedVetRecord['mime_type'],
                    'size_bytes' => $storedVetRecord['size_bytes'],
                ]);
            }

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
