<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\Role;
use App\Enums\VerificationSubmissionStatus;
use App\Models\User;
use App\Models\VerificationDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SignUpAndVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        Http::fake(['api.pwnedpasswords.com/range/*' => Http::response('')]);
    }

    public function test_pet_sign_up_creates_pending_account_draft_pet_and_private_id_document(): void
    {
        $photo = UploadedFile::fake()->image('mochi.jpg', 800, 600);
        $validId = UploadedFile::fake()->image('caretaker-id.png', 1000, 700);
        $vetRecord = UploadedFile::fake()->createWithContent('vaccine.pdf', "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

        $response = $this->postJson('/api/v1/auth/sign-up/pet', [
            'name' => 'Mochi',
            'species' => 'dog',
            'breed' => 'Aspin',
            'approximate_age_months' => 18,
            'currently_at' => 'Foster home in QC',
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
            'caretaker_name' => 'Maria Clara',
            'caretaker_contact_number' => '0917 123 4567',
            'photos' => [$photo],
            'valid_id' => $validId,
            'vet_record' => $vetRecord,
            'email' => 'Mochi.Caretaker@Example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', 'pet')
            ->assertJsonPath('data.status', 'pending_verification')
            ->assertJsonPath('data.display_name', 'Mochi')
            ->assertJsonPath('data.email', 'mochi.caretaker@example.com');

        $user = User::query()->where('email', 'mochi.caretaker@example.com')->firstOrFail();
        $this->assertSame(Role::Pet, $user->getRole());
        $this->assertSame(AccountStatus::PendingVerification, $user->getStatus());
        $this->assertNotNull($user->pet);
        $this->assertSame('09171234567', $user->pet->caretaker_contact_number);

        // SEC-PRIV-05: Caretaker contact number is encrypted at rest in raw DB column.
        $rawPhone = DB::table('pets')->where('id', $user->pet->id)->value('caretaker_contact_number');
        $this->assertNotSame('09171234567', $rawPhone);

        // Verification submission & documents exist; valid_id is stored on private local disk.
        $submission = $user->verificationSubmissions()->firstOrFail();
        $this->assertSame(VerificationSubmissionStatus::Pending->value, $submission->status);
        $idDoc = $submission->documents()->where('document_type', 'valid_id')->firstOrFail();
        Storage::disk('local')->assertExists($idDoc->file_path);
    }

    public function test_human_sign_up_enforces_18_plus_age_and_encrypts_personal_fields(): void
    {
        $validId = UploadedFile::fake()->image('umid.jpg', 900, 600);

        // Under 18 is rejected with 422.
        $this->postJson('/api/v1/auth/sign-up/human', [
            'full_name' => 'Young Applicant',
            'birthdate' => now()->subYears(16)->format('Y-m-d'),
            'contact_number' => '09181234567',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '45 Orchid St',
            'id_type' => 'umid',
            'valid_id' => $validId,
            'email' => 'young@example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ])->assertUnprocessable()
            ->assertJsonPath('errors.birthdate.0', 'You must be 18 or older to adopt on Pawfolio.');

        // Adult human succeeds.
        $response = $this->postJson('/api/v1/auth/sign-up/human', [
            'full_name' => 'Ana Santos',
            'birthdate' => '1995-04-12',
            'contact_number' => '+63 918 123 4567',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '45 Orchid St, Brgy Kapitolyo',
            'id_type' => 'umid',
            'valid_id' => UploadedFile::fake()->image('umid-adult.jpg', 900, 600),
            'email' => 'ana.santos@example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', 'human')
            ->assertJsonPath('data.status', 'pending_verification')
            ->assertJsonPath('data.display_name', 'Ana Santos');

        $user = User::query()->where('email', 'ana.santos@example.com')->firstOrFail();
        $rawHome = DB::table('home_profiles')->where('user_id', $user->id)->first();
        $this->assertNotSame('09181234567', $rawHome->contact_number);
        $this->assertNotSame('45 Orchid St, Brgy Kapitolyo', $rawHome->street_address);
        $this->assertSame('09181234567', $user->homeProfile->contact_number);
        $this->assertSame('45 Orchid St, Brgy Kapitolyo', $user->homeProfile->street_address);
    }

    public function test_spoofed_svg_upload_is_rejected_by_content_inspection(): void
    {
        $svgAsJpg = UploadedFile::fake()->createWithContent(
            'evil.jpg',
            '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        );

        $this->postJson('/api/v1/auth/sign-up/human', [
            'full_name' => 'Ana Santos',
            'birthdate' => '1995-04-12',
            'contact_number' => '09181234567',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '45 Orchid St',
            'id_type' => 'umid',
            'valid_id' => $svgAsJpg,
            'email' => 'spoof@example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['valid_id']);
    }

    public function test_admin_verification_workflow_deny_resubmit_and_approve(): void
    {
        // Sign up a human account.
        $this->postJson('/api/v1/auth/sign-up/human', [
            'full_name' => 'Carla Mendoza',
            'birthdate' => '1993-08-20',
            'contact_number' => '09175556666',
            'city' => 'Mandaluyong',
            'province' => 'Metro Manila',
            'street_address' => '88 Shaw Blvd',
            'id_type' => 'passport',
            'valid_id' => UploadedFile::fake()->image('passport.jpg', 800, 600),
            'email' => 'carla@example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ])->assertCreated();

        $carla = User::query()->where('email', 'carla@example.com')->firstOrFail();

        // While Pending, Carla cannot access active member endpoints (SEC-AUTHZ-06).
        $this->actingAs($carla)->getJson('/api/v1/feed')
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        // But Carla CAN access /api/v1/account-status and /api/v1/account/submission.
        $this->actingAs($carla)->getJson('/api/v1/account-status')
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_verification')
            ->assertJsonPath('data.is_resubmission', false);

        // Non-admin cannot access /api/v1/admin/verification.
        $activeHuman = User::factory()->human()->active()->create();
        $this->actingAs($activeHuman)->getJson('/api/v1/admin/verification')
            ->assertForbidden();

        // Admin reviews and denies Carla's submission.
        $admin = User::factory()->admin()->active()->create();
        $this->actingAs($admin)->getJson('/api/v1/admin/verification')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $doc = VerificationDocument::query()->firstOrFail();
        $this->actingAs($admin)->get("/api/v1/admin/verification-documents/{$doc->id}")
            ->assertOk();

        $this->actingAs($admin)->postJson("/api/v1/admin/verification/{$carla->id}/deny", [
            'denial_reason' => 'id_photo_unreadable',
            'message_to_owner' => 'Please upload a clearer photo of your passport.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'denied');

        // Carla sees the denial reason on /api/v1/account-status (AU-20).
        $this->actingAs($carla->fresh())->getJson('/api/v1/account-status')
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.denial_reason', 'id_photo_unreadable')
            ->assertJsonPath('data.reason', 'Please upload a clearer photo of your passport.');

        // Carla edits and resubmits (AU-19). Prior submission row is kept as history!
        $this->actingAs($carla->fresh())->patchJson('/api/v1/account/submission', [
            'full_name' => 'Carla Mendoza',
            'birthdate' => '1993-08-20',
            'contact_number' => '09175556666',
            'city' => 'Mandaluyong',
            'province' => 'Metro Manila',
            'street_address' => '88B Shaw Blvd',
            'id_type' => 'passport',
        ])->assertOk()
            ->assertJsonPath('data.status', 'pending_verification');

        $this->assertSame(2, $carla->verificationSubmissions()->count());

        $this->actingAs($carla->fresh())->getJson('/api/v1/account-status')
            ->assertOk()
            ->assertJsonPath('data.is_resubmission', true);

        // Admin sees previous denial history on AU-24 and approves Carla.
        $this->actingAs($admin)->getJson("/api/v1/admin/verification/{$carla->id}")
            ->assertOk()
            ->assertJsonPath('data.is_resubmission', true)
            ->assertJsonPath('data.previous_denial.denial_reason', 'id_photo_unreadable');

        $this->actingAs($admin)->postJson("/api/v1/admin/verification/{$carla->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertSame(AccountStatus::Active, $carla->fresh()->getStatus());
    }

    public function test_a_human_resubmission_needs_the_id_type_and_a_refused_save_changes_nothing(): void
    {
        $this->postJson('/api/v1/auth/sign-up/human', [
            'full_name' => 'Bea Navarro',
            'birthdate' => '1991-02-14',
            'contact_number' => '09175556666',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '5 Emerald Ave',
            'id_type' => 'umid',
            'valid_id' => UploadedFile::fake()->image('umid.jpg', 800, 600),
            'email' => 'bea@example.com',
            'password' => 'safePass123',
            'password_confirmation' => 'safePass123',
            'terms_accepted' => '1',
        ])->assertCreated();

        $bea = User::query()->where('email', 'bea@example.com')->firstOrFail();
        $details = [
            'full_name' => 'Bea Navarro',
            'birthdate' => '1991-02-14',
            'contact_number' => '09175556666',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '5 Emerald Ave',
        ];

        // The ID file may be left out to keep the one on file, but its type is still asked for (AU-19).
        foreach ([$details, [...$details, 'id_type' => ''], [...$details, 'id_type' => 'library_card']] as $body) {
            $this->actingAs($bea)->patchJson('/api/v1/account/submission', $body)
                ->assertUnprocessable()
                ->assertJsonPath('errors.id_type.0', 'Choose the type of ID.');
        }

        $this->assertSame(1, $bea->verificationSubmissions()->count());

        $this->actingAs($bea)->patchJson('/api/v1/account/submission', [...$details, 'id_type' => 'passport'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_verification');

        $this->assertSame(2, $bea->verificationSubmissions()->count());
        $this->actingAs($bea->fresh())->getJson('/api/v1/account-status')
            ->assertOk()
            ->assertJsonPath('data.documents.0.document_type', 'valid_id')
            ->assertJsonPath('data.documents.0.id_type', 'passport');
    }

    public function test_create_admin_artisan_command_creates_admin_account(): void
    {
        $this->artisan('pawfolio:create-admin', [
            '--email' => 'cli-admin@pawfolio.ph',
            '--name' => 'admin.cli',
            '--password' => 'StrongAdmin123',
        ])->assertExitCode(0);

        $admin = User::query()->where('email', 'cli-admin@pawfolio.ph')->firstOrFail();
        $this->assertTrue($admin->isAdmin());
        $this->assertTrue($admin->isActive());
    }
}
