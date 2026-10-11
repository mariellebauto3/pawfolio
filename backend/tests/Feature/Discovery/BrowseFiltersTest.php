<?php

declare(strict_types=1);

namespace Tests\Feature\Discovery;

use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The two Browse filters the screens need beyond BE-14's first set (DS-01, DS-02): temperament for pets (FR6) and
 * kids at home for Home Profiles (FR22).
 */
class BrowseFiltersTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  list<string>  $tags
     */
    private function petWithTags(string $name, array $tags): Pet
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name]);
        foreach ($tags as $tag) {
            $pet->temperamentTags()->create(['tag' => $tag]);
        }

        return $pet;
    }

    /**
     * @param  list<string>  $members
     */
    private function homeWith(string $name, array $members): HomeProfile
    {
        $home = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
        foreach ($members as $member) {
            $home->householdMembers()->create(['member' => $member]);
        }

        return $home;
    }

    /**
     * @return list<string>
     */
    private function names(string $url, User $viewer, string $key): array
    {
        $names = $this->actingAs($viewer)->getJson($url)->assertOk()->json("data.*.{$key}");
        sort($names);

        return $names;
    }

    /**
     * The search box asks as it is typed in, so the first letters of a name have to find it, in any case. `LIKE`
     * alone ignores case on SQLite and not on PostgreSQL; run this class against PostgreSQL to see the difference.
     */
    public function test_the_first_letters_of_a_name_find_it_whatever_the_case(): void
    {
        $this->petWithTags('Kimchi', ['Loyal']);
        $this->petWithTags('Pebbles', ['Calm']);
        // Hired: a pet that was adopted is in no list, whatever is typed (proposal §5).
        $adopted = $this->petWithTags('Kimbap', []);
        $adopted->forceFill(['status' => 'adopted_hired'])->save();
        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();

        foreach (['k', 'ki', 'KI', 'Kim', 'kImChI', 'mch'] as $typed) {
            $this->assertSame(['Kimchi'], $this->names('/api/v1/pets?q='.urlencode($typed), $human, 'name'), "typed: {$typed}");
        }
        $this->assertSame(['Kimchi'], $this->names('/api/v1/pets?q=LOYAL', $human, 'name'));
        $this->assertSame([], $this->names('/api/v1/pets?q=kimb', $human, 'name'));
        $this->assertSame(['Kimchi'], $this->actingAs($human)->getJson('/api/v1/search?q=KIM')->assertOk()->json('data.pets.*.name'));

        // The same for homes, as a pet types.
        $this->homeWith('Reyes Household', []);
        $this->homeWith('Lim Family', []);
        $pet = User::factory()->pet()->active()->create();
        Pet::factory()->for($pet)->lookingForAHome()->create();
        foreach (['rey', 'REYES', 'yes hou'] as $typed) {
            $this->assertSame(['Reyes Household'], $this->names('/api/v1/home-profiles?q='.urlencode($typed), $pet, 'full_name'), "typed: {$typed}");
        }

        // The names under the search box: the name alone, the ones that start with the words first.
        $this->petWithTags('Loki', ['Kind']);
        $this->petWithTags('Kiko', []);
        $suggested = fn (string $typed) => $this->actingAs($human)->getJson('/api/v1/pets?search_in=name&per_page=6&q='.urlencode($typed))->assertOk()->json('data.*.name');
        $this->assertSame(['Kiko', 'Kimchi'], collect($suggested('ki'))->take(2)->sort()->values()->all());
        $this->assertSame('Loki', $suggested('ki')[2]);
        $this->assertSame(['Kimchi'], $suggested('KIM'));
        // "kind" is one of Loki's tags, not a name: the cards find it, the names don't.
        $this->assertSame([], $suggested('kind'));
        $this->assertSame(['Loki'], $this->names('/api/v1/pets?q=kind', $human, 'name'));
        $this->assertSame(['Reyes Household'], $this->actingAs($pet)->getJson('/api/v1/home-profiles?search_in=name&q=rey')->assertOk()->json('data.*.full_name'));
        $this->actingAs($human)->getJson('/api/v1/pets?search_in=bio&q=ki')->assertUnprocessable();

        // A wildcard is searched for as typed, not as "anything".
        $this->assertSame([], $this->names('/api/v1/pets?q='.urlencode('%'), $human, 'name'));
    }

    public function test_pets_are_filtered_by_any_of_the_picked_temperament_tags(): void
    {
        $this->petWithTags('Calmy', ['Calm', 'Cuddly']);
        $this->petWithTags('Zoomy', ['Playful']);
        $this->petWithTags('Plain', []);

        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();

        $this->assertSame(['Calmy'], $this->names('/api/v1/pets?temperament=Calm', $human, 'name'));
        $this->assertSame(['Calmy', 'Zoomy'], $this->names('/api/v1/pets?temperament=Cuddly,Playful', $human, 'name'));
        $this->assertSame([], $this->names('/api/v1/pets?temperament=Shy', $human, 'name'));
        // A list with nothing in it is no filter at all, and neither is an empty value.
        $this->assertSame(['Calmy', 'Plain', 'Zoomy'], $this->names('/api/v1/pets?temperament=,', $human, 'name'));
        $this->assertSame(['Calmy', 'Plain', 'Zoomy'], $this->names('/api/v1/pets?temperament=&species=', $human, 'name'));
    }

    public function test_home_profiles_are_filtered_by_kids_at_home(): void
    {
        $this->homeWith('Toddler Home', ['partner', 'kids_under_6']);
        $this->homeWith('School Home', ['kids_6_to_12']);
        // Teens are not "kids" here, as in the kids dealbreaker.
        $this->homeWith('Teen Home', ['partner', 'teens']);
        $this->homeWith('Solo Home', ['just_me']);

        $petUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($petUser)->lookingForAHome()->create();

        $this->assertSame(['School Home', 'Toddler Home'], $this->names('/api/v1/home-profiles?has_kids=yes', $petUser, 'full_name'));
        $this->assertSame(['Solo Home', 'Teen Home'], $this->names('/api/v1/home-profiles?has_kids=no', $petUser, 'full_name'));
        // No answer is no filter.
        $this->assertCount(4, $this->names('/api/v1/home-profiles?has_kids=', $petUser, 'full_name'));
    }

    public function test_pet_filters_accept_only_listed_values(): void
    {
        $human = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($human)->create();

        $refused = [
            'species=dragon' => 'species.0',
            'species=dog,dragon' => 'species.1',
            'size=huge' => 'size.0',
            'age=ancient' => 'age.0',
            'good_with=sharks' => 'good_with.0',
            'sex=unknown' => 'sex.0',
            'energy_level=turbo' => 'energy_level.0',
            'special_needs=some' => 'special_needs',
            'province=Atlantis' => 'province',
            'sort=price' => 'sort',
            // Drafts and adopted pets can't be asked for (§5.2).
            'status=draft' => 'status',
            'status=adopted_hired' => 'status',
            'page=0' => 'page',
            'page=two' => 'page',
            'q='.str_repeat('a', 101) => 'q',
            'temperament='.str_repeat('a', 41) => 'temperament.0',
        ];

        foreach ($refused as $query => $field) {
            $this->actingAs($human)->getJson("/api/v1/pets?{$query}")
                ->assertUnprocessable()
                ->assertJsonValidationErrors($field);
        }

        // The message is written for a person, not Laravel's "The selected species.0 is invalid."
        $this->actingAs($human)->getJson('/api/v1/pets?species=dragon')
            ->assertJsonPath('errors', ['species.0' => ['Choose one of the listed options.']]);

        // Every value the Browse screen sends is accepted, lists with spaces and a stray comma included.
        $this->actingAs($human)
            ->getJson('/api/v1/pets?q=aspin&species=dog,%20cat,&age=puppy_kitten,adult,senior&size=small&temperament=Calm&good_with=kids,dogs&province=Metro%20Manila&sort=newest&page=1&per_page=12')
            ->assertOk();
        // A page size past the most allowed is brought down to it, as on every list (SEC-API-05).
        $this->actingAs($human)->getJson('/api/v1/pets?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_home_filters_accept_only_listed_values(): void
    {
        $petUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($petUser)->lookingForAHome()->create();

        $refused = [
            'home_type=castle' => 'home_type.0',
            'outdoor_space=moat' => 'outdoor_space.0',
            'activity_level=turbo' => 'activity_level.0',
            'pet_experience=wizard' => 'pet_experience.0',
            'accepted_species=dragon' => 'accepted_species.0',
            'preferred_size=huge' => 'preferred_size.0',
            'has_other_pets=dragons' => 'has_other_pets.0',
            'has_kids=maybe' => 'has_kids',
            'sort=name_asc' => 'sort',
            'province=Atlantis' => 'province',
        ];

        foreach ($refused as $query => $field) {
            $this->actingAs($petUser)->getJson("/api/v1/home-profiles?{$query}")
                ->assertUnprocessable()
                ->assertJsonValidationErrors($field);
        }

        $this->actingAs($petUser)
            ->getJson('/api/v1/home-profiles?q=pasig&home_type=house,condo&outdoor_space=none&activity_level=active&has_other_pets=none&has_kids=no&sort=newest')
            ->assertOk();
    }

    public function test_browse_filters_are_closed_to_accounts_that_are_not_active(): void
    {
        $this->getJson('/api/v1/pets?temperament=Calm')->assertUnauthorized();

        $pending = User::factory()->pendingVerification()->create();
        $this->actingAs($pending)->getJson('/api/v1/home-profiles?has_kids=yes')->assertForbidden();
    }
}
