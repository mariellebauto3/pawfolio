<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_read_protected_api_data(): void
    {
        foreach (['admin/dashboard', 'admin/accounts', 'admin/reports', 'me/pet', 'me/home-profile', 'matches', 'stats'] as $path) {
            $this->getJson('/api/v1/'.$path)->assertUnauthorized()->assertJsonMissingPath('data');
        }
    }

    public function test_members_cannot_read_admin_modules_and_responses_do_not_name_the_role(): void
    {
        foreach (['pet', 'human'] as $role) {
            $user = User::factory()->active()->create(['role' => $role]);
            foreach (['admin/dashboard', 'admin/accounts', 'admin/reports', 'admin/verifications', 'admin/announcements', 'admin/activity-logs'] as $path) {
                $this->actingAs($user)->getJson('/api/v1/'.$path)
                    ->assertForbidden()
                    ->assertExactJson(['message' => 'This action is unauthorized.', 'code' => 'role_not_allowed']);
            }
            $this->actingAs($user)->postJson('/api/v1/admin/announcements', [])
                ->assertForbidden()->assertJsonMissingPath('data');
        }
    }

    public function test_profile_role_guards_apply_to_reads_and_writes(): void
    {
        foreach (['pet' => 'me/home-profile', 'human' => 'me/pet', 'admin' => 'me/pet'] as $role => $path) {
            $user = User::factory()->active()->create(['role' => $role]);
            $this->actingAs($user)->getJson('/api/v1/'.$path)->assertForbidden()->assertJsonMissingPath('data');
            $this->actingAs($user)->patchJson('/api/v1/'.$path, [])->assertForbidden()->assertJsonMissingPath('data');
        }
    }

    public function test_admins_cannot_use_member_matching_and_stats(): void
    {
        $this->actingAs(User::factory()->admin()->active()->create());
        foreach (['matches', 'matches/1/breakdown', 'stats'] as $path) {
            $this->getJson('/api/v1/'.$path)->assertForbidden()->assertJsonMissingPath('data');
        }
    }
}
