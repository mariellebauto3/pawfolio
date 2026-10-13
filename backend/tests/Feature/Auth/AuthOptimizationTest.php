<?php

namespace Tests\Feature\Auth;

use App\Actions\Auth\SignIn;
use App\Actions\Auth\SignUpHuman;
use App\Actions\Auth\SignUpPet;
use App\Http\Requests\Auth\SignUpHumanRequest;
use App\Http\Requests\Auth\SignUpPetRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\HomeProfile;
use App\Models\User;
use App\Rules\UniqueEmail;
use App\Services\Auth\BreachedPasswordVerifier;
use App\Services\Uploads\FileUploadService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AuthOptimizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Cache::flush();
    }

    public function test_breach_prefix_cache_preserves_threshold_and_avoids_http_requests(): void
    {
        $hash = strtoupper(sha1('safePass123'));
        Http::fake(['*' => Http::response(substr($hash, 5).':2')]);
        $verifier = app(BreachedPasswordVerifier::class);
        $this->assertFalse($verifier->verify(['value' => 'safePass123', 'threshold' => 0]));
        $this->assertTrue($verifier->verify(['value' => 'safePass123', 'threshold' => 2]));
        Http::assertSentCount(1);
    }

    public function test_breach_outages_and_malformed_responses_are_not_cached_or_accepted(): void
    {
        foreach ([Http::response('', 503), Http::response('invalid payload')] as $response) {
            Cache::forget('password-breach:unavailable');
            Http::fake(['*' => $response]);
            try {
                app(BreachedPasswordVerifier::class)->verify(['value' => 'safePass123', 'threshold' => 0]);
                $this->fail('Unavailable checks must not pass.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('password', $exception->errors());
            }
            $this->assertNull(Cache::get('password-breach:'.substr(strtoupper(sha1('safePass123')), 0, 5)));
        }
    }

    public function test_case_insensitive_uniqueness_is_validated_and_enforced_in_database(): void
    {
        User::factory()->create(['email' => 'Legacy@Example.com']);
        $this->assertTrue(Validator::make(['email' => 'legacy@example.com'], ['email' => new UniqueEmail])->fails());
        $this->expectException(UniqueConstraintViolationException::class);
        User::factory()->create(['email' => 'legacy@example.com']);
    }

    public function test_password_broker_retrieves_existing_mixed_case_accounts(): void
    {
        $user = User::factory()->create(['email' => 'Legacy@Example.com']);
        $provider = Auth::createUserProvider('users');
        $this->assertSame($user->id, $provider->retrieveByCredentials(['email' => 'legacy@example.com'])->id);
    }

    public function test_outage_cooldown_avoids_more_external_requests(): void
    {
        Http::fake(['*' => Http::response('', 503)]);
        foreach (['onePassword123', 'anotherPassword123'] as $password) {
            try {
                app(BreachedPasswordVerifier::class)->verify(['value' => $password, 'threshold' => 0]);
                $this->fail('Unavailable checks must fail.');
            } catch (ValidationException) {
                // Expected, without repeating the external call during cooldown.
            }
        }
        Http::assertSentCount(1);
    }

    public function test_contended_login_lock_rejects_without_resetting_failure_state(): void
    {
        $user = User::factory()->create();
        $request = Request::create('/');
        $key = 'sign-in:'.sha1($user->email.'|'.$request->ip());
        Cache::put($key.':tries', 4, 900);
        $lock = Cache::lock($key.':lock', 10);
        $this->assertTrue($lock->get());
        try {
            app(SignIn::class)($request, $user->email, 'password');
            $this->fail('Contended login must be refused.');
        } catch (ThrottleRequestsException) {
            $this->assertSame(4, Cache::get($key.':tries'));
        } finally {
            $lock->release();
        }
    }

    private function humanRequest(): SignUpHumanRequest
    {
        return new SignUpHumanRequest([
            'email' => 'new@example.com', 'password' => 'safePass123',
            'full_name' => 'New Human', 'birthdate' => '1990-01-01',
            'contact_number' => '09171234567', 'city' => 'Manila',
            'province' => 'Metro Manila', 'street_address' => '123 Street', 'id_type' => 'umid',
        ], [], [], [], ['valid_id' => UploadedFile::fake()->image('id.png', 100, 100)]);
    }

    public function test_database_failure_rolls_back_account_and_deletes_uploaded_id(): void
    {
        HomeProfile::created(fn () => throw new \RuntimeException('Simulated database failure'));
        try {
            app(SignUpHuman::class)($this->humanRequest());
            $this->fail('Expected failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated database failure', $exception->getMessage());
        } finally {
            HomeProfile::flushEventListeners();
        }
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('home_profiles', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_registration_duplicate_race_returns_validation_and_removes_uploaded_files(): void
    {
        User::factory()->create(['email' => 'NEW@example.com']);
        try {
            // Invoke after request validation, as if another registration just committed.
            app(SignUpHuman::class)($this->humanRequest());
            $this->fail('Duplicate email must fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('email', $exception->errors());
        }
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('home_profiles', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_pet_registration_reuses_profile_and_empty_gallery(): void
    {
        $request = new SignUpPetRequest([
            'email' => 'pet@example.com', 'password' => 'safePass123',
            'name' => 'Mochi', 'species' => 'dog', 'breed' => 'Mixed',
            'approximate_age_months' => 12, 'currently_at' => 'Foster home',
            'city' => 'Manila', 'province' => 'Metro Manila', 'caretaker_name' => 'Caretaker',
            'caretaker_contact_number' => '09171234567',
        ], [], [], [], [
            'photos' => [UploadedFile::fake()->image('one.png', 100, 100), UploadedFile::fake()->image('two.jpg', 100, 100)],
            'valid_id' => UploadedFile::fake()->image('id.png', 100, 100),
        ]);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $user = app(SignUpPet::class)($request);
        $data = (new AuthenticatedUserResource($user))->resolve();
        $this->assertSame('Mochi', $data['display_name']);
        $this->assertNull($data['avatar_url']);
        $selects = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with(strtolower($query['query']), 'select'));
        $this->assertCount(0, $selects);
        DB::flushQueryLog();
        $user->load(['pet', 'homeProfile']);
        $this->assertSame($data, (new AuthenticatedUserResource($user))->resolve());
        $selects = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with(strtolower($query['query']), 'select'));
        $this->assertCount(3, $selects);
        DB::disableQueryLog();
        $this->assertCount(3, Storage::disk('local')->allFiles());
    }

    public function test_partial_pet_upload_failure_cleans_up_previous_photo(): void
    {
        $request = new SignUpPetRequest(['password' => 'safePass123'], [], [], [], [
            'photos' => [UploadedFile::fake()->image('good.png', 100, 100),
                UploadedFile::fake()->createWithContent('bad.png', 'invalid image')],
        ]);
        try {
            app(SignUpPet::class)($request);
            $this->fail('Malformed image must fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('photos.1', $exception->errors());
        }
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertDatabaseCount('users', 0);
    }

    public function test_registration_response_reuses_created_profile_without_select_queries(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $user = app(SignUpHuman::class)($this->humanRequest());
        $data = (new AuthenticatedUserResource($user))->resolve();
        $this->assertSame('New Human', $data['display_name']);
        $selects = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with(strtolower($query['query']), 'select'));
        $this->assertCount(0, $selects);
        DB::flushQueryLog();
        // Replay the original action's unconditional relationship reload.
        $user->load(['pet', 'homeProfile']);
        $this->assertSame($data, (new AuthenticatedUserResource($user))->resolve());
        $selects = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with(strtolower($query['query']), 'select'));
        $this->assertCount(2, $selects);
        DB::disableQueryLog();
    }

    public function test_extreme_dimensions_are_rejected_before_decoding(): void
    {
        // Header is a valid tiny PNG whose IHDR advertises excessive dimensions.
        $image = imagecreatetruecolor(1, 1);
        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();
        imagedestroy($image);
        $bytes = substr_replace($bytes, pack('NN', 20000, 20000), 16, 8);
        $file = UploadedFile::fake()->createWithContent('bomb.png', $bytes);
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Image dimensions are too large');
        app(FileUploadService::class)->storePrivatePhoto($file);
    }

    public function test_orphan_reconciliation_previews_and_preserves_references_and_recent_uploads(): void
    {
        $user = app(SignUpHuman::class)($this->humanRequest());
        $referenced = $user->verificationDocuments()->value('file_path');
        $orphan = 'verification/ids/'.Str::uuid().'.png';
        $recent = 'verification/pet-photos/'.Str::uuid().'.jpg';
        $disk = Storage::disk('local');
        $disk->put($orphan, 'orphan');
        $disk->put($recent, 'recent upload');
        foreach ([$referenced, $orphan] as $path) {
            touch($disk->path($path), now()->subDays(2)->timestamp);
        }
        $this->artisan('uploads:prune-registration-orphans')->assertSuccessful();
        $disk->assertExists([$orphan, $referenced, $recent]);
        $this->artisan('uploads:prune-registration-orphans', ['--delete' => true])->assertSuccessful();
        $disk->assertMissing($orphan);
        $disk->assertExists([$referenced, $recent]);
    }
}
