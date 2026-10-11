<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Profiles;

use App\Enums\ActivityLogType;
use App\Enums\PetEnergyLevel;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetSkill;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetSpecialNeed;
use App\Enums\PetStatus;
use App\Enums\PetTimeAlone;
use App\Enums\PostType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\PetPhoto;
use App\Models\PetVetRecord;
use App\Models\Post;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Uploads\FileUploadService;
use App\Support\Provinces;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Pet owner resume management, photo & vet-record uploads, and publishing (BE-11, PR-01..PR-10).
 *
 * Locked fields (name, species, breed, approximate_age_months) and status cannot be edited here (FR27, SEC-INPUT-04).
 */
class PetResumeController extends Controller
{
    public const MAX_PHOTOS = 10;

    public const MAX_VET_RECORDS = 5;

    public function __construct(
        private readonly FileUploadService $uploads,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function show(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        return ResponseResource::make(
            (new PetResource($pet))->forOwner()->toArray($request),
        );
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        // Reject attempts to change locked fields or status via the resume endpoint (FR27, SEC-INPUT-04, PR-03).
        $validated = $request->validate([
            'sex' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetSex::cases()))],
            'size' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetSize::cases()))],
            'currently_at' => ['sometimes', 'required', 'string', 'max:120'],
            'city' => ['sometimes', 'required', 'string', 'max:80'],
            'province' => ['sometimes', 'required', 'string', Rule::in(Provinces::LIST)],
            'bio' => ['sometimes', 'nullable', 'string', 'min:50', 'max:600'],
            'energy_level' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetEnergyLevel::cases()))],
            'good_with_kids' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetGoodWith::cases()))],
            'good_with_dogs' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetGoodWith::cases()))],
            'good_with_cats' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetGoodWith::cases()))],
            'time_alone' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetTimeAlone::cases()))],
            'space_needs' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetSpaceNeeds::cases()))],
            'experience_needed' => ['sometimes', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, PetExperienceNeeded::cases()))],
            'health_notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'temperament_tags' => ['sometimes', 'array', 'max:5'],
            'temperament_tags.*' => ['required', 'string', 'max:40'],
            'skills' => ['sometimes', 'array', 'max:15'],
            'skills.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, PetSkill::cases()))],
            'special_needs' => ['sometimes', 'array', 'max:5'],
            'special_needs.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, PetSpecialNeed::cases()))],
        ]);

        DB::transaction(function () use ($pet, $validated, $user, $request): void {
            $scalarFields = [
                'sex', 'size', 'currently_at', 'city', 'province',
                'bio', 'energy_level', 'good_with_kids', 'good_with_dogs', 'good_with_cats',
                'time_alone', 'space_needs', 'experience_needed', 'health_notes',
            ];

            foreach ($scalarFields as $field) {
                if (array_key_exists($field, $validated)) {
                    $pet->{$field} = $validated[$field];
                }
            }
            $pet->save();

            if (array_key_exists('temperament_tags', $validated)) {
                $pet->temperamentTags()->delete();
                $tags = array_values(array_unique(array_map('trim', $validated['temperament_tags'])));
                foreach ($tags as $tag) {
                    if ($tag !== '') {
                        $pet->temperamentTags()->create(['tag' => $tag]);
                    }
                }
            }

            if (array_key_exists('skills', $validated)) {
                $pet->skills()->delete();
                $skills = array_values(array_unique($validated['skills']));
                foreach ($skills as $skill) {
                    $pet->skills()->create(['skill' => $skill]);
                }
            }

            if (array_key_exists('special_needs', $validated)) {
                $pet->specialNeeds()->delete();
                $needs = array_values(array_unique($validated['special_needs']));
                foreach ($needs as $need) {
                    $pet->specialNeeds()->create(['need' => $need]);
                }
            }

            ActivityLogger::log(
                type: ActivityLogType::Profile,
                action: 'pet_resume_updated',
                actor: $user,
                subject: $pet,
                userAgent: $request->userAgent(),
            );
        });

        $pet->refresh();
        $this->matcher->recalculateForPet($pet);

        return ResponseResource::make(
            (new PetResource($pet))->forOwner()->toArray($request),
        );
    }

    public function addPhoto(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        $request->validate([
            'photo' => ['required', 'file'],
            'caption' => ['nullable', 'string', 'max:140'],
            'is_primary' => ['sometimes', 'boolean'],
        ]);

        if ($pet->photos()->count() >= self::MAX_PHOTOS) {
            throw ValidationException::withMessages([
                'photo' => ['You can upload up to 10 photos.'],
            ]);
        }

        /** @var UploadedFile $file */
        $file = $request->file('photo');
        $stored = $this->uploads->storePublicPhoto($file, 'pets/photos', 'photo');

        $isPrimary = $request->boolean('is_primary');

        DB::transaction(function () use ($pet, $stored, $request, $isPrimary, $user): void {
            if ($isPrimary) {
                $pet->photos()->increment('sort_order');
                $sortOrder = 1;
            } else {
                $maxOrder = (int) $pet->photos()->max('sort_order');
                $sortOrder = $maxOrder + 1;
            }

            $pet->photos()->create([
                'file_path' => $stored['file_path'],
                'caption' => $request->filled('caption') ? trim($request->string('caption')->toString()) : null,
                'sort_order' => $sortOrder,
            ]);

            ActivityLogger::log(
                type: ActivityLogType::Profile,
                action: 'pet_photo_added',
                actor: $user,
                subject: $pet,
                userAgent: $request->userAgent(),
            );
        });

        return ResponseResource::created(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function reorderPhotos(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        $validated = $request->validate([
            'photo_ids' => ['required', 'array', 'min:1'],
            'photo_ids.*' => ['required', 'integer'],
        ]);

        $ownedPhotos = $pet->photos()->get()->keyBy('id');
        foreach ($validated['photo_ids'] as $id) {
            if (! $ownedPhotos->has((int) $id)) {
                return ErrorResource::notFound('Photo not found.')->toResponse($request);
            }
        }

        DB::transaction(function () use ($validated, $ownedPhotos): void {
            $order = 1;
            foreach ($validated['photo_ids'] as $id) {
                $photo = $ownedPhotos->get((int) $id);
                if ($photo) {
                    $photo->sort_order = $order++;
                    $photo->save();
                }
            }
        });

        return ResponseResource::make(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function deletePhoto(Request $request, PetPhoto $photo)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet || $photo->pet_id !== $pet->id) {
            return ErrorResource::notFound('Photo not found.')->toResponse($request);
        }

        $currentCount = $pet->photos()->count();
        $minAllowed = $pet->getStatusEnum() === PetStatus::Draft ? 1 : 3;

        if ($currentCount <= $minAllowed) {
            return ErrorResource::conflict(
                "A pet resume must keep at least {$minAllowed} photo(s).",
                'minimum_photos_required',
            )->toResponse($request);
        }

        $photo->delete();

        // Resequence sort_order 1..N.
        $remaining = $pet->photos()->orderBy('sort_order')->get();
        foreach ($remaining as $index => $item) {
            $item->sort_order = $index + 1;
            $item->save();
        }

        return ResponseResource::make(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function updateCoverPhoto(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        $request->validate([
            'cover_photo' => ['required', 'file'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('cover_photo');
        $stored = $this->uploads->storePublicPhoto($file, 'pets/covers', 'cover_photo');

        $pet->cover_photo_path = $stored['file_path'];
        $pet->save();

        return ResponseResource::make(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function addVetRecord(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        $request->validate([
            'vet_record' => ['required', 'file'],
        ]);

        if ($pet->vetRecords()->count() >= self::MAX_VET_RECORDS) {
            throw ValidationException::withMessages([
                'vet_record' => ['You can upload up to 5 vet records.'],
            ]);
        }

        /** @var UploadedFile $file */
        $file = $request->file('vet_record');
        $stored = $this->uploads->storePrivateDocument($file, 'pets/vet-records', 'vet_record');

        $pet->vetRecords()->create([
            'file_path' => $stored['file_path'],
            'mime_type' => $stored['mime_type'],
            'size_bytes' => $stored['size_bytes'],
        ]);

        return ResponseResource::created(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function deleteVetRecord(Request $request, PetVetRecord $record)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet || $record->pet_id !== $pet->id) {
            return ErrorResource::notFound('Vet record not found.')->toResponse($request);
        }

        Storage::disk('local')->delete($record->file_path);
        $record->delete();

        return ResponseResource::make(
            (new PetResource($pet->fresh()))->forOwner()->toArray($request),
        );
    }

    public function publish(Request $request)
    {
        $user = $request->user();
        $pet = $user->pet;

        if (! $pet) {
            return ErrorResource::notFound('Pet profile not found.')->toResponse($request);
        }

        $completeness = PetResource::checkCompleteness($pet);
        if (! $completeness['is_complete']) {
            throw ValidationException::withMessages([
                'resume' => $completeness['missing'],
            ]);
        }

        if ($pet->getStatusEnum() === PetStatus::AdoptedHired) {
            return ErrorResource::conflict('An adopted pet cannot be republished.', 'already_adopted')->toResponse($request);
        }

        DB::transaction(function () use ($pet, $user, $request): void {
            $beforeStatus = $pet->getStatusEnum()->value;
            $wasDraft = $pet->getStatusEnum() === PetStatus::Draft;

            if ($wasDraft) {
                $pet->status = PetStatus::LookingForAHome;
                $pet->published_at = $pet->published_at ?? now();
                $pet->save();

                // Automatically create a "For Hire" post on the community feed (PR-10, BE-21).
                $hasForHirePost = Post::query()
                    ->where('author_user_id', $user->id)
                    ->where('type', PostType::ForHire->value)
                    ->whereNull('deleted_at')
                    ->whereNull('removed_at')
                    ->exists();

                if (! $hasForHirePost) {
                    $post = new Post;
                    $post->author_user_id = $user->id;
                    $post->type = PostType::ForHire->value;
                    $post->title = "{$pet->name} is Looking for a Home!";
                    $post->body = "I'm officially #LookingForAHome! Check out my resume to see if we're a match.";
                    $post->save();

                    $firstPhoto = $pet->photos()->orderBy('sort_order')->first();
                    if ($firstPhoto) {
                        $post->photos()->create([
                            'file_path' => $firstPhoto->file_path,
                            'sort_order' => 1,
                        ]);
                    }
                }

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'pet_resume_published',
                    actor: null,
                    subject: $pet,
                    before: $beforeStatus,
                    after: PetStatus::LookingForAHome->value,
                    reason: 'Owner completed and published resume',
                    userAgent: $request->userAgent(),
                );
            }
        });

        $pet->refresh();
        $this->matcher->recalculateForPet($pet);

        return ResponseResource::make(
            (new PetResource($pet))->forOwner()->toArray($request),
        );
    }
}
