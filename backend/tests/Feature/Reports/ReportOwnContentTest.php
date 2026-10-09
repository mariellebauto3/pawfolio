<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Models\Comment;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `POST /api/v1/reports` (RP-01): an account can't report what is its own. The answer is a 422 the report dialog can
 * show, not a server error.
 */
class ReportOwnContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_reporting_your_own_post_comment_or_account_answers_422_and_files_nothing(): void
    {
        $ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
        $post = Post::factory()->for($ana, 'author')->create();
        $comment = Comment::factory()->for($post)->for($ana, 'author')->create();

        $own = [
            'her own post' => ['target_type' => 'post', 'post_id' => $post->id],
            'her own comment' => ['target_type' => 'comment', 'comment_id' => $comment->id],
            'her own account' => ['target_type' => 'account', 'target_id' => $ana->id],
        ];

        foreach ($own as $what => $target) {
            $this->actingAs($ana)->postJson('/api/v1/reports', [...$target, 'reason' => 'spam_or_scam'])
                ->assertUnprocessable()
                ->assertJsonPath('message', 'You cannot report your own content or account.')
                ->assertJsonPath('errors.target_id.0', 'You cannot report your own content or account.');
        }

        $this->assertDatabaseCount('reports', 0);
    }

    public function test_reporting_someone_elses_post_still_files_a_report(): void
    {
        $ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
        $mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $post = Post::factory()->update()->for($mochi, 'author')->create();

        $this->actingAs($ana)->postJson('/api/v1/reports', ['target_type' => 'post', 'post_id' => $post->id, 'reason' => 'spam_or_scam'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open');

        $this->assertDatabaseHas('reports', ['reporter_user_id' => $ana->id, 'reported_user_id' => $mochi->id, 'post_id' => $post->id]);
    }
}
