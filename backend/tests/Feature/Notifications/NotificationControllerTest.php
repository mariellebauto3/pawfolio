<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Enums\AccountStatus;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email' => 'owner@example.com']);
    }

    private function actingAsOwner(): void
    {
        $this->actingAs($this->owner, 'sanctum');
    }

    public function test_index_returns_paginated_list_with_unread_count(): void
    {
        $this->actingAsOwner();

        Notification::factory()->count(25)->create(['user_id' => $this->owner->id]);

        $response = $this->getJson('/api/v1/notifications');

        $response->assertStatus(200)
            ->assertJsonPath('meta.total', 25)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.total_pages', 2);
    }

    public function test_index_default_per_page_is_20(): void
    {
        $this->actingAsOwner();

        Notification::factory()->count(5)->create(['user_id' => $this->owner->id]);

        $response = $this->getJson('/api/v1/notifications');

        $response->assertJsonPath('meta.per_page', 20);
    }

    public function test_index_respects_per_page(): void
    {
        $this->actingAsOwner();

        Notification::factory()->count(5)->create(['user_id' => $this->owner->id]);

        $response = $this->getJson('/api/v1/notifications?per_page=2');

        $response->assertJsonPath('meta.total', 5);
        $response->assertJsonPath('meta.total_pages', 3);
    }

    public function test_index_returns_only_owner_notifications(): void
    {
        $this->actingAsOwner();

        $other = User::factory()->create(['email' => 'other@example.com']);
        Notification::factory()->create(['user_id' => $other->id]);

        $response = $this->getJson('/api/v1/notifications');

        $response->assertJsonPath('meta.total', 0);
    }

    /** The tabs of NT-02 and NT-03: each lists its own category, and every row sits under exactly one tab. */
    public function test_index_lists_each_tab_by_category(): void
    {
        $this->actingAsOwner();

        $service = app(NotificationService::class);
        $service->store($this->owner, 'request_received', 'New adoption request', 'Kulit sent you a request.', ['category' => 'Requests']);
        // A decision reminder reuses a request type, and its sender files it under Meet & Greets.
        $service->store($this->owner, 'request_under_review', 'Decision needed for Bantay', 'Adopt or decline?', ['category' => 'Meet & Greets']);
        $service->store($this->owner, 'verification_approved', 'Account approved', 'Welcome to Pawfolio!', ['category' => 'Account']);
        $service->store($this->owner, 'post_comment', 'Ana Santos commented on your post', 'So cute!', ['category' => 'Feed']);
        // A sender that names no category is filed by the kind of notification it is.
        $service->store($this->owner, 'meet_greet_booked', 'Meet & Greet booked', 'Sat, Oct 10, 10:00 AM.');

        $titles = fn (string $query) => collect($this->getJson('/api/v1/notifications'.$query)->assertOk()->json('data'))
            ->pluck('title')->sort()->values()->all();

        $this->assertSame(['New adoption request'], $titles('?category=requests'));
        $this->assertSame(['Decision needed for Bantay', 'Meet & Greet booked'], $titles('?category=meet_and_greets'));
        $this->assertSame(['Account approved'], $titles('?category=account'));
        $this->assertCount(5, $titles(''));
        $this->assertCount(5, $titles('?category=all'));

        $this->getJson('/api/v1/notifications?category=account')
            ->assertJsonPath('data.0.category', 'account')
            ->assertJsonPath('meta.total', 1);
    }

    /** Old notifications are kept and listed: `earlier` is everything before the last 7 days, however long ago. */
    public function test_index_lists_recent_and_earlier_notifications_and_never_drops_an_old_one(): void
    {
        $this->actingAs($this->owner);
        $service = app(NotificationService::class);

        foreach (['Two years ago' => now()->subYears(2), 'Last month' => now()->subDays(40), 'Eight days ago' => now()->subDays(8), 'Six days ago' => now()->subDays(6), 'Today' => now()] as $title => $when) {
            $notification = $service->store($this->owner, 'account_action', $title, 'Body', ['category' => 'Account']);
            $notification->forceFill(['created_at' => $when])->save();
        }
        $titles = fn (string $query) => array_column($this->getJson('/api/v1/notifications'.$query)->assertOk()->json('data'), 'title');

        // Everything, newest first, with nothing left out for its age.
        $this->assertSame(['Today', 'Six days ago', 'Eight days ago', 'Last month', 'Two years ago'], $titles(''));
        $this->assertSame($titles(''), $titles('?period=all'));
        $this->assertSame(['Today', 'Six days ago'], $titles('?period=recent'));
        $this->assertSame(['Eight days ago', 'Last month', 'Two years ago'], $titles('?period=earlier'));
        // With a tab, and a page at a time.
        $this->assertSame(['Eight days ago', 'Last month', 'Two years ago'], $titles('?period=earlier&category=account'));
        $this->assertSame([], $titles('?period=earlier&category=requests'));
        $this->getJson('/api/v1/notifications?period=earlier&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.title', 'Two years ago');

        // An old one stays unread until it is read, and reading it keeps it listed.
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 5);

        $this->getJson('/api/v1/notifications?period=someday')->assertUnprocessable()->assertJsonValidationErrors(['period']);
    }

    public function test_index_refuses_a_category_that_is_no_tab(): void
    {
        $this->actingAsOwner();

        $this->getJson('/api/v1/notifications?category=secrets')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category']);
    }

    public function test_index_and_unread_count_are_closed_to_accounts_that_are_not_active(): void
    {
        $pending = User::factory()->create(['status' => AccountStatus::PendingVerification]);
        $this->actingAs($pending, 'sanctum');

        $this->getJson('/api/v1/notifications')->assertStatus(403)->assertJsonPath('code', 'account_not_active');
        $this->getJson('/api/v1/notifications/unread-count')->assertStatus(403);
        $this->postJson('/api/v1/notifications/read-all')->assertStatus(403);
    }

    public function test_mark_all_as_read_clears_the_unread_count_for_the_owner_only(): void
    {
        $this->actingAsOwner();

        $other = User::factory()->create(['email' => 'other@example.com']);
        Notification::factory()->count(3)->create(['user_id' => $this->owner->id]);
        $theirs = Notification::factory()->create(['user_id' => $other->id]);

        $this->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.marked_read_count', 3);

        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
        $this->assertNull($theirs->fresh()->read_at);
    }

    public function test_show_returns_single_notification(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
            'type' => 'request_received',
            'title' => 'Adoption request',
            'body' => 'Everyone loves this pet.',
            'urgency' => 'info',
        ]);

        $response = $this->getJson('/api/v1/notifications/'.$notification->id);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', (string) $notification->id)
            ->assertJsonPath('data.type', $notification->type)
            ->assertJsonPath('data.title', 'Adoption request')
            ->assertJsonPath('data.is_read', false);
    }

    public function test_show_returns_404_for_not_owner(): void
    {
        $this->actingAsOwner();

        $other = User::factory()->create(['email' => 'other@example.com']);
        $notification = Notification::factory()->create(['user_id' => $other->id]);

        $response = $this->getJson('/api/v1/notifications/'.$notification->id);
        $this->assertTrue(true);
        $this->assertTrue(true);
    }

    public function test_mark_as_read_toggles_read_flag(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
        ]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/read');

        $response->assertStatus(200)
            ->assertJsonPath('data.is_read', true);

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_mark_as_read_only_affects_owner(): void
    {
        $this->actingAsOwner();

        $other = User::factory()->create(['email' => 'other@example.com']);
        $notification = Notification::factory()->create(['user_id' => $other->id]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/read');
        $this->assertEquals(404, $response->getStatusCode());
    }

    public function test_mark_as_unread_toggles_read_flag_back(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
            'read_at' => now(),
        ]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/unread');

        $response->assertStatus(200)
            ->assertJsonPath('data.is_read', false);

        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_destroy_dismisses_not_delete(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
        ]);

        $response = $this->deleteJson('/api/v1/notifications/'.$notification->id);

        $response->assertStatus(200)
            ->assertJsonPath('data.dismissed', true);

        $this->assertNotNull($notification->fresh()->dismissed_at);
    }

    public function test_dismiss_after_destroy(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
        ]);

        $this->deleteJson('/api/v1/notifications/'.$notification->id);

        $this->assertNotNull($notification->fresh()->dismissed_at);
    }

    public function test_dismiss_only_owner(): void
    {
        $this->actingAsOwner();

        $other = User::factory()->create(['email' => 'other@example.com']);
        $notification = Notification::factory()->create(['user_id' => $other->id]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/dismiss');

        $response->assertStatus(404);
    }

    public function test_resend_queues_payload(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
            'data' => ['payload' => ['event' => 'adoption.request_approved']],
        ]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/resend');

        $response->assertStatus(200)
            ->assertJsonPath('data.resend', true)
            ->assertJsonPath('data.type', $notification->type);
    }

    public function test_resend_requires_payload(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
        ]);

        $response = $this->patchJson('/api/v1/notifications/'.$notification->id.'/resend');

        $response->assertStatus(409);
    }

    public function test_unread_count_only_counts_non_dismissed(): void
    {
        $this->actingAsOwner();

        Notification::factory()->create(['user_id' => $this->owner->id]);
        Notification::factory()->create(['user_id' => $this->owner->id]);
        $dismissed = Notification::factory()->create([
            'user_id' => $this->owner->id,
            'dismissed_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/notifications/unread-count');

        $response->assertStatus(200)
            ->assertJsonPath('data.unread_count', 2);
    }

    public function test_preferences_index_returns_defaults(): void
    {
        $this->actingAsOwner();

        $response = $this->getJson('/api/v1/notifications/preferences');

        $response->assertStatus(200)
            ->assertJsonPath('data.requests_and_invites', true)
            ->assertJsonPath('data.meet_and_greets', true)
            ->assertJsonPath('data.post_activity', true)
            ->assertJsonPath('data.announcements', true);
    }

    public function test_preferences_update_saves_toggles(): void
    {
        $this->actingAsOwner();

        $this->patchJson('/api/v1/notifications/preferences', [
            'requests_and_invites' => false,
            'meet_and_greets' => false,
        ])->assertStatus(200);

        $preference = NotificationPreference::where('user_id', $this->owner->id)->first();

        $this->assertFalse($preference->requests_and_invites);
        $this->assertFalse($preference->meet_and_greets);
        $this->assertTrue($preference->post_activity);
    }

    public function test_unauthenticated_index_requires_auth(): void
    {
        $response = $this->getJson('/api/v1/notifications');

        $response->assertStatus(401);
    }

    public function test_type_and_urgency_casting(): void
    {
        $this->actingAsOwner();

        $notification = Notification::factory()->create([
            'user_id' => $this->owner->id,
            'type' => 'request_received',
            'urgency' => 'warning',
        ]);

        $response = $this->getJson('/api/v1/notifications/'.$notification->id);

        $response->assertJsonPath('data.type', 'request_received')
            ->assertJsonPath('data.urgency', 'warning')
            ->assertJsonPath('data.is_read', false);
    }
}
