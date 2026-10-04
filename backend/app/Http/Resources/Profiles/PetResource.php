<?php

declare(strict_types=1);

namespace App\Http\Resources\Profiles;

use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\PetPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Public Pet resume resource matching frontend/src/types/pet.ts (BE-11, BE-14, SEC-PRIV-01/02).
 *
 * Caretaker contact number and private vet record files are never included in public views.
 */
class PetResource extends JsonResource
{
    private ?int $matchScore = null;

    /** @var list<string> */
    private array $matchReasons = [];

    private bool $includeOwnerExtras = false;

    private bool $includeConfirmedContact = false;

    public function withMatch(?int $score, array $reasons = []): self
    {
        $this->matchScore = $score;
        $this->matchReasons = $reasons;

        return $this;
    }

    public function withMatchScore(?MatchScore $match): self
    {
        if ($match !== null) {
            $this->matchScore = (int) $match->score;
        }

        return $this;
    }

    public function forOwner(bool $include = true): self
    {
        $this->includeOwnerExtras = $include;

        return $this;
    }

    public function withConfirmedMeetAndGreetContact(bool $include = true): self
    {
        $this->includeConfirmedContact = $include;

        return $this;
    }

    public function toArray(Request $request): array
    {
        /** @var Pet $pet */
        $pet = $this->resource;
        $pet->loadMissing(['photos', 'temperamentTags', 'skills', 'specialNeeds', 'publishedAdoption.homeProfile']);

        $photos = $pet->photos->map(fn (PetPhoto $photo) => [
            'id' => $photo->id,
            'url' => Storage::disk('public')->url($photo->file_path),
            'caption' => $photo->caption,
            'sort_order' => $photo->sort_order,
        ])->values()->all();

        $activeAdoption = $pet->publishedAdoption;
        $hiredBy = null;
        if ($activeAdoption && $activeAdoption->homeProfile) {
            $hiredBy = [
                'adoption_id' => $activeAdoption->id,
                'home_profile_id' => $activeAdoption->homeProfile->id,
                'full_name' => $activeAdoption->homeProfile->full_name,
                'city' => $activeAdoption->homeProfile->city,
                'adopted_at' => $activeAdoption->adopted_at?->toISOString(),
            ];
        }

        $data = [
            'id' => $pet->id,
            'name' => $pet->name,
            'species' => $pet->species,
            'breed' => $pet->breed,
            'approximate_age_months' => (int) $pet->approximate_age_months,
            'sex' => $pet->sex instanceof \BackedEnum ? $pet->sex->value : $pet->sex,
            'size' => $pet->size instanceof \BackedEnum ? $pet->size->value : $pet->size,
            'currently_at' => $pet->currently_at,
            'city' => $pet->city,
            'province' => $pet->province,
            'bio' => $pet->bio,
            'energy_level' => $pet->energy_level instanceof \BackedEnum ? $pet->energy_level->value : $pet->energy_level,
            'good_with_kids' => $pet->good_with_kids instanceof \BackedEnum ? $pet->good_with_kids->value : $pet->good_with_kids,
            'good_with_dogs' => $pet->good_with_dogs instanceof \BackedEnum ? $pet->good_with_dogs->value : $pet->good_with_dogs,
            'good_with_cats' => $pet->good_with_cats instanceof \BackedEnum ? $pet->good_with_cats->value : $pet->good_with_cats,
            'time_alone' => $pet->time_alone instanceof \BackedEnum ? $pet->time_alone->value : $pet->time_alone,
            'space_needs' => $pet->space_needs instanceof \BackedEnum ? $pet->space_needs->value : $pet->space_needs,
            'experience_needed' => $pet->experience_needed instanceof \BackedEnum ? $pet->experience_needed->value : $pet->experience_needed,
            'health_notes' => $pet->health_notes,
            'temperament_tags' => $pet->temperamentTags->pluck('tag')->values()->all(),
            'skills' => $pet->skills->map(fn ($row) => $row->skill instanceof \BackedEnum ? $row->skill->value : $row->skill)->values()->all(),
            'special_needs' => $pet->specialNeeds->map(fn ($row) => $row->need instanceof \BackedEnum ? $row->need->value : $row->need)->values()->all(),
            'cover_photo_url' => $pet->cover_photo_path ? Storage::disk('public')->url($pet->cover_photo_path) : null,
            'photos' => $photos,
            'status' => $pet->getStatusEnum()->value,
            'published_at' => $pet->published_at?->toISOString(),
            'hired_by' => $hiredBy,
            'views_count' => $pet->profileViews()->count(),
            'bookmarks_count' => $pet->bookmarks()->count(),
        ];

        if ($this->matchScore !== null) {
            $data['match_score'] = $this->matchScore;
            $data['match_reasons'] = $this->matchReasons;
        }

        $viewer = $request->user();
        if ($viewer) {
            $data['is_bookmarked'] = $viewer->bookmarks()->where('pet_id', $pet->id)->exists();
        }

        if ($this->includeConfirmedContact || $this->includeOwnerExtras) {
            $data['caretaker_name'] = $pet->caretaker_name;
            $data['caretaker_contact_number'] = $pet->caretaker_contact_number;
        }

        if ($this->includeOwnerExtras) {
            $pet->loadMissing('vetRecords');
            $data['vet_records'] = $pet->vetRecords->map(fn ($rec) => [
                'id' => $rec->id,
                'mime_type' => $rec->mime_type,
                'size_bytes' => (int) $rec->size_bytes,
                'uploaded_at' => ($rec->created_at ?? now())->toISOString(),
                'download_url' => "/api/v1/pets/{$pet->id}/vet-records/{$rec->id}",
            ])->values()->all();
            $data['completeness'] = self::checkCompleteness($pet);
        }

        return $data;
    }

    /**
     * @return array{is_complete: bool, strength_percent: int, steps: array<string, bool>, missing: list<string>}
     */
    public static function checkCompleteness(Pet $pet): array
    {
        $pet->loadMissing(['photos', 'temperamentTags', 'skills', 'specialNeeds']);

        $basicsOk = filled($pet->name)
            && filled($pet->species)
            && filled($pet->breed)
            && (int) $pet->approximate_age_months >= 1
            && filled($pet->sex)
            && filled($pet->size)
            && filled($pet->currently_at)
            && filled($pet->city)
            && filled($pet->province);

        $photoCount = $pet->photos->count();
        $photosOk = $photoCount >= 3 && $photoCount <= 10;

        $bioLen = mb_strlen(trim((string) $pet->bio));
        $aboutOk = $bioLen >= 50
            && $bioLen <= 600
            && filled($pet->energy_level)
            && $pet->temperamentTags->count() >= 1
            && $pet->temperamentTags->count() <= 5;

        $compatibilityOk = filled($pet->good_with_kids)
            && filled($pet->good_with_dogs)
            && filled($pet->good_with_cats)
            && filled($pet->time_alone)
            && filled($pet->space_needs)
            && filled($pet->experience_needed);

        $healthOk = filled(trim((string) $pet->health_notes));

        $missing = [];
        if (! $basicsOk) {
            $missing[] = 'Complete basics (sex, size, currently at, city, province).';
        }
        if (! $photosOk) {
            $missing[] = 'Add at least 3 clear photos of the pet (up to 10).';
        }
        if (! $aboutOk) {
            $missing[] = 'Write a first-person bio (50–600 characters), pick 1–5 temperament tags, and set energy level.';
        }
        if (! $compatibilityOk) {
            $missing[] = 'Complete compatibility and care needs (kids, dogs, cats, time alone, space, experience).';
        }
        if (! $healthOk) {
            $missing[] = 'Add health & vet notes.';
        }

        $steps = [
            'basics' => $basicsOk,
            'photos' => $photosOk,
            'about_temperament' => $aboutOk,
            'compatibility' => $compatibilityOk,
            'health' => $healthOk,
        ];

        $completedCount = count(array_filter($steps));
        $strengthPercent = (int) round(($completedCount / count($steps)) * 100);

        return [
            'is_complete' => empty($missing),
            'strength_percent' => $strengthPercent,
            'steps' => $steps,
            'missing' => $missing,
        ];
    }

    /**
     * @return array{id: int, name: string, species: string, breed: string, city: string, status: string, photo_url: string|null}
     */
    public static function summary(Pet $pet): array
    {
        $pet->loadMissing('photos');
        $firstPhoto = $pet->photos->first();

        return [
            'id' => $pet->id,
            'name' => $pet->name,
            'species' => $pet->species,
            'breed' => $pet->breed,
            'city' => $pet->city,
            'status' => $pet->getStatusEnum()->value,
            'photo_url' => $firstPhoto ? Storage::disk('public')->url($firstPhoto->file_path) : null,
        ];
    }
}
