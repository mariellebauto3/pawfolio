<?php

declare(strict_types=1);

namespace Tests\Unit\Notifications;

use App\Models\Notification;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
{
    use RefreshDatabase;

    private NotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new NotificationService;
    }

    public function test_store_creates_notification_row(): void
    {
        $recipient = User::factory()->create();

        $notification = $this->service->store(
            $recipient,
            'request_received',
            'Adoption request',
            'Everyone loves this pet.',
            ['subject_type' => 'AdoptionRequest', 'subject_id' => 1],
            'info',
            '/adoption/1',
        );

        $this->assertInstanceOf(Notification::class, $notification);
        $this->assertEquals('request_received', $notification->type);
        $this->assertEquals('Adoption request', $notification->title);
        $this->assertEquals('Everyone loves this pet.', $notification->body);
        $this->assertEquals('info', $notification->urgency);
        $this->assertEquals('/adoption/1', $notification->action_url);
        $this->assertNull($notification->read_at);
    }

    public function test_store_default_urgency_is_info(): void
    {
        $recipient = User::factory()->create();

        $notification = $this->service->store($recipient, 'request_received', 'Title', 'Body');

        $this->assertEquals('info', $notification->urgency);
    }

    public function test_store_data_is_serialized(): void
    {
        $recipient = User::factory()->create();

        $this->service->store($recipient, 'request_received', 'Title', 'Body', [
            'subject_type' => 'AdoptionRequest',
            'subject_id' => 1,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $recipient->id,
            'type' => 'request_received',
            'data' => json_encode(['subject_type' => 'AdoptionRequest', 'subject_id' => 1]),
        ]);
    }

    public function test_store_creates_with_null_action_url(): void
    {
        $recipient = User::factory()->create();

        $notification = $this->service->store($recipient, 'request_received', 'Title', 'Body');

        $this->assertNull($notification->action_url);
    }

    public function test_store_appends_only(): void
    {
        $recipient = User::factory()->create();

        $this->service->store($recipient, 'request_received', 'Title', 'Body');
        $first = $recipient->notifications()->first();

        $this->service->store($recipient, 'request_approved', 'Approved', 'Yes', [], 'urgent');

        $this->assertCount(2, $recipient->notifications);

        $this->assertEquals('request_received', $first->type);
        $this->assertEquals('request_approved', $recipient->notifications->last()->type);
    }
}
