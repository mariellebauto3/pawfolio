<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\VerificationDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The admin verification endpoints as docs/api/auth.md describes them (BE-08, AU-22..AU-26, FR33).
 */
class AdminVerificationTest extends TestCase
{
    use RefreshDatabase;

    private const QUEUE = '/api/v1/admin/verifications';

    private const DOCUMENT_KEYS = ['document_type', 'id_type', 'mime_type', 'size_bytes', 'uploaded_at'];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        Http::fake(['api.pwnedpasswords.com/range/*' => Http::response('')]);
    }

    public function test_only_active_admins_reach_the_endpoints(): void
    {
        $bea = $this->signUpHuman('Bea Navarro');
        $document = $bea->verificationDocuments()->firstOrFail();
        $paths = [
            ['GET', self::QUEUE],
            ['GET', self::QUEUE."/{$bea->id}"],
            ['GET', self::QUEUE."/{$bea->id}/documents/{$document->id}"],
            ['POST', self::QUEUE."/{$bea->id}/approve"],
            ['POST', self::QUEUE."/{$bea->id}/deny"],
        ];

        foreach ($paths as [$method, $path]) {
            $this->json($method, $path)->assertUnauthorized();
        }

        // A pet or a human is told the page is for admins, and the attempt is logged (SEC-LOG-02).
        foreach ([User::factory()->human()->active()->create(), User::factory()->pet()->active()->create()] as $member) {
            foreach ($paths as [$method, $path]) {
                $this->actingAs($member)->json($method, $path)
                    ->assertForbidden()
                    ->assertJsonPath('message', 'This page is for admins only.');
            }
        }
        $this->assertSame(10, ActivityLog::query()->where('type', 'security')->where('action', 'admin_access_denied')->count());

        // The owner can't read their own document either: the account isn't Active, and it isn't an admin.
        $this->actingAs($bea)->getJson(self::QUEUE."/{$bea->id}/documents/{$document->id}")
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        // An admin account that isn't Active is stopped like any other.
        $suspended = User::factory()->admin()->create(['status' => AccountStatus::Suspended]);
        $this->actingAs($suspended)->getJson(self::QUEUE)
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        $this->assertSame(AccountStatus::PendingVerification, $bea->fresh()->getStatus());
    }

    public function test_the_queue_lists_each_waiting_account_once_newest_first(): void
    {
        $this->travelTo('2026-10-01 08:00:00');
        $bea = $this->signUpHuman('Bea Navarro');
        $this->travelTo('2026-10-01 09:00:00');
        $kulit = $this->signUpPet('Kulit', 'Joy Lim');
        $this->travelTo('2026-10-01 10:00:00');
        $carla = $this->signUpHuman('Carla Mendoza');
        $this->travelTo('2026-10-01 11:00:00');
        $dan = $this->signUpHuman('Dan Ramos');

        $admin = $this->admin();
        $this->actingAs($admin)->postJson(self::QUEUE."/{$dan->id}/approve")->assertOk();

        // Bea edits while still Pending: a second row for her, and she goes to the top of the queue.
        $this->travelTo('2026-10-01 12:00:00');
        $this->actingAs($bea)->patchJson('/api/v1/account/submission', [...$this->humanDetails('Bea Navarro'), 'id_type' => 'umid'])->assertOk();
        $this->assertSame(2, $bea->verificationSubmissions()->count());

        $response = $this->actingAs($admin)->getJson(self::QUEUE)->assertOk();

        $response->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('data.0.account_id', $bea->id)
            ->assertJsonPath('data.1.account_id', $carla->id)
            ->assertJsonPath('data.2.account_id', $kulit->id)
            ->assertJsonPath('data.2.role', 'pet')
            ->assertJsonPath('data.2.display_name', 'Kulit')
            ->assertJsonPath('data.2.caretaker_name', 'Joy Lim')
            ->assertJsonPath('data.2.is_resubmission', false)
            ->assertJsonPath('data.1.role', 'human')
            ->assertJsonPath('data.1.display_name', 'Carla Mendoza')
            ->assertJsonPath('data.1.caretaker_name', null)
            ->assertJsonPath('data.0.is_resubmission', true);

        $this->assertSame(
            ['account_id', 'role', 'display_name', 'caretaker_name', 'submitted_at', 'is_resubmission', 'documents'],
            array_keys($response->json('data.0')),
        );
        // Documents are described, never linked: no id, path or URL (SEC-PRIV-01).
        $this->assertSame(self::DOCUMENT_KEYS, array_keys($response->json('data.0.documents.0')));
        $this->assertSame(['valid_id', 'pet_photo'], array_column($response->json('data.2.documents'), 'document_type'));
        $this->assertSame('umid', $response->json('data.1.documents.0.id_type'));
    }

    public function test_the_queue_filters_by_account_type_and_name(): void
    {
        $this->travelTo('2026-10-01 08:00:00');
        $bea = $this->signUpHuman('Bea Navarro');
        $this->travelTo('2026-10-01 09:00:00');
        $kulit = $this->signUpPet('Kulit', 'Joy Lim');
        $this->travelTo('2026-10-01 10:00:00');
        $this->signUpHuman('Carla Mendoza');
        $admin = $this->admin();

        $ids = fn (string $query) => array_column($this->actingAs($admin)->getJson(self::QUEUE.$query)->assertOk()->json('data'), 'account_id');

        $this->assertSame([$kulit->id], $ids('?role=pet'));
        $this->assertSame(2, count($ids('?role=human')));
        $this->assertSame([$kulit->id], $ids('?search=KUL'));
        $this->assertSame([$kulit->id], $ids('?search=joy%20l'));
        $this->assertSame([$bea->id], $ids('?search=%20navarro%20'));
        $this->assertSame([], $ids('?search=nobody'));
        // Wildcards are searched for as typed, not as patterns.
        $this->assertSame([], $ids('?search=%25'));
        $this->assertSame([], $ids('?search=_'));
        $this->assertSame([$kulit->id], $ids('?role=pet&search=kulit'));
        $this->assertSame([], $ids('?role=human&search=kulit'));

        $this->actingAs($admin)->getJson(self::QUEUE.'?role=admin')
            ->assertUnprocessable()
            ->assertJsonPath('errors.role.0', 'Choose Pet or Human.');
        $this->actingAs($admin)->getJson(self::QUEUE.'?search='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonPath('errors.search.0', 'Search for 100 characters or fewer.');

        // The sidebar's count: one row asked for, the total comes with it. Pages never go over 50.
        $this->actingAs($admin)->getJson(self::QUEUE.'?per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 3);
        $this->actingAs($admin)->getJson(self::QUEUE.'?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_the_review_shows_what_was_submitted_and_where_it_stands(): void
    {
        $this->travelTo('2026-10-01 08:00:00');
        $bea = $this->signUpHuman('Bea Navarro');
        $this->travelTo('2026-10-01 09:00:00');
        $kulit = $this->signUpPet('Kulit', 'Joy Lim');
        $this->travelTo('2026-10-01 10:00:00');
        $carla = $this->signUpHuman('Carla Mendoza');
        $admin = $this->admin();

        $review = $this->actingAs($admin)->getJson(self::QUEUE."/{$kulit->id}")->assertOk();
        $this->assertSame(
            [
                'account_id', 'display_name', 'account_status', 'status', 'submitted_at', 'is_resubmission', 'previous_denial',
                'reviewed_at', 'reviewed_by', 'denial_reason', 'message_to_owner', 'details', 'documents', 'queue',
            ],
            array_keys($review->json('data')),
        );
        $review->assertJsonPath('data.account_id', $kulit->id)
            ->assertJsonPath('data.display_name', 'Kulit')
            ->assertJsonPath('data.account_status', 'pending_verification')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.is_resubmission', false)
            ->assertJsonPath('data.previous_denial', null)
            ->assertJsonPath('data.reviewed_at', null)
            ->assertJsonPath('data.reviewed_by', null)
            ->assertJsonPath('data.details', [
                'role' => 'pet',
                'name' => 'Kulit',
                'species' => 'cat',
                'breed' => 'Puspin',
                'approximate_age_months' => 8,
                'currently_at' => 'With the finder',
                'city' => 'Pasig',
                'province' => 'Metro Manila',
                'caretaker_name' => 'Joy Lim',
                'caretaker_contact_number' => '09170000014',
            ])
            ->assertJsonPath('data.queue', ['position' => 2, 'total' => 3, 'next_account_id' => $bea->id]);
        $this->assertSame(['id', ...self::DOCUMENT_KEYS], array_keys($review->json('data.documents.0')));

        // A human's street address isn't sent (SEC-PRIV-04); the newest account is first and points to the one under it.
        $this->actingAs($admin)->getJson(self::QUEUE."/{$carla->id}")
            ->assertOk()
            ->assertJsonPath('data.details', [
                'role' => 'human',
                'full_name' => 'Carla Mendoza',
                'birthdate' => '1991-02-14',
                'contact_number' => '09175556666',
                'city' => 'Pasig',
                'province' => 'Metro Manila',
            ])
            ->assertJsonPath('data.queue', ['position' => 1, 'total' => 3, 'next_account_id' => $kulit->id]);

        // The oldest account is last and points back to the newest.
        $this->actingAs($admin)->getJson(self::QUEUE."/{$bea->id}")
            ->assertOk()
            ->assertJsonPath('data.queue', ['position' => 3, 'total' => 3, 'next_account_id' => $carla->id]);

        // Unknown id, an admin's id and an account that never submitted all answer 404 (SEC-AUTHZ-04).
        $neverSubmitted = User::factory()->human()->pendingVerification()->create();
        foreach ([999999, $admin->id, $neverSubmitted->id] as $id) {
            $this->actingAs($admin)->getJson(self::QUEUE."/{$id}")->assertNotFound();
            $this->actingAs($admin)->postJson(self::QUEUE."/{$id}/approve")->assertNotFound();
            $this->actingAs($admin)->postJson(self::QUEUE."/{$id}/deny", ['denial_reason' => 'id_expired'])->assertNotFound();
        }
        $this->actingAs($admin)->getJson(self::QUEUE.'/not-a-number')->assertNotFound();
    }

    public function test_a_document_is_streamed_from_the_private_disk_to_admins_only(): void
    {
        $bea = $this->signUpHuman('Bea Navarro');
        $carla = $this->signUpHuman('Carla Mendoza');
        $admin = $this->admin();
        $document = $bea->verificationDocuments()->firstOrFail();
        $path = self::QUEUE."/{$bea->id}/documents/{$document->id}";

        $response = $this->actingAs($admin)->get($path)->assertOk();
        $this->assertSame(Storage::disk('local')->get($document->file_path), $response->getContent());
        $this->assertSame('image/jpeg', $response->headers->get('Content-Type'));
        $this->assertSame('inline', $response->headers->get('Content-Disposition'));
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        Storage::disk('public')->assertMissing($document->file_path);

        // Another account's document under this account's id answers like one that doesn't exist.
        $this->actingAs($admin)->getJson(self::QUEUE."/{$carla->id}/documents/{$document->id}")->assertNotFound();
        $this->actingAs($admin)->getJson(self::QUEUE."/{$bea->id}/documents/999999")->assertNotFound();

        // Only the latest submission's documents: after Bea sends a new ID, the old one isn't served.
        $this->actingAs($bea)->post('/api/v1/account/submission', [
            ...$this->humanDetails('Bea Navarro'),
            'id_type' => 'passport',
            'valid_id' => UploadedFile::fake()->image('passport.png', 800, 600),
            '_method' => 'PATCH',
        ])->assertOk();
        $this->actingAs($admin)->getJson($path)->assertNotFound();
        $replacement = VerificationDocument::query()->latest('id')->firstOrFail();
        $this->actingAs($admin)->get(self::QUEUE."/{$bea->id}/documents/{$replacement->id}")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');

        // A row whose file is gone is a 404, not an error.
        Storage::disk('local')->delete($replacement->file_path);
        $this->actingAs($admin)->getJson(self::QUEUE."/{$bea->id}/documents/{$replacement->id}")->assertNotFound();
    }

    public function test_approve_activates_the_account_once(): void
    {
        $bea = $this->signUpHuman('Bea Navarro');
        $admin = $this->admin('admin.jess');
        $other = $this->admin('admin.mark');

        $this->actingAs($bea)->getJson('/api/v1/feed')->assertForbidden();

        // `status` and anything else in the body is ignored (SEC-INPUT-04).
        $this->actingAs($admin)->postJson(self::QUEUE."/{$bea->id}/approve", ['status' => 'denied', 'reviewed_by' => 'someone'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.account_status', 'active')
            ->assertJsonPath('data.reviewed_by', 'admin.jess')
            ->assertJsonPath('data.denial_reason', null)
            ->assertJsonPath('data.queue.position', null)
            ->assertJsonPath('data.queue.total', 0);

        $bea->refresh();
        $this->assertSame(AccountStatus::Active, $bea->getStatus());
        $this->actingAs($bea)->getJson('/api/v1/feed')->assertOk();

        $log = ActivityLog::query()->where('action', 'account_approved')->sole();
        $this->assertSame([$admin->id, $bea->id, 'pending_verification', 'active'], [$log->actor_user_id, $log->subject_id, $log->before_value, $log->after_value]);
        $this->assertSame(1, $bea->notifications()->where('type', 'verification_approved')->count());

        // A second decision, by anyone, is refused and changes nothing.
        $this->actingAs($other)->postJson(self::QUEUE."/{$bea->id}/approve")
            ->assertConflict()
            ->assertJsonPath('code', 'verification_already_reviewed')
            ->assertJsonPath('message', 'This account was already approved by admin.jess.');
        $this->actingAs($other)->postJson(self::QUEUE."/{$bea->id}/deny", ['denial_reason' => 'id_expired'])
            ->assertConflict()
            ->assertJsonPath('code', 'verification_already_reviewed');
        $this->assertSame(AccountStatus::Active, $bea->fresh()->getStatus());
        $this->assertSame(1, ActivityLog::query()->where('type', 'verification')->where('subject_id', $bea->id)->whereIn('action', ['account_approved', 'account_denied'])->count());
    }

    public function test_sign_up_photos_stay_private_until_the_pet_is_approved(): void
    {
        $kulit = $this->signUpPet('Kulit', 'Joy Lim', photos: 2);
        $photos = $kulit->verificationDocuments()->where('document_type', 'pet_photo')->get();

        $this->assertCount(2, $photos);
        $photos->each(fn (VerificationDocument $photo) => Storage::disk('local')->assertExists($photo->file_path));
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame(0, $kulit->pet->photos()->count());
        $this->actingAs($kulit)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.avatar_url', null);

        // A Pending owner who sends new photos still has nothing public.
        $this->actingAs($kulit)->post('/api/v1/account/submission', [
            ...$this->petDetails('Kulit', 'Joy Lim'),
            'photos' => [UploadedFile::fake()->image('new.png', 640, 480)],
            '_method' => 'PATCH',
        ])->assertOk();
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->actingAs($this->admin())->postJson(self::QUEUE."/{$kulit->id}/approve")->assertOk();

        // Approved: the photos of the approved submission become the gallery, and the private copies stay.
        $gallery = $kulit->pet->photos()->orderBy('sort_order')->get();
        $this->assertCount(1, $gallery);
        $this->assertStringStartsWith('pets/photos/', $gallery[0]->file_path);
        $this->assertStringEndsWith('.png', $gallery[0]->file_path);
        Storage::disk('public')->assertExists($gallery[0]->file_path);
        $approved = $kulit->verificationSubmissions()->latest('id')->firstOrFail()->documents()->where('document_type', 'pet_photo')->sole();
        Storage::disk('local')->assertExists($approved->file_path);
        $this->assertNotNull($this->actingAs($kulit->fresh())->getJson('/api/v1/auth/me')->json('data.avatar_url'));
        $this->assertSame('draft', $kulit->pet->fresh()->status->value ?? $kulit->pet->fresh()->status);
    }

    public function test_deny_needs_a_reason_and_tells_the_owner(): void
    {
        $bea = $this->signUpHuman('Bea Navarro');
        $admin = $this->admin('admin.jess');
        $deny = fn (array $body) => $this->actingAs($admin)->postJson(self::QUEUE."/{$bea->id}/deny", $body);

        $deny([])->assertUnprocessable()->assertJsonPath('errors.denial_reason.0', 'Choose a reason.');
        $deny(['denial_reason' => 'because'])->assertUnprocessable()->assertJsonPath('errors.denial_reason.0', 'Choose a reason.');
        $deny(['denial_reason' => 'other'])->assertUnprocessable()
            ->assertJsonPath('errors.message_to_owner.0', 'Write a message so the owner knows what to correct.');
        $deny(['denial_reason' => 'other', 'message_to_owner' => '   '])->assertUnprocessable()
            ->assertJsonPath('errors.message_to_owner.0', 'Write a message so the owner knows what to correct.');
        $deny(['denial_reason' => 'id_expired', 'message_to_owner' => str_repeat('a', 501)])->assertUnprocessable()
            ->assertJsonPath('errors.message_to_owner.0', 'Keep the message to 500 characters or fewer.');
        $this->assertSame(AccountStatus::PendingVerification, $bea->fresh()->getStatus());

        // A listed reason needs no message. `status` in the body is ignored (SEC-INPUT-04).
        $deny(['denial_reason' => 'name_mismatch', 'status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.account_status', 'denied')
            ->assertJsonPath('data.denial_reason', 'name_mismatch')
            ->assertJsonPath('data.message_to_owner', null)
            ->assertJsonPath('data.reviewed_by', 'admin.jess')
            ->assertJsonPath('data.queue.position', null);

        $this->actingAs($bea->fresh())->getJson('/api/v1/account-status')
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.denial_reason', 'name_mismatch')
            ->assertJsonPath('data.reason', null);

        $log = ActivityLog::query()->where('action', 'account_denied')->sole();
        $this->assertSame([$admin->id, $bea->id, 'pending_verification', 'denied', 'name_mismatch'], [$log->actor_user_id, $log->subject_id, $log->before_value, $log->after_value, $log->reason]);
        $this->assertSame(1, $bea->notifications()->where('type', 'verification_denied')->count());

        $deny(['denial_reason' => 'id_expired'])
            ->assertConflict()
            ->assertJsonPath('code', 'verification_already_reviewed')
            ->assertJsonPath('message', 'This account was already denied by admin.jess.');
    }

    public function test_a_resubmission_shows_the_previous_denial(): void
    {
        $this->travelTo('2026-10-01 08:00:00');
        $bea = $this->signUpHuman('Bea Navarro');
        $admin = $this->admin();

        $this->travelTo('2026-10-01 09:00:00');
        $this->actingAs($admin)->postJson(self::QUEUE."/{$bea->id}/deny", [
            'denial_reason' => 'other',
            'message_to_owner' => '  The name on the ID is cut off.  ',
        ])->assertOk()->assertJsonPath('data.message_to_owner', 'The name on the ID is cut off.');
        $this->actingAs($admin)->getJson(self::QUEUE)->assertOk()->assertJsonPath('meta.total', 0);

        $this->travelTo('2026-10-01 10:00:00');
        $this->actingAs($bea->fresh())->patchJson('/api/v1/account/submission', [...$this->humanDetails('Bea Navarro'), 'id_type' => 'umid'])->assertOk();
        // She edits once more before anyone reviews it: the denial is still the last reviewed round.
        $this->travelTo('2026-10-01 11:00:00');
        $this->actingAs($bea->fresh())->patchJson('/api/v1/account/submission', [...$this->humanDetails('Bea Navarro'), 'id_type' => 'umid'])->assertOk();

        $this->actingAs($admin)->getJson(self::QUEUE."/{$bea->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.account_status', 'pending_verification')
            ->assertJsonPath('data.is_resubmission', true)
            ->assertJsonPath('data.denial_reason', null)
            ->assertJsonPath('data.previous_denial.denial_reason', 'other')
            ->assertJsonPath('data.previous_denial.message_to_owner', 'The name on the ID is cut off.')
            ->assertJsonPath('data.queue', ['position' => 1, 'total' => 1, 'next_account_id' => null]);
        $this->actingAs($admin)->getJson(self::QUEUE)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.is_resubmission', true);

        // Approved after the resubmission: the earlier denial is still the previous round.
        $this->actingAs($admin)->postJson(self::QUEUE."/{$bea->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.previous_denial.denial_reason', 'other');
    }

    private function admin(string $name = 'admin.jess'): User
    {
        return User::factory()->admin()->active()->create(['name' => $name]);
    }

    /**
     * @return array<string, mixed>
     */
    private function humanDetails(string $fullName): array
    {
        return [
            'full_name' => $fullName,
            'birthdate' => '1991-02-14',
            'contact_number' => '09175556666',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'street_address' => '5 Emerald Ave',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function petDetails(string $name, string $caretaker): array
    {
        return [
            'name' => $name,
            'species' => 'cat',
            'breed' => 'Puspin',
            'approximate_age_months' => 8,
            'currently_at' => 'With the finder',
            'city' => 'Pasig',
            'province' => 'Metro Manila',
            'caretaker_name' => $caretaker,
            'caretaker_contact_number' => '09170000014',
        ];
    }

    /** Signs a human up through the real endpoint, so the submission and its files are what the API makes. */
    private function signUpHuman(string $fullName): User
    {
        $email = strtolower(str_replace(' ', '.', $fullName)).'@example.com';

        $this->post('/api/v1/auth/sign-up/human', [
            ...$this->humanDetails($fullName),
            'id_type' => 'umid',
            'valid_id' => UploadedFile::fake()->image('id.jpg', 800, 600),
            ...$this->login($email),
        ], ['Accept' => 'application/json'])->assertCreated();

        return $this->signedUp($email);
    }

    private function signUpPet(string $name, string $caretaker, int $photos = 1): User
    {
        $email = strtolower($name).'@example.com';

        $this->post('/api/v1/auth/sign-up/pet', [
            ...$this->petDetails($name, $caretaker),
            'photos' => array_map(fn (int $i) => UploadedFile::fake()->image("photo-{$i}.jpg", 640, 480), range(1, $photos)),
            'valid_id' => UploadedFile::fake()->image('id.jpg', 800, 600),
            ...$this->login($email),
        ], ['Accept' => 'application/json'])->assertCreated();

        return $this->signedUp($email);
    }

    /**
     * @return array<string, string>
     */
    private function login(string $email): array
    {
        return ['email' => $email, 'password' => 'safePass123', 'password_confirmation' => 'safePass123', 'terms_accepted' => '1'];
    }

    /** Sign-up signs the new account in; sign it out again so the next request starts as a visitor. */
    private function signedUp(string $email): User
    {
        Auth::guard('web')->logout();
        $this->app['auth']->forgetGuards();

        return User::query()->where('email', $email)->firstOrFail();
    }
}
