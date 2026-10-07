<?php

declare(strict_types=1);

namespace App\Http\Resources\Profiles;

use App\Models\HomeProfile;
use App\Models\MatchScore;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Public Home Profile resource matching frontend/src/types/home-profile.ts (BE-12, BE-14, SEC-PRIV-03).
 *
 * Public profiles expose city and household summary only — never street_address, contact_number,
 * birthdate, or province.
 */
class HomeProfileResource extends JsonResource
{
    private ?int $matchScore = null;

    /** @var list<string> */
    private array $matchReasons = [];

    private bool $includeOwnerExtras = false;

    private bool $includeConfirmedContact = false;

    private ?bool $bookmarked = null;

    /**
     * For lists: whether the viewer bookmarked this one, already read for the whole page in one query.
     */
    public function withBookmarked(bool $bookmarked): self
    {
        $this->bookmarked = $bookmarked;

        return $this;
    }

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
        /** @var HomeProfile $home */
        $home = $this->resource;
        $home->loadMissing([
            'householdMembers',
            'otherPets',
            'acceptedSpecies',
            'preferredSizes',
            'preferredAges',
            'activeAdoptions.pet.photos',
        ]);

        $adoptedPets = $home->activeAdoptions
            ->filter(fn ($adoption) => $adoption->pet !== null)
            ->map(fn ($adoption) => [
                'adoption_id' => $adoption->id,
                'adopted_at' => $adoption->adopted_at?->toISOString(),
                'pet' => PetResource::summary($adoption->pet),
            ])
            ->values()
            ->all();

        $data = [
            'id' => $home->id,
            'full_name' => $home->full_name,
            'city' => $home->city,
            'headline' => $home->headline,
            'about_home' => $home->about_home,
            'profile_photo_url' => $home->profile_photo_path ? Storage::disk('public')->url($home->profile_photo_path) : null,
            'cover_photo_url' => $home->cover_photo_path ? Storage::disk('public')->url($home->cover_photo_path) : null,
            'home_type' => $home->home_type,
            'outdoor_space' => $home->outdoor_space,
            'activity_level' => $home->activity_level,
            'hours_away' => $home->hours_away,
            'pet_experience' => $home->pet_experience,
            'special_needs_willingness' => $home->special_needs_willingness,
            'household_members' => $home->householdMembers->map(fn ($m) => $m->member instanceof \BackedEnum ? $m->member->value : $m->member)->values()->all(),
            'other_pets' => $home->otherPets->map(fn ($p) => $p->pet_type instanceof \BackedEnum ? $p->pet_type->value : $p->pet_type)->values()->all(),
            'accepted_species' => $home->acceptedSpecies->map(fn ($s) => $s->species instanceof \BackedEnum ? $s->species->value : $s->species)->values()->all(),
            'preferred_sizes' => $home->preferredSizes->map(fn ($s) => $s->size instanceof \BackedEnum ? $s->size->value : $s->size)->values()->all(),
            'preferred_ages' => $home->preferredAges->map(fn ($a) => $a->age_group instanceof \BackedEnum ? $a->age_group->value : $a->age_group)->values()->all(),
            'is_open_to_adopt' => $home->isOpenToAdopt(),
            'is_furparent' => $home->isFurparent(),
            'has_completed_quiz' => $home->hasCompletedQuiz(),
            'adopted_pets' => $adoptedPets,
        ];

        if ($this->matchScore !== null) {
            $data['match_score'] = $this->matchScore;
            $data['match_reasons'] = $this->matchReasons;
        }

        $viewer = $request->user();
        if ($viewer) {
            $data['is_bookmarked'] = $this->bookmarked ?? $viewer->bookmarks()->where('home_profile_id', $home->id)->exists();
        }

        if ($this->includeConfirmedContact || $this->includeOwnerExtras) {
            $data['province'] = $home->province;
            $data['contact_number'] = $home->contact_number;
            $data['street_address'] = $home->street_address;
        }

        if ($this->includeOwnerExtras) {
            $data['birthdate'] = $home->birthdate instanceof CarbonInterface
                ? $home->birthdate->format('Y-m-d')
                : (string) ($home->birthdate ?? '');
            $data['views_count'] = $home->profileViews()->count();
            $data['open_slots_count'] = $home->meetAndGreetSlots()->available()->count();
        }

        return $data;
    }

    /**
     * @return array{id: int, full_name: string, city: string, profile_photo_url: string|null, is_furparent: bool}
     */
    public static function summary(HomeProfile $home): array
    {
        return [
            'id' => $home->id,
            'full_name' => $home->full_name,
            'city' => $home->city,
            'profile_photo_url' => $home->profile_photo_path ? Storage::disk('public')->url($home->profile_photo_path) : null,
            'is_furparent' => $home->isFurparent(),
        ];
    }
}
