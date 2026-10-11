<?php

declare(strict_types=1);

namespace Tests\Feature\Analytics;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\ProfileView;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * A member's own stats (BE-25, FE-25, AN-01, AN-02, FR30): what each tile and chart counts, that the numbers are
 * the asking account's only, and who may ask.
 */
class MemberStatsTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/stats';

    private User $mochi;

    private Pet $pet;

    private User $ana;

    private HomeProfile $home;

    protected function setUp(): void
    {
        parent::setUp();

        // Noon on Oct 10 in the Philippines.
        $this->travelTo(Carbon::parse('2026-10-10 04:00:00', 'UTC'));

        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $this->pet = Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        $this->home = HomeProfile::factory()->for($this->ana)->openToAdopt()->withQuizCompleted()->create(['full_name' => 'Ana Santos']);
    }

    private function viewOf(Pet $pet, string $source, string $at): void
    {
        ProfileView::factory()->create([
            'viewer_user_id' => User::factory()->human()->active(),
            'pet_id' => $pet->id,
            'home_profile_id' => null,
            'source' => $source,
            'created_at' => Carbon::parse($at, 'UTC'),
        ]);
    }

    private function listedPet(string $name): Pet
    {
        return Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name]);
    }

    private function score(Pet $pet, int $score): void
    {
        MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id, 'score' => $score]);
    }

    public function test_a_pet_reads_its_views_bookmarks_requests_and_invites(): void
    {
        $this->viewOf($this->pet, 'matches', '2026-10-10 02:00:00');
        $this->viewOf($this->pet, 'matches', '2026-10-08 02:00:00');
        $this->viewOf($this->pet, 'search', '2026-09-20 02:00:00');
        $this->viewOf($this->pet, 'direct', '2026-08-01 02:00:00');
        // Another pet's views are not Mochi's.
        $this->viewOf($this->listedPet('Kulit'), 'browse', '2026-10-10 02:00:00');

        Bookmark::factory()->onPet()->create(['pet_id' => $this->pet->id]);
        Bookmark::factory()->onPet()->create(['pet_id' => $this->pet->id, 'created_at' => now()->subDays(20)]);

        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);
        AdoptionRequest::factory()->declined()->create(['pet_id' => $this->pet->id]);

        Invite::factory()->create(['pet_id' => $this->pet->id]);
        Invite::factory()->create(['pet_id' => $this->pet->id, 'dismissed_at' => now()]);

        $this->actingAs($this->mochi)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonPath('data.role', 'pet')
            ->assertJsonPath('data.pet_status', 'looking_for_a_home')
            ->assertJsonPath('data.tiles.views', ['total' => 4, 'this_week' => 2])
            ->assertJsonPath('data.tiles.bookmarks', ['total' => 2, 'this_week' => 1])
            ->assertJsonPath('data.tiles.requests', ['total' => 2, 'open' => 1])
            ->assertJsonPath('data.tiles.invites', ['total' => 2, 'live' => 1])
            ->assertJsonPath('data.views_by_source', ['browse' => 0, 'search' => 1, 'matches' => 2, 'bookmarks' => 0, 'feed' => 0, 'direct' => 1])
            ->assertJsonCount(30, 'data.views_over_time')
            ->assertJsonPath('data.views_over_time.0.date', '2026-09-11')
            ->assertJsonPath('data.views_over_time.29', ['date' => '2026-10-10', 'count' => 1])
            ->assertJsonPath('data.views_over_time.27', ['date' => '2026-10-08', 'count' => 1])
            ->assertJsonCount(2, 'data.request_history');
    }

    public function test_a_view_is_counted_on_its_day_in_the_philippines(): void
    {
        // 1 AM on Oct 10 in the Philippines is still Oct 9 in UTC.
        $this->viewOf($this->pet, 'feed', '2026-10-09 17:00:00');

        $this->actingAs($this->mochi)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonPath('data.views_over_time.29', ['date' => '2026-10-10', 'count' => 1])
            ->assertJsonPath('data.views_over_time.28', ['date' => '2026-10-09', 'count' => 0]);
    }

    public function test_a_human_reads_matches_requests_and_adoptions(): void
    {
        $this->score($this->pet, 92);
        $this->score($this->listedPet('Kulit'), 84);
        $this->score($this->listedPet('Choco'), 61);
        // Not on Pets for You, so not a match: an adopted pet, and a pet whose account is suspended.
        $this->score(Pet::factory()->for(User::factory()->pet()->active())->adopted()->create(), 95);
        $this->score(Pet::factory()->for(User::factory()->state(['role' => 'pet', 'status' => 'suspended']))->lookingForAHome()->create(), 88);

        Bookmark::factory()->onPet()->create(['user_id' => $this->ana->id, 'pet_id' => $this->pet->id]);

        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);
        $booked = AdoptionRequest::factory()->approved()->create(['home_profile_id' => $this->home->id]);
        MeetAndGreet::factory()->create(['adoption_request_id' => $booked->id]);
        // Approved with nothing booked waits on the pet, not on the human.
        AdoptionRequest::factory()->approved()->create(['home_profile_id' => $this->home->id]);
        AdoptionRequest::factory()->declined()->create(['home_profile_id' => $this->home->id]);

        $luna = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create(['name' => 'Luna']);
        $adopted = AdoptionRequest::factory()->create(['pet_id' => $luna->id, 'home_profile_id' => $this->home->id, 'status' => 'adopted']);
        Adoption::factory()->create(['pet_id' => $luna->id, 'home_profile_id' => $this->home->id, 'adoption_request_id' => $adopted->id]);
        // An adoption an admin undid is no longer one.
        Adoption::factory()->removed()->create(['home_profile_id' => $this->home->id]);

        $this->actingAs($this->ana)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonPath('data.role', 'human')
            ->assertJsonPath('data.has_completed_quiz', true)
            ->assertJsonPath('data.tiles.matches', ['total' => 3, 'strong' => 2])
            ->assertJsonPath('data.tiles.bookmarks', ['total' => 1])
            ->assertJsonPath('data.tiles.requests', ['total' => 5, 'need_action' => 2])
            ->assertJsonPath('data.tiles.adopted', ['total' => 1, 'names' => ['Luna']])
            ->assertJsonPath('data.match_score_distribution', [
                ['from' => 90, 'to' => 100, 'count' => 1],
                ['from' => 80, 'to' => 89, 'count' => 1],
                ['from' => 70, 'to' => 79, 'count' => 0],
                ['from' => 60, 'to' => 69, 'count' => 1],
                ['from' => 0, 'to' => 59, 'count' => 0],
            ])
            ->assertJsonPath('data.request_outcomes.sent', 1)
            ->assertJsonPath('data.request_outcomes.approved', 2)
            ->assertJsonPath('data.request_outcomes.declined', 1)
            ->assertJsonPath('data.request_outcomes.adopted', 1)
            ->assertJsonPath('data.request_outcomes.withdrawn', 0)
            ->assertJsonCount(5, 'data.request_history');
    }

    public function test_the_request_history_is_the_accounts_own_newest_first_without_contact_details(): void
    {
        $old = AdoptionRequest::factory()->declined()->create(['pet_id' => $this->pet->id, 'sent_at' => now()->subDays(40)]);
        $new = AdoptionRequest::factory()->awaitingDecision()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'sent_at' => now()->subDays(5)]);
        AdoptionRequest::factory()->create();

        $response = $this->actingAs($this->mochi)->getJson(self::PATH)->assertOk();

        $response->assertJsonPath('data.request_history.*.id', [$new->id, $old->id])
            ->assertJsonPath('data.request_history.0.status', 'awaiting_decision')
            ->assertJsonPath('data.request_history.0.home_profile.full_name', 'Ana Santos')
            ->assertJsonStructure(['data' => ['request_history' => [['id', 'status', 'pet', 'home_profile', 'sent_at', 'updated_at']]]]);

        // A list of requests names no phone number and no address, even once a meeting was confirmed (SEC-PRIV-02).
        $body = $response->getContent();
        $this->assertStringNotContainsString('contact_number', $body);
        $this->assertStringNotContainsString('street_address', $body);
        $this->assertStringNotContainsString('contacts', $body);
    }

    public function test_only_the_latest_ten_requests_are_listed(): void
    {
        AdoptionRequest::factory()->count(12)->declined()->create(['pet_id' => $this->pet->id]);

        $this->actingAs($this->mochi)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonCount(10, 'data.request_history')
            ->assertJsonPath('data.tiles.requests.total', 12);
    }

    public function test_a_human_who_has_not_finished_the_quiz_has_no_matches_yet(): void
    {
        $bea = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($bea)->create();

        $this->actingAs($bea)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonPath('data.has_completed_quiz', false)
            ->assertJsonPath('data.tiles.matches', ['total' => 0, 'strong' => 0]);
    }

    public function test_stats_are_for_signed_in_active_pets_and_humans(): void
    {
        $this->getJson(self::PATH)->assertUnauthorized();

        $pending = User::factory()->create(['role' => 'pet', 'status' => 'pending_verification']);
        Pet::factory()->for($pending)->draft()->create();
        $this->actingAs($pending)->getJson(self::PATH)->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $admin = User::factory()->admin()->active()->create();
        $this->actingAs($admin)->getJson(self::PATH)->assertForbidden();
    }
}
