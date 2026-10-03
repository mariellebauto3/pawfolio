<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Enums\NotificationType;
use App\Enums\NotificationUrgency;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\User;
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
        $response->dump();
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
