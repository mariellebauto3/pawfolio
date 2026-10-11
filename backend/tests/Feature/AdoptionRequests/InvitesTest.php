<?php

declare(strict_types=1);

namespace Tests\Feature\AdoptionRequests;

use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Invite to Apply (RQ-01, RQ-02, FR9, docs/api/bookmarks-and-invites.md): a human who is Open to Adopt invites a pet
 * that is Looking for a Home, once; only that pet reads and dismisses the invite.
 */
class InvitesTest extends TestCase
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
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create(['full_name' => 'Ana Santos']);

        $this->petUser = User::factory()->pet()->active()->create();
        $this->pet = Pet::factory()->for($this->petUser)->lookingForAHome()->create(['name' => 'Mochi']);
    }

    private function listedHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
    }

    /** An invite to Mochi written straight to the table, as one sent earlier. */
    private function invited(HomeProfile $home, ?string $at = null, ?Pet $pet = null): Invite
    {
        return Invite::factory()->create([
            'home_profile_id' => $home->id,
            'pet_id' => ($pet ?? $this->pet)->id,
            'note' => null,
            'created_at' => $at ?? now(),
        ]);
    }

    private function sendUrl(?Pet $pet = null): string
    {
        return '/api/v1/pets/'.($pet ?? $this->pet)->id.'/invites';
    }

    public function test_only_a_signed_in_active_human_sends_and_only_a_pet_reads(): void
    {
        $this->postJson($this->sendUrl())->assertUnauthorized();
        $this->getJson('/api/v1/invites')->assertUnauthorized();
        $this->postJson('/api/v1/invites/1/dismiss')->assertUnauthorized();

        $pending = User::factory()->human()->pendingVerification()->create();
        HomeProfile::factory()->for($pending)->openToAdopt()->create();
        $this->actingAs($pending)->postJson($this->sendUrl())->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $suspended = User::factory()->pet()->suspended()->create();
        $this->actingAs($suspended)->getJson('/api/v1/invites')->assertForbidden()->assertJsonPath('code', 'account_not_active');

        // A pet doesn't invite, and neither does an admin.
        $this->actingAs($this->petUser)->postJson($this->sendUrl())->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->postJson($this->sendUrl())->assertForbidden();

        // Invites to Apply is the pet's screen.
        $this->actingAs($this->human)->getJson('/api/v1/invites')->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->getJson('/api/v1/invites')->assertForbidden();

        $this->assertSame(0, Invite::query()->count());
    }

    public function test_a_human_invites_a_pet_and_the_pet_is_told(): void
    {
        $this->actingAs($this->human)->getJson("/api/v1/pets/{$this->pet->id}")->assertOk()->assertJsonPath('data.invited_at', null);

        $response = $this->actingAs($this->human)->postJson($this->sendUrl(), ['note' => '  Your resume made us smile.  '])
            ->assertCreated()
            ->assertJsonPath('data.pet_id', $this->pet->id)
            ->assertJsonPath('data.home_profile_id', $this->home->id)
            // Trimmed before it is stored (SEC-INPUT-06).
            ->assertJsonPath('data.note', 'Your resume made us smile.');

        $invite = Invite::query()->sole();
        $this->assertSame($response->json('data.id'), $invite->id);
        $this->assertNull($invite->dismissed_at);

        $notification = $this->petUser->notifications()->sole();
        $this->assertSame('invite_sent', $notification->type);
        $this->assertSame('/invites', $notification->action_url);

        $this->assertSame(1, ActivityLog::query()->where('action', 'invite_to_apply_sent')->where('actor_user_id', $this->human->id)->count());

        // The resume now tells this human their invite is out, and nobody else.
        $this->actingAs($this->human)->getJson("/api/v1/pets/{$this->pet->id}")
            ->assertOk()
            ->assertJsonPath('data.invited_at', $invite->created_at->toISOString());
        $other = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($other)->openToAdopt()->create();
        $this->actingAs($other)->getJson("/api/v1/pets/{$this->pet->id}")->assertOk()->assertJsonPath('data.invited_at', null);
        $this->actingAs($this->petUser)->getJson("/api/v1/pets/{$this->pet->id}")->assertOk()->assertJsonMissingPath('data.invited_at');
    }

    public function test_a_pet_that_turned_invite_alerts_off_is_invited_without_one(): void
    {
        $this->petUser->createNotificationPreference()->update(['requests_and_invites' => false]);

        $this->actingAs($this->human)->postJson($this->sendUrl())->assertCreated()->assertJsonPath('data.note', null);

        $this->assertSame(1, Invite::query()->count());
        $this->assertSame(0, $this->petUser->notifications()->count());
    }

    public function test_only_the_note_is_read_from_an_invite(): void
    {
        $this->actingAs($this->human)->postJson($this->sendUrl(), ['note' => str_repeat('a', 201)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);
        $this->actingAs($this->human)->postJson($this->sendUrl(), ['note' => ['a list']])->assertUnprocessable();
        $this->assertSame(0, Invite::query()->count());

        // The pet is the one in the path and the home is the sender's own, whatever the body says (SEC-INPUT-04).
        $otherHome = $this->listedHome('Ben Cruz');
        $otherPet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create();
        $this->actingAs($this->human)->postJson($this->sendUrl(), [
            'note' => str_repeat('a', 200),
            'home_profile_id' => $otherHome->id,
            'pet_id' => $otherPet->id,
            'dismissed_at' => '2026-01-01 00:00:00',
        ])->assertCreated();

        $invite = Invite::query()->sole();
        $this->assertSame($this->home->id, $invite->home_profile_id);
        $this->assertSame($this->pet->id, $invite->pet_id);
        $this->assertNull($invite->dismissed_at);
    }

    public function test_a_human_invites_only_while_open_to_adopt(): void
    {
        $this->home->forceFill(['is_open_to_adopt' => false])->save();
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertConflict()->assertJsonPath('code', 'not_open_to_adopt');

        // Open to Adopt can't be on without the quiz, but the rule doesn't lean on that.
        $this->home->forceFill(['is_open_to_adopt' => true, 'quiz_completed_at' => null])->save();
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertConflict()->assertJsonPath('code', 'not_open_to_adopt');

        $noHome = User::factory()->human()->active()->create();
        $this->actingAs($noHome)->postJson($this->sendUrl())->assertConflict()->assertJsonPath('code', 'not_open_to_adopt');

        $this->assertSame(0, Invite::query()->count());
    }

    public function test_only_a_pet_that_is_looking_for_a_home_is_invited(): void
    {
        $inProcess = Pet::factory()->for(User::factory()->pet()->active())->create(['status' => 'in_process', 'published_at' => now()]);
        $alum = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create();

        foreach ([$inProcess, $alum] as $pet) {
            $this->actingAs($this->human)->postJson($this->sendUrl($pet))
                ->assertConflict()
                ->assertJsonPath('code', 'pet_not_looking_for_home');
        }

        // A pet the human may not see answers like one that doesn't exist (SEC-AUTHZ-04).
        $draft = Pet::factory()->for(User::factory()->pet()->active())->draft()->create();
        $suspended = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create();
        $this->actingAs($this->human)->postJson($this->sendUrl($draft))->assertNotFound();
        $this->actingAs($this->human)->postJson($this->sendUrl($suspended))->assertNotFound();
        $this->actingAs($this->human)->postJson('/api/v1/pets/999999/invites')->assertNotFound();

        $this->assertSame(0, Invite::query()->count());
    }

    public function test_one_live_invite_per_pet_and_home(): void
    {
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertCreated();
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertConflict()->assertJsonPath('code', 'invite_already_sent');
        $this->assertSame(1, Invite::query()->count());

        // Another home may invite the same pet.
        $other = $this->listedHome('Ben Cruz');
        $this->actingAs($other->user)->postJson($this->sendUrl())->assertCreated();

        // Once the pet dismissed it, the human may ask again.
        $first = Invite::query()->where('home_profile_id', $this->home->id)->sole();
        $this->actingAs($this->petUser)->postJson("/api/v1/invites/{$first->id}/dismiss")->assertOk();
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertCreated();

        $this->assertSame(1, Invite::query()->where('home_profile_id', $this->home->id)->active()->count());
    }

    public function test_a_pet_that_already_applied_is_not_invited(): void
    {
        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);

        $this->actingAs($this->human)->postJson($this->sendUrl())->assertConflict()->assertJsonPath('code', 'request_already_open');
        $this->assertSame(0, Invite::query()->count());

        // A request that ended doesn't stand in the way.
        AdoptionRequest::query()->update(['status' => 'withdrawn', 'closed_at' => now()]);
        $this->actingAs($this->human)->postJson($this->sendUrl())->assertCreated();
    }

    public function test_a_pet_reads_its_live_invites_newest_first(): void
    {
        $older = $this->listedHome('Older');
        $newer = $this->listedHome('Newer');
        $this->invited($older, '2026-10-01 09:00:00');
        $newest = $this->invited($newer, '2026-10-02 09:00:00');
        $newest->forceFill(['note' => 'Come and meet us.'])->save();
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $newer->id, 'score' => 86]);

        // Not listed: one it dismissed, one from a suspended account, and one sent to another pet.
        $this->invited($this->listedHome('Dismissed'))->forceFill(['dismissed_at' => now()])->save();
        $this->invited(HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create());
        $otherPetUser = User::factory()->pet()->active()->create();
        $this->invited($this->home, null, Pet::factory()->for($otherPetUser)->lookingForAHome()->create());

        $this->actingAs($this->petUser)->getJson('/api/v1/invites')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $newest->id)
            ->assertJsonPath('data.0.note', 'Come and meet us.')
            ->assertJsonPath('data.0.home_profile.full_name', 'Newer')
            ->assertJsonPath('data.0.home_profile.match_score', 86)
            ->assertJsonPath('data.0.home_profile.is_open_to_adopt', true)
            ->assertJsonPath('data.0.open_request_id', null)
            ->assertJsonPath('data.0.cooldown_until', null)
            ->assertJsonPath('data.1.home_profile.full_name', 'Older')
            ->assertJsonPath('data.1.note', null)
            ->assertJsonMissingPath('data.1.home_profile.match_score')
            // The home is attached as its public profile: the address and the phone number stay private (RQ-01).
            ->assertJsonMissingPath('data.0.home_profile.contact_number')
            ->assertJsonMissingPath('data.0.home_profile.street_address')
            ->assertJsonMissingPath('data.0.home_profile.birthdate');

        $this->actingAs($otherPetUser)->getJson('/api/v1/invites')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_an_invite_says_when_the_pet_cannot_apply(): void
    {
        $declined = $this->listedHome('Declined');
        $longAgo = $this->listedHome('Long ago');
        $applied = $this->listedHome('Applied');
        foreach ([$declined, $longAgo, $applied] as $home) {
            $this->invited($home);
        }

        $closedAt = now()->subDays(10)->startOfSecond();
        AdoptionRequest::factory()->declined()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $declined->id, 'closed_at' => $closedAt]);
        AdoptionRequest::factory()->declined()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $longAgo->id, 'closed_at' => now()->subDays(31)]);
        $open = AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $applied->id]);

        $rows = collect($this->actingAs($this->petUser)->getJson('/api/v1/invites')->assertOk()->json('data'))
            ->keyBy('home_profile.full_name');

        // Declined less than 30 days ago: the day the pet may apply again (RQ-06).
        $this->assertSame($closedAt->copy()->addDays(30)->toISOString(), $rows['Declined']['cooldown_until']);
        $this->assertNull($rows['Declined']['open_request_id']);
        // The 30 days have passed.
        $this->assertNull($rows['Long ago']['cooldown_until']);
        // A request is already open with this home.
        $this->assertSame($open->id, $rows['Applied']['open_request_id']);
        $this->assertNull($rows['Applied']['cooldown_until']);
    }

    public function test_only_the_invited_pet_dismisses_an_invite(): void
    {
        $invite = $this->invited($this->home);
        $otherPetUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPetUser)->lookingForAHome()->create();

        // Another pet, the human who sent it and an admin are answered like it doesn't exist (SEC-AUTHZ-04).
        $this->actingAs($otherPetUser)->postJson("/api/v1/invites/{$invite->id}/dismiss")->assertNotFound();
        $this->actingAs($this->human)->postJson("/api/v1/invites/{$invite->id}/dismiss")->assertNotFound();
        $this->actingAs(User::factory()->admin()->create())->postJson("/api/v1/invites/{$invite->id}/dismiss")->assertNotFound();
        $this->actingAs($this->petUser)->postJson('/api/v1/invites/999999/dismiss')->assertNotFound();
        $this->assertNull($invite->fresh()->dismissed_at);

        $first = $this->actingAs($this->petUser)->postJson("/api/v1/invites/{$invite->id}/dismiss")
            ->assertOk()
            ->assertJsonPath('data.id', $invite->id)
            ->json('data.dismissed_at');
        $this->assertNotNull($first);

        // A second press keeps the first time and is not an error.
        $this->travel(5)->minutes();
        $this->actingAs($this->petUser)->postJson("/api/v1/invites/{$invite->id}/dismiss")
            ->assertOk()
            ->assertJsonPath('data.dismissed_at', $first);

        $this->actingAs($this->petUser)->getJson('/api/v1/invites')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_the_list_is_paged_and_loaded_once_for_the_page(): void
    {
        foreach (['One', 'Two', 'Three'] as $name) {
            $this->invited($this->listedHome($name));
        }

        $this->actingAs($this->petUser)->getJson('/api/v1/invites?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
        // Never more than 50 a page (SEC-API-05).
        $this->actingAs($this->petUser)->getJson('/api/v1/invites?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
        $this->actingAs($this->petUser)->getJson('/api/v1/invites?page=0')->assertUnprocessable()->assertJsonValidationErrors(['page']);

        $three = $this->queriesFor($this->petUser, '/api/v1/invites');
        foreach (['Four', 'Five', 'Six'] as $name) {
            $this->invited($this->listedHome($name));
        }

        // Twice the rows, the same number of queries.
        $this->assertSame($three, $this->queriesFor($this->petUser, '/api/v1/invites'));
    }

    private function queriesFor(User $viewer, string $url): int
    {
        // A fresh copy each time: relations the last request loaded onto the model would hide a query from this one.
        $viewer = $viewer->fresh();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($viewer)->getJson($url)->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }
}
