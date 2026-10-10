<?php

declare(strict_types=1);

namespace Tests\Feature\Adoption;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetStatus;
use App\Models\ActivityLog;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\AdoptionResolution;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\Notification;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The admin's side of adoption (BE-20, FE-23): the monitor of requests and Meet & Greets with the overdue ones
 * (RQ-18, MG-15, MG-16, FR36), a request's record and its reminder (RQ-19), and Resolve adoption issue with its
 * four actions, each applying to one situation only, with a reason, logged, and told to both sides (AL-07, AL-08,
 * FR37, NFR9).
 */
class AdminMonitorAndResolveTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mochi;

    private Pet $pet;

    private User $ana;

    private HomeProfile $home;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi', 'email' => 'mochi@example.com']);
        $this->pet = Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi', 'caretaker_contact_number' => '09171112222']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos', 'email' => 'ana.santos@example.com']);
        $this->home = HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos', 'contact_number' => '09180000001', 'street_address' => '12 Mabini St']);
    }

    /** Another home, for a pet's second and third requests. */
    private function anotherHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active()->create(['name' => $name]))->openToAdopt()->create(['full_name' => $name]);
    }

    /** A request from Mochi in the given state, with the pet's status moved the way the flow would have moved it. */
    private function requestIn(string $state, ?HomeProfile $home = null, array $attributes = []): AdoptionRequest
    {
        $factory = $state === 'sent' ? AdoptionRequest::factory() : AdoptionRequest::factory()->{$state}();
        $request = $factory->create(['pet_id' => $this->pet->id, 'home_profile_id' => ($home ?? $this->home)->id, ...$attributes]);

        if ($request->isInProcess()) {
            $this->pet->forceFill(['status' => PetStatus::InProcess])->save();
        }

        return $request;
    }

    /** A booking of one of the home's slots for the request. */
    private function meeting(AdoptionRequest $request, string $state = 'confirmed', string $startsAt = '+2 days'): MeetAndGreet
    {
        $slot = MeetGreetSlot::factory()->create(['home_profile_id' => $request->home_profile_id, 'starts_at' => now()->modify($startsAt), 'place_type' => 'public_spot', 'place_details' => 'Ayala Triangle Gardens']);

        $factory = $state === 'booked' ? MeetAndGreet::factory() : MeetAndGreet::factory()->{$state}();

        return $factory->create(['adoption_request_id' => $request->id, 'meet_greet_slot_id' => $slot->id, 'ended_by_user_id' => null]);
    }

    /** Mochi adopted by Ana, as the Adopt action leaves it. */
    private function adopt(): Adoption
    {
        $request = AdoptionRequest::factory()->adopted()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);
        $this->pet->forceFill(['status' => PetStatus::AdoptedHired])->save();
        $this->home->forceFill(['furparent_at' => now(), 'is_open_to_adopt' => false])->save();

        return Adoption::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'adoption_request_id' => $request->id]);
    }

    private function resolve(array $body, ?Pet $pet = null)
    {
        return $this->actingAs($this->admin)->postJson('/api/v1/admin/adoptions/'.($pet ?? $this->pet)->id.'/resolve', $body);
    }

    private function actions(): array
    {
        return collect($this->actingAs($this->admin)->getJson("/api/v1/admin/adoptions/{$this->pet->id}/resolve")->assertOk()->json('data.actions'))->keyBy('action')->all();
    }

    public function test_only_an_active_admin_reaches_the_monitor_and_the_resolution(): void
    {
        $request = $this->requestIn('awaitingDecision');
        $paths = [
            ['getJson', '/api/v1/admin/adoption-requests'],
            ['getJson', "/api/v1/admin/adoption-requests/{$request->id}"],
            ['postJson', "/api/v1/admin/adoption-requests/{$request->id}/remind"],
            ['getJson', '/api/v1/admin/meet-and-greets'],
            ['getJson', "/api/v1/admin/adoptions/{$this->pet->id}/resolve"],
            ['postJson', "/api/v1/admin/adoptions/{$this->pet->id}/resolve/preview"],
            ['postJson', "/api/v1/admin/adoptions/{$this->pet->id}/resolve"],
            ['getJson', '/api/v1/admin/adoption-resolutions'],
            ['getJson', '/api/v1/admin/alumni'],
        ];
        $body = ['action' => 'return_to_looking_for_a_home', 'reason' => 'Because.'];

        foreach ($paths as [$method, $path]) {
            $this->{$method}($path, $body)->assertUnauthorized();
        }
        // Neither side of the request reaches the admin's view of it, nor changes a status through it (SEC-AUTHZ-07).
        foreach ([$this->ana, $this->mochi] as $member) {
            foreach ($paths as [$method, $path]) {
                $this->actingAs($member)->{$method}($path, $body)->assertForbidden();
            }
        }
        // An admin account that isn't Active is stopped like any other (SEC-AUTHZ-06).
        $suspended = User::factory()->admin()->create(['status' => AccountStatus::Suspended->value]);
        foreach ($paths as [$method, $path]) {
            $this->actingAs($suspended)->{$method}($path, $body)->assertForbidden();
        }

        $this->assertSame(AdoptionRequestStatus::AwaitingDecision, $request->fresh()->getStatus());
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(0, AdoptionResolution::query()->count());
        $this->assertSame(0, Notification::query()->count());

        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests/999')->assertNotFound();
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoptions/999/resolve')->assertNotFound();
    }

    public function test_the_monitor_lists_every_request_by_tab_status_and_search(): void
    {
        $sent = $this->requestIn('sent', $this->anotherHome('Marco Cruz'));
        $scheduled = $this->requestIn('meetScheduled', $this->anotherHome('Mia Tan'));
        $this->meeting($scheduled);
        // Awaiting Decision for eight days: overdue even before the scheduled job has flagged it.
        $overdue = $this->requestIn('awaitingDecision', null, ['awaiting_decision_at' => now()->subDays(8)]);
        $this->meeting($overdue, 'ended', '-8 days');
        // Flagged once, then decided: no longer overdue.
        $decided = $this->requestIn('declined', $this->anotherHome('Ian Lim'), ['overdue_flagged_at' => now()->subDay()]);

        $ids = fn (string $query) => collect($this->actingAs($this->admin)->getJson("/api/v1/admin/adoption-requests{$query}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

        $this->assertSame([$sent->id, $scheduled->id, $overdue->id, $decided->id], $ids(''));
        $this->assertSame([$scheduled->id, $overdue->id], $ids('?tab=meet_and_greets'));
        $this->assertSame([$overdue->id], $ids('?tab=overdue'));
        $this->assertSame([$decided->id], $ids('?status=declined'));
        $this->assertSame([], $ids('?tab=overdue&status=sent'));
        $this->assertSame([$scheduled->id], $ids('?q=mia'));
        $this->assertSame([$sent->id, $scheduled->id, $overdue->id, $decided->id], $ids('?q=moch'));

        $row = collect($this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?tab=overdue')->json('data'))->first();
        $this->assertTrue($row['is_overdue']);
        $this->assertSame('Mochi', $row['pet']['name']);
        $this->assertSame('Ana Santos', $row['home_profile']['full_name']);
        $this->assertSame('ended', $row['latest_meet_and_greet']['status']);
        $this->assertSame('Ayala Triangle Gardens', $row['latest_meet_and_greet']['slot']['place_details']);
        $this->assertNotNull($row['updated_at']);

        $rows = collect($this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests')->json('data'))->keyBy('id');
        $this->assertFalse($rows[$decided->id]['is_overdue']);
        $this->assertNull($rows[$sent->id]['latest_meet_and_greet']);
        // A list row carries no contact details, whatever the status (SEC-PRIV-02).
        $this->assertArrayNotHasKey('contacts', $rows[$overdue->id]);

        // A filter the API doesn't know is refused, not passed on (SEC-INPUT-03).
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?status=hired')->assertUnprocessable()->assertJsonValidationErrors(['status']);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?tab=everything')->assertUnprocessable()->assertJsonValidationErrors(['tab']);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?per_page=500')->assertUnprocessable()->assertJsonValidationErrors(['per_page']);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/meet-and-greets?status=late')->assertUnprocessable()->assertJsonValidationErrors(['status']);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/meet-and-greets?status=confirmed')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_a_requests_record_names_both_accounts_and_carries_no_contact_details(): void
    {
        $request = $this->requestIn('awaitingDecision', null, ['awaiting_decision_at' => now()->subDays(2)]);
        $this->meeting($request, 'ended', '-2 days');

        $data = $this->actingAs($this->admin)->getJson("/api/v1/admin/adoption-requests/{$request->id}")->assertOk()->json('data');

        $this->assertSame('awaiting_decision', $data['status']);
        $this->assertFalse($data['is_overdue']);
        $this->assertSame($this->mochi->id, $data['parties']['pet_user_id']);
        $this->assertSame('mochi@example.com', $data['parties']['pet_email']);
        $this->assertSame($this->ana->id, $data['parties']['human_user_id']);
        $this->assertSame('active', $data['parties']['human_account_status']);
        $this->assertSame('ended', $data['latest_meet_and_greet']['status']);
        $this->assertSame(['waiting_on' => 'human', 'last_sent_at' => null, 'can_send' => true], $data['reminder']);
        $this->assertSame([], $data['resolutions']);

        // The two sides read each other's phone number and address on this request; an admin monitoring it doesn't
        // need them, so the record has none (SEC-PRIV-02).
        foreach (['contacts', 'unlocked_contact', 'contact_unlocked', 'available_slots'] as $key) {
            $this->assertArrayNotHasKey($key, $data);
        }
        $json = json_encode($data);
        $this->assertStringNotContainsString('09171112222', $json);
        $this->assertStringNotContainsString('09180000001', $json);
        $this->assertStringNotContainsString('12 Mabini St', $json);
    }

    public function test_a_reminder_goes_to_the_side_with_the_next_step_once_a_day(): void
    {
        $remind = fn (AdoptionRequest $request) => $this->actingAs($this->admin)->postJson("/api/v1/admin/adoption-requests/{$request->id}/remind");
        $told = fn (User $user, string $title) => $this->assertDatabaseHas('notifications', ['user_id' => $user->id, 'title' => $title, 'urgency' => 'warning']);

        // Sent: the human answers.
        $sent = $this->requestIn('sent', $this->anotherHome('Marco Cruz'));
        $remind($sent)->assertOk()->assertJsonPath('data.recipient', 'human')->assertJsonPath('data.recipient_name', 'Marco Cruz');
        $told($sent->homeProfile->user, 'Reminder: Mochi is waiting for your answer');
        $this->assertDatabaseHas('notifications', ['user_id' => $sent->homeProfile->user_id, 'action_url' => "/requests/{$sent->id}"]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin_request_reminder_sent', 'actor_user_id' => $this->admin->id, 'subject_id' => $sent->id, 'after_value' => 'human']);

        // Once a day per request: the second one is refused and nobody is told twice.
        $remind($sent)->assertStatus(409)->assertJsonPath('code', 'already_reminded');
        $this->assertSame(1, Notification::query()->where('user_id', $sent->homeProfile->user_id)->count());
        $this->actingAs($this->admin)->getJson("/api/v1/admin/adoption-requests/{$sent->id}")->assertJsonPath('data.reminder.can_send', false)->assertJsonPath('data.reminder.waiting_on', 'human');
        $this->travel(25)->hours();
        $remind($sent)->assertOk();
        $this->travelBack();

        // Approved with no booking: the pet books. Once it has, the human confirms.
        $approved = $this->requestIn('approved');
        $remind($approved)->assertOk()->assertJsonPath('data.recipient', 'pet')->assertJsonPath('data.recipient_name', 'Mochi');
        $told($this->mochi, 'Reminder: book your Meet & Greet with Ana Santos');

        ActivityLog::query()->where('action', 'admin_request_reminder_sent')->toBase()->delete();
        $this->meeting($approved, 'booked');
        $remind($approved)->assertOk()->assertJsonPath('data.recipient', 'human');
        $told($this->ana, 'Reminder: confirm the Meet & Greet with Mochi');

        // A confirmed meeting that is still ahead waits on nobody; nor does a request On Hold or one that ended.
        $approved->meetAndGreets()->update(['status' => MeetAndGreetStatus::Confirmed->value]);
        $approved->forceFill(['status' => AdoptionRequestStatus::MeetScheduled->value])->save();
        ActivityLog::query()->where('action', 'admin_request_reminder_sent')->toBase()->delete();
        $before = Notification::query()->count();
        $remind($approved)->assertStatus(409)->assertJsonPath('code', 'no_reminder_needed');
        $remind($this->requestIn('onHold', $this->anotherHome('Mia Tan')))->assertStatus(409)->assertJsonPath('code', 'no_reminder_needed');
        $remind($this->requestIn('withdrawn', $this->anotherHome('Ian Lim')))->assertStatus(409)->assertJsonPath('code', 'no_reminder_needed');
        $this->assertSame($before, Notification::query()->count());

        // Once its time has passed, the human decides.
        $approved->forceFill(['status' => AdoptionRequestStatus::AwaitingDecision->value, 'awaiting_decision_at' => now()])->save();
        $remind($approved)->assertOk()->assertJsonPath('data.recipient', 'human');
        $told($this->ana, 'Reminder: decide on the request from Mochi');
    }

    public function test_a_pets_resolve_options_offer_only_what_applies_to_it(): void
    {
        // Looking for a Home with one Sent request: only that request can be closed.
        $sent = $this->requestIn('sent');
        $options = $this->actions();
        $this->assertSame(['cancel_adoption' => false, 'return_to_looking_for_a_home' => false, 'close_request' => true, 'reopen_meet_greet_booking' => false], array_map(fn ($o) => $o['available'], $options));
        $this->assertSame([$sent->id], $options['close_request']['request_ids']);
        $this->assertNull($options['close_request']['unavailable_reason']);
        $this->assertStringContainsString("hasn't been adopted", $options['cancel_adoption']['unavailable_reason']);

        // In Process with an Approved request and another On Hold: the process can be ended, the paused one closed.
        $sent->forceFill(['status' => AdoptionRequestStatus::OnHold->value])->save();
        $approved = $this->requestIn('approved', $this->anotherHome('Marco Cruz'));
        $options = $this->actions();
        $this->assertSame([$approved->id], $options['return_to_looking_for_a_home']['request_ids']);
        $this->assertSame([$sent->id], $options['close_request']['request_ids']);
        $this->assertFalse($options['reopen_meet_greet_booking']['available']);

        // Once the meeting is confirmed, its booking can be reopened as well.
        $approved->forceFill(['status' => AdoptionRequestStatus::MeetScheduled->value])->save();
        $this->assertSame([$approved->id], $this->actions()['reopen_meet_greet_booking']['request_ids']);

        $data = $this->actingAs($this->admin)->getJson("/api/v1/admin/adoptions/{$this->pet->id}/resolve")->json('data');
        $this->assertSame('Mochi', $data['pet']['name']);
        $this->assertSame('in_process', $data['pet']['status']);
        $this->assertSame($this->mochi->id, $data['pet']['user_id']);
        $this->assertNull($data['furparent']);
        $this->assertSame([$approved->id, $sent->id], array_column($data['requests'], 'id'));
        $this->assertSame('Marco Cruz', $data['requests'][0]['home_name']);
    }

    public function test_cancelling_an_adoption_removes_the_link_and_keeps_the_furparent_label(): void
    {
        $adoption = $this->adopt();
        $requestId = $adoption->adoption_request_id;

        $options = $this->actions();
        $this->assertSame(['cancel_adoption' => true, 'return_to_looking_for_a_home' => false, 'close_request' => false, 'reopen_meet_greet_booking' => false], array_map(fn ($o) => $o['available'], $options));
        $this->assertSame([$requestId], $options['cancel_adoption']['request_ids']);
        $this->actingAs($this->admin)->getJson("/api/v1/admin/adoptions/{$this->pet->id}/resolve")->assertJsonPath('data.furparent.full_name', 'Ana Santos');

        // The preview says what would change and writes nothing.
        $this->actingAs($this->admin)->postJson("/api/v1/admin/adoptions/{$this->pet->id}/resolve/preview", ['action' => 'cancel_adoption'])
            ->assertOk()
            ->assertJsonPath('data.before', ['pet_status' => 'adopted_hired', 'request_status' => 'adopted', 'furparent_name' => 'Ana Santos'])
            ->assertJsonPath('data.after', ['pet_status' => 'looking_for_a_home', 'request_status' => 'closed', 'furparent_name' => null])
            ->assertJsonPath('data.request', ['id' => $requestId, 'home_name' => 'Ana Santos']);
        $this->assertSame(PetStatus::AdoptedHired, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(0, AdoptionResolution::query()->count());

        // A reason is required (FR37), and without one nothing changes.
        $this->resolve(['action' => 'cancel_adoption'])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->resolve(['action' => 'cancel_adoption', 'reason' => '   '])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->assertNull($adoption->fresh()->link_removed_at);

        $this->resolve(['action' => 'cancel_adoption', 'reason' => 'Returned on Sep 20 because of a severe allergy.'])
            ->assertOk()
            ->assertJsonPath('data.action', 'cancel_adoption')
            ->assertJsonPath('data.pet_status', 'looking_for_a_home')
            ->assertJsonPath('data.admin_name', 'admin.jess')
            ->assertJsonPath('data.adoption_request_id', $requestId);

        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
        $this->assertNotNull($adoption->fresh()->link_removed_at);
        $this->assertSame(AdoptionRequestStatus::Closed, AdoptionRequest::query()->findOrFail($requestId)->getStatus());
        // A human can adopt again, and the Furparent label stays (§5.5).
        $this->assertTrue($this->home->fresh()->isFurparent());

        $this->assertDatabaseHas('adoption_resolutions', ['pet_id' => $this->pet->id, 'adoption_request_id' => $requestId, 'action' => 'cancel_adoption', 'admin_user_id' => $this->admin->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin_adoption_resolved', 'actor_user_id' => $this->admin->id, 'before_value' => 'adopted_hired', 'after_value' => 'looking_for_a_home']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'adoption_link_removed', 'actor_user_id' => $this->admin->id, 'before_value' => 'Ana Santos']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin_request_status_changed', 'before_value' => 'adopted', 'after_value' => 'closed']);

        // Both accounts are told, in plain words, with the reason and never the action's code.
        foreach ([[$this->mochi, 'Your adoption was cancelled'], [$this->ana, 'The adoption of Mochi was cancelled']] as [$user, $title]) {
            $notification = Notification::query()->where('user_id', $user->id)->firstOrFail();
            $this->assertSame($title, $notification->title);
            $this->assertStringContainsString('Reason: Returned on Sep 20 because of a severe allergy.', $notification->body);
            $this->assertStringNotContainsString('cancel_adoption', $notification->body);
            $this->assertSame("/requests/{$requestId}", $notification->action_url);
        }

        // Done once: there is no adoption left to cancel.
        $this->resolve(['action' => 'cancel_adoption', 'reason' => 'Again.'])->assertStatus(409)->assertJsonPath('code', 'resolution_not_available');
        $this->assertSame(1, AdoptionResolution::query()->count());

        // The adopted request's record no longer names an adoption.
        $this->actingAs($this->admin)->getJson("/api/v1/admin/adoption-requests/{$requestId}")
            ->assertJsonPath('data.adoption', null)
            ->assertJsonPath('data.resolutions.0.action', 'cancel_adoption')
            ->assertJsonPath('data.resolutions.0.admin_name', 'admin.jess');
    }

    public function test_returning_a_pet_ends_its_process_and_restores_its_paused_requests(): void
    {
        $paused = $this->requestIn('onHold', $this->anotherHome('Marco Cruz'), ['expires_at' => null]);
        $inProcess = $this->requestIn('meetScheduled');
        $meeting = $this->meeting($inProcess);

        $this->actingAs($this->admin)->postJson("/api/v1/admin/adoptions/{$this->pet->id}/resolve/preview", ['action' => 'return_to_looking_for_a_home'])
            ->assertOk()
            ->assertJsonPath('data.before.pet_status', 'in_process')
            ->assertJsonPath('data.after.pet_status', 'looking_for_a_home')
            ->assertJsonPath('data.after.request_status', 'closed')
            ->assertJsonPath('data.requests_restored', 1)
            ->assertJsonPath('data.meeting_ended', true);

        $this->resolve(['action' => 'return_to_looking_for_a_home', 'adoption_request_id' => $inProcess->id, 'reason' => 'The home asked to stop the process.'])->assertOk();

        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(AdoptionRequestStatus::Closed, $inProcess->fresh()->getStatus());
        $this->assertNotNull($inProcess->fresh()->closed_at);
        // The booked Meet & Greet ends with it, and the admin is named as ending it.
        $this->assertSame(MeetAndGreetStatus::Ended, $meeting->fresh()->getStatus());
        $this->assertSame($this->admin->id, $meeting->fresh()->ended_by_user_id);
        // The request On Hold is Sent again with a fresh 14 days (§5.3).
        $this->assertSame(AdoptionRequestStatus::Sent, $paused->fresh()->getStatus());
        $this->assertNotNull($paused->fresh()->expires_at);

        $this->assertSame("You're Looking for a Home again", Notification::query()->where('user_id', $this->mochi->id)->firstOrFail()->title);
        $this->assertSame('The request from Mochi was closed', Notification::query()->where('user_id', $this->ana->id)->firstOrFail()->title);

        // A pet that isn't In Process has no process to end.
        $this->resolve(['action' => 'return_to_looking_for_a_home', 'reason' => 'Again.'])->assertStatus(409)->assertJsonPath('code', 'resolution_not_available');
    }

    public function test_closing_a_request_changes_that_request_only_and_never_one_in_process(): void
    {
        $inProcess = $this->requestIn('approved');
        $first = $this->requestIn('onHold', $this->anotherHome('Marco Cruz'));
        $second = $this->requestIn('onHold', $this->anotherHome('Mia Tan'));

        // With two requests it could close, the API asks which one.
        $this->resolve(['action' => 'close_request', 'reason' => 'Duplicate.'])->assertStatus(409)->assertJsonPath('code', 'resolution_request_required');
        // The request in process is not closed this way: that would leave the pet In Process with nothing in process.
        $this->resolve(['action' => 'close_request', 'adoption_request_id' => $inProcess->id, 'reason' => 'Stop.'])->assertStatus(409)->assertJsonPath('code', 'resolution_not_available');
        // Nor another pet's request.
        $other = AdoptionRequest::factory()->create();
        $this->resolve(['action' => 'close_request', 'adoption_request_id' => $other->id, 'reason' => 'Stop.'])->assertStatus(409);
        $this->assertSame(AdoptionRequestStatus::Sent, $other->fresh()->getStatus());
        $this->assertSame(0, AdoptionResolution::query()->count());

        $this->resolve(['action' => 'close_request', 'adoption_request_id' => $first->id, 'reason' => 'The home asked us to remove it.'])
            ->assertOk()
            ->assertJsonPath('data.change.before.request_status', 'on_hold')
            ->assertJsonPath('data.change.after.request_status', 'closed')
            ->assertJsonPath('data.change.after.pet_status', 'in_process')
            ->assertJsonPath('data.home_name', 'Marco Cruz');

        $this->assertSame(AdoptionRequestStatus::Closed, $first->fresh()->getStatus());
        // "Other requests are not affected" (AL-07).
        $this->assertSame(AdoptionRequestStatus::OnHold, $second->fresh()->getStatus());
        $this->assertSame(AdoptionRequestStatus::Approved, $inProcess->fresh()->getStatus());
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());
        $this->assertSame('Your request to Marco Cruz was closed', Notification::query()->where('user_id', $this->mochi->id)->firstOrFail()->title);
        $this->assertSame(0, Notification::query()->where('user_id', $this->ana->id)->count());

        // An unknown action is refused before anything is read.
        $this->resolve(['action' => 'mark_adopted', 'reason' => 'By hand.'])->assertUnprocessable()->assertJsonValidationErrors(['action']);
        $this->resolve(['action' => 'close_request', 'adoption_request_id' => 'abc', 'reason' => 'x'])->assertUnprocessable()->assertJsonValidationErrors(['adoption_request_id']);
    }

    public function test_reopening_a_booking_sends_an_overdue_request_back_to_approved(): void
    {
        $request = $this->requestIn('awaitingDecision', null, ['awaiting_decision_at' => now()->subDays(9), 'overdue_flagged_at' => now()->subDays(2)]);
        $this->meeting($request, 'ended', '-9 days');

        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?tab=overdue')->assertJsonCount(1, 'data');

        $this->resolve(['action' => 'reopen_meet_greet_booking', 'adoption_request_id' => $request->id, 'reason' => 'Neither side showed up; they asked for another day.'])
            ->assertOk()
            ->assertJsonPath('data.change.before.request_status', 'awaiting_decision')
            ->assertJsonPath('data.change.after.request_status', 'approved')
            ->assertJsonPath('data.pet_status', 'in_process');

        $fresh = $request->fresh();
        $this->assertSame(AdoptionRequestStatus::Approved, $fresh->getStatus());
        $this->assertNull($fresh->meet_scheduled_at);
        $this->assertNull($fresh->awaiting_decision_at);
        $this->assertNull($fresh->overdue_flagged_at);
        $this->assertNull($fresh->closed_at);
        $this->assertTrue($fresh->expires_at->isFuture());
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());

        // No longer overdue, and the pet is reminded to book again in its own words.
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-requests?tab=overdue')->assertJsonCount(0, 'data');
        $this->assertSame('Meet & Greet booking is open again', Notification::query()->where('user_id', $this->mochi->id)->firstOrFail()->title);
        // The pet can book a slot again, as after an approval.
        $this->actingAs($this->mochi)->getJson("/api/v1/adoption-requests/{$request->id}")->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.contacts', null);

        // An Approved request has no confirmed meeting to reopen.
        $this->resolve(['action' => 'reopen_meet_greet_booking', 'adoption_request_id' => $request->id, 'reason' => 'Again.'])->assertStatus(409)->assertJsonPath('code', 'resolution_not_available');
    }

    public function test_recent_resolutions_list_who_changed_what_and_why(): void
    {
        $first = $this->requestIn('sent');
        $this->resolve(['action' => 'close_request', 'adoption_request_id' => $first->id, 'reason' => 'Sent by mistake.'])->assertOk();
        $this->travel(1)->minutes();
        $this->adopt();
        $this->resolve(['action' => 'cancel_adoption', 'reason' => 'Returned.'])->assertOk();

        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-resolutions')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.action', 'cancel_adoption')
            ->assertJsonPath('data.0.pet.name', 'Mochi')
            ->assertJsonPath('data.0.home_name', 'Ana Santos')
            ->assertJsonPath('data.0.admin_name', 'admin.jess')
            ->assertJsonPath('data.0.reason', 'Returned.')
            ->assertJsonPath('data.1.action', 'close_request');

        $otherPet = Pet::factory()->lookingForAHome()->create();
        $this->actingAs($this->admin)->getJson("/api/v1/admin/adoption-resolutions?pet_id={$otherPet->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->admin)->getJson('/api/v1/admin/adoption-resolutions?pet_id=abc')->assertUnprocessable();
    }
}
