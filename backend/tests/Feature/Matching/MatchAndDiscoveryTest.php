<?php

declare(strict_types=1);

namespace Tests\Feature\Matching;

use App\Enums\PetStatus;
use App\Models\Adoption;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatchAndDiscoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_recently_hired_and_privacy_boundaries_on_profiles(): void
    {
        $petUser = User::factory()->pet()->active()->create(['name' => 'Luna']);
        $pet = Pet::factory()->for($petUser)->create([
            'name' => 'Luna',
            'status' => PetStatus::AdoptedHired,
            'caretaker_contact_number' => '09179998888',
        ]);
        $pet->photos()->create(['file_path' => 'pets/photos/luna.jpg', 'sort_order' => 1]);

        $humanUser = User::factory()->human()->active()->create(['name' => 'Elena Garcia']);
        $home = HomeProfile::factory()->for($humanUser)->openToAdopt()->create([
            'full_name' => 'Elena Garcia',
            'city' => 'Makati',
            'province' => 'Metro Manila',
            'street_address' => '99 Ayala Ave',
            'contact_number' => '09187776666',
        ]);

        Adoption::factory()->create([
            'pet_id' => $pet->id,
            'home_profile_id' => $home->id,
            'adopted_at' => now()->subDay(),
        ]);

        // AU-01 / SEC-PRIV-03: Public recently-hired endpoint returns only {name, photo_url, hired_at}.
        $recent = $this->getJson('/api/v1/public/recently-hired')
            ->assertOk()
            ->json('data.0');

        $this->assertSame(['name', 'photo_url', 'hired_at'], array_keys($recent));
        $this->assertSame('Luna', $recent['name']);

        // Viewing another user's Home Profile hides street_address, contact_number, birthdate, and province (SEC-PRIV-03).
        $otherPetUser = User::factory()->pet()->active()->create();
        $otherPet = Pet::factory()->for($otherPetUser)->lookingForAHome()->create([
            'province' => 'Metro Manila',
            'caretaker_contact_number' => '09171112222',
        ]);

        $homePayload = $this->actingAs($otherPetUser)
            ->getJson("/api/v1/home-profiles/{$home->id}")
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('street_address', $homePayload);
        $this->assertArrayNotHasKey('contact_number', $homePayload);
        $this->assertArrayNotHasKey('birthdate', $homePayload);
        $this->assertArrayNotHasKey('province', $homePayload);

        // Viewing a Pet Resume before Meet & Greet confirmation hides caretaker_contact_number.
        $petPayload = $this->actingAs($humanUser)
            ->getJson("/api/v1/pets/{$otherPet->id}")
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('caretaker_contact_number', $petPayload);
    }

    public function test_matches_bookmarks_and_invites_flow(): void
    {
        $petUser = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $pet = Pet::factory()->for($petUser)->lookingForAHome()->create([
            'name' => 'Mochi',
            'species' => 'dog',
            'province' => 'Metro Manila',
        ]);

        $humanUser = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        $home = HomeProfile::factory()->for($humanUser)->openToAdopt()->create([
            'full_name' => 'Ana Santos',
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
        ]);
        $home->acceptedSpecies()->create(['species' => 'dog']);
        $home->preferredSizes()->create(['size' => $pet->size->value]);
        $home->preferredAges()->create(['age_group' => 'adult']);

        app(MatchScoreCalculator::class)->recalculateForPet($pet);

        // Pet sees matched Home Profiles.
        $this->actingAs($petUser)->getJson('/api/v1/matches')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        // Breakdown Drawer returns 7 criteria.
        $this->actingAs($petUser)->getJson("/api/v1/matches/{$home->id}/breakdown")
            ->assertOk()
            ->assertJsonCount(7, 'data.criteria');

        // Human bookmarks Pet and sends an Invite to Apply.
        $this->actingAs($humanUser)->postJson('/api/v1/bookmarks', [
            'pet_id' => $pet->id,
        ])->assertCreated();

        $this->actingAs($humanUser)->getJson('/api/v1/bookmarks')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($humanUser)->postJson("/api/v1/pets/{$pet->id}/invites", [
            'note' => 'Come apply to our home!',
        ])->assertCreated();

        $inviteId = $this->actingAs($petUser)->getJson('/api/v1/invites')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->json('data.0.id');

        $this->actingAs($petUser)->postJson("/api/v1/invites/{$inviteId}/dismiss")
            ->assertOk();
    }
}
