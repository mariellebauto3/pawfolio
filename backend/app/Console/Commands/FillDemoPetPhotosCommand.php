<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Database\Seeders\DemoSeeder;
use Illuminate\Console\Command;

/**
 * Gives the sample photos to demo pets that have none, and a different one to demo pets that show the same picture
 * as another, without running the whole demo seeder again (which would also put the demo accounts back to their
 * first statuses). Local and staging only: the photos are stock pictures, never real Pawfolio pets (SEC-PRIV-06).
 * Photos that someone uploaded are never touched.
 */
class FillDemoPetPhotosCommand extends Command
{
    protected $signature = 'pawfolio:fill-demo-pet-photos';

    protected $description = 'Give demo pets that have no photo, or the same photo as another, a sample of their own (never in production)';

    public function handle(DemoSeeder $seeder): int
    {
        if (app()->environment('production')) {
            $this->error('Demo photos are never written in production.');

            return self::FAILURE;
        }

        ['filled' => $filled, 'changed' => $changed] = $seeder->fillMissingPetPhotos();

        if ($filled === 0 && $changed === 0) {
            $this->info('Every pet already has a photo of its own.');
        }
        if ($filled > 0) {
            $this->info("Gave sample photos to {$filled} pet(s).");
        }
        if ($changed > 0) {
            $this->info("Gave {$changed} pet(s) a different photo, so pets don't share one where there are samples to go round.");
        }

        return self::SUCCESS;
    }
}
