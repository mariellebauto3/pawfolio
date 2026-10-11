<?php

declare(strict_types=1);

namespace Tests\Feature\Discovery;

use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Who may read a resume and a Home Profile (PetPolicy, HomeProfilePolicy; DS-05, DS-07). What may not be seen
 * answers 404, the same as what doesn't exist (SEC-AUTHZ-04).
 */
class ProfileVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_draft_resume_is_only_for_its_pet_and_admins(): void
    {
        $owner = User::factory()->pet()->active()->create();
        $draft = Pet::factory()->for($owner)->draft()->create();

        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();
        $otherPet = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPet)->lookingForAHome()->create();

        // Signed out, before anyone is signed in for this test.
        $this->getJson("/api/v1/pets/{$draft->id}")->assertUnauthorized();

        $this->actingAs($human)->getJson("/api/v1/pets/{$draft->id}")->assertNotFound();
        $this->actingAs($otherPet)->getJson("/api/v1/pets/{$draft->id}")->assertNotFound();
        $this->actingAs($owner)->getJson("/api/v1/pets/{$draft->id}")->assertOk();
        $this->actingAs(User::factory()->admin()->create())->getJson("/api/v1/pets/{$draft->id}")->assertOk();
    }

    public function test_the_resume_of_an_account_that_is_not_active_is_hidden(): void
    {
        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();

        $suspended = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create();
        $published = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create();
        $alum = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create();

        $this->actingAs($human)->getJson("/api/v1/pets/{$suspended->id}")->assertNotFound();
        $this->actingAs($human)->getJson("/api/v1/pets/{$published->id}")->assertOk();
        // An adopted pet's profile stays public (DS-08).
        $this->actingAs($human)->getJson("/api/v1/pets/{$alum->id}")->assertOk();
        $this->actingAs($human)->getJson('/api/v1/pets/999999')->assertNotFound();
    }

    public function test_a_home_that_is_not_open_shows_only_to_a_pet_with_a_request(): void
    {
        $closed = HomeProfile::factory()->for(User::factory()->human()->active())->withQuizCompleted()->create();
        $open = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create();
        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create();

        $stranger = User::factory()->pet()->active()->create();
        Pet::factory()->for($stranger)->lookingForAHome()->create();

        $applicant = User::factory()->pet()->active()->create();
        $applicantPet = Pet::factory()->for($applicant)->lookingForAHome()->create();
        AdoptionRequest::factory()->create(['pet_id' => $applicantPet->id, 'home_profile_id' => $closed->id]);

        $this->actingAs($stranger)->getJson("/api/v1/home-profiles/{$open->id}")->assertOk();
        $this->actingAs($stranger)->getJson("/api/v1/home-profiles/{$closed->id}")->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/v1/home-profiles/{$suspended->id}")->assertNotFound();
        // Turning Open to Adopt off doesn't end a request in progress (§5.5), so its pet still reads the home.
        $this->actingAs($applicant)->getJson("/api/v1/home-profiles/{$closed->id}")->assertOk();
        // The owner and an admin always can.
        $this->actingAs($closed->user)->getJson("/api/v1/home-profiles/{$closed->id}")->assertOk();
        $this->actingAs(User::factory()->admin()->create())->getJson("/api/v1/home-profiles/{$closed->id}")->assertOk();
    }
}
