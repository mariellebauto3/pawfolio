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
            'viewer_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['viewer_user_id'] ?? null),
            'pet_id' => PetFactory::new()->sequence(fn (array $attrs) => $attrs['pet_id'] ?? null),
            'home_profile_id' => HomeProfileFactory::new()->sequence(fn (array $attrs) => $attrs['home_profile_id'] ?? null),
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
