<?php

declare(strict_types=1);

namespace Tests\Feature\CommunityFeed;

use App\Models\Adoption;
use App\Models\Comment;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What the feed screens read and send (FE-20, FD-01..FD-07): who may call each endpoint, the author line under a
 * name, and counts that match what a post's page lists.
 */
class FeedScreensTest extends TestCase
{
    use RefreshDatabase;

    private function pet(string $name = 'Mochi', string $state = 'lookingForAHome'): User
    {
        $user = User::factory()->pet()->active()->create(['name' => $name]);
        Pet::factory()->for($user)->{$state}()->create(['name' => $name, 'breed' => 'Aspin', 'city' => 'Pasig']);

        return $user;
    }

    private function human(string $name = 'Ana Santos', bool $open = true, bool $furparent = false): User
    {
        $user = User::factory()->human()->active()->create(['name' => $name]);
        HomeProfile::factory()->for($user)->create([
            'full_name' => $name,
            'city' => 'Quezon City',
            'is_open_to_adopt' => $open,
            'quiz_completed_at' => now(),
            'furparent_at' => $furparent ? now() : null,
        ]);

        return $user;
    }

    public function test_the_feed_is_for_signed_in_active_accounts_only(): void
    {
        $post = Post::factory()->for($this->pet(), 'author')->create();

        $this->getJson('/api/v1/feed')->assertUnauthorized();
        $this->postJson('/api/v1/posts', ['body' => 'Hello'])->assertUnauthorized();

        $pending = User::factory()->human()->pendingVerification()->create();
        $suspended = User::factory()->pet()->suspended()->create();

        foreach ([$pending, $suspended] as $blocked) {
            $this->actingAs($blocked)->getJson('/api/v1/feed')->assertForbidden()->assertJsonPath('code', 'account_not_active');
            $this->actingAs($blocked)->getJson("/api/v1/posts/{$post->id}")->assertForbidden();
            $this->actingAs($blocked)->postJson('/api/v1/posts', ['body' => 'Hello'])->assertForbidden();
            $this->actingAs($blocked)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => 'Hello'])->assertForbidden();
            $this->actingAs($blocked)->postJson("/api/v1/posts/{$post->id}/reactions")->assertForbidden();
        }

        $this->assertDatabaseCount('posts', 1);
        $this->assertDatabaseCount('comments', 0);
        $this->assertDatabaseCount('reactions', 0);
    }

    public function test_a_post_names_its_author_with_the_public_line_and_whether_the_profile_can_be_opened(): void
    {
        $mochi = $this->pet('Mochi');
        $draft = $this->pet('Pebbles', 'draft');
        $ana = $this->human('Ana Santos', open: true);
        $furparent = $this->human('Marco Cruz', open: false, furparent: true);

        $byPet = Post::factory()->update()->for($mochi, 'author')->create();
        $byDraft = Post::factory()->update()->for($draft, 'author')->create();
        $byHuman = Post::factory()->for($ana, 'author')->create();
        $byFurparent = Post::factory()->for($furparent, 'author')->create();

        $feed = collect($this->actingAs($ana)->getJson('/api/v1/feed')->assertOk()->json('data'))->keyBy('id');

        $this->assertSame(
            ['id' => $mochi->id, 'role' => 'pet', 'display_name' => 'Mochi', 'avatar_url' => null, 'profile_id' => $mochi->pet->id, 'breed' => 'Aspin', 'city' => 'Pasig', 'is_furparent' => false, 'is_profile_viewable' => true],
            $feed[$byPet->id]['author'],
        );

        // A Draft resume isn't open to anyone but the pet, so its name is not a link (PR-02).
        $this->assertFalse($feed[$byDraft->id]['author']['is_profile_viewable']);

        $this->assertSame(
            ['id' => $ana->id, 'role' => 'human', 'display_name' => 'Ana Santos', 'avatar_url' => null, 'profile_id' => $ana->homeProfile->id, 'breed' => null, 'city' => 'Quezon City', 'is_furparent' => false, 'is_profile_viewable' => true],
            $feed[$byHuman->id]['author'],
        );

        // Open to Adopt is off: the Furparent label and the city still show, the Home Profile doesn't open.
        $this->assertTrue($feed[$byFurparent->id]['author']['is_furparent']);
        $this->assertSame('Quezon City', $feed[$byFurparent->id]['author']['city']);
        $this->assertFalse($feed[$byFurparent->id]['author']['is_profile_viewable']);

        // The same block names who wrote a comment.
        Comment::factory()->for($byPet)->for($furparent, 'author')->create();
        $this->actingAs($mochi)->getJson("/api/v1/posts/{$byPet->id}")
            ->assertOk()
            ->assertJsonPath('data.comments.0.author.display_name', 'Marco Cruz')
            ->assertJsonPath('data.comments.0.author.is_furparent', true)
            ->assertJsonPath('data.comments.0.author.is_profile_viewable', false)
            ->assertJsonPath('data.author.is_profile_viewable', true);

        // Nothing private travels with a name (SEC-PRIV-02).
        $this->assertStringNotContainsString('contact_number', json_encode($feed->all()));
        $this->assertStringNotContainsString('street_address', json_encode($feed->all()));
    }

    public function test_posting_validates_its_input_and_the_server_picks_the_type(): void
    {
        $mochi = $this->pet();
        $ana = $this->human();

        $this->actingAs($mochi)->postJson('/api/v1/posts', ['body' => ''])->assertUnprocessable()->assertJsonValidationErrors(['body']);
        $this->actingAs($mochi)->postJson('/api/v1/posts', ['body' => str_repeat('a', 2001)])->assertUnprocessable()->assertJsonValidationErrors(['body']);
        $this->actingAs($mochi)->postJson('/api/v1/posts', ['body' => 'Hi', 'type' => 'hired'])->assertUnprocessable()->assertJsonValidationErrors(['type']);

        $this->actingAs($mochi)->postJson('/api/v1/posts', ['body' => '  I wore my best bandana today.  '])
            ->assertCreated()
            ->assertJsonPath('data.type', 'update')
            ->assertJsonPath('data.body', 'I wore my best bandana today.')
            ->assertJsonPath('data.reactions_count', 0)
            ->assertJsonPath('data.comments_count', 0)
            ->assertJsonPath('data.has_reacted', false);

        $this->actingAs($ana)->postJson('/api/v1/posts', ['body' => 'Any tips for a first-time Furparent?'])
            ->assertCreated()
            ->assertJsonPath('data.type', 'post');
    }

    public function test_only_a_furparent_writes_an_adoption_story_and_only_about_a_pet_they_adopted(): void
    {
        $luna = $this->pet('Luna', 'adopted');
        $other = $this->pet('Biko', 'adopted');
        $ana = $this->human('Ana Santos', open: false, furparent: true);
        Adoption::factory()->create(['pet_id' => $luna->pet->id, 'home_profile_id' => $ana->homeProfile->id]);

        $story = ['adopted_pet_id' => $luna->pet->id, 'title' => 'How Luna applied to our home', 'body' => 'It started with a cover letter.'];

        $this->actingAs($luna)->postJson('/api/v1/posts/adoption-story', $story)->assertForbidden();
        $this->actingAs($this->human('Paolo Garcia'))->postJson('/api/v1/posts/adoption-story', $story)->assertForbidden();
        $this->actingAs($ana)->postJson('/api/v1/posts/adoption-story', [...$story, 'adopted_pet_id' => $other->pet->id])->assertForbidden();
        $this->actingAs($ana)->postJson('/api/v1/posts/adoption-story', [...$story, 'title' => ''])->assertUnprocessable()->assertJsonValidationErrors(['title']);
        $this->assertDatabaseCount('posts', 0);

        $this->actingAs($ana)->postJson('/api/v1/posts/adoption-story', $story)
            ->assertCreated()
            ->assertJsonPath('data.type', 'adoption_story')
            ->assertJsonPath('data.title', 'How Luna applied to our home')
            ->assertJsonPath('data.adopted_pet.id', $luna->pet->id)
            ->assertJsonPath('data.adopted_pet.name', 'Luna');
    }

    public function test_only_the_author_edits_or_deletes_a_post_and_an_edit_keeps_their_like(): void
    {
        $mochi = $this->pet();
        $ana = $this->human();
        $post = Post::factory()->update()->for($mochi, 'author')->create(['title' => null, 'body' => 'First draft.']);

        $this->actingAs($ana)->patchJson("/api/v1/posts/{$post->id}", ['body' => 'Not mine.'])->assertForbidden();
        $this->actingAs($ana)->deleteJson("/api/v1/posts/{$post->id}")->assertForbidden();
        $this->assertSame('First draft.', $post->fresh()->body);
        $this->assertNull($post->fresh()->deleted_at);

        $this->actingAs($mochi)->postJson("/api/v1/posts/{$post->id}/reactions")
            ->assertOk()
            ->assertJsonPath('data.reacted', true)
            ->assertJsonPath('data.reactions_count', 1);

        $this->actingAs($mochi)->patchJson("/api/v1/posts/{$post->id}", ['body' => 'Second draft.'])
            ->assertOk()
            ->assertJsonPath('data.body', 'Second draft.')
            ->assertJsonPath('data.has_reacted', true)
            ->assertJsonPath('data.reactions_count', 1);

        $this->actingAs($mochi)->deleteJson("/api/v1/posts/{$post->id}")->assertOk()->assertJsonPath('data.deleted', true);

        // Deleted: gone from the feed, and its page answers like one that never existed.
        $this->actingAs($ana)->getJson('/api/v1/feed')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($ana)->getJson("/api/v1/posts/{$post->id}")->assertNotFound();
        $this->actingAs($ana)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => 'Too late'])->assertNotFound();
        $this->actingAs($ana)->postJson("/api/v1/posts/{$post->id}/reactions")->assertNotFound();
    }

    public function test_a_post_counts_the_comments_its_page_lists(): void
    {
        $mochi = $this->pet();
        $ana = $this->human();
        $post = Post::factory()->update()->for($mochi, 'author')->create();

        $kept = Comment::factory()->for($post)->for($ana, 'author')->create();
        Comment::factory()->for($post)->for($mochi, 'author')->create(['parent_comment_id' => $kept->id]);
        $removed = Comment::factory()->for($post)->for($ana, 'author')->create();
        Comment::factory()->for($post)->for($mochi, 'author')->create(['parent_comment_id' => $removed->id]);

        $this->actingAs($mochi)->getJson("/api/v1/posts/{$post->id}")->assertOk()->assertJsonPath('data.comments_count', 4);

        // Someone else's comment can't be removed by a bystander; its author, or the post's, can.
        $this->actingAs($this->human('Paolo Garcia'))->deleteJson("/api/v1/comments/{$removed->id}")->assertForbidden();
        $this->actingAs($ana)->deleteJson("/api/v1/comments/{$removed->id}")->assertOk();

        // The reply under the removed comment is no longer listed, so it is no longer counted either.
        $detail = $this->actingAs($mochi)->getJson("/api/v1/posts/{$post->id}")->assertOk();
        $detail->assertJsonPath('data.comments_count', 2)->assertJsonCount(1, 'data.comments')->assertJsonCount(1, 'data.comments.0.replies');
        $this->actingAs($mochi)->getJson('/api/v1/feed')->assertOk()->assertJsonPath('data.0.comments_count', 2);

        $this->actingAs($mochi)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => ''])->assertUnprocessable()->assertJsonValidationErrors(['body']);
        $this->actingAs($mochi)->postJson("/api/v1/posts/{$post->id}/comments", ['body' => str_repeat('a', 1001)])->assertUnprocessable();
    }

    public function test_a_like_is_one_per_account_and_toggles(): void
    {
        $mochi = $this->pet();
        $ana = $this->human();
        $post = Post::factory()->update()->for($mochi, 'author')->create();
        $comment = Comment::factory()->for($post)->for($mochi, 'author')->create();

        $this->actingAs($ana)->postJson("/api/v1/posts/{$post->id}/reactions")->assertOk()->assertJsonPath('data.reacted', true)->assertJsonPath('data.reactions_count', 1);
        $this->actingAs($ana)->getJson('/api/v1/feed')->assertOk()->assertJsonPath('data.0.has_reacted', true)->assertJsonPath('data.0.reactions_count', 1);
        $this->actingAs($mochi)->getJson('/api/v1/feed')->assertOk()->assertJsonPath('data.0.has_reacted', false);
        $this->actingAs($ana)->postJson("/api/v1/posts/{$post->id}/reactions")->assertOk()->assertJsonPath('data.reacted', false)->assertJsonPath('data.reactions_count', 0);

        $this->actingAs($ana)->postJson("/api/v1/comments/{$comment->id}/reactions")->assertOk()->assertJsonPath('data.reacted', true)->assertJsonPath('data.reactions_count', 1);
        $this->actingAs($ana)->getJson("/api/v1/posts/{$post->id}")->assertOk()->assertJsonPath('data.comments.0.has_reacted', true)->assertJsonPath('data.comments.0.reactions_count', 1);

        $this->assertSame(1, Reaction::query()->count());
    }

    /**
     * A suspended or deactivated account's posts and comments are hidden with its profile (SEC-ABUSE-04, SEC-PRIV-05):
     * not only left out of the feed, but closed by their own address too.
     */
    public function test_the_posts_and_comments_of_an_account_that_is_not_active_are_hidden(): void
    {
        $ana = $this->human();
        $mochi = $this->pet('Mochi');
        $admin = User::factory()->admin()->active()->create();

        foreach (['suspended', 'deactivated'] as $status) {
            $biscuit = $this->pet('Biscuit');
            $theirs = Post::factory()->update()->for($biscuit, 'author')->create(['body' => 'Message me about a rehoming fee.']);
            $onTheirs = Comment::factory()->for($theirs)->for($mochi, 'author')->create();

            $mochis = Post::factory()->update()->for($mochi, 'author')->create();
            $kept = Comment::factory()->for($mochis)->for($ana, 'author')->create();
            $hidden = Comment::factory()->for($mochis)->for($biscuit, 'author')->create(['body' => 'Message me.']);
            $underHidden = Comment::factory()->for($mochis)->for($ana, 'author')->create(['parent_comment_id' => $hidden->id]);
            $hiddenReply = Comment::factory()->for($mochis)->for($biscuit, 'author')->create(['parent_comment_id' => $kept->id]);

            // While the account is Active, all of it is there.
            $this->actingAs($ana)->getJson("/api/v1/posts/{$theirs->id}")->assertOk();
            $this->actingAs($ana)->getJson("/api/v1/posts/{$mochis->id}")->assertOk()->assertJsonPath('data.comments_count', 4)->assertJsonCount(2, 'data.comments');

            $biscuit->forceFill(['status' => $status])->save();

            // Their post: gone from the feed, and its own address answers like a post that never existed.
            $feed = collect($this->actingAs($ana)->getJson('/api/v1/feed')->assertOk()->json('data'));
            $this->assertFalse($feed->contains('id', $theirs->id), "a {$status} account's post is still on the feed");
            $this->actingAs($ana)->getJson("/api/v1/posts/{$theirs->id}")->assertNotFound();
            $this->actingAs($ana)->postJson("/api/v1/posts/{$theirs->id}/comments", ['body' => 'Hello?'])->assertNotFound();
            $this->actingAs($ana)->postJson("/api/v1/posts/{$theirs->id}/reactions")->assertNotFound();
            $this->actingAs($ana)->postJson("/api/v1/comments/{$onTheirs->id}/reactions")->assertNotFound();
            // An admin still reads it, to moderate.
            $this->actingAs($admin)->getJson("/api/v1/posts/{$theirs->id}")->assertOk();

            // Their comments on someone else's post: not listed, not counted, and what was said under them goes too.
            $detail = $this->actingAs($ana)->getJson("/api/v1/posts/{$mochis->id}")->assertOk();
            $detail->assertJsonPath('data.comments_count', 1)->assertJsonCount(1, 'data.comments')->assertJsonPath('data.comments.0.id', $kept->id)->assertJsonCount(0, 'data.comments.0.replies');
            $this->assertSame(1, $feed->firstWhere('id', $mochis->id)['comments_count']);
            $this->actingAs($ana)->postJson("/api/v1/comments/{$hidden->id}/reactions")->assertNotFound();
            $this->actingAs($ana)->postJson("/api/v1/comments/{$hiddenReply->id}/reactions")->assertNotFound();
            $this->actingAs($ana)->postJson("/api/v1/posts/{$mochis->id}/comments", ['body' => 'Hello?', 'parent_comment_id' => $hidden->id])->assertNotFound();

            $this->assertSame(0, Reaction::query()->count());
            $this->assertSame(5, Comment::query()->whereIn('post_id', [$theirs->id, $mochis->id])->count());

            // Nothing was deleted: reactivated, the account's words are back where they were.
            $biscuit->forceFill(['status' => 'active'])->save();
            $this->actingAs($ana)->getJson("/api/v1/posts/{$theirs->id}")->assertOk()->assertJsonPath('data.comments_count', 1);
            $this->actingAs($ana)->getJson("/api/v1/posts/{$mochis->id}")->assertOk()->assertJsonPath('data.comments_count', 4)->assertJsonCount(2, 'data.comments');
            $this->assertSame($underHidden->id, $this->actingAs($ana)->getJson("/api/v1/posts/{$mochis->id}")->json('data.comments.1.replies.0.id'));

            // The next round starts from a feed without this one's posts.
            Post::query()->whereIn('id', [$theirs->id, $mochis->id])->update(['deleted_at' => now()]);
        }
    }
}
