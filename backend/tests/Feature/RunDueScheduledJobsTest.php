<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\AdoptionRequestStatus;
use App\Http\Middleware\RunDueScheduledJobs;
use App\Models\AdoptionRequest;
use App\Models\Announcement;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Render's free plan has no cron or worker, so the scheduled jobs run after API answers, at most once every 5 minutes
 * (ADR 0008; proposal §5: Awaiting Decision after the meeting, reminders, expiry; NT-05 scheduled announcements).
 */
class RunDueScheduledJobsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mochi;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.run_due_jobs_on_requests' => true]);
        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
    }

    private function scheduleAnnouncement(string $title, \DateTimeInterface $at): int
    {
        return $this->actingAs($this->admin)->postJson('/api/v1/admin/announcements', [
            'title' => $title, 'message' => 'Shelters and fosters are featured all week.', 'audience' => 'everyone',
            'publish_at' => $at->format(DATE_ATOM),
        ])->assertCreated()->assertJsonPath('data.status', 'scheduled')->json('data.id');
    }

    private function isPublished(int $id): bool
    {
        return Announcement::query()->findOrFail($id)->published_at !== null;
    }

    public function test_after_the_meeting_time_the_next_answer_moves_the_request_to_awaiting_decision(): void
    {
        $homeId = $this->ana->homeProfile->id;
        $requestId = $this->actingAs($this->mochi)->postJson("/api/v1/home-profiles/{$homeId}/adoption-requests", [
            'cover_letter' => 'Hi! I am Mochi, a gentle and house-trained Aspin looking for a warm and loving forever home.',
        ])->assertCreated()->json('data.id');
        $this->actingAs($this->ana)->postJson("/api/v1/adoption-requests/{$requestId}/approve")->assertOk();
        $slotId = $this->actingAs($this->ana)->postJson('/api/v1/meet-greet-slots', [
            'starts_at' => now()->addDays(2)->toISOString(), 'place_type' => 'public_spot', 'place_details' => 'Ayala Triangle Gardens',
        ])->assertCreated()->json('data.0.id');
        $this->actingAs($this->mochi)->postJson("/api/v1/adoption-requests/{$requestId}/meet-and-greet", ['slot_id' => $slotId])->assertCreated();
        $this->actingAs($this->ana)->postJson("/api/v1/adoption-requests/{$requestId}/meet-and-greet/confirm")
            ->assertOk()->assertJsonPath('data.status', 'meet_scheduled');

        $this->travel(2)->days();
        $this->travel(1)->hours();
        $this->actingAs($this->ana)->getJson('/api/v1/notifications/unread-count')->assertOk();

        $this->assertSame(AdoptionRequestStatus::AwaitingDecision, AdoptionRequest::query()->findOrFail($requestId)->getStatus());
    }

    public function test_a_scheduled_announcement_is_published_by_the_first_answer_after_its_time(): void
    {
        $id = $this->scheduleAnnouncement('Adoption Week starts Oct 10', now()->addDay());

        $this->travel(1)->days();
        $this->travel(1)->minutes();
        $this->assertFalse($this->isPublished($id));

        $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();

        $this->assertTrue($this->isPublished($id));
        $this->assertSame(1, $this->ana->notifications()->where('type', 'announcement')->count());
    }

    public function test_the_jobs_run_at_most_once_every_5_minutes(): void
    {
        $first = $this->scheduleAnnouncement('First', now()->addMinutes(10)); // this answer runs the jobs
        $this->travel(11)->minutes();
        $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();
        $this->assertTrue($this->isPublished($first));

        $second = $this->scheduleAnnouncement('Second', now()->addMinute()); // within 5 minutes: no run
        $this->travel(2)->minutes();
        $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();
        $this->assertFalse($this->isPublished($second));

        $this->travel(4)->minutes();
        $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();
        $this->assertTrue($this->isPublished($second));
    }

    public function test_the_answer_that_runs_the_jobs_states_its_length(): void
    {
        $response = $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();

        // Without it, `php artisan serve` keeps the browser waiting until the deferred jobs end.
        $this->assertSame((string) strlen((string) $response->getContent()), $response->headers->get('Content-Length'));
    }

    public function test_a_failed_answer_runs_nothing(): void
    {
        $id = $this->scheduleAnnouncement('Adoption Week', now()->addMinutes(10));
        $this->travel(11)->minutes();

        $this->actingAs($this->mochi)->getJson('/api/v1/admin/announcements')->assertForbidden();
        $this->assertFalse($this->isPublished($id));
    }

    public function test_turned_off_nothing_runs(): void
    {
        $id = $this->scheduleAnnouncement('Adoption Week', now()->addMinutes(10));
        config(['app.run_due_jobs_on_requests' => false]);
        $this->travel(11)->minutes();

        $this->actingAs($this->mochi)->getJson('/api/v1/notifications/unread-count')->assertOk();

        $this->assertFalse($this->isPublished($id));
    }

    public function test_the_jobs_are_the_ones_scheduled_in_routes_console(): void
    {
        Artisan::call('schedule:list');
        preg_match_all('/App\\\\Jobs\\\\\w+/', Artisan::output(), $scheduled);

        $this->assertEqualsCanonicalizing(RunDueScheduledJobs::JOBS, array_unique($scheduled[0]));
    }
}
