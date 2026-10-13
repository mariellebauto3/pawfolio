<?php

namespace Tests\Feature;

use App\Enums\VerificationDocumentType;
use App\Models\AdoptionRequest;
use App\Models\Comment;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use App\Services\Uploads\FileUploadService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class CoreConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    public function test_chunked_scores_match_evaluation_and_remove_failed_pairs(): void
    {
        $home = HomeProfile::factory()->withQuizCompleted()->create();
        $home->acceptedSpecies()->create(['species' => 'dog']);
        $pets = Pet::factory()->count(201)->lookingForAHome()->create(['species' => 'dog', 'province' => $home->province]);
        $failed = Pet::factory()->lookingForAHome()->create(['species' => 'cat', 'province' => $home->province]);
        MatchScore::factory()->create(['pet_id' => $failed->id, 'home_profile_id' => $home->id]);
        $calculator = app(MatchScoreCalculator::class);
        $calculator->recalculateForHome($home);
        $scores = MatchScore::where('home_profile_id', $home->id)->get()->keyBy('pet_id');
        $this->assertCount(201, $scores);
        $home->load(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges']);
        foreach ($pets as $pet) {
            $pet->setRelation('specialNeeds', $pet->specialNeeds()->getRelated()->newCollection());
            $expected = $calculator->evaluate($pet, $home);
            foreach (['score', 'activity_points', 'hours_away_points', 'space_points', 'experience_points', 'size_age_points', 'compatibility_points', 'special_needs_points'] as $column) {
                $this->assertSame($expected[$column], $scores[$pet->id]->{$column});
            }
        }
        $created = $scores->first();
        $calculator->recalculateForHome($home);
        $this->assertSame($created->created_at->toISOString(), $created->fresh()->created_at->toISOString());
        $this->assertDatabaseCount('match_scores', 201);
    }

    public function test_score_recalculation_rolls_back_all_chunks_on_failure(): void
    {
        $home = HomeProfile::factory()->withQuizCompleted()->create();
        $home->acceptedSpecies()->create(['species' => 'dog']);
        Pet::factory()->count(201)->lookingForAHome()->create(['species' => 'dog', 'province' => $home->province]);
        $writes = 0;
        DB::listen(function ($query) use (&$writes): void {
            if (str_starts_with($query->sql, 'insert into "match_scores"') && ++$writes === 2) {
                throw new \RuntimeException('Second batch failed');
            }
        });
        try {
            app(MatchScoreCalculator::class)->recalculateForHome($home);
            $this->fail('Expected batch failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Second batch failed', $exception->getMessage());
        }
        $this->assertDatabaseCount('match_scores', 0);
    }

    public function test_pair_scoring_reloads_changed_inputs_and_keeps_one_row(): void
    {
        $home = HomeProfile::factory()->withQuizCompleted()->create();
        $home->acceptedSpecies()->create(['species' => 'dog']);
        $pet = Pet::factory()->lookingForAHome()->create(['species' => 'dog', 'province' => $home->province]);
        $calculator = app(MatchScoreCalculator::class);
        $calculator->evaluateAndPersist($pet, $home);
        $home->acceptedSpecies()->delete();
        $result = $calculator->evaluateAndPersist($pet, $home);
        $this->assertFalse($result['passes_dealbreakers']);
        $this->assertDatabaseCount('match_scores', 0);
        $home->acceptedSpecies()->create(['species' => 'dog']);
        $calculator->evaluateAndPersist($pet, $home);
        $calculator->evaluateAndPersist($pet, $home);
        $this->assertDatabaseCount('match_scores', 1);
    }

    public function test_feed_closed_home_links_are_viewer_scoped_without_n_plus_one_queries(): void
    {
        $viewer = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($viewer)->lookingForAHome()->create();
        foreach (range(1, 12) as $index) {
            $author = User::factory()->human()->active()->create();
            $home = HomeProfile::factory()->for($author)->withQuizCompleted()->create();
            Post::factory()->create(['author_user_id' => $author->id]);
            Invite::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $home->id]);
        }
        $this->actingAs($viewer);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $response = $this->getJson('/api/v1/feed')->assertOk();
        $this->assertLessThanOrEqual(11, count(DB::getQueryLog()));
        DB::disableQueryLog();
        foreach ($response->json('data') as $post) {
            $this->assertTrue($post['author']['is_profile_viewable']);
            $this->assertArrayNotHasKey('contact_number', $post['author']);
        }
        $other = User::factory()->pet()->active()->create();
        Pet::factory()->for($other)->lookingForAHome()->create();
        foreach ($this->actingAs($other)->getJson('/api/v1/feed')->assertOk()->json('data') as $post) {
            $this->assertFalse($post['author']['is_profile_viewable']);
        }
    }

    public function test_partial_post_upload_failure_removes_preceding_files(): void
    {
        $user = User::factory()->human()->active()->create();
        $this->actingAs($user)->postJson('/api/v1/posts', ['body' => 'Hello', 'photos' => [
            UploadedFile::fake()->image('good.png', 30, 30),
            UploadedFile::fake()->createWithContent('bad.png', 'malformed image'),
        ]])->assertUnprocessable()->assertJsonValidationErrors('photos.1');
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('posts', 0);
    }

    public function test_hidden_parent_replies_cannot_receive_reactions(): void
    {
        $author = User::factory()->human()->active()->create();
        $post = Post::factory()->create(['author_user_id' => $author->id]);
        $parent = Comment::factory()->create(['post_id' => $post->id, 'user_id' => $author->id, 'body' => 'Parent', 'removed_at' => now()]);
        $reply = Comment::factory()->create(['post_id' => $post->id, 'user_id' => $author->id, 'body' => 'Reply', 'parent_comment_id' => $parent->id]);
        $viewer = User::factory()->human()->active()->create();
        $this->actingAs($viewer)->postJson('/api/v1/comments/'.$reply->id.'/reactions')->assertNotFound();
        $this->assertDatabaseCount('reactions', 0);
    }

    public function test_reactions_toggle_serially_and_keep_only_one_like(): void
    {
        $user = User::factory()->human()->active()->create();
        $post = Post::factory()->create(['author_user_id' => $user->id]);
        $this->actingAs($user)->postJson('/api/v1/posts/'.$post->id.'/reactions')
            ->assertOk()->assertJsonPath('data.reacted', true)->assertJsonPath('data.reactions_count', 1);
        $this->postJson('/api/v1/posts/'.$post->id.'/reactions')
            ->assertOk()->assertJsonPath('data.reacted', false)->assertJsonPath('data.reactions_count', 0);
        $this->postJson('/api/v1/posts/'.$post->id.'/reactions')
            ->assertOk()->assertJsonPath('data.reacted', true)->assertJsonPath('data.reactions_count', 1);
        $this->assertDatabaseCount('reactions', 1);
    }

    public function test_post_database_failure_rolls_back_and_removes_uploads(): void
    {
        $user = User::factory()->human()->active()->create();
        Post::created(fn () => throw new \RuntimeException('Database failure'));
        try {
            $this->actingAs($user)->postJson('/api/v1/posts', ['body' => 'Hello', 'photos' => [UploadedFile::fake()->image('photo.png', 30, 30)]])->assertStatus(500);
        } finally {
            Post::flushEventListeners();
        }
        $this->assertDatabaseCount('posts', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_comment_and_notification_fail_together(): void
    {
        $author = User::factory()->human()->active()->create();
        $viewer = User::factory()->human()->active()->create();
        $post = Post::factory()->create(['author_user_id' => $author->id]);
        $this->mock(NotificationService::class, fn ($mock) => $mock->shouldReceive('store')->once()->andThrow(new \RuntimeException('Notification persistence failed')));
        $this->actingAs($viewer)->postJson('/api/v1/posts/'.$post->id.'/comments', ['body' => 'Comment'])
            ->assertStatus(500);
        $this->assertDatabaseCount('comments', 0);
    }

    public function test_unchanged_quiz_preferences_do_not_rebuild_answer_rows(): void
    {
        $user = User::factory()->human()->active()->create();
        $home = HomeProfile::factory()->for($user)->create();
        $answers = ['accepted_species' => ['dog', 'cat'], 'preferred_sizes' => ['medium'], 'preferred_ages' => ['adult']];
        $this->actingAs($user)->patchJson('/api/v1/me/home-profile/5', $answers)->assertOk();
        $ids = $home->acceptedSpecies()->pluck('id')->all();
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->patchJson('/api/v1/me/home-profile/5', $answers)->assertOk();
        $writes = array_filter(DB::getQueryLog(), fn ($query) => preg_match('/^(insert|delete).*home_profile_(accepted_species|preferred_sizes|preferred_ages)/', $query['query']));
        DB::disableQueryLog();
        $this->assertCount(0, $writes);
        $this->assertSame($ids, $home->acceptedSpecies()->pluck('id')->all());
    }

    public function test_removing_vet_record_preserves_file_used_by_verification(): void
    {
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();
        $path = 'verification/vet-records/shared.pdf';
        Storage::disk('local')->put($path, '%PDF-1.4');
        $record = $pet->vetRecords()->create(['file_path' => $path, 'mime_type' => 'application/pdf', 'size_bytes' => 8]);
        $submission = VerificationSubmission::factory()->create(['user_id' => $user->id]);
        $submission->documents()->create(['document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
            'file_path' => $path, 'mime_type' => 'application/pdf', 'size_bytes' => 8]);
        $this->actingAs($user)->deleteJson('/api/v1/me/pet/vet-records/'.$record->id)->assertOk();
        $this->assertSame(0, $pet->vetRecords()->count());
        Storage::disk('local')->assertExists($path);
    }

    public function test_post_photos_use_one_insert_and_keep_ids_and_order(): void
    {
        $user = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($user)->create();
        DB::enableQueryLog();
        DB::flushQueryLog();
        $response = $this->actingAs($user)->postJson('/api/v1/posts', ['body' => 'An update', 'photos' => [
            UploadedFile::fake()->image('one.png', 30, 30), UploadedFile::fake()->image('two.jpg', 30, 30), UploadedFile::fake()->image('three.png', 30, 30),
        ]])->assertCreated()->assertJsonCount(3, 'data.photos');
        $writes = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with($query['query'], 'insert into "post_photos"'));
        DB::disableQueryLog();
        $this->assertCount(1, $writes);
        $this->assertSame([1, 2, 3], array_column($response->json('data.photos'), 'sort_order'));
        $this->assertCount(3, array_unique(array_column($response->json('data.photos'), 'id')));
    }

    public function test_photo_limit_is_rechecked_after_upload_and_failed_upload_is_cleaned(): void
    {
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();
        foreach (range(1, 9) as $index) {
            $pet->photos()->create(['file_path' => 'existing/'.$index.'.png', 'sort_order' => $index]);
        }
        $actual = app(FileUploadService::class);
        $mock = Mockery::mock(FileUploadService::class)->makePartial();
        $mock->shouldReceive('storePublicPhoto')->once()->andReturnUsing(function ($file, $directory, $field) use ($actual, $pet) {
            $stored = $actual->storePublicPhoto($file, $directory, $field);
            // Model another request winning the final place during storage I/O.
            $pet->photos()->create(['file_path' => 'existing/competitor.png', 'sort_order' => 10]);

            return $stored;
        });
        $this->app->instance(FileUploadService::class, $mock);
        $this->actingAs($user)->postJson('/api/v1/me/pet/photos', ['photo' => UploadedFile::fake()->image('photo.png', 30, 30)])
            ->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->assertSame(10, $pet->photos()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_photo_deletion_checks_current_published_status_and_preserves_minimum(): void
    {
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();
        foreach (range(1, 3) as $index) {
            $photo = $pet->photos()->create(['file_path' => 'existing/'.$index.'.png', 'sort_order' => $index]);
        }
        $user->setRelation('pet', $pet);
        Pet::whereKey($pet->id)->update(['status' => 'looking_for_a_home']);
        $this->actingAs($user)->deleteJson('/api/v1/me/pet/photos/'.$photo->id)->assertConflict();
        $this->assertSame(3, $pet->photos()->count());
    }

    public function test_photo_reordering_uses_one_write_and_preserves_response_order(): void
    {
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();
        $ids = [];
        foreach (range(1, 10) as $index) {
            $ids[] = $pet->photos()->create(['file_path' => 'existing/'.$index.'.png', 'sort_order' => $index])->id;
        }
        $ids = array_reverse($ids);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $response = $this->actingAs($user)->patchJson('/api/v1/me/pet/photos/order', ['photo_ids' => $ids])->assertOk();
        $updates = array_filter(DB::getQueryLog(), fn ($query) => str_starts_with($query['query'], 'UPDATE pet_photos'));
        DB::disableQueryLog();
        $this->assertCount(1, $updates);
        $this->assertSame($ids, array_column($response->json('data.photos'), 'id'));
    }

    public function test_shared_public_photos_are_preserved_and_unreferenced_covers_are_removed(): void
    {
        $path = 'pets/covers/shared.png';
        Storage::disk('public')->put($path, 'image');
        $pet = Pet::factory()->create(['cover_photo_path' => $path]);
        $uploads = app(FileUploadService::class);
        $uploads->deleteUnreferencedPublicFile($path);
        Storage::disk('public')->assertExists($path);
        $pet->cover_photo_path = null;
        $pet->save();
        $uploads->deleteUnreferencedPublicFile($path);
        Storage::disk('public')->assertMissing($path);
        Storage::disk('public')->put('defaults/profile-avatar.png', 'default');
        $uploads->deleteUnreferencedPublicFile('defaults/profile-avatar.png');
        Storage::disk('public')->assertExists('defaults/profile-avatar.png');
    }

    private function uniqueViolation(callable $insert): void
    {
        try {
            DB::transaction($insert);
            $this->fail('Expected uniqueness enforcement.');
        } catch (UniqueConstraintViolationException) {
            $this->addToAssertionCount(1);
        }
    }

    public function test_available_slots_are_unique_but_deleted_history_can_repeat(): void
    {
        $slot = MeetGreetSlot::factory()->create();
        $attributes = ['home_profile_id' => $slot->home_profile_id, 'starts_at' => $slot->starts_at];
        $this->uniqueViolation(fn () => MeetGreetSlot::factory()->create($attributes));
        $slot->deleted_at = now();
        $slot->save();
        MeetGreetSlot::factory()->create($attributes);
        $this->assertDatabaseCount('meet_greet_slots', 2);
    }

    public function test_active_bookings_are_unique_per_request_and_slot_and_keep_ended_history(): void
    {
        $ar = AdoptionRequest::factory()->approved()->create();
        $slot = MeetGreetSlot::factory()->create(['home_profile_id' => $ar->home_profile_id]);
        MeetAndGreet::factory()->create(['adoption_request_id' => $ar->id, 'meet_greet_slot_id' => $slot->id]);
        $anotherSlot = MeetGreetSlot::factory()->create(['home_profile_id' => $ar->home_profile_id, 'starts_at' => $slot->starts_at->copy()->addDay()]);
        $this->uniqueViolation(fn () => MeetAndGreet::factory()->create(['adoption_request_id' => $ar->id, 'meet_greet_slot_id' => $anotherSlot->id]));
        $anotherRequest = AdoptionRequest::factory()->approved()->create();
        $this->uniqueViolation(fn () => MeetAndGreet::factory()->create(['adoption_request_id' => $anotherRequest->id, 'meet_greet_slot_id' => $slot->id]));
        MeetAndGreet::factory()->count(2)->create(['adoption_request_id' => $ar->id, 'meet_greet_slot_id' => $slot->id, 'status' => 'ended', 'ended_at' => now()]);
        $this->assertDatabaseCount('meet_and_greets', 3);
    }
}
