<?php

namespace Tests\Feature\Discovery;

use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use App\Models\VerificationSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSearchSuggestionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_searches_offer_partial_names_without_private_resource_payloads(): void
    {
        $admin = User::factory()->admin()->active()->create();
        $human = User::factory()->human()->pendingVerification()->create();
        $home = HomeProfile::factory()->for($human)->create(['full_name' => 'Ana Santos']);
        VerificationSubmission::factory()->for($human)->create();
        $pet = Pet::factory()->for(User::factory()->pet()->active())->create(['name' => 'Ana Pet']);
        AdoptionRequest::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $home->id]);

        foreach (['a', 'an', 'AN', 'An', 'na'] as $words) {
            $this->actingAs($admin)->getJson('/api/v1/admin/accounts?suggestions=1&q='.$words)
                ->assertOk()->assertJsonFragment(['display_name' => 'Ana Santos'])->assertJsonMissingPath('data.0.email');
            $this->actingAs($admin)->getJson('/api/v1/admin/adoption-requests?suggestions=1&q='.$words)
                ->assertOk()->assertJsonPath('data.0.pet.name', 'Ana Pet')->assertJsonMissingPath('data.0.cover_letter');
            $this->actingAs($admin)->getJson('/api/v1/admin/verifications?suggestions=1&search='.$words)
                ->assertOk()->assertJsonPath('data.0.display_name', 'Ana Santos')->assertJsonMissingPath('data.0.documents');
        }
        $this->actingAs($human)->getJson('/api/v1/admin/accounts?suggestions=1&q=an')->assertForbidden();
    }
}
