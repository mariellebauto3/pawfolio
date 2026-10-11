<?php

declare(strict_types=1);

namespace Tests\Feature\Discovery;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * How the Browse lists are ordered and loaded, and what an alumni profile says about a Furparent whose Open to Adopt
 * is off (DS-01, DS-02, DS-07, DS-08).
 */
class DiscoveryListsTest extends TestCase
{
    use RefreshDatabase;

    private function listedPet(string $name): Pet
    {
        return Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name]);
    }

    private function listedHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
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

    public function test_best_match_lists_pets_without_a_score_last(): void
    {
        $human = User::factory()->human()->active()->create();
        $home = HomeProfile::factory()->for($human)->openToAdopt()->create();

        $good = $this->listedPet('Good');
        // Published last, so "newest first" alone would put it at the top.
        $unscored = $this->listedPet('Unscored');
        $best = $this->listedPet('Best');
        $unscored->forceFill(['published_at' => now()->addDay()])->save();

        MatchScore::factory()->create(['pet_id' => $good->id, 'home_profile_id' => $home->id, 'score' => 60]);
        MatchScore::factory()->create(['pet_id' => $best->id, 'home_profile_id' => $home->id, 'score' => 90]);

        $this->actingAs($human)->getJson('/api/v1/pets')
            ->assertOk()
            ->assertJsonPath('data.*.name', ['Best', 'Good', 'Unscored'])
            ->assertJsonPath('data.0.match_score', 90)
            ->assertJsonMissingPath('data.2.match_score');
    }

    public function test_best_match_lists_homes_without_a_score_last(): void
    {
        $petUser = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($petUser)->lookingForAHome()->create();

        $good = $this->listedHome('Good Home');
        $unscored = $this->listedHome('Unscored Home');
        $best = $this->listedHome('Best Home');
        $unscored->forceFill(['quiz_completed_at' => now()->addDay()])->save();

        MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $good->id, 'score' => 55]);
        MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $best->id, 'score' => 95]);

        $this->actingAs($petUser)->getJson('/api/v1/home-profiles')
            ->assertOk()
            ->assertJsonPath('data.*.full_name', ['Best Home', 'Good Home', 'Unscored Home']);
    }

    public function test_a_longer_list_of_pets_takes_no_more_queries(): void
    {
        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->openToAdopt()->create();

        $first = $this->listedPet('First');
        $this->listedPet('Second');
        $few = $this->queriesFor($human, '/api/v1/pets');

        foreach (range(1, 6) as $n) {
            $this->listedPet("More {$n}");
        }
        $this->assertSame($few, $this->queriesFor($human, '/api/v1/pets'));
        $this->assertSame($this->queriesFor($human, '/api/v1/search?q=o'), $this->queriesFor($human, '/api/v1/search?q=e'));

        // The numbers the list now loads in bulk are still each pet's own.
        $this->actingAs($human)->postJson('/api/v1/bookmarks', ['pet_id' => $first->id])->assertCreated();
        $rows = collect($this->actingAs($human)->getJson('/api/v1/pets?sort=name_asc')->assertOk()->json('data'))->keyBy('name');

        $this->assertTrue($rows['First']['is_bookmarked']);
        $this->assertSame(1, $rows['First']['bookmarks_count']);
        $this->assertFalse($rows['Second']['is_bookmarked']);
        $this->assertSame(0, $rows['Second']['bookmarks_count']);
    }

    public function test_a_longer_list_of_homes_takes_no_more_queries(): void
    {
        $petUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($petUser)->lookingForAHome()->create();

        $this->listedHome('One');
        $this->listedHome('Two');
        $few = $this->queriesFor($petUser, '/api/v1/home-profiles');

        foreach (range(1, 6) as $n) {
            $this->listedHome("More {$n}");
        }
        $this->assertSame($few, $this->queriesFor($petUser, '/api/v1/home-profiles'));
    }

    public function test_a_furparents_home_is_hidden_once_open_to_adopt_is_off_and_hired_by_says_so(): void
    {
        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();

        $furparent = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => 'Elena Garcia']);
        $alumUser = User::factory()->pet()->active()->create();
        $alum = Pet::factory()->for($alumUser)->adopted()->create(['name' => 'Luna']);
        $request = AdoptionRequest::factory()->create(['pet_id' => $alum->id, 'home_profile_id' => $furparent->id]);
        Adoption::factory()->create(['pet_id' => $alum->id, 'home_profile_id' => $furparent->id, 'adoption_request_id' => $request->id]);

        // Open to Adopt on: anyone may open the home, and the alumni profile says the "Hired by …" name can link.
        $this->actingAs($human)->getJson("/api/v1/home-profiles/{$furparent->id}")->assertOk();
        $this->actingAs($human)->getJson("/api/v1/pets/{$alum->id}")
            ->assertOk()
            ->assertJsonPath('data.hired_by.full_name', 'Elena Garcia')
            ->assertJsonPath('data.hired_by.is_home_viewable', true);

        $furparent->forceFill(['is_open_to_adopt' => false])->save();

        // Off: the home isn't shown, though it adopted a pet, and it isn't listed.
        $this->actingAs($human)->getJson("/api/v1/home-profiles/{$furparent->id}")->assertNotFound();
        $this->actingAs($human)->getJson('/api/v1/search?q=elena')->assertOk()->assertJsonPath('data.totals.home_profiles', 0);
        // The alumni profile still names the Furparent, and says the name shouldn't be a link.
        $this->actingAs($human)->getJson("/api/v1/pets/{$alum->id}")
            ->assertOk()
            ->assertJsonPath('data.hired_by.full_name', 'Elena Garcia')
            ->assertJsonPath('data.hired_by.is_home_viewable', false);

        // The adopted pet itself still reads its Furparent's home: its request with it stands (§5.5).
        $this->actingAs($alumUser)->getJson("/api/v1/home-profiles/{$furparent->id}")->assertOk();
        $this->actingAs($alumUser)->getJson('/api/v1/me/pet')->assertOk()->assertJsonPath('data.hired_by.is_home_viewable', true);
        // And the Furparent keeps using the account: the profile is theirs to read and to switch back on.
        $this->actingAs($furparent->user)->getJson('/api/v1/me/home-profile')->assertOk()->assertJsonPath('data.is_open_to_adopt', false);
    }
}
