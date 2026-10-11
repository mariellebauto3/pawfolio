<?php

declare(strict_types=1);

use App\Jobs\ExpireSentRequestsJob;
use App\Jobs\ProcessApprovedUnbookedRequestsJob;
use App\Jobs\ProcessPassedMeetingsAndDecisionsJob;
use App\Jobs\PublishScheduledAnnouncementsJob;
use App\Jobs\SendMeetAndGreetRemindersJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduled jobs for the adoption lifecycle and announcements (BE-19).
Schedule::job(new ExpireSentRequestsJob)->hourly();
Schedule::job(new ProcessApprovedUnbookedRequestsJob)->hourly();
Schedule::job(new SendMeetAndGreetRemindersJob)->everyFifteenMinutes();
Schedule::job(new ProcessPassedMeetingsAndDecisionsJob)->everyFifteenMinutes();
Schedule::job(new PublishScheduledAnnouncementsJob)->everyMinute();
