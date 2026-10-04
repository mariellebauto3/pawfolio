<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\VerificationDocumentType;
use App\Enums\VerificationSubmissionStatus;
use App\Http\Requests\Auth\UpdateSubmissionRequest;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Uploads\FileUploadService;
use App\Support\Provinces;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Updates submitted details and resubmits for verification (BE-06, AU-19).
 *
 * Preserves prior verification_submissions rows so admins see previous denial history on AU-24.
 */
class UpdateSubmission
{
    public function __construct(
        private readonly FileUploadService $uploads,
    ) {}

    public function __invoke(UpdateSubmissionRequest $request, User $user): User
    {
        $storedPhotos = [];
        if ($user->isPet() && $request->hasFile('photos')) {
            /** @var list<UploadedFile> $photos */
            $photos = array_values($request->file('photos', []));
            foreach ($photos as $index => $photo) {
                $storedPhotos[] = $this->uploads->storePublicPhoto($photo, 'pets/photos', "photos.{$index}");
            }
        }

        $storedValidId = null;
        if ($request->hasFile('valid_id') && $request->file('valid_id') instanceof UploadedFile) {
            $storedValidId = $this->uploads->storePrivateDocument($request->file('valid_id'), 'verification/ids', 'valid_id');
        }

        $storedVetRecord = null;
        if ($user->isPet() && $request->hasFile('vet_record') && $request->file('vet_record') instanceof UploadedFile) {
            $storedVetRecord = $this->uploads->storePrivateDocument(
                $request->file('vet_record'),
                'verification/vet-records',
                'vet_record',
            );
        }

        DB::transaction(function () use ($request, $user, $storedPhotos, $storedValidId, $storedVetRecord): void {
            $previousStatus = $user->getStatus()->value;

            if ($user->isPet()) {
                $pet = $user->pet;
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
                $pet->save();

                $user->name = $pet->name;

                if (! empty($storedPhotos)) {
                    $pet->photos()->delete();
                    foreach ($storedPhotos as $idx => $photoMeta) {
                        $pet->photos()->create([
                            'file_path' => $photoMeta['file_path'],
                            'caption' => null,
                            'sort_order' => $idx + 1,
                        ]);
                    }
                }

                if ($storedVetRecord !== null) {
                    $pet->vetRecords()->create([
                        'file_path' => $storedVetRecord['file_path'],
                        'mime_type' => $storedVetRecord['mime_type'],
                        'size_bytes' => $storedVetRecord['size_bytes'],
                    ]);
                }
            } else {
                $home = $user->homeProfile;
                $home->full_name = $request->string('full_name')->toString();
                $home->birthdate = $request->string('birthdate')->toString();
                $home->contact_number = Provinces::normalizeContactNumber(
                    $request->string('contact_number')->toString(),
                );
                $home->city = $request->string('city')->toString();
                $home->province = $request->string('province')->toString();
                $home->street_address = $request->string('street_address')->toString();
                $home->save();

                $user->name = $home->full_name;
            }

            $user->status = AccountStatus::PendingVerification;
            $user->save();

            // Create a new VerificationSubmission row so prior submission/denial history is preserved (BE-06, AU-24).
            $previousSubmission = $user->verificationSubmissions()->latest('id')->with('documents')->first();

            $newSubmission = new VerificationSubmission;
            $newSubmission->user_id = $user->id;
            $newSubmission->status = VerificationSubmissionStatus::Pending->value;
            $newSubmission->submitted_at = now();
            $newSubmission->save();

            $existingDocs = $previousSubmission ? $previousSubmission->documents : collect();

            // 1. Valid ID
            $existingValidId = $existingDocs->firstWhere('document_type', VerificationDocumentType::ValidId->value);
            $idType = $request->filled('id_type')
                ? $request->string('id_type')->toString()
                : ($existingValidId?->id_type);

            if ($storedValidId !== null) {
                $newSubmission->documents()->create([
                    'document_type' => VerificationDocumentType::ValidId->value,
                    'id_type' => $user->isHuman() ? $idType : null,
                    'file_path' => $storedValidId['file_path'],
                    'mime_type' => $storedValidId['mime_type'],
                    'size_bytes' => $storedValidId['size_bytes'],
                ]);
            } elseif ($existingValidId !== null) {
                $newSubmission->documents()->create([
                    'document_type' => VerificationDocumentType::ValidId->value,
                    'id_type' => $user->isHuman() ? $idType : null,
                    'file_path' => $existingValidId->file_path,
                    'mime_type' => $existingValidId->mime_type,
                    'size_bytes' => $existingValidId->size_bytes,
                ]);
            }

            // 2. Pet photos & vet records
            if ($user->isPet()) {
                if (! empty($storedPhotos)) {
                    foreach ($storedPhotos as $photoMeta) {
                        $newSubmission->documents()->create([
                            'document_type' => VerificationDocumentType::PetPhoto->value,
                            'id_type' => null,
                            'file_path' => $photoMeta['file_path'],
                            'mime_type' => $photoMeta['mime_type'],
                            'size_bytes' => $photoMeta['size_bytes'],
                        ]);
                    }
                } else {
                    foreach ($existingDocs->where('document_type', VerificationDocumentType::PetPhoto->value) as $doc) {
                        $newSubmission->documents()->create([
                            'document_type' => VerificationDocumentType::PetPhoto->value,
                            'id_type' => null,
                            'file_path' => $doc->file_path,
                            'mime_type' => $doc->mime_type,
                            'size_bytes' => $doc->size_bytes,
                        ]);
                    }
                }

                if ($storedVetRecord !== null) {
                    $newSubmission->documents()->create([
                        'document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
                        'id_type' => null,
                        'file_path' => $storedVetRecord['file_path'],
                        'mime_type' => $storedVetRecord['mime_type'],
                        'size_bytes' => $storedVetRecord['size_bytes'],
                    ]);
                } else {
                    foreach ($existingDocs->where('document_type', VerificationDocumentType::VetRecordOrCertificate->value) as $doc) {
                        $newSubmission->documents()->create([
                            'document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
                            'id_type' => null,
                            'file_path' => $doc->file_path,
                            'mime_type' => $doc->mime_type,
                            'size_bytes' => $doc->size_bytes,
                        ]);
                    }
                }
            }

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'verification_resubmitted',
                actor: $user,
                subject: $user,
                before: $previousStatus,
                after: AccountStatus::PendingVerification->value,
                userAgent: $request->userAgent(),
            );
        });

        return $user->fresh(['pet', 'homeProfile']);
    }
}
