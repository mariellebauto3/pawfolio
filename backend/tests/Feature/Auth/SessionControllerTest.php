<?php

namespace Tests\Feature\Auth;

use App\Actions\Auth\SignIn;
use App\Enums\AccountStatus;
use App\Enums\Role;
use Illuminate\Cache\Repository;
use Illuminate\Cache\Store\ArrayStore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SessionControllerTest extends TestCase
{
    use RefreshDatabase;

    protected SignIn $signIn;

    protected function setUp(): void
    {
        parent::setUp();

        // Use an isolated in-memory (array) cache store for the sign-in lockout
        // tests so they are deterministic and don't depend on the global cache
        // binding or any stale cached config.
        $store = $this->app->make('cache')->store('array');
        $this->signIn = new SignIn($store);
        $this->app->instance(SignIn::class, $this->signIn);
    }

    public function test_me_returns_the_signed_in_account_shape(): void
    {
        $pet = User::factory()->create([
            'role' => Role::Pet,
            'status' => AccountStatus::Active,
            'email' => 'mochi@example.com',
            'name' => 'admin.jess',
        ]);

        $pet->pet()->create([
            'name' => 'Mochi',
            'species' => 'dog',
            'breed' => 'Mixed',
            'approximate_age_months' => 24,
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
            'caretaker_name' => 'Maria Santos',
            'caretaker_contact_number' => '09123456789',
        ]);

        $this->actingAs($pet)->getJson('/api/v1/auth/me')->assertOk()->assertJson([
            'data' => [
                'id' => $pet->id,
                'role' => 'pet',
                'status' => 'active',
                'email' => 'mochi@example.com',
                'display_name' => 'Mochi',
                'avatar_url' => null,
                'profile_id' => $pet->pet->id,
            ],
        ]);
    }

    public function test_me_for_a_human_returns_full_name_and_home_profile_id(): void
    {
        $human = User::factory()->create([
            'role' => Role::Human,
            'status' => AccountStatus::Active,
            'email' => 'ana.santos@example.com',
            'name' => 'admin.jess',
        ]);

        $human->homeProfile()->create([
            'full_name' => 'Ana Santos',
            'birthdate' => '1990-01-15',
            'contact_number' => '09171112222',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'street_address' => '123 Rizal St',
        ]);

        $this->actingAs($human)->getJson('/api/v1/auth/me')->assertOk()->assertJson([
            'data' => [
                'id' => $human->id,
                'role' => 'human',
                'status' => 'active',
                'email' => 'ana.santos@example.com',
                'display_name' => 'Ana Santos',
                'avatar_url' => null,
                'profile_id' => $human->homeProfile->id,
            ],
        ]);
    }

    public function test_me_for_an_admin_returns_null_profile_id(): void
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'status' => AccountStatus::Active,
            'email' => 'admin@example.com',
            'name' => 'admin.jess',
        ]);

        $this->actingAs($admin)->getJson('/api/v1/auth/me')->assertOk()->assertJson([
            'data' => [
                'id' => $admin->id,
                'role' => 'admin',
                'status' => 'active',
                'email' => 'admin@example.com',
                'display_name' => 'admin.jess',
                'avatar_url' => null,
                'profile_id' => null,
            ],
        ]);
    }

    public function test_me_is_exempt_from_active_only_so_pending_accounts_can_see_their_status(): void
    {
        $pending = User::factory()->create([
            'role' => Role::Pet,
            'status' => AccountStatus::PendingVerification,
            'email' => 'kulit@example.com',
            'name' => 'admin.jess',
        ]);

        $pending->pet()->create([
            'name' => 'Kulit',
            'species' => 'cat',
            'breed' => 'Mixed',
            'approximate_age_months' => 12,
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'caretaker_name' => 'Tita Rosa',
            'caretaker_contact_number' => '09129998888',
        ]);

        $this->actingAs($pending)->getJson('/api/v1/auth/me')->assertOk()->assertJson([
            'data' => [
                'role' => 'pet',
                'status' => 'pending_verification',
                'display_name' => 'Kulit',
                'profile_id' => $pending->pet->id,
            ],
        ]);
    }

    public function test_me_when_signed_out_is_401(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_sign_in_success_regenerates_session_and_returns_the_account_shape(): void
    {
        $user = User::factory()->create([
            'role' => Role::Human,
            'status' => AccountStatus::Active,
            'email' => 'ana.santos@example.com',
            'name' => 'admin.jess',
        ]);

        $user->homeProfile()->create([
            'full_name' => 'Ana Santos',
            'birthdate' => '1990-01-15',
            'contact_number' => '09171112222',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'street_address' => '123 Rizal St',
        ]);

        $this->postJson('/api/v1/auth/sign-in', [
            'email' => 'ana.santos@example.com',
            'password' => 'password',
        ])->assertOk()->assertJson([
            'data' => [
                'role' => 'human',
                'status' => 'active',
                'email' => 'ana.santos@example.com',
                'display_name' => 'Ana Santos',
                'profile_id' => $user->homeProfile->id,
            ],
        ]);
    }

    public function test_sign_in_wrong_password_is_one_generic_message_whether_account_exists(): void
    {
        User::factory()->create([
            'role' => Role::Pet,
            'status' => AccountStatus::Active,
            'email' => 'mochi@example.com',
            'name' => 'admin.jess',
        ]);

        // Existing account, wrong password.
        $this->postJson('/api/v1/auth/sign-in', [
            'email' => 'mochi@example.com',
            'password' => 'wrong',
        ])->assertUnprocessable()->assertJson([
            'message' => "That email and password don't match. Try again.",
            'errors' => [
                'email' => ["That email and password don't match. Try again."],
            ],
        ]);

        // Nonexistent account: same generic message, no hint that the email is unknown.
        $this->postJson('/api/v1/auth/sign-in', [
            'email' => 'ghost@example.com',
            'password' => 'wrong',
        ])->assertUnprocessable()->assertJson([
            'message' => "That email and password don't match. Try again.",
        ]);
    }

    public function test_five_failed_sign_ins_lock_out_the_ip_and_email_with_429_retry_after(): void
    {
        User::factory()->create([
            'role' => Role::Pet,
            'status' => AccountStatus::Active,
            'email' => 'mochi@example.com',
            'name' => 'admin.jess',
        ]);

        $this->withHeaders(['X-Forwarded-For' => '10.0.0.1']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/sign-in', [
                'email' => 'mochi@example.com',
                'password' => 'wrong',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/sign-in', [
            'email' => 'mochi@example.com',
            'password' => 'wrong',
        ])->assertTooManyRequests()->assertHeader('Retry-After', '900');
    }

    public function test_sign_out_is_204_and_ends_the_session(): void
    {
        $user = User::factory()->create([
            'role' => Role::Admin,
            'status' => AccountStatus::Active,
            'email' => 'admin@example.com',
            'name' => 'admin.jess',
        ]);

        // Sign in first so a real Sanctum session exists, then sign out.
        $this->postJson('/api/v1/auth/sign-in', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $this->postJson('/api/v1/auth/sign-out')
            ->assertNoContent();

        // After sign-out the session is gone, so /me is 401.
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_sign_in_validation_rejects_missing_fields(): void
    {
        $this->postJson('/api/v1/auth/sign-in', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    protected function tearDown(): void
    {
        parent::tearDown();
    }
}
