<?php

namespace Tests\Feature;

use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CorePerformanceTest extends TestCase
{
    use RefreshDatabase;

    private function queries(callable $operation): array
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $operation();

            return DB::getQueryLog();
        } finally {
            DB::disableQueryLog();
        }
    }

    public function test_matching_recalculation_has_bounded_query_count(): void
    {
        $home = HomeProfile::factory()->withQuizCompleted()->create();
        $home->acceptedSpecies()->create(['species' => 'dog']);
        Pet::factory()->count(40)->lookingForAHome()->create(['species' => 'dog', 'province' => $home->province]);
        $queries = $this->queries(fn () => app(MatchScoreCalculator::class)->recalculateForHome($home));
        $this->assertLessThanOrEqual(9, count($queries));
        $this->assertDatabaseCount('match_scores', 40);
    }

    public function test_feed_queries_do_not_grow_per_author(): void
    {
        foreach (range(1, 20) as $index) {
            $author = User::factory()->pet()->active()->create();
            Pet::factory()->for($author)->lookingForAHome()->create();
            Post::factory()->create(['author_user_id' => $author->id]);
        }
        $viewer = User::factory()->human()->active()->create();
        $this->actingAs($viewer);
        $one = $this->queries(fn () => $this->getJson('/api/v1/feed?per_page=1')->assertOk());
        $twenty = $this->queries(fn () => $this->getJson('/api/v1/feed?per_page=20')->assertOk()->assertJsonCount(20, 'data'));
        $this->assertLessThanOrEqual(count($one), count($twenty));
        $this->assertLessThanOrEqual(9, count($twenty));
    }

    public function test_quiz_answers_preserve_lists_without_per_answer_writes(): void
    {
        $user = User::factory()->human()->active()->create();
        $home = HomeProfile::factory()->for($user)->create();
        $this->actingAs($user);
        $answers = ['accepted_species' => ['dog', 'cat', 'other'], 'preferred_sizes' => ['small', 'medium', 'large'], 'preferred_ages' => ['puppy_kitten', 'adult', 'senior']];
        $queries = $this->queries(fn () => $this->patchJson('/api/v1/me/home-profile/5', $answers)->assertOk()
            ->assertJsonCount(3, 'data.accepted_species'));
        $this->assertLessThanOrEqual(19, count($queries));
        $this->assertEqualsCanonicalizing($answers['preferred_sizes'], $home->preferredSizes()->get()->map(fn ($row) => $row->size->value)->all());
    }
}
