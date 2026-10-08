<?php

declare(strict_types=1);

namespace Tests\Feature\Matching;

use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pets for You and Homes for You (MT-01, MT-02, MT-04, MT-05): who is listed, in what order, in what shape, and
 * what an account without matches is told (FR5, FR21, docs/api/profiles-and-matching.md).
 */
class MatchesListTest extends TestCase
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

    /**
     * A pet that is looking for a home, already scored with the human's home.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function matchedPet(string $name, int $score, array $attributes = []): Pet
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name] + $attributes);
        MatchScore::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id, 'score' => $score]);

        return $pet;
    }

    /**
     * A home that is Open to Adopt, already scored with the pet.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function matchedHome(string $name, int $score, array $attributes = []): HomeProfile
    {
        $home = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name] + $attributes);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $home->id, 'score' => $score]);

        return $home;
    }

    /**
     * @return list<string>
     */
    private function petNames(string $query = ''): array
    {
        return $this->actingAs($this->human)->getJson("/api/v1/matches{$query}")->assertOk()->json('data.*.pet.name');
    }

    /**
     * @return list<string>
     */
    private function homeNames(string $query = ''): array
    {
        return $this->actingAs($this->petUser)->getJson("/api/v1/matches{$query}")->assertOk()->json('data.*.home_profile.full_name');
    }

    public function test_a_human_reads_pets_for_you_best_score_first(): void
    {
        $this->matchedPet('Good', 64);
        $best = $this->matchedPet('Best', 91);
        $this->matchedPet('Fair', 40);

        $response = $this->actingAs($this->human)->getJson('/api/v1/matches')
            ->assertOk()
            ->assertJsonPath('data.*.pet.name', ['Best', 'Good', 'Fair'])
            ->assertJsonPath('data.0.score', 91)
            ->assertJsonPath('data.0.tier', 'high')
            ->assertJsonPath('data.0.pet.id', $best->id)
            ->assertJsonPath('data.0.pet.match_score', 91)
            ->assertJsonPath('data.0.pet.is_bookmarked', false)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.eligible', true)
            ->assertJsonPath('meta.reason', null)
            ->assertJsonStructure(['data' => [['id', 'score', 'reasons', 'calculated_at', 'pet' => ['photos', 'temperament_tags', 'status']]], 'links']);

        $this->assertIsArray($response->json('data.0.reasons'));
        // The caretaker's number never rides along on a list (SEC-PRIV-02).
        $this->assertArrayNotHasKey('caretaker_contact_number', $response->json('data.0.pet'));
    }

    public function test_a_pet_reads_homes_for_you_with_public_details_only(): void
    {
        $this->matchedHome('Good Home', 55);
        $this->matchedHome('Best Home', 95);

        $response = $this->actingAs($this->petUser)->getJson('/api/v1/matches')
            ->assertOk()
            ->assertJsonPath('data.*.home_profile.full_name', ['Best Home', 'Good Home'])
            ->assertJsonPath('data.0.home_profile.match_score', 95)
            ->assertJsonPath('meta.eligible', true);

        // The city and the household answers only (SEC-PRIV-03).
        foreach (['street_address', 'contact_number', 'province', 'birthdate'] as $private) {
            $this->assertArrayNotHasKey($private, $response->json('data.0.home_profile'));
        }
    }

    public function test_an_account_without_matches_yet_gets_an_empty_list_that_says_why(): void
    {
        $unfinished = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($unfinished)->create();

        $draft = User::factory()->pet()->active()->create();
        Pet::factory()->for($draft)->draft()->create();

        $hired = User::factory()->pet()->active()->create();
        Pet::factory()->for($hired)->adopted()->create();

        foreach ([[$unfinished, 'quiz_incomplete'], [$draft, 'resume_draft'], [$hired, 'already_adopted']] as [$viewer, $reason]) {
            $this->actingAs($viewer)->getJson('/api/v1/matches')
                ->assertOk()
                ->assertExactJson([
                    'data' => [],
                    'meta' => [
                        'page' => 1,
                        'current_page' => 1,
                        'per_page' => 20,
                        'total' => 0,
                        'last_page' => 1,
                        'total_pages' => 1,
                        'from' => null,
                        'to' => null,
                        'path' => url('/api/v1/matches'),
                        'eligible' => false,
                        'reason' => $reason,
                    ],
                    'links' => [
                        'first' => url('/api/v1/matches').'?page=1',
                        'last' => url('/api/v1/matches').'?page=1',
                        'prev' => null,
                        'next' => null,
                    ],
                ]);
        }
    }

    public function test_pets_that_are_not_looking_for_a_home_are_left_out(): void
    {
        $this->matchedPet('Listed', 80);
        $this->matchedPet('Draft', 99, ['status' => 'draft']);
        $this->matchedPet('In Process', 98, ['status' => 'in_process']);
        $this->matchedPet('Hired', 97, ['status' => 'adopted_hired']);

        $suspended = Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create(['name' => 'Suspended']);
        MatchScore::factory()->create(['pet_id' => $suspended->id, 'home_profile_id' => $this->home->id, 'score' => 96]);

        $this->assertSame(['Listed'], $this->petNames());
    }

    public function test_homes_that_are_not_open_to_adopt_are_left_out(): void
    {
        $this->matchedHome('Listed', 80);
        $this->matchedHome('Closed', 99, ['is_open_to_adopt' => false]);
        $this->matchedHome('No Quiz', 98, ['quiz_completed_at' => null]);

        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create(['full_name' => 'Suspended']);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $suspended->id, 'score' => 97]);

        $this->assertSame(['Listed'], $this->homeNames());
    }

    public function test_a_human_narrows_pets_by_species_size_and_age(): void
    {
        $this->matchedPet('Puppy', 90, ['species' => 'dog', 'size' => 'small', 'approximate_age_months' => 6]);
        $this->matchedPet('Dog', 80, ['species' => 'dog', 'size' => 'large', 'approximate_age_months' => 36]);
        $this->matchedPet('Old Cat', 70, ['species' => 'cat', 'size' => 'small', 'approximate_age_months' => 120]);

        $this->assertSame(['Puppy', 'Dog'], $this->petNames('?species=dog'));
        $this->assertSame(['Puppy', 'Dog', 'Old Cat'], $this->petNames('?species=dog,cat'));
        $this->assertSame(['Puppy', 'Old Cat'], $this->petNames('?size=small'));
        $this->assertSame(['Old Cat'], $this->petNames('?age=senior'));
        $this->assertSame(['Puppy', 'Old Cat'], $this->petNames('?age=puppy_kitten,senior'));
        $this->assertSame(['Dog'], $this->petNames('?age=adult'));
        $this->assertSame(['Puppy'], $this->petNames('?tier=high&max_score=95&min_score=85'));
        // An empty value is no filter.
        $this->assertSame(['Puppy', 'Dog', 'Old Cat'], $this->petNames('?species='));
    }

    public function test_a_pet_narrows_homes_by_type_kids_and_other_pets(): void
    {
        $house = $this->matchedHome('House With Kids', 90, ['home_type' => 'house']);
        $house->householdMembers()->create(['member' => 'kids_under_6']);

        $condo = $this->matchedHome('Condo With Cats', 80, ['home_type' => 'condo']);
        $condo->householdMembers()->create(['member' => 'teens']);
        $condo->otherPets()->create(['pet_type' => 'cats']);

        $this->assertSame(['House With Kids'], $this->homeNames('?home_type=house'));
        $this->assertSame(['House With Kids', 'Condo With Cats'], $this->homeNames('?home_type=house,condo'));
        $this->assertSame(['House With Kids'], $this->homeNames('?has_kids=yes'));
        // Teens are not the young kids the dealbreaker counts.
        $this->assertSame(['Condo With Cats'], $this->homeNames('?has_kids=no'));
        $this->assertSame(['House With Kids'], $this->homeNames('?has_other_pets=none'));
        $this->assertSame(['Condo With Cats'], $this->homeNames('?has_other_pets=cats'));
    }

    public function test_a_filter_value_that_is_not_on_the_list_is_refused(): void
    {
        $this->actingAs($this->human)->getJson('/api/v1/matches?species=dragon')->assertStatus(422)->assertJsonValidationErrors('species.0');
        $this->actingAs($this->human)->getJson('/api/v1/matches?age=young')->assertStatus(422)->assertJsonValidationErrors('age.0');
        $this->actingAs($this->human)->getJson('/api/v1/matches?sort=name_asc')->assertStatus(422)->assertJsonValidationErrors('sort');
        $this->actingAs($this->human)->getJson('/api/v1/matches?tier=best')->assertStatus(422)->assertJsonValidationErrors('tier');
        $this->actingAs($this->human)->getJson('/api/v1/matches?min_score=200')->assertStatus(422)->assertJsonValidationErrors('min_score');
        $this->actingAs($this->human)->getJson('/api/v1/matches?page=0')->assertStatus(422)->assertJsonValidationErrors('page');
        $this->actingAs($this->petUser)->getJson('/api/v1/matches?home_type=castle')->assertStatus(422)->assertJsonValidationErrors('home_type.0');
        $this->actingAs($this->petUser)->getJson('/api/v1/matches?has_kids=maybe')->assertStatus(422)->assertJsonValidationErrors('has_kids');
    }

    public function test_newest_puts_the_latest_resume_first_and_the_score_second(): void
    {
        $old = $this->matchedPet('Old Best', 95);
        $old->forceFill(['published_at' => now()->subDays(10)])->save();
        $new = $this->matchedPet('New Fair', 50);
        $new->forceFill(['published_at' => now()->addDay()])->save();

        $this->assertSame(['Old Best', 'New Fair'], $this->petNames());
        $this->assertSame(['New Fair', 'Old Best'], $this->petNames('?sort=newest'));

        // Equal scores: the newest resume first.
        $tied = $this->matchedPet('New Best', 95);
        $tied->forceFill(['published_at' => now()->addDays(2)])->save();
        $this->assertSame(['New Best', 'Old Best', 'New Fair'], $this->petNames());
    }

    public function test_pages_do_not_repeat_or_skip_rows_that_tie(): void
    {
        $published = now()->subDay();
        foreach (range(1, 5) as $n) {
            $this->matchedPet("Tied {$n}", 70)->forceFill(['published_at' => $published])->save();
        }

        $seen = [];
        foreach ([1, 2, 3] as $page) {
            $seen = [...$seen, ...$this->petNames("?per_page=2&page={$page}")];
        }

        $this->assertCount(5, $seen);
        $this->assertCount(5, array_unique($seen));
        $this->actingAs($this->human)->getJson('/api/v1/matches?per_page=2&page=2')
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.from', 3)
            ->assertJsonPath('meta.to', 4);
    }

    public function test_a_page_holds_at_most_fifty(): void
    {
        $this->matchedPet('One', 70);

        $this->actingAs($this->human)->getJson('/api/v1/matches?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_a_longer_list_takes_no_more_queries(): void
    {
        $count = function (User $viewer): int {
            // A fresh copy each time: relations the last request loaded onto the model would hide a query from this one.
            $viewer = $viewer->fresh();
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->actingAs($viewer)->getJson('/api/v1/matches')->assertOk();
            $queries = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $queries;
        };

        $this->matchedPet('First', 90);
        $this->matchedPet('Second', 80);
        $this->matchedHome('One', 90);
        $this->matchedHome('Two', 80);
        $fewPets = $count($this->human);
        $fewHomes = $count($this->petUser);

        foreach (range(1, 6) as $n) {
            $this->matchedPet("More {$n}", 60);
            $this->matchedHome("More {$n}", 60);
        }

        $this->assertSame($fewPets, $count($this->human));
        $this->assertSame($fewHomes, $count($this->petUser));
    }

    public function test_the_first_read_works_the_scores_out(): void
    {
        $this->home->acceptedSpecies()->create(['species' => 'dog']);
        $this->pet->forceFill(['species' => 'dog'])->save();
        $this->assertSame(0, MatchScore::query()->count());

        $this->assertSame(['Mochi'], $this->petNames());
        $this->assertSame(['Ana Santos'], $this->homeNames());
        $this->assertSame(1, MatchScore::query()->count());
    }

    public function test_only_active_pets_and_humans_have_matches(): void
    {
        $this->getJson('/api/v1/matches')->assertStatus(401);

        $pending = User::factory()->human()->pendingVerification()->create();
        HomeProfile::factory()->for($pending)->create();
        $this->actingAs($pending)->getJson('/api/v1/matches')->assertStatus(403)->assertJsonPath('code', 'account_not_active');

        $this->actingAs(User::factory()->admin()->active()->create())->getJson('/api/v1/matches')->assertStatus(403);
    }
}
