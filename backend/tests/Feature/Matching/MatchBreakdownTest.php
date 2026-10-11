<?php

declare(strict_types=1);

namespace Tests\Feature\Matching;

use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The match breakdown (MT-03): the four dealbreakers and the seven weighted criteria of the viewer and one profile,
 * and who may ask for it (FR5, FR21, SEC-AUTHZ-02, SEC-AUTHZ-04).
 */
class MatchBreakdownTest extends TestCase
{
    use RefreshDatabase;

    private User $human;

    private HomeProfile $home;

    private User $petUser;

    private Pet $pet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create(['province' => 'Metro Manila']);
        $this->home->acceptedSpecies()->create(['species' => 'dog']);

        $this->petUser = User::factory()->pet()->active()->create();
        $this->pet = Pet::factory()->for($this->petUser)->lookingForAHome()->create(['species' => 'dog', 'province' => 'Metro Manila']);
    }

    private function breakdownOf(User $viewer, int $profileId)
    {
        return $this->actingAs($viewer)->getJson("/api/v1/matches/{$profileId}/breakdown");
    }

    public function test_a_human_reads_the_breakdown_of_a_pet(): void
    {
        $data = $this->breakdownOf($this->human, $this->pet->id)
            ->assertOk()
            ->assertJsonPath('data.pet_id', $this->pet->id)
            ->assertJsonPath('data.home_profile_id', $this->home->id)
            ->assertJsonPath('data.passed_dealbreakers', true)
            ->assertJsonPath('data.failed_dealbreakers', [])
            ->assertJsonPath('data.dealbreakers', ['species_accepted' => true, 'ok_with_kids' => true, 'ok_with_other_pets' => true, 'same_province' => true])
            ->assertJsonCount(7, 'data.criteria')
            ->assertJsonPath('data.criteria.*.key', ['activity', 'hours_away', 'space', 'experience', 'size_age', 'compatibility', 'special_needs'])
            ->assertJsonPath('data.criteria.*.max_points', [20, 15, 15, 15, 15, 10, 10])
            ->json('data');

        $this->assertSame($data['score'], array_sum(array_column($data['criteria'], 'points')));
        $this->assertNotEmpty($data['reasons']);
        $this->assertLessThanOrEqual(3, count($data['reasons']));
    }

    public function test_the_pet_and_the_human_read_the_same_score_and_reasons(): void
    {
        $asHuman = $this->breakdownOf($this->human, $this->pet->id)->assertOk()->json('data');
        $asPet = $this->breakdownOf($this->petUser, $this->home->id)->assertOk()->json('data');

        $this->assertSame($asHuman, $asPet);
        // Written for both readers: nobody is "you".
        foreach ($asPet['reasons'] as $reason) {
            $this->assertDoesNotMatchRegularExpression('/\byou(r)?\b/i', $reason);
        }
    }

    public function test_the_id_is_the_profile_and_never_a_stored_score(): void
    {
        $other = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['species' => 'dog', 'province' => 'Metro Manila']);
        // This home's score with the first pet happens to carry the second pet's id.
        MatchScore::factory()->create(['id' => $other->id, 'pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);

        $this->breakdownOf($this->human, $other->id)->assertOk()->assertJsonPath('data.pet_id', $other->id);
    }

    public function test_a_failed_dealbreaker_is_named_and_scores_nothing(): void
    {
        $cat = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['species' => 'cat', 'province' => 'Cebu']);

        $this->breakdownOf($this->human, $cat->id)
            ->assertOk()
            ->assertJsonPath('data.passed_dealbreakers', false)
            ->assertJsonPath('data.failed_dealbreakers', ['species_accepted', 'same_province'])
            ->assertJsonPath('data.score', 0);
    }

    public function test_reading_a_breakdown_stores_nothing(): void
    {
        $this->breakdownOf($this->human, $this->pet->id)->assertOk();
        $this->breakdownOf($this->petUser, $this->home->id)->assertOk();

        $this->assertSame(0, MatchScore::query()->count());
    }

    public function test_a_pet_the_human_may_not_open_answers_not_found(): void
    {
        $draft = Pet::factory()->for(User::factory()->pet()->active())->draft()->create(['species' => 'dog']);
        $suspended = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create(['species' => 'dog']);

        $this->breakdownOf($this->human, $draft->id)->assertStatus(404)->assertJsonPath('code', 'not_found');
        $this->breakdownOf($this->human, $suspended->id)->assertStatus(404);
        $this->breakdownOf($this->human, 999999)->assertStatus(404);
    }

    public function test_a_home_the_pet_may_not_open_answers_not_found(): void
    {
        $closed = HomeProfile::factory()->for(User::factory()->human()->active())->withQuizCompleted()->create();
        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create();
        $noQuiz = HomeProfile::factory()->for(User::factory()->human()->active())->create(['is_open_to_adopt' => true]);

        $this->breakdownOf($this->petUser, $closed->id)->assertStatus(404);
        $this->breakdownOf($this->petUser, $suspended->id)->assertStatus(404);
        $this->breakdownOf($this->petUser, $noQuiz->id)->assertStatus(404);
        $this->breakdownOf($this->petUser, 999999)->assertStatus(404);

        // A request already with the home keeps it readable after Open to Adopt goes off (§5.5), breakdown included.
        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $closed->id]);
        $this->breakdownOf($this->petUser, $closed->id)->assertOk();
    }

    public function test_an_account_without_matches_yet_has_no_breakdown(): void
    {
        $unfinished = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($unfinished)->create();

        $draftUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($draftUser)->draft()->create();

        $this->breakdownOf($unfinished, $this->pet->id)->assertStatus(404);
        $this->breakdownOf($draftUser, $this->home->id)->assertStatus(404);
    }

    public function test_only_active_pets_and_humans_may_ask(): void
    {
        $this->getJson("/api/v1/matches/{$this->pet->id}/breakdown")->assertStatus(401);

        $pending = User::factory()->human()->pendingVerification()->create();
        HomeProfile::factory()->for($pending)->create();
        $this->breakdownOf($pending, $this->pet->id)->assertStatus(403)->assertJsonPath('code', 'account_not_active');

        $this->breakdownOf(User::factory()->admin()->active()->create(), $this->pet->id)->assertStatus(403);
    }

    public function test_an_id_that_is_not_a_plain_number_is_not_a_route(): void
    {
        $this->actingAs($this->human)->getJson('/api/v1/matches/abc/breakdown')->assertStatus(404);
        $this->actingAs($this->human)->getJson('/api/v1/matches/12345678901234567890/breakdown')->assertStatus(404);
    }
}
