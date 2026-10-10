<?php

declare(strict_types=1);

namespace Tests\Feature\Analytics;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The admin's platform dashboard (BE-25, FE-25, AN-03, FR40): what each tile and trend counts, what needs
 * attention, and that only an Active admin reads it.
 */
class PlatformDashboardTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/admin/dashboard';

    private User $admin;

    private User $mochi;

    private Pet $pet;

    private HomeProfile $home;

    protected function setUp(): void
    {
        parent::setUp();

        // Noon on Oct 10 in the Philippines.
        $this->travelTo(Carbon::parse('2026-10-10 04:00:00', 'UTC'));

        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $this->pet = Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        $this->home = HomeProfile::factory()->for($ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
    }

    private function dashboard()
    {
        return $this->actingAs($this->admin)->getJson(self::PATH)->assertOk();
    }

    private function adoption(string $sentAt, string $adoptedAt): Adoption
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create();
        $request = AdoptionRequest::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id, 'status' => 'adopted', 'sent_at' => Carbon::parse($sentAt, 'UTC')]);

        return Adoption::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id, 'adoption_request_id' => $request->id, 'adopted_at' => Carbon::parse($adoptedAt, 'UTC')]);
    }

    public function test_the_tiles_count_accounts_pets_requests_and_meetings_as_they_stand(): void
    {
        $pepper = User::factory()->create(['name' => 'Pepper', 'role' => 'pet', 'status' => 'pending_verification', 'created_at' => now()->subDays(2)]);
        Pet::factory()->for($pepper)->draft()->create(['name' => 'Pepper']);
        User::factory()->human()->suspended()->create();
        User::factory()->human()->deactivated()->create();

        // Open: one about to run out, one with a meeting this week, one overdue for a decision.
        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'expires_at' => now()->addDays(2)]);
        $scheduled = AdoptionRequest::factory()->meetScheduled()->create(['home_profile_id' => $this->home->id]);
        MeetAndGreet::factory()->confirmed()->create(['adoption_request_id' => $scheduled->id, 'meet_greet_slot_id' => MeetGreetSlot::factory()->create(['home_profile_id' => $this->home->id, 'starts_at' => now()->addDays(3)])]);
        AdoptionRequest::factory()->awaitingDecision()->create(['awaiting_decision_at' => now()->subDays(9), 'overdue_flagged_at' => now()->subDays(2)]);
        // A meeting further ahead isn't this week's.
        MeetAndGreet::factory()->create(['meet_greet_slot_id' => MeetGreetSlot::factory()->create(['starts_at' => now()->addDays(20)])]);

        Report::factory()->onAccount()->create();
        Report::factory()->onAccount()->create(['status' => 'resolved']);

        $tiles = $this->dashboard()->json('data.tiles');

        $this->assertSame(1, $tiles['accounts']['pending_verification']);
        $this->assertSame(1, $tiles['accounts']['suspended']);
        $this->assertSame(1, $tiles['accounts']['deactivated']);
        $this->assertSame($tiles['accounts']['total'], $tiles['accounts']['active'] + 3 + $tiles['accounts']['denied']);
        $this->assertSame($tiles['accounts']['active'], $tiles['accounts']['active_pets'] + $tiles['accounts']['active_humans']);
        $this->assertSame(1, $tiles['verification_queue_count']);
        $this->assertSame(now()->subDays(2)->toISOString(), $tiles['oldest_verification_at']);
        $this->assertSame(1, $tiles['open_reports_count']);
        $this->assertSame(Pet::query()->count(), array_sum($tiles['pets_by_status']));
        $this->assertSame(Pet::query()->where('status', 'draft')->count(), $tiles['pets_by_status']['draft']);
        $this->assertSame(1, $tiles['requests']['expiring_soon']);
        $this->assertSame(1, $tiles['requests']['overdue']);
        $this->assertSame(4, $tiles['requests']['open']);
        $this->assertSame(2, $tiles['meet_and_greets']['total']);
        $this->assertSame(1, $tiles['meet_and_greets']['upcoming_week']);
    }

    public function test_adoptions_are_counted_by_month_with_the_average_days_they_took(): void
    {
        $this->adoption('2026-09-20 02:00:00', '2026-10-05 02:00:00'); // 15 days, this month
        $this->adoption('2026-08-01 02:00:00', '2026-09-05 02:00:00'); // 35 days, last month
        // 1 AM on Oct 1 in the Philippines is still September in UTC: it is October's.
        $this->adoption('2026-09-20 17:00:00', '2026-09-30 17:00:00'); // 10 days
        // An adoption an admin undid isn't counted.
        Adoption::factory()->removed()->create(['adopted_at' => now()]);

        $response = $this->dashboard()
            ->assertJsonPath('data.tiles.adoptions_count', 3)
            ->assertJsonPath('data.tiles.adoptions_this_month', 2)
            ->assertJsonPath('data.tiles.adoptions_last_month', 1)
            ->assertJsonPath('data.tiles.average_days_to_adoption', 20)
            ->assertJsonCount(6, 'data.trends')
            ->assertJsonPath('data.trends.0.month', '2026-05')
            ->assertJsonPath('data.trends.5.month', '2026-10')
            ->assertJsonPath('data.trends.5.adopted', 2)
            ->assertJsonPath('data.trends.4.adopted', 1);

        // Requests sent in a month, whatever became of them.
        $this->assertSame(2, $response->json('data.trends.4.sent'));
        $this->assertSame(1, $response->json('data.trends.3.sent'));
    }

    public function test_needs_attention_names_what_waits_without_contact_details(): void
    {
        $pepper = User::factory()->create(['name' => 'Pepper', 'role' => 'pet', 'status' => 'pending_verification']);
        Pet::factory()->for($pepper)->draft()->create(['name' => 'Pepper']);
        Report::factory()->onAccount()->create(['reported_user_id' => $this->mochi->id]);
        $overdue = AdoptionRequest::factory()->awaitingDecision()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'awaiting_decision_at' => now()->subDays(9)]);

        $response = $this->dashboard()
            ->assertJsonPath('data.needs_attention.pending_verifications.0.display_name', 'Pepper')
            ->assertJsonPath('data.needs_attention.pending_verifications.0.role', 'pet')
            ->assertJsonPath('data.needs_attention.open_reports.0.reported_user_name', 'Mochi')
            ->assertJsonPath('data.needs_attention.overdue_requests.0.id', $overdue->id)
            ->assertJsonPath('data.needs_attention.overdue_requests.0.pet.name', 'Mochi');

        $body = $response->getContent();
        $this->assertStringNotContainsString('contact_number', $body);
        $this->assertStringNotContainsString('street_address', $body);
        $this->assertStringNotContainsString('@example', $body);
    }

    public function test_an_empty_platform_answers_with_zeros(): void
    {
        $this->dashboard()
            ->assertJsonPath('data.tiles.verification_queue_count', 0)
            ->assertJsonPath('data.tiles.oldest_verification_at', null)
            ->assertJsonPath('data.tiles.adoptions_count', 0)
            ->assertJsonPath('data.tiles.average_days_to_adoption', 0)
            ->assertJsonPath('data.needs_attention.overdue_requests', []);
    }

    public function test_only_an_active_admin_reads_the_dashboard(): void
    {
        $this->getJson(self::PATH)->assertUnauthorized();
        $this->actingAs($this->mochi)->getJson(self::PATH)->assertForbidden();

        $suspended = User::factory()->create(['role' => 'admin', 'status' => 'suspended']);
        $this->actingAs($suspended)->getJson(self::PATH)->assertForbidden();
    }
}
