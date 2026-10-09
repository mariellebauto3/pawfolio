<?php

declare(strict_types=1);

namespace Tests\Feature\Accounts;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\PetStatus;
use App\Models\AdoptionRequest;
use App\Models\DetailChangeRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The owner's own account as the Settings screen uses it (BE-23, FE-22, AC-01…AC-05): contact details, notification
 * preferences, the password, a change to a locked detail, and closing the account.
 */
class AccountSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Biscuit-tin-42';

    private User $mochi;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        // The breached-password check asks api.pwnedpasswords.com; no test talks to the internet.
        Http::fake(['api.pwnedpasswords.com/range/*' => Http::response('')]);

        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi', 'password' => Hash::make(self::PASSWORD)]);
        Pet::factory()->for($this->mochi)->lookingForAHome()->create([
            'name' => 'Mochi', 'species' => 'dog', 'breed' => 'Aspin', 'approximate_age_months' => 24,
            'caretaker_name' => 'Joy Lim', 'caretaker_contact_number' => '09171234567',
        ]);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos', 'password' => Hash::make(self::PASSWORD)]);
        HomeProfile::factory()->for($this->ana)->openToAdopt()->create([
            'full_name' => 'Ana Santos', 'birthdate' => '1990-03-04', 'city' => 'Quezon City', 'province' => 'Metro Manila',
            'contact_number' => '09181234567', 'street_address' => '12 Sample St.',
        ]);
    }

    private function openSession(User $user, string $id): void
    {
        DB::table(config('session.table', 'sessions'))->insert(['id' => $id, 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->timestamp]);
    }

    public function test_settings_are_for_a_signed_in_active_account_and_show_its_own_details(): void
    {
        $this->getJson('/api/v1/settings')->assertUnauthorized();

        $suspended = User::factory()->pet()->suspended()->create();
        $this->actingAs($suspended)->getJson('/api/v1/settings')->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $this->actingAs($this->mochi)->getJson('/api/v1/settings')
            ->assertOk()
            ->assertJsonPath('data.account.role', 'pet')
            ->assertJsonPath('data.account.email', $this->mochi->email)
            ->assertJsonPath('data.locked_details', ['name' => 'Mochi', 'species' => 'dog', 'breed' => 'Aspin', 'approximate_age_months' => 24])
            ->assertJsonPath('data.contact_details.caretaker_name', 'Joy Lim')
            ->assertJsonPath('data.contact_details.caretaker_contact_number', '09171234567')
            ->assertJsonPath('data.notification_preferences', ['requests_and_invites' => true, 'meet_and_greets' => true, 'post_activity' => true, 'announcements' => true])
            ->assertJsonPath('data.change_requests', []);

        $this->actingAs($this->ana)->getJson('/api/v1/settings')
            ->assertOk()
            ->assertJsonPath('data.locked_details', ['full_name' => 'Ana Santos', 'birthdate' => '1990-03-04', 'city' => 'Quezon City', 'province' => 'Metro Manila'])
            ->assertJsonPath('data.contact_details.contact_number', '09181234567')
            ->assertJsonPath('data.contact_details.street_address', '12 Sample St.');
    }

    public function test_contact_details_and_notification_preferences_are_saved_and_nothing_else(): void
    {
        $this->actingAs($this->mochi)->patchJson('/api/v1/settings', ['caretaker_contact_number' => '12345'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.caretaker_contact_number.0', 'Enter a mobile number like 0917 123 4567.');

        $this->actingAs($this->mochi)->patchJson('/api/v1/settings', [
            'caretaker_name' => '  Ana Santos ',
            'caretaker_contact_number' => '+63 918 123 4567',
            'notification_preferences' => ['post_activity' => false],
            // Never taken from a request (SEC-INPUT-04).
            'status' => 'suspended',
            'role' => 'admin',
            'name' => 'Rex',
        ])->assertOk()
            ->assertJsonPath('data.contact_details.caretaker_name', 'Ana Santos')
            ->assertJsonPath('data.contact_details.caretaker_contact_number', '09181234567')
            ->assertJsonPath('data.notification_preferences.post_activity', false)
            ->assertJsonPath('data.notification_preferences.announcements', true)
            ->assertJsonPath('data.account.status', 'active')
            ->assertJsonPath('data.account.role', 'pet')
            ->assertJsonPath('data.locked_details.name', 'Mochi');

        $this->actingAs($this->ana)->patchJson('/api/v1/settings', ['contact_number' => '0917 765 4321', 'street_address' => '8 New St.'])
            ->assertOk()
            ->assertJsonPath('data.contact_details.contact_number', '09177654321')
            ->assertJsonPath('data.contact_details.street_address', '8 New St.');
    }

    public function test_changing_the_password_needs_the_current_one_and_signs_out_other_devices(): void
    {
        $this->openSession($this->ana, 'phone');
        $this->openSession($this->ana, 'laptop');
        $this->openSession($this->mochi, 'someone-else');
        $new = ['password' => 'Tennis-ball-77', 'password_confirmation' => 'Tennis-ball-77'];

        $this->actingAs($this->ana)->postJson('/api/v1/settings/password', ['current_password' => 'not-it', ...$new])
            ->assertUnprocessable()
            ->assertJsonPath('errors.current_password.0', 'Your current password is incorrect.');

        $this->actingAs($this->ana)->postJson('/api/v1/settings/password', ['current_password' => self::PASSWORD, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->actingAs($this->ana)->postJson('/api/v1/settings/password', ['current_password' => self::PASSWORD, 'password' => 'Tennis-ball-77', 'password_confirmation' => 'Tennis-ball-78'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', "The passwords don't match.");

        $this->actingAs($this->ana)->postJson('/api/v1/settings/password', ['current_password' => self::PASSWORD, 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Choose a password that is different from your current one.');

        $this->assertTrue(Hash::check(self::PASSWORD, $this->ana->fresh()->password));
        $this->assertDatabaseCount(config('session.table', 'sessions'), 3);

        $this->actingAs($this->ana)->postJson('/api/v1/settings/password', ['current_password' => self::PASSWORD, ...$new])
            ->assertOk()
            ->assertJsonPath('data.password_changed', true);

        $this->assertTrue(Hash::check('Tennis-ball-77', $this->ana->fresh()->password));
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->ana->id]);
        $this->assertDatabaseHas(config('session.table', 'sessions'), ['id' => 'someone-else']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_changed', 'actor_user_id' => $this->ana->id]);
    }

    public function test_a_change_to_a_locked_detail_is_checked_like_the_sign_up_field_and_waits_for_an_admin(): void
    {
        $ask = fn (User $user, array $input) => $this->actingAs($user)->postJson('/api/v1/settings/change-requests', ['reason' => 'The vet says so.', ...$input]);

        // Only the account's own locked details, and only values the profile could hold.
        $ask($this->ana, ['field' => 'species', 'new_value' => 'cat'])->assertUnprocessable()->assertJsonValidationErrors(['field']);
        $ask($this->mochi, ['field' => 'status', 'new_value' => 'adopted_hired'])->assertUnprocessable()->assertJsonValidationErrors(['field']);
        $ask($this->mochi, ['field' => 'species', 'new_value' => 'dragon'])->assertUnprocessable()->assertJsonValidationErrors(['new_value']);
        $ask($this->mochi, ['field' => 'approximate_age_months', 'new_value' => 'two'])->assertUnprocessable()->assertJsonValidationErrors(['new_value']);
        $ask($this->mochi, ['field' => 'approximate_age_months', 'new_value' => '0'])->assertUnprocessable()->assertJsonValidationErrors(['new_value']);
        $ask($this->ana, ['field' => 'province', 'new_value' => 'Atlantis'])->assertUnprocessable()->assertJsonValidationErrors(['new_value']);
        $ask($this->ana, ['field' => 'birthdate', 'new_value' => now()->subYears(17)->format('Y-m-d')])
            ->assertUnprocessable()
            ->assertJsonPath('errors.new_value.0', 'You must be 18 or older to adopt on Pawfolio.');
        $ask($this->mochi, ['field' => 'breed', 'new_value' => ' Aspin '])
            ->assertUnprocessable()
            ->assertJsonPath('errors.new_value.0', 'That is already what your account says.');
        $this->actingAs($this->mochi)->postJson('/api/v1/settings/change-requests', ['field' => 'breed', 'new_value' => 'Shih Tzu mix'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
        $this->assertDatabaseCount('detail_change_requests', 0);

        $ask($this->mochi, ['field' => 'breed', 'new_value' => ' Shih Tzu mix '])
            ->assertCreated()
            ->assertJsonPath('data.field', 'breed')
            ->assertJsonPath('data.new_value', 'Shih Tzu mix')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.has_document', false);

        // Nothing changes until an admin approves it.
        $this->assertSame('Aspin', $this->mochi->pet->fresh()->breed);

        $ask($this->mochi, ['field' => 'breed', 'new_value' => 'Poodle'])->assertConflict()->assertJsonPath('code', 'change_request_pending');

        // Another detail can be asked for meanwhile, with a supporting document kept on the private disk.
        $ask($this->mochi, ['field' => 'approximate_age_months', 'new_value' => '36', 'document' => UploadedFile::fake()->image('vet-card.jpg', 600, 400)])
            ->assertCreated()
            ->assertJsonPath('data.has_document', true);

        $path = DetailChangeRequest::query()->where('field', 'approximate_age_months')->value('document_path');
        $this->assertStringStartsWith('verification/change-requests/', (string) $path);
        Storage::disk('local')->assertExists($path);

        $ask($this->mochi, ['field' => 'name', 'new_value' => 'Mocha', 'document' => UploadedFile::fake()->create('notes.html', 4, 'text/html')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['document']);

        $this->actingAs($this->mochi)->getJson('/api/v1/settings')
            ->assertJsonCount(2, 'data.change_requests')
            ->assertJsonPath('data.change_requests.0.status', 'pending');
    }

    public function test_closing_your_account_needs_your_password_and_closes_what_was_open(): void
    {
        // Mochi is In Process with Ana, and has another request On Hold with a second home.
        $mochiPet = $this->mochi->pet;
        $mochiPet->update(['status' => PetStatus::InProcess->value]);
        $approved = AdoptionRequest::factory()->for($mochiPet)->for($this->ana->homeProfile, 'homeProfile')->meetScheduled()->create();
        $meeting = MeetAndGreet::factory()->confirmed()->create(['adoption_request_id' => $approved->id]);
        $paolo = User::factory()->human()->active()->create(['name' => 'Paolo Garcia']);
        $paoloHome = HomeProfile::factory()->for($paolo)->openToAdopt()->create(['full_name' => 'Paolo Garcia']);
        $onHold = AdoptionRequest::factory()->for($mochiPet)->for($paoloHome, 'homeProfile')->onHold()->create();
        $this->openSession($this->ana, 'phone');

        $this->actingAs($this->ana)->postJson('/api/v1/settings/deactivate', ['password' => 'not-it'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Your password is incorrect.');
        $this->actingAs($this->ana)->postJson('/api/v1/settings/deactivate', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
        $this->assertSame(AccountStatus::Active, $this->ana->fresh()->getStatus());

        $this->actingAs($this->ana)->postJson('/api/v1/settings/deactivate', ['password' => self::PASSWORD, 'reason' => 'No longer adopting'])
            ->assertOk()
            ->assertJsonPath('data.deactivated', true);

        $this->assertSame(AccountStatus::Deactivated, $this->ana->fresh()->getStatus());
        $this->assertFalse((bool) $this->ana->homeProfile->fresh()->is_open_to_adopt);
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->ana->id]);
        $this->assertDatabaseHas('account_actions', ['user_id' => $this->ana->id, 'performed_by_user_id' => $this->ana->id, 'action' => 'deactivate', 'reason' => 'No longer adopting']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account_deactivated_by_owner', 'before_value' => 'active', 'after_value' => 'deactivated']);

        // Her request is Closed and its Meet & Greet ended; Mochi is told, and is free to look again.
        $this->assertSame(AdoptionRequestStatus::Closed, $approved->fresh()->getStatus());
        $this->assertSame('ended', $meeting->fresh()->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'adoption_request_closed', 'subject_id' => $approved->id, 'after_value' => 'closed']);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->mochi->id, 'title' => 'The adoption request with Ana Santos was closed']);
        $this->assertSame(PetStatus::LookingForAHome, $mochiPet->fresh()->getStatusEnum());
        $this->assertSame(AdoptionRequestStatus::Sent, $onHold->fresh()->getStatus());

        // The records stay (proposal §5.1): nothing was deleted.
        $this->assertDatabaseHas('home_profiles', ['id' => $this->ana->homeProfile->id]);
        $this->assertDatabaseHas('adoption_requests', ['id' => $approved->id]);
    }
}
