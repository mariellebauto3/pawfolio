<?php

declare(strict_types=1);

namespace Tests\Feature\Discovery;

use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The top-bar search (GN-01, DS-03, DS-04): an overview of pets, homes and posts with how many there are of each,
 * and one kind a page at a time.
 */
class SearchTest extends TestCase
{
    use RefreshDatabase;

    private User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->viewer = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($this->viewer)->create(['full_name' => 'The Viewer', 'city' => 'Baguio']);
    }

    private function pet(string $name, array $attributes = []): Pet
    {
        return Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create([
            'name' => $name, 'breed' => 'Aspin', 'city' => 'Pasig', 'bio' => 'A good dog.', ...$attributes,
        ]);
    }

    public function test_the_overview_holds_the_first_of_each_kind_and_every_total(): void
    {
        foreach (range(1, 7) as $n) {
            $this->pet("Marikina Pet {$n}", ['published_at' => now()->subDays($n)]);
        }
        HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => 'Marikina Home', 'headline' => null, 'about_home' => null]);
        Post::factory()->for(User::factory()->human()->active(), 'author')->create(['title' => 'Adopted in Marikina', 'body' => 'What a week.']);
        $this->pet('Elsewhere');

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=marikina&limit=5')
            ->assertOk()
            ->assertJsonPath('data.query', 'marikina')
            ->assertJsonCount(5, 'data.pets')
            // Newest first.
            ->assertJsonPath('data.pets.0.name', 'Marikina Pet 1')
            ->assertJsonCount(1, 'data.home_profiles')
            ->assertJsonCount(1, 'data.posts')
            ->assertJsonPath('data.posts.0.title', 'Adopted in Marikina')
            ->assertJsonPath('data.totals', ['pets' => 7, 'home_profiles' => 1, 'posts' => 1]);
    }

    public function test_one_kind_is_paged_through_with_the_totals_of_all_three(): void
    {
        foreach (range(1, 7) as $n) {
            $this->pet("Marikina Pet {$n}", ['published_at' => now()->subDays($n)]);
        }
        HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => 'Marikina Home', 'headline' => null, 'about_home' => null]);

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=marikina&type=pets&per_page=3&page=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Marikina Pet 7')
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.total', 7)
            ->assertJsonPath('meta.query', 'marikina')
            ->assertJsonPath('meta.totals', ['pets' => 7, 'home_profiles' => 1, 'posts' => 0]);

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=marikina&type=home_profiles')
            ->assertOk()
            ->assertJsonPath('data.0.full_name', 'Marikina Home')
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=marikina&type=posts')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    }

    public function test_search_never_finds_what_may_not_be_seen(): void
    {
        Pet::factory()->for(User::factory()->pet()->active())->draft()->create(['name' => 'Hidden Draft']);
        Pet::factory()->for(User::factory()->pet()->active())->adopted()->create(['name' => 'Hidden Alum']);
        Pet::factory()->for(User::factory()->pet()->suspended())->lookingForAHome()->create(['name' => 'Hidden Suspended']);
        // Not Open to Adopt.
        HomeProfile::factory()->for(User::factory()->human()->active())->withQuizCompleted()->create(['full_name' => 'Hidden Home']);
        Post::factory()->for(User::factory()->human()->active(), 'author')->create(['title' => 'Hidden post', 'removed_at' => now()]);

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=hidden')
            ->assertOk()
            ->assertJsonPath('data.totals', ['pets' => 0, 'home_profiles' => 0, 'posts' => 0])
            ->assertJsonCount(0, 'data.pets')
            ->assertJsonCount(0, 'data.home_profiles')
            ->assertJsonCount(0, 'data.posts');
    }

    public function test_search_rows_carry_no_private_details(): void
    {
        $this->pet('Marikina Pet', ['caretaker_contact_number' => '09171112222']);
        HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create([
            'full_name' => 'Marikina Home', 'street_address' => '99 Ayala Ave', 'contact_number' => '09187776666',
        ]);

        $data = $this->actingAs($this->viewer)->getJson('/api/v1/search?q=marikina')->assertOk()->json('data');

        $this->assertArrayNotHasKey('caretaker_contact_number', $data['pets'][0]);
        $this->assertArrayNotHasKey('street_address', $data['home_profiles'][0]);
        $this->assertArrayNotHasKey('contact_number', $data['home_profiles'][0]);
    }

    public function test_nothing_typed_finds_nothing(): void
    {
        $this->pet('Anyone');

        $this->actingAs($this->viewer)->getJson('/api/v1/search')
            ->assertOk()
            ->assertJsonPath('data.totals', ['pets' => 0, 'home_profiles' => 0, 'posts' => 0])
            ->assertJsonCount(0, 'data.pets');

        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=%20&type=pets')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    }

    public function test_search_accepts_only_what_it_knows(): void
    {
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=a&type=accounts')->assertUnprocessable()->assertJsonValidationErrors('type');
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=a&type=pets&page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q='.str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');

        // The percent sign and the underscore are searched for as themselves, not as wildcards.
        $this->pet('Plain Name');
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=%25')->assertOk()->assertJsonPath('data.totals.pets', 0);
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=_')->assertOk()->assertJsonPath('data.totals.pets', 0);

        // The overview and a page are both capped (SEC-API-05).
        foreach (range(1, 27) as $n) {
            $this->pet("Capped {$n}");
        }
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=capped&limit=500')->assertOk()->assertJsonCount(25, 'data.pets')->assertJsonPath('data.totals.pets', 27);
        $this->actingAs($this->viewer)->getJson('/api/v1/search?q=capped&type=pets&per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_search_is_closed_to_accounts_that_are_not_active(): void
    {
        $this->getJson('/api/v1/search?q=a')->assertUnauthorized();
        $this->actingAs(User::factory()->pendingVerification()->create())->getJson('/api/v1/search?q=a')->assertForbidden();
    }
}
