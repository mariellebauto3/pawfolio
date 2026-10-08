<?php

declare(strict_types=1);

namespace Tests\Feature\Bookmarks;

use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Bookmarks (BM-01…BM-04, FR8, FR23, docs/api/bookmarks-and-invites.md): a human saves pets and a pet saves homes,
 * only what they may see, and each account reads and removes only its own.
 */
class BookmarksTest extends TestCase
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

    private function listedPet(string $name): Pet
    {
        return Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name]);
    }

    private function listedHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
    }

    /** A bookmark written straight to the table, as one saved earlier. */
    private function saved(User $user, Pet|HomeProfile $target, ?string $at = null): Bookmark
    {
        $bookmark = new Bookmark;
        $bookmark->user_id = $user->id;
        $bookmark->{$target instanceof Pet ? 'pet_id' : 'home_profile_id'} = $target->id;
        $bookmark->created_at = $at ?? now();
        $bookmark->save();

        return $bookmark;
    }

    public function test_bookmarks_are_for_signed_in_active_pets_and_humans(): void
    {
        $this->getJson('/api/v1/bookmarks')->assertUnauthorized();
        $this->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])->assertUnauthorized();
        $this->deleteJson("/api/v1/bookmarks/pets/{$this->pet->id}")->assertUnauthorized();

        $pending = User::factory()->human()->pendingVerification()->create();
        $this->actingAs($pending)->getJson('/api/v1/bookmarks')->assertForbidden()->assertJsonPath('code', 'account_not_active');
        $this->actingAs($pending)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        $suspended = User::factory()->pet()->suspended()->create();
        $this->actingAs($suspended)->postJson('/api/v1/bookmarks', ['home_profile_id' => $this->home->id])
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        // An admin has nothing to save.
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->getJson('/api/v1/bookmarks')->assertForbidden();
        $this->actingAs($admin)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])->assertForbidden();
        $this->actingAs($admin)->deleteJson("/api/v1/bookmarks/pets/{$this->pet->id}")->assertForbidden();

        $this->assertSame(0, Bookmark::query()->count());
    }

    public function test_a_human_saves_a_pet_once(): void
    {
        $first = $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])
            ->assertCreated()
            ->assertJsonPath('data.pet_id', $this->pet->id)
            ->assertJsonPath('data.home_profile_id', null);

        // A second press keeps the first bookmark and is not an error.
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame(1, Bookmark::query()->where('user_id', $this->human->id)->count());

        $this->actingAs($this->human)->getJson("/api/v1/pets/{$this->pet->id}")
            ->assertOk()
            ->assertJsonPath('data.is_bookmarked', true)
            ->assertJsonPath('data.bookmarks_count', 1);
    }

    public function test_a_pet_saves_a_home_once(): void
    {
        $first = $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => $this->home->id])
            ->assertCreated()
            ->assertJsonPath('data.home_profile_id', $this->home->id)
            ->assertJsonPath('data.pet_id', null);

        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => $this->home->id])
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->actingAs($this->petUser)->getJson("/api/v1/home-profiles/{$this->home->id}")
            ->assertOk()
            ->assertJsonPath('data.is_bookmarked', true);
    }

    public function test_each_role_saves_only_its_own_kind(): void
    {
        // A human saves pets, not homes.
        $otherHome = $this->listedHome('Ben Cruz');
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['home_profile_id' => $otherHome->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['pet_id', 'home_profile_id']);
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id, 'home_profile_id' => $otherHome->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['home_profile_id']);

        // A pet saves homes, not pets: not another pet's resume, and not its own.
        $otherPet = $this->listedPet('Kulit');
        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['pet_id' => $otherPet->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['pet_id', 'home_profile_id']);
        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['pet_id' => $this->pet->id])->assertUnprocessable();

        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', [])->assertUnprocessable()->assertJsonValidationErrors(['pet_id']);
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => 'mochi'])->assertUnprocessable();
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => 0])->assertUnprocessable();

        $this->assertSame(0, Bookmark::query()->count());
    }

    public function test_a_pet_that_may_not_be_seen_cannot_be_saved(): void
    {
        $draft = Pet::factory()->for(User::factory()->pet()->active())->draft()->create();
        $suspended = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create();

        // Each answers like a pet that doesn't exist (SEC-AUTHZ-04).
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $draft->id])->assertNotFound();
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $suspended->id])->assertNotFound();
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => 999999])->assertNotFound();

        // An adopted pet's profile is public, but it has no Bookmark (DS-08).
        $alum = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create(['name' => 'Luna']);
        $this->actingAs($this->human)->postJson('/api/v1/bookmarks', ['pet_id' => $alum->id])
            ->assertConflict()
            ->assertJsonPath('code', 'pet_already_adopted');

        $this->assertSame(0, Bookmark::query()->count());
    }

    public function test_a_home_that_may_not_be_seen_cannot_be_saved(): void
    {
        $closed = HomeProfile::factory()->for(User::factory()->human()->active())->withQuizCompleted()->create();
        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create();

        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => $closed->id])->assertNotFound();
        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => $suspended->id])->assertNotFound();
        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => 999999])->assertNotFound();
        $this->assertSame(0, Bookmark::query()->count());

        // Open to Adopt off doesn't hide a home from a pet with a request there (§5.5), so that pet may save it.
        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $closed->id]);
        $this->actingAs($this->petUser)->postJson('/api/v1/bookmarks', ['home_profile_id' => $closed->id])->assertCreated();
    }

    public function test_a_human_reads_the_pets_they_saved_newest_first_with_their_match(): void
    {
        $older = $this->listedPet('Older');
        $newer = $this->listedPet('Newer');
        $this->saved($this->human, $older, '2026-10-01 09:00:00');
        $newest = $this->saved($this->human, $newer, '2026-10-02 09:00:00');
        MatchScore::factory()->create(['pet_id' => $newer->id, 'home_profile_id' => $this->home->id, 'score' => 86]);

        // Someone else's bookmark is not on the list.
        $this->saved(User::factory()->human()->active()->create(), $this->pet);

        $response = $this->actingAs($this->human)->getJson('/api/v1/bookmarks')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $newest->id)
            ->assertJsonPath('data.0.pet.name', 'Newer')
            ->assertJsonPath('data.0.pet.match_score', 86)
            ->assertJsonPath('data.0.pet.is_bookmarked', true)
            ->assertJsonPath('data.0.pet.bookmarks_count', 1)
            ->assertJsonPath('data.1.pet.name', 'Older')
            // No score for this pair, so none is shown.
            ->assertJsonMissingPath('data.1.pet.match_score')
            ->assertJsonMissingPath('data.0.home_profile');

        // A card carries the public resume only (SEC-PRIV-02).
        $response->assertJsonMissingPath('data.0.pet.caretaker_contact_number')
            ->assertJsonMissingPath('data.0.pet.caretaker_name')
            ->assertJsonMissingPath('data.0.pet.vet_records');
    }

    public function test_a_pet_reads_the_homes_it_saved_with_its_match(): void
    {
        $saved = $this->listedHome('Ben Cruz');
        $this->saved($this->petUser, $saved);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $saved->id, 'score' => 78]);

        $this->actingAs($this->petUser)->getJson('/api/v1/bookmarks')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.home_profile.full_name', 'Ben Cruz')
            ->assertJsonPath('data.0.home_profile.match_score', 78)
            ->assertJsonPath('data.0.home_profile.is_bookmarked', true)
            ->assertJsonMissingPath('data.0.pet')
            // Only the city and a household summary are public (SEC-PRIV-03).
            ->assertJsonMissingPath('data.0.home_profile.contact_number')
            ->assertJsonMissingPath('data.0.home_profile.street_address')
            ->assertJsonMissingPath('data.0.home_profile.birthdate');
    }

    public function test_a_saved_pet_that_became_hidden_leaves_the_list(): void
    {
        $shown = $this->listedPet('Shown');
        $alum = Pet::factory()->for(User::factory()->pet()->active())->adopted()->create(['name' => 'Alum']);
        $hidden = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create(['name' => 'Hidden']);
        foreach ([$shown, $alum, $hidden] as $pet) {
            $this->saved($this->human, $pet);
        }

        // A pet saved before it was adopted stays, as its profile does (DS-08); a suspended account's doesn't.
        $names = $this->actingAs($this->human)->getJson('/api/v1/bookmarks')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->json('data.*.pet.name');

        $this->assertEqualsCanonicalizing(['Shown', 'Alum'], $names);
    }

    public function test_a_saved_home_that_became_hidden_leaves_the_list(): void
    {
        $open = $this->listedHome('Open');
        $closed = $this->listedHome('Closed');
        $applied = $this->listedHome('Applied');
        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create(['full_name' => 'Suspended']);
        foreach ([$open, $closed, $applied, $suspended] as $home) {
            $this->saved($this->petUser, $home);
        }

        AdoptionRequest::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $applied->id]);
        $closed->forceFill(['is_open_to_adopt' => false])->save();
        $applied->forceFill(['is_open_to_adopt' => false])->save();

        // Open to Adopt off hides a home, except from a pet with a request there (§5.5).
        $names = $this->actingAs($this->petUser)->getJson('/api/v1/bookmarks')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->json('data.*.home_profile.full_name');

        $this->assertEqualsCanonicalizing(['Open', 'Applied'], $names);

        // Hidden, not gone: it is back when the home opens again, and it can still be removed meanwhile.
        $this->actingAs($this->petUser)->deleteJson("/api/v1/bookmarks/home-profiles/{$suspended->id}")->assertNoContent();
        $closed->forceFill(['is_open_to_adopt' => true])->save();
        $this->actingAs($this->petUser)->getJson('/api/v1/bookmarks')->assertOk()->assertJsonPath('meta.total', 3);
    }

    public function test_the_list_is_paged_and_loaded_once_for_the_page(): void
    {
        foreach (['One', 'Two', 'Three'] as $name) {
            $this->saved($this->human, $this->listedPet($name));
        }

        $this->actingAs($this->human)->getJson('/api/v1/bookmarks?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
        $this->actingAs($this->human)->getJson('/api/v1/bookmarks?per_page=2&page=2')->assertOk()->assertJsonCount(1, 'data');
        // Never more than 50 a page (SEC-API-05).
        $this->actingAs($this->human)->getJson('/api/v1/bookmarks?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
        $this->actingAs($this->human)->getJson('/api/v1/bookmarks?page=0')->assertUnprocessable()->assertJsonValidationErrors(['page']);
        $this->actingAs($this->human)->getJson('/api/v1/bookmarks?page=two')->assertUnprocessable();

        $three = $this->queriesFor($this->human, '/api/v1/bookmarks');
        foreach (['Four', 'Five', 'Six'] as $name) {
            $this->saved($this->human, $this->listedPet($name));
        }

        // Twice the rows, the same number of queries.
        $this->assertSame($three, $this->queriesFor($this->human, '/api/v1/bookmarks'));
    }

    public function test_a_bookmark_is_removed_by_the_profile_it_saves(): void
    {
        $this->saved($this->human, $this->pet);
        $othersHuman = User::factory()->human()->active()->create();
        $others = $this->saved($othersHuman, $this->pet);

        $this->actingAs($this->human)->deleteJson("/api/v1/bookmarks/pets/{$this->pet->id}")->assertNoContent();
        // Already gone: pressing twice is not an error.
        $this->actingAs($this->human)->deleteJson("/api/v1/bookmarks/pets/{$this->pet->id}")->assertNoContent();

        $this->assertSame(0, Bookmark::query()->where('user_id', $this->human->id)->count());
        // Only the account's own bookmark of that pet went.
        $this->assertModelExists($others);

        $this->saved($this->petUser, $this->home);
        $this->actingAs($this->petUser)->deleteJson("/api/v1/bookmarks/home-profiles/{$this->home->id}")->assertNoContent();
        $this->assertSame(0, Bookmark::query()->where('user_id', $this->petUser->id)->count());

        $this->actingAs($this->human)->deleteJson('/api/v1/bookmarks/pets/mochi')->assertNotFound();
    }

    public function test_a_bookmark_is_removed_by_its_id_only_by_its_owner(): void
    {
        $mine = $this->saved($this->human, $this->pet);
        $others = $this->saved(User::factory()->human()->active()->create(), $this->pet);

        // Someone else's answers like one that doesn't exist (SEC-AUTHZ-04).
        $this->actingAs($this->human)->deleteJson("/api/v1/bookmarks/{$others->id}")->assertNotFound();
        $this->actingAs($this->human)->deleteJson('/api/v1/bookmarks/999999')->assertNotFound();
        $this->assertModelExists($others);

        $this->actingAs($this->human)->deleteJson("/api/v1/bookmarks/{$mine->id}")->assertNoContent();
        $this->assertModelMissing($mine);
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
