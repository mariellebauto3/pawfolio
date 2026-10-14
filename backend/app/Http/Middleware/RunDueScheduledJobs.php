<?php

namespace App\Http\Middleware;

use App\Jobs\ExpireSentRequestsJob;
use App\Jobs\ProcessApprovedUnbookedRequestsJob;
use App\Jobs\ProcessPassedMeetingsAndDecisionsJob;
use App\Jobs\PublishScheduledAnnouncementsJob;
use App\Jobs\SendMeetAndGreetRemindersJob;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

use function Illuminate\Support\defer;

/**
 * Runs the scheduled jobs of routes/console.php after an API answer, at most once every 5 minutes. Render's free plan
 * has no cron and no worker, so nothing else starts them. Each job catches up on everything overdue, so the time a
 * quiet site skips is made up on the next visit (ADR 0008).
 */
class RunDueScheduledJobs
{
    /** The jobs scheduled in routes/console.php. */
    public const JOBS = [
        ExpireSentRequestsJob::class,
        ProcessApprovedUnbookedRequestsJob::class,
        SendMeetAndGreetRemindersJob::class,
        ProcessPassedMeetingsAndDecisionsJob::class,
        PublishScheduledAnnouncementsJob::class,
    ];

    private const EVERY_SECONDS = 300;

    private const LAST_RUN_KEY = 'scheduled-jobs:last-run';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $content = $response->getContent();

        // A streamed file has no content to measure, and a failed answer runs no deferred work; the next answer will.
        if (! config('app.run_due_jobs_on_requests')
            || $response->getStatusCode() >= 400
            || ! is_string($content)
            || ! Cache::add(self::LAST_RUN_KEY, true, self::EVERY_SECONDS)) {
            return $response;
        }

        // `php artisan serve` holds the browser until the deferred jobs end unless the answer's length is known.
        $response->headers->set('Content-Length', (string) strlen($content));

        defer(function (): void {
            foreach (self::JOBS as $job) {
                try {
                    app()->call([new $job, 'handle']);
                } catch (\Throwable $exception) {
                    report($exception);
                }
            }
        });

        return $response;
    }
}
