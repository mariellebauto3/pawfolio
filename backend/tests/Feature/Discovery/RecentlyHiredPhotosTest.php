<?php

declare(strict_types=1);

namespace Tests\Feature\Discovery;

use App\Enums\PetStatus;
use App\Models\Adoption;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The pictures of the landing page's Recently Hired gallery (AU-01, docs/api/discovery.md): a pet is sent with a
 * photo only when the file is there, and the demo data never leaves a pet without one.
 */
class RecentlyHiredPhotosTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/public/recently-hired';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function hired(string $name, int $daysAgo): Pet
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->create(['name' => $name, 'status' => PetStatus::AdoptedHired]);
        $home = HomeProfile::factory()->for(User::factory()->human()->active())->create();
        Adoption::factory()->create(['pet_id' => $pet->id, 'home_profile_id' => $home->id, 'adopted_at' => now()->subDays($daysAgo)]);

        return $pet;
    }

    public function test_a_pet_is_sent_with_the_first_photo_whose_file_is_there(): void
    {
        $luna = $this->hired('Luna', 1);
        $luna->photos()->create(['file_path' => 'pets/photos/luna-gone.jpg', 'sort_order' => 1]);
        $luna->photos()->create(['file_path' => 'pets/photos/luna-2.jpg', 'sort_order' => 2]);
        Storage::disk('public')->put('pets/photos/luna-2.jpg', 'jpg');

        $kimchi = $this->hired('Kimchi', 2);
        $kimchi->photos()->create(['file_path' => 'pets/photos/kimchi-gone.jpg', 'sort_order' => 1]);

        $this->hired('Pancit', 3);

        $response = $this->getJson(self::PATH)->assertOk()->assertJsonCount(3, 'data');

        // Luna's first file is gone, so her second photo is the one shown; no address that would answer 404 is sent.
        $response->assertJsonPath('data.0.name', 'Luna')
            ->assertJsonPath('data.0.photo_url', Storage::disk('public')->url('pets/photos/luna-2.jpg'))
            ->assertJsonPath('data.1.name', 'Kimchi')
            ->assertJsonPath('data.1.photo_url', null)
            ->assertJsonPath('data.2.name', 'Pancit')
            ->assertJsonPath('data.2.photo_url', null);
    }

    public function test_the_demo_photo_command_gives_photos_to_pets_that_have_none(): void
    {
        $kimchi = $this->hired('Kimchi', 1);
        $luna = $this->hired('Luna', 2);
        $luna->photos()->create(['file_path' => 'pets/photos/luna.jpg', 'sort_order' => 1]);
        Storage::disk('public')->put('pets/photos/luna.jpg', 'her own photo');

        $this->artisan('pawfolio:fill-demo-pet-photos')->expectsOutputToContain('Gave sample photos to')->assertSuccessful();

        // Kimchi has three photos with their files; a pet that had its own keeps exactly what it had.
        $this->assertSame(3, $kimchi->photos()->count());
        foreach ($kimchi->photos as $photo) {
            Storage::disk('public')->assertExists($photo->file_path);
        }
        $this->assertSame(['pets/photos/luna.jpg'], $luna->photos()->pluck('file_path')->all());
        $this->assertSame('her own photo', Storage::disk('public')->get('pets/photos/luna.jpg'));

        $this->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.name', 'Kimchi')
            ->assertJsonPath('data.0.photo_url', Storage::disk('public')->url("pets/photos/demo-{$kimchi->id}-1.jpg"));

        // Run again: nothing left to do, nothing added twice.
        $this->artisan('pawfolio:fill-demo-pet-photos')->expectsOutput('Every pet already has a photo of its own.')->assertSuccessful();
        $this->assertSame(3, $kimchi->photos()->count());
    }

    public function test_demo_pets_of_a_kind_never_show_the_same_first_photo_while_samples_are_left(): void
    {
        $disk = Storage::disk('public');
        $sample = fn (string $name) => (string) file_get_contents(database_path("seeders/assets/pets/{$name}.jpg"));
        $pathOf = fn (Pet $pet, int $order = 1) => (string) $pet->photos()->where('sort_order', $order)->value('file_path');
        $firstPhotoOf = fn (Pet $pet) => md5((string) $disk->get($pathOf($pet)));
        $demoPhotos = function (Pet $pet, string $first, string $second) use ($disk, $sample): void {
            foreach ([1 => $first, 2 => $second] as $order => $name) {
                $pet->photos()->create(['file_path' => "pets/photos/demo-{$pet->id}-{$order}.jpg", 'sort_order' => $order]);
                $disk->put("pets/photos/demo-{$pet->id}-{$order}.jpg", $sample($name));
            }
        };

        // Choco Jr. and Kimchi were dealt the same picture, as two dogs side by side on the landing page were.
        $choco = $this->hired('Choco Jr.', 5);
        $choco->update(['species' => 'dog']);
        $demoPhotos($choco, 'dog-1', 'dog-2');
        $kimchi = $this->hired('Kimchi', 1);
        $kimchi->update(['species' => 'dog']);
        $demoPhotos($kimchi, 'dog-1', 'dog-2');
        // A cat on a cat sample, and a dog with a photo of its own: neither is part of the clash.
        $luna = $this->hired('Luna', 2);
        $luna->update(['species' => 'cat']);
        $demoPhotos($luna, 'cat-1', 'cat-2');
        $own = $this->hired('Bantay', 3);
        $own->update(['species' => 'dog']);
        $own->photos()->create(['file_path' => 'pets/photos/bantay.jpg', 'sort_order' => 1]);
        $disk->put('pets/photos/bantay.jpg', $sample('dog-1'));
        // Every other pet in the table (the factories make some) is a cat with a photo of its own.
        Pet::query()->whereNotIn('id', [$choco->id, $kimchi->id, $luna->id, $own->id])->update(['species' => 'cat']);

        $this->assertSame($firstPhotoOf($choco), $firstPhotoOf($kimchi));

        $this->artisan('pawfolio:fill-demo-pet-photos')->expectsOutputToContain('a different photo')->assertSuccessful();

        // The first of the two keeps its picture; the other gets a sample nobody shows, and its second photo follows.
        $this->assertSame(md5($sample('dog-1')), $firstPhotoOf($choco));
        $this->assertNotSame($firstPhotoOf($choco), $firstPhotoOf($kimchi));
        $this->assertContains($firstPhotoOf($kimchi), array_map(fn (int $n) => md5($sample("dog-{$n}")), range(2, 8)));
        $this->assertNotSame($firstPhotoOf($kimchi), md5((string) $disk->get($pathOf($kimchi, 2))));
        // The new picture has a new address, so no cache goes on showing the old one, and the old file is gone.
        $this->assertNotSame("pets/photos/demo-{$kimchi->id}-1.jpg", $pathOf($kimchi));
        $this->assertStringStartsWith("pets/photos/demo-{$kimchi->id}-1-dog", $pathOf($kimchi));
        $disk->assertMissing("pets/photos/demo-{$kimchi->id}-1.jpg");
        $this->assertSame("pets/photos/demo-{$choco->id}-1.jpg", $pathOf($choco));
        // A re-dealt file that goes missing comes back as the same sample.
        $before = $firstPhotoOf($kimchi);
        $disk->delete($pathOf($kimchi));
        $this->artisan('pawfolio:fill-demo-pet-photos')->assertSuccessful();
        $this->assertSame($before, $firstPhotoOf($kimchi));
        // Nothing else moved: the cat's sample, and the upload that only looks like a sample.
        $this->assertSame(md5($sample('cat-1')), $firstPhotoOf($luna));
        $this->assertSame($sample('dog-1'), $disk->get('pets/photos/bantay.jpg'));

        // Settled: a second run changes nothing.
        $after = [$firstPhotoOf($choco), $firstPhotoOf($kimchi), $firstPhotoOf($luna)];
        $this->artisan('pawfolio:fill-demo-pet-photos')->doesntExpectOutputToContain('a different photo')->assertSuccessful();
        $this->assertSame($after, [$firstPhotoOf($choco), $firstPhotoOf($kimchi), $firstPhotoOf($luna)]);
    }

    public function test_the_demo_photo_command_refuses_in_production(): void
    {
        $kimchi = $this->hired('Kimchi', 1);
        $this->app['env'] = 'production';

        $this->artisan('pawfolio:fill-demo-pet-photos')->assertFailed();
        $this->assertSame(0, $kimchi->photos()->count());
    }
}
