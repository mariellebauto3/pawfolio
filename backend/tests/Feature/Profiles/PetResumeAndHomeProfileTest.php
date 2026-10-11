<?php

declare(strict_types=1);

namespace Tests\Feature\Profiles;

use App\Enums\PetStatus;
use App\Enums\PostType;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PetResumeAndHomeProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    public function test_pet_owner_can_complete_and_publish_resume_while_locked_fields_are_ignored(): void
    {
        $user = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $pet = Pet::factory()->for($user)->draft()->create([
            'name' => 'Mochi',
            'species' => 'dog',
            'breed' => 'Aspin',
            'approximate_age_months' => 24,
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
            'currently_at' => 'Foster home',
        ]);

        // Add 1 photo initially; publishing should fail because < 3 photos and missing fields.
        $pet->photos()->create(['file_path' => 'pets/photos/p1.jpg', 'sort_order' => 1]);

        $this->actingAs($user)->postJson('/api/v1/me/pet/publish')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['resume']);

        // Upload 2 more photos via API.
        $this->actingAs($user)->postJson('/api/v1/me/pet/photos', [
            'photo' => UploadedFile::fake()->image('p2.jpg', 800, 600),
            'caption' => 'Playing in the yard',
        ])->assertCreated();

        $this->actingAs($user)->postJson('/api/v1/me/pet/photos', [
            'photo' => UploadedFile::fake()->image('p3.jpg', 800, 600),
            'is_primary' => true,
        ])->assertCreated();

        // Update resume fields; also attempt to tamper with locked fields (name, species, status).
        $bio = 'Hi! I am Mochi, a cheerful and house-trained Aspin who loves walks, belly rubs, and napping by your desk.';
        $this->actingAs($user)->patchJson('/api/v1/me/pet', [
            'name' => 'HackedName',
            'species' => 'cat',
            'status' => 'adopted_hired',
            'sex' => 'female',
            'size' => 'medium',
            'bio' => $bio,
            'energy_level' => 'medium',
            'good_with_kids' => 'yes',
            'good_with_dogs' => 'yes',
            'good_with_cats' => 'unknown',
            'time_alone' => 'up_to_4_hrs',
            'space_needs' => 'apartment_ok',
            'experience_needed' => 'first_time_ok',
            'health_notes' => 'Fully vaccinated, dewormed, and spayed.',
            'temperament_tags' => ['Friendly', 'Playful', 'Gentle'],
            'skills' => ['potty_trained', 'leash_trained'],
            'special_needs' => ['special_diet'],
        ])->assertOk()
            ->assertJsonPath('data.name', 'Mochi')
            ->assertJsonPath('data.species', 'dog')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.completeness.is_complete', true);

        // Publish resume -> transitions to looking_for_a_home and creates an automatic For Hire post.
        $this->actingAs($user)->postJson('/api/v1/me/pet/publish')
            ->assertOk()
            ->assertJsonPath('data.status', PetStatus::LookingForAHome->value);

        $this->assertTrue(
            Post::query()
                ->where('author_user_id', $user->id)
                ->where('type', PostType::ForHire->value)
                ->exists(),
        );
    }

    public function test_human_can_complete_6_step_quiz_and_toggle_open_to_adopt(): void
    {
        $user = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($user)->create([
            'full_name' => 'Ana Santos',
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
            'is_open_to_adopt' => false,
            'quiz_completed_at' => null,
        ]);

        // Cannot turn on Open to Adopt before completing the quiz.
        $this->actingAs($user)->postJson('/api/v1/me/open-to-adopt', [
            'is_open_to_adopt' => true,
        ])->assertStatus(409)
            ->assertJsonPath('code', 'quiz_incomplete');

        // Complete steps 1..6.
        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/1', [
            'household_members' => ['partner', 'kids_6_to_12'],
            'other_pets' => ['dogs'],
            'about_home' => 'Quiet neighborhood with a fenced yard.',
        ])->assertOk();

        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/2', [
            'home_type' => 'house',
            'outdoor_space' => 'small_yard',
        ])->assertOk();

        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/3', [
            'activity_level' => 'moderate',
            'hours_away' => '3_to_5',
        ])->assertOk();

        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/4', [
            'pet_experience' => 'experienced',
            'special_needs_willingness' => 'yes',
        ])->assertOk();

        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/5', [
            'accepted_species' => ['dog', 'cat'],
            'preferred_sizes' => ['small', 'medium'],
            'preferred_ages' => ['adult'],
        ])->assertOk();

        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/6', [
            'is_open_to_adopt' => true,
        ])->assertOk()
            ->assertJsonPath('data.has_completed_quiz', true)
            ->assertJsonPath('data.is_open_to_adopt', true);

        // Toggle Open to Adopt off and back on.
        $this->actingAs($user)->postJson('/api/v1/me/open-to-adopt', [
            'is_open_to_adopt' => false,
        ])->assertOk()
            ->assertJsonPath('data.is_open_to_adopt', false);
    }
}
