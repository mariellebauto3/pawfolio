<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Enums\AccountStatus;
use App\Jobs\PublishScheduledAnnouncementsJob;
use App\Models\Announcement;
use App\Models\HomeProfile;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The admin's announcements (BE-24, FE-24, NT-04, NT-05, FR39): publishing one now or at a time still ahead, who it
 * reaches (its audience's Active accounts, in their Alerts and on the feed), and the list of what was published and
 * what is scheduled.
 */
class AnnouncementsTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/admin/announcements';

    private User $admin;

    private User $mochi;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
    }

    private function body(array $change = []): array
    {
        return ['title' => 'Adoption Week starts Oct 10', 'message' => 'Shelters and fosters are featured all week. Update your resume photos!', 'audience' => 'everyone', ...$change];
    }

    private function publish(array $change = [])
    {
        return $this->actingAs($this->admin)->postJson(self::PATH, $this->body($change));
    }

    private function alertsOf(User $user): int
    {
        return Notification::query()->where('user_id', $user->id)->where('type', 'announcement')->count();
    }

    public function test_only_an_active_admin_lists_and_publishes_announcements(): void
    {
        $this->getJson(self::PATH)->assertUnauthorized();
        $this->postJson(self::PATH, $this->body())->assertUnauthorized();

        foreach ([$this->mochi, $this->ana] as $member) {
            $this->actingAs($member)->getJson(self::PATH)->assertForbidden();
            $this->actingAs($member)->postJson(self::PATH, $this->body())->assertForbidden();
        }
        $suspended = User::factory()->admin()->create(['status' => AccountStatus::Suspended->value]);
        $this->actingAs($suspended)->postJson(self::PATH, $this->body())->assertForbidden();

        $this->assertSame(0, Announcement::query()->count());
        $this->assertSame(0, Notification::query()->count());
    }

    public function test_publishing_now_reaches_the_audiences_active_accounts_and_is_logged(): void
    {
        // Not Active, so not reached; and an Active human who turned announcements off gets no alert.
        User::factory()->pet()->create(['status' => AccountStatus::Suspended->value]);
        User::factory()->human()->pendingVerification()->create();
        $quiet = User::factory()->human()->active()->create(['name' => 'Bea Navarro']);
        NotificationPreference::factory()->create(['user_id' => $quiet->id, 'announcements' => false]);

        $this->publish(['title' => '  Adoption Week starts Oct 10  '])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.title', 'Adoption Week starts Oct 10')
            ->assertJsonPath('data.audience', 'everyone')
            ->assertJsonPath('data.admin_name', 'admin.jess')
            ->assertJsonPath('data.recipients_notified', 2);

        $this->assertSame(1, $this->alertsOf($this->mochi));
        $this->assertSame(1, $this->alertsOf($this->ana));
        $this->assertSame(0, $this->alertsOf($quiet));
        $this->assertSame(0, $this->alertsOf($this->admin));
        $this->assertSame(2, Notification::query()->count());

        $alert = Notification::query()->where('user_id', $this->mochi->id)->firstOrFail();
        $this->assertSame('Adoption Week starts Oct 10', $alert->title);
        $this->assertSame('/feed', $alert->action_url);
        $this->assertSame('account', $alert->category);

        $this->assertDatabaseHas('activity_logs', ['action' => 'announcement_published', 'actor_user_id' => $this->admin->id, 'after_value' => 'everyone']);

        // On the feed for both roles, the quiet account included.
        foreach ([$this->mochi, $this->ana, $quiet] as $member) {
            $this->actingAs($member)->getJson('/api/v1/feed')->assertOk()->assertJsonPath('meta.announcements.0.title', 'Adoption Week starts Oct 10');
        }
    }

    public function test_an_audience_of_pets_or_humans_leaves_the_other_out(): void
    {
        $this->publish(['audience' => 'pets', 'title' => 'Keep vet records up to date'])->assertCreated()->assertJsonPath('data.recipients_notified', 1);
        $this->assertSame(1, $this->alertsOf($this->mochi));
        $this->assertSame(0, $this->alertsOf($this->ana));
        $this->actingAs($this->mochi)->getJson('/api/v1/feed')->assertJsonCount(1, 'meta.announcements');
        $this->actingAs($this->ana)->getJson('/api/v1/feed')->assertJsonCount(0, 'meta.announcements');

        $this->publish(['audience' => 'humans', 'title' => 'Add your Meet & Greet slots'])->assertCreated()->assertJsonPath('data.recipients_notified', 1);
        $this->assertSame(1, $this->alertsOf($this->mochi));
        $this->assertSame(1, $this->alertsOf($this->ana));
    }

    public function test_a_scheduled_announcement_waits_for_its_time(): void
    {
        $at = now()->addDays(2)->startOfMinute();

        $id = $this->publish(['publish_at' => $at->toISOString()])
            ->assertCreated()
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.published_at', null)
            ->assertJsonPath('data.recipients_notified', 0)
            ->json('data.id');

        $this->assertTrue($at->equalTo(Announcement::query()->findOrFail($id)->publish_at));
        $this->assertSame(0, Notification::query()->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'announcement_scheduled', 'actor_user_id' => $this->admin->id]);
        // Nobody reads it before its time, in Alerts or on the feed.
        $this->actingAs($this->mochi)->getJson('/api/v1/feed')->assertJsonCount(0, 'meta.announcements');

        // The scheduler leaves it alone until then, publishes it once, and not again.
        app()->call([new PublishScheduledAnnouncementsJob, 'handle']);
        $this->assertSame(0, Notification::query()->count());

        $this->travelTo($at->copy()->addMinute());
        app()->call([new PublishScheduledAnnouncementsJob, 'handle']);
        app()->call([new PublishScheduledAnnouncementsJob, 'handle']);

        $this->assertSame(2, Notification::query()->count());
        $this->actingAs($this->admin)->getJson(self::PATH)->assertJsonPath('data.0.status', 'published');
        $this->actingAs($this->mochi)->getJson('/api/v1/feed')->assertJsonCount(1, 'meta.announcements');
    }

    public function test_an_announcement_needs_a_title_a_message_an_audience_and_a_time_still_ahead(): void
    {
        $this->publish(['title' => '   '])->assertUnprocessable()->assertJsonValidationErrors(['title' => 'Enter a title.']);
        $this->publish(['title' => str_repeat('a', 161)])->assertUnprocessable()->assertJsonValidationErrors(['title']);
        $this->publish(['message' => ''])->assertUnprocessable()->assertJsonValidationErrors(['message' => 'Enter a message.']);
        $this->publish(['message' => str_repeat('a', 2001)])->assertUnprocessable()->assertJsonValidationErrors(['message']);
        $this->publish(['audience' => 'admins'])->assertUnprocessable()->assertJsonValidationErrors(['audience']);
        $this->actingAs($this->admin)->postJson(self::PATH, ['title' => 'No audience', 'message' => 'x'])->assertUnprocessable()->assertJsonValidationErrors(['audience']);

        // A time that has passed isn't quietly published now: the admin chose to schedule, and reads why it can't be.
        $this->publish(['publish_at' => now()->subMinute()->toISOString()])->assertUnprocessable()->assertJsonValidationErrors(['publish_at' => 'Choose a time that is still ahead, or publish now.']);
        $this->publish(['publish_at' => now()->addYears(2)->toISOString()])->assertUnprocessable()->assertJsonValidationErrors(['publish_at' => 'Choose a time within the next year.']);
        $this->publish(['publish_at' => 'next full moon-ish'])->assertUnprocessable()->assertJsonValidationErrors(['publish_at']);

        $this->assertSame(0, Announcement::query()->count());
        $this->assertSame(0, Notification::query()->count());

        // Who published it and when it was published are never the body's to say (SEC-INPUT-04).
        $other = User::factory()->admin()->active()->create(['name' => 'admin.mark']);
        $this->publish(['admin_user_id' => $other->id, 'published_at' => '2020-01-01T00:00:00Z', 'status' => 'scheduled'])
            ->assertCreated()
            ->assertJsonPath('data.admin_name', 'admin.jess')
            ->assertJsonPath('data.status', 'published');
        $this->assertTrue(Announcement::query()->firstOrFail()->published_at->isToday());
    }

    public function test_the_list_is_newest_first_with_how_many_accounts_each_audience_is(): void
    {
        $this->publish(['title' => 'First'])->assertCreated();
        $this->travel(1)->minutes();
        $this->publish(['title' => 'Second', 'audience' => 'pets', 'publish_at' => now()->addDay()->toISOString()])->assertCreated();
        // Counted by audience: Active Pet and Human accounts only.
        User::factory()->pet()->active()->create();
        User::factory()->human()->create(['status' => AccountStatus::Deactivated->value]);

        $this->actingAs($this->admin)->getJson(self::PATH)
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.title', 'Second')
            ->assertJsonPath('data.0.status', 'scheduled')
            ->assertJsonPath('data.0.audience', 'pets')
            ->assertJsonPath('data.1.title', 'First')
            ->assertJsonPath('data.1.status', 'published')
            ->assertJsonPath('data.1.admin_name', 'admin.jess')
            ->assertJsonPath('meta.audience_counts', ['everyone' => 3, 'pets' => 2, 'humans' => 1]);

        $this->actingAs($this->admin)->getJson(self::PATH.'?per_page=1')->assertJsonCount(1, 'data')->assertJsonPath('meta.last_page', 2);
        $this->actingAs($this->admin)->getJson(self::PATH.'?per_page=500')->assertUnprocessable();
    }
}
