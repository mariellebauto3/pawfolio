<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Forgot and reset password (AU-04…AU-06; SEC-AUTH-03, -05, -07, -08; SEC-FE-04).
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const SAME_ANSWER = "If an account exists for that email, we've sent a link to reset the password. It expires in 30 minutes.";

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Referer', 'http://localhost:3000/');
        // The breached-password check asks api.pwnedpasswords.com; no test talks to the internet. The fake knows one
        // leaked password, "leaked1234"; every other password is unknown to it.
        $leaked = strtoupper(sha1('leaked1234'));
        Http::fake(['api.pwnedpasswords.com/range/*' => fn ($request) => Http::response(
            str_ends_with($request->url(), substr($leaked, 0, 5)) ? substr($leaked, 5).':4200' : '',
        )]);
    }

    public function test_forgot_password_emails_a_frontend_link_with_token_and_email_after_the_hash(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'mochi@example.com', 'status' => AccountStatus::Active]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'mochi@example.com'])
            ->assertOk()->assertExactJson(['message' => self::SAME_ANSWER]);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;
            [$beforeHash, $fragment] = explode('#', $url, 2);

            // Nothing personal or secret before the "#", so it never reaches a server log (SEC-FE-04).
            $this->assertSame('http://localhost:3000/reset-password', $beforeHash);
            parse_str($fragment, $params);
            $this->assertSame('mochi@example.com', $params['email']);
            $this->assertSame($notification->token, $params['token']);

            return true;
        });
    }

    public function test_forgot_password_answers_the_same_for_an_unknown_email_and_sends_nothing(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])
            ->assertOk()->assertExactJson(['message' => self::SAME_ANSWER]);

        Notification::assertNothingSent();
    }

    public function test_forgot_password_validates_the_email(): void
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'not-an-email'])
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }

    public function test_forgot_password_is_rate_limited_with_retry_after(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => "a{$i}@example.com"])->assertOk();
        }

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'a9@example.com'])
            ->assertTooManyRequests()->assertJsonPath('code', 'rate_limited')->assertHeader('Retry-After');
    }

    public function test_reset_sets_the_new_password_once_and_ends_every_session(): void
    {
        config(['session.driver' => 'database']);
        $user = User::factory()->create(['email' => 'mochi@example.com', 'status' => AccountStatus::Active]);
        DB::table('sessions')->insert([
            'id' => 'other-device', 'user_id' => $user->id, 'ip_address' => '10.0.0.9', 'user_agent' => 'Phone',
            'payload' => '', 'last_activity' => now()->timestamp,
        ]);
        $token = Password::createToken($user);
        $payload = [
            'token' => $token, 'email' => 'mochi@example.com',
            'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ];

        $this->postJson('/api/v1/auth/reset-password', $payload)->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['id' => 'other-device']);
        $this->assertDatabaseHas('activity_logs', ['type' => 'security', 'action' => 'password_reset', 'actor_user_id' => $user->id]);
        $this->assertGuest('web');

        // Single use (SEC-AUTH-08).
        $this->postJson('/api/v1/auth/reset-password', $payload)
            ->assertUnprocessable()->assertJsonPath('errors.token.0', 'This reset link is invalid or has expired. Ask for a new one.');
    }

    public function test_a_reset_link_expires_after_30_minutes(): void
    {
        $user = User::factory()->create(['email' => 'mochi@example.com']);
        $token = Password::createToken($user);

        $this->travel(31)->minutes();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'mochi@example.com',
            'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);
    }

    public function test_a_wrong_token_or_unknown_email_gets_the_same_answer(): void
    {
        User::factory()->create(['email' => 'mochi@example.com']);
        $body = ['password' => 'newpass123', 'password_confirmation' => 'newpass123'];

        $wrongToken = $this->postJson('/api/v1/auth/reset-password', $body + ['token' => 'nope', 'email' => 'mochi@example.com']);
        $unknown = $this->postJson('/api/v1/auth/reset-password', $body + ['token' => 'nope', 'email' => 'ghost@example.com']);

        $wrongToken->assertUnprocessable();
        $this->assertSame($wrongToken->json(), $unknown->json());
    }

    public function test_the_new_password_needs_8_characters_a_letter_a_number_and_a_match(): void
    {
        $user = User::factory()->create(['email' => 'mochi@example.com']);
        $token = Password::createToken($user);
        $try = fn (string $password, ?string $confirmation = null) => $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'mochi@example.com',
            'password' => $password, 'password_confirmation' => $confirmation ?? $password,
        ]);

        $try('short1')->assertJsonPath('errors.password.0', 'Use at least 8 characters.');
        $try('onlyletters')->assertJsonPath('errors.password.0', 'Include at least one number.');
        $try('12345678')->assertJsonPath('errors.password.0', 'Include at least one letter.');
        $try('newpass123', 'different123')->assertJsonPath('errors.password.0', "The passwords don't match.");
    }

    public function test_a_password_found_in_a_data_leak_is_refused(): void
    {
        $user = User::factory()->create(['email' => 'mochi@example.com']);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => Password::createToken($user), 'email' => 'mochi@example.com',
            'password' => 'leaked1234', 'password_confirmation' => 'leaked1234',
        ])->assertUnprocessable()->assertJsonPath('errors.password.0', 'This password has appeared in a data leak. Choose a different one.');
    }
}
