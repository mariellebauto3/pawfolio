<?php

declare(strict_types=1);

namespace Tests\Feature\CommunityFeed;

use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\Post;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HomeFeedLoadingTest extends TestCase
{
    use RefreshDatabase;

    public function test_cursor_batches_keep_tied_dates_stable_during_insertions_and_deletions(): void
    {
        $viewer = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($viewer)->create();
        $posts = Post::factory()->count(25)->for($viewer, 'author')->create(['created_at' => now()->subHour()]);
        $expected = $posts->pluck('id')->sortDesc()->values()->all();
        $this->actingAs($viewer);
        $first = $this->getJson('/api/v1/feed?pagination=cursor')->assertOk()->assertJsonCount(10, 'data');
        $this->assertSame(array_slice($expected, 0, 10), array_column($first->json('data'), 'id'));
        $first->assertJsonPath('meta.has_more', true);
        $this->assertArrayNotHasKey('total', $first->json('meta'));

        // A newly posted item and a deleted item from the loaded batch must not shift the next batch.
        Post::factory()->for($viewer, 'author')->create(['created_at' => now()]);
        Post::whereKey($expected[0])->update(['deleted_at' => now()]);
        $second = $this->getJson('/api/v1/feed?pagination=cursor&cursor='.urlencode($first->json('meta.next_cursor')))
            ->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.announcements', []);
        $this->assertSame(array_slice($expected, 10, 10), array_column($second->json('data'), 'id'));
        $last = $this->getJson('/api/v1/feed?pagination=cursor&cursor='.urlencode($second->json('meta.next_cursor')))
            ->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('meta.has_more', false)->assertJsonPath('meta.next_cursor', null);
        $this->assertSame(array_slice($expected, 20), array_column($last->json('data'), 'id'));
    }

    public function test_cursor_reads_do_not_count_or_offset_the_whole_feed_and_preserve_likes_and_visibility(): void
    {
        $viewer = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($viewer)->create();
        $post = Post::factory()->for($viewer, 'author')->create();
        Reaction::factory()->create(['user_id' => $viewer->id, 'post_id' => $post->id, 'comment_id' => null]);
        Post::factory()->for(User::factory()->pet()->suspended(), 'author')->create();
        Post::factory()->for($viewer, 'author')->create(['removed_at' => now()]);
        $this->actingAs($viewer);
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $this->getJson('/api/v1/feed?pagination=cursor')->assertOk()->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.has_reacted', true)->assertJsonPath('data.0.reactions_count', 1);
            $queries = collect(DB::getQueryLog())->pluck('query')->implode("\n");
            $this->assertStringNotContainsString('offset', strtolower($queries));
            $this->assertStringNotContainsString('count(*) as aggregate from "posts"', strtolower($queries));
        } finally {
            DB::disableQueryLog();
        }
    }

    public function test_home_summary_counts_only_visible_invites_without_loading_their_cards(): void
    {
        $viewer = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($viewer)->lookingForAHome()->create();
        $activeHome = HomeProfile::factory()->for(User::factory()->human()->active())->create();
        $hiddenHome = HomeProfile::factory()->for(User::factory()->human()->suspended())->create();
        Invite::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $activeHome->id]);
        Invite::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $hiddenHome->id]);
        $answer = $this->actingAs($viewer)->getJson('/api/v1/feed?pagination=cursor&include_home=1')->assertOk()
            ->assertJsonPath('meta.home.name', $pet->name)->assertJsonPath('meta.home.invites_count', 1);
        $this->assertArrayNotHasKey('contact_number', $answer->json('meta.home'));
        $this->assertArrayNotHasKey('caretaker_contact_number', $answer->json('meta.home'));
        $this->assertArrayNotHasKey('invites', $answer->json('meta.home'));
    }

    public function test_human_home_counts_saved_pets_without_returning_full_bookmarks_or_private_fields(): void
    {
        $viewer = User::factory()->human()->active()->create();
        $home = HomeProfile::factory()->for($viewer)->create();
        $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create();
        $draft = Pet::factory()->for(User::factory()->pet()->active())->draft()->create();
        foreach ([$pet, $draft] as $saved) {
            $bookmark = new Bookmark;
            $bookmark->user_id = $viewer->id;
            $bookmark->pet_id = $saved->id;
            $bookmark->save();
        }
        $answer = $this->actingAs($viewer)->getJson('/api/v1/feed?pagination=cursor&include_home=1')->assertOk()
            ->assertJsonPath('meta.home.name', $home->full_name)->assertJsonPath('meta.home.saved_pets_count', 1);
        foreach (['street_address', 'contact_number', 'birthdate', 'bookmarks'] as $private) {
            $this->assertArrayNotHasKey($private, $answer->json('meta.home'));
        }
    }

    public function test_invalid_cursors_and_oversized_batches_are_rejected_and_status_guards_remain(): void
    {
        $viewer = User::factory()->human()->active()->create();
        $this->getJson('/api/v1/feed?pagination=cursor')->assertUnauthorized();
        $this->actingAs($viewer)->getJson('/api/v1/feed?pagination=cursor&cursor=garbage')->assertUnprocessable();
        $this->getJson('/api/v1/feed?pagination=cursor&cursor='.urlencode(base64_encode('null')))->assertUnprocessable();
        $this->getJson('/api/v1/feed?pagination=cursor&cursor[]=invalid')->assertUnprocessable();
        $booleanId = base64_encode(json_encode(['created_at' => '2026-10-13 12:00:00', 'id' => true, '_pointsToNextItems' => true]));
        $this->getJson('/api/v1/feed?pagination=cursor&cursor='.urlencode($booleanId))->assertUnprocessable();
        $this->getJson('/api/v1/feed?pagination=cursor&per_page=1000')->assertUnprocessable();
        $this->actingAs(User::factory()->pet()->pendingVerification()->create())
            ->getJson('/api/v1/feed?pagination=cursor&include_home=1')->assertForbidden();
    }

    public function test_pet_home_suggestions_keep_ranking_and_visibility_without_loading_full_home_profiles(): void
    {
        $viewer = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($viewer)->lookingForAHome()->create();
        foreach ([70, 90, 80, 60] as $score) {
            $home = HomeProfile::factory()->for(User::factory()->human()->active())->withQuizCompleted()->create(['is_open_to_adopt' => true]);
            MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $home->id, 'score' => $score]);
        }
        $hidden = HomeProfile::factory()->for(User::factory()->human()->suspended())->withQuizCompleted()->create(['is_open_to_adopt' => true]);
        MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $hidden->id, 'score' => 100]);
        $answer = $this->actingAs($viewer)->getJson('/api/v1/matches?summary=1&per_page=3')->assertOk()->assertJsonCount(3, 'data');
        $this->assertSame([90, 80, 70], array_column($answer->json('data'), 'score'));
        $this->assertSame(['id', 'name', 'city', 'avatar_url'], array_keys($answer->json('data.0.profile')));
        $this->assertArrayNotHasKey('home_profile', $answer->json('data.0'));
        $this->assertArrayNotHasKey('criteria_scores', $answer->json('data.0'));
    }

    public function test_human_home_suggestions_do_not_load_pet_profile_sections_or_bookmarks(): void
    {
        $viewer = User::factory()->human()->active()->create();
        $home = HomeProfile::factory()->for($viewer)->withQuizCompleted()->create();
        foreach ([90, 80, 70, 60] as $score) {
            $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create();
            MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $home->id, 'score' => $score]);
        }
        $this->actingAs($viewer);
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $answer = $this->getJson('/api/v1/matches?summary=1&per_page=3')->assertOk()->assertJsonCount(3, 'data');
            $this->assertSame([90, 80, 70], array_column($answer->json('data'), 'score'));
            $queries = strtolower(collect(DB::getQueryLog())->pluck('query')->implode("\n"));
            foreach (['pet_skills', 'pet_temperament', 'bookmarks', 'vet_records'] as $unused) {
                $this->assertStringNotContainsString($unused, $queries);
            }
            $this->assertLessThanOrEqual(8, count(DB::getQueryLog()));
        } finally {
            DB::disableQueryLog();
        }
    }
}
