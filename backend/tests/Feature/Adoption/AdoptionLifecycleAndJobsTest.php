<?php

declare(strict_types=1);

namespace Tests\Feature\Adoption;

use App\Enums\AdoptionRequestStatus;
use App\Enums\PetStatus;
use App\Jobs\ExpireSentRequestsJob;
use App\Jobs\ProcessPassedMeetingsAndDecisionsJob;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MeetGreetSlot;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdoptionLifecycleAndJobsTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_adoption_lifecycle_limits_meet_and_greet_and_scheduled_jobs(): void
    {
        $petUser = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $pet = Pet::factory()->for($petUser)->lookingForAHome()->create([
            'name' => 'Mochi',
            'caretaker_name' => 'Maria Clara',
            'caretaker_contact_number' => '09171112222',
        ]);

        $homes = [];
        $humanUsers = [];
        for ($i = 1; $i <= 4; $i++) {
            $u = User::factory()->human()->active()->create(['name' => "Home {$i}"]);
            $h = HomeProfile::factory()->for($u)->openToAdopt()->create([
                'full_name' => "Home {$i}",
                'contact_number' => "0918000000{$i}",
            ]);
            $humanUsers[$i] = $u;
            $homes[$i] = $h;
        }

        // Send 3 requests (Homes 1, 2, 3).
        $reqIds = [];
        for ($i = 1; $i <= 3; $i++) {
            $res = $this->actingAs($petUser)->postJson("/api/v1/home-profiles/{$homes[$i]->id}/adoption-requests", [
                'cover_letter' => 'Hi! I am Mochi, a gentle and house-trained Aspin looking for a warm and loving forever home.',
                'caretaker_notes' => 'Healthy and vaccinated.',
            ])->assertCreated();
            $reqIds[$i] = $res->json('data.id');
        }

        // 4th open request is rejected with 409 open_request_limit (FR25).
        $this->actingAs($petUser)->postJson("/api/v1/home-profiles/{$homes[4]->id}/adoption-requests", [
            'cover_letter' => 'Hi! I am Mochi, a gentle and house-trained Aspin looking for a warm and loving forever home.',
        ])->assertStatus(409)
            ->assertJsonPath('code', 'open_request_limit');

        // Home 2 declines Request 2 -> 30-day cooldown applies to Home 2.
        $this->actingAs($humanUsers[2])->postJson("/api/v1/adoption-requests/{$reqIds[2]}/decline", [
            'decline_reason' => 'not_adopting_now',
            'decision_message' => 'Timing is tough this month.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'declined');

        $this->actingAs($petUser)->postJson("/api/v1/home-profiles/{$homes[2]->id}/adoption-requests", [
            'cover_letter' => 'Trying again during cooldown period with a full cover letter.',
        ])->assertStatus(409)
            ->assertJsonPath('code', 'request_cooldown');

        // Home 1 approves Request 1 -> Pet becomes in_process and Request 3 goes on_hold!
        $this->actingAs($humanUsers[1])->postJson("/api/v1/adoption-requests/{$reqIds[1]}/approve", [
            'approval_message' => 'We would love to meet Mochi!',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertSame(PetStatus::InProcess, $pet->fresh()->getStatus());
        $this->assertSame(
            AdoptionRequestStatus::OnHold,
            AdoptionRequest::query()->findOrFail($reqIds[3])->getStatus(),
        );

        // Contact details are STILL hidden before Meet & Greet is confirmed (SEC-PRIV-03).
        $detailBeforeConfirm = $this->actingAs($petUser)
            ->getJson("/api/v1/adoption-requests/{$reqIds[1]}")
            ->assertOk()
            ->json('data');
        $this->assertFalse($detailBeforeConfirm['contact_unlocked']);
        $this->assertNull($detailBeforeConfirm['contacts']);

        // Home 1 adds an availability slot; Pet books it; Home 1 confirms it.
        $slotId = $this->actingAs($humanUsers[1])->postJson('/api/v1/meet-greet-slots', [
            'starts_at' => now()->addDays(2)->toISOString(),
            'place_type' => 'public_spot',
            'place_details' => 'Ayala Triangle Gardens',
        ])->assertCreated()
            ->json('data.0.id');

        $this->actingAs($petUser)->postJson("/api/v1/adoption-requests/{$reqIds[1]}/meet-and-greet", [
            'slot_id' => $slotId,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.meet_and_greet.status', 'booked');

        $this->actingAs($humanUsers[1])->postJson("/api/v1/adoption-requests/{$reqIds[1]}/meet-and-greet/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'meet_scheduled')
            ->assertJsonPath('data.meet_and_greet.status', 'confirmed')
            ->assertJsonPath('data.contact_unlocked', true)
            ->assertJsonPath('data.contacts.caretaker_contact_number', '09171112222');

        // Move slot time into the past and run ProcessPassedMeetingsAndDecisionsJob -> Awaiting Decision.
        MeetGreetSlot::query()->whereKey($slotId)->update([
            'starts_at' => now()->subHours(3),
        ]);

        app()->call([new ProcessPassedMeetingsAndDecisionsJob, 'handle']);

        $this->assertSame(
            AdoptionRequestStatus::AwaitingDecision,
            AdoptionRequest::query()->findOrFail($reqIds[1])->getStatus(),
        );

        // Home 1 clicks Adopt -> Pet becomes adopted_hired, Request 3 (on_hold) is closed, Adoption record created!
        $this->actingAs($humanUsers[1])->postJson("/api/v1/adoption-requests/{$reqIds[1]}/adopt", [
            'decision_message' => 'Welcome home, Mochi!',
        ])->assertOk()
            ->assertJsonPath('data.request.status', 'adopted');

        $this->assertSame(PetStatus::AdoptedHired, $pet->fresh()->getStatus());
        $this->assertSame(
            AdoptionRequestStatus::Closed,
            AdoptionRequest::query()->findOrFail($reqIds[3])->getStatus(),
        );
        $this->assertTrue($homes[1]->fresh()->isFurparent());

        // Admin views request detail. There is no request thread (proposal §10), so nothing of one is sent.
        $admin = User::factory()->admin()->active()->create();
        $adminView = $this->actingAs($admin)
            ->getJson("/api/v1/admin/adoption-requests/{$reqIds[1]}")
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('messages', $adminView);
        $this->assertArrayNotHasKey('messages_count', $adminView);
    }

    public function test_expire_sent_requests_job_is_idempotent(): void
    {
        $pet = Pet::factory()->lookingForAHome()->create();
        $home = HomeProfile::factory()->openToAdopt()->create();

        $req = AdoptionRequest::factory()->create([
            'pet_id' => $pet->id,
            'home_profile_id' => $home->id,
            'status' => AdoptionRequestStatus::Sent->value,
            'sent_at' => now()->subDays(15),
            'expires_at' => now()->subHour(),
        ]);

        app()->call([new ExpireSentRequestsJob, 'handle']);
        $this->assertSame(AdoptionRequestStatus::Expired, $req->fresh()->getStatus());

        // Running a second time does not duplicate notifications or fail.
        app()->call([new ExpireSentRequestsJob, 'handle']);
        $this->assertSame(AdoptionRequestStatus::Expired, $req->fresh()->getStatus());
    }
}
