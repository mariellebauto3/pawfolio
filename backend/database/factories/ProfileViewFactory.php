<?php

namespace Database\Factories;

use App\Enums\ProfileViewSource;
use App\Models\ProfileView;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProfileView>
 */
class ProfileViewFactory extends Factory
{
    protected $model = ProfileView::class;

    public function definition(): array
    {
        return [
            'viewer_user_id' => UserFactory::new(),
            'pet_id' => PetFactory::new(),
            'home_profile_id' => HomeProfileFactory::new(),
            'source' => ProfileViewSource::Browse->value,
        ];
    }

    public function fromSearch(): static
    {
        return $this->state(fn (array $attrs) => ['source' => ProfileViewSource::Search->value]);
    }

    public function fromMatches(): static
    {
        return $this->state(fn (array $attrs) => ['source' => ProfileViewSource::Matches->value]);
    }

    public function fromBookmarks(): static
    {
        return $this->state(fn (array $attrs) => ['source' => ProfileViewSource::Bookmarks->value]);
    }

    public function fromFeed(): static
    {
        return $this->state(fn (array $attrs) => ['source' => ProfileViewSource::Feed->value]);
    }

    public function fromDirect(): static
    {
        return $this->state(fn (array $attrs) => ['source' => ProfileViewSource::Direct->value]);
    }
}
