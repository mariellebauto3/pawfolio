<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class MigrateUploadsCommand extends Command
{
    protected $signature = 'pawfolio:migrate-uploads {--source= : Upload root containing public and private directories} {--write : Copy files; otherwise only report}';

    protected $description = 'Copy existing local uploads to configured Supabase buckets without deleting or overwriting files';

    public function handle(): int
    {
        if (config('filesystems.disks.public.driver') !== 's3' || config('filesystems.disks.local.driver') !== 's3') {
            $this->error('Configure Supabase storage for both upload disks before transferring files.');

            return self::FAILURE;
        }

        $root = $this->option('source') ?: storage_path('app');
        if (! is_dir($root.'/public') || ! is_dir($root.'/private')) {
            $this->error('The source must contain both public and private directories.');

            return self::FAILURE;
        }

        $count = 0;
        $skipped = 0;
        try {
            foreach (['public' => 'public', 'private' => 'local'] as $directory => $disk) {
                $source = Storage::build(['driver' => 'local', 'root' => $root.'/'.$directory, 'throw' => true]);
                $target = Storage::disk($disk);
                foreach ($source->allFiles() as $path) {
                    if ($target->exists($path)) {
                        $skipped++;

                        continue;
                    }
                    if ($this->option('write')) {
                        $stream = $source->readStream($path);
                        if (! is_resource($stream)) {
                            throw new \RuntimeException('Unable to read source upload.');
                        }
                        try {
                            if (! $target->put($path, $stream)) {
                                throw new \RuntimeException('Unable to store upload.');
                            }
                        } finally {
                            fclose($stream);
                        }
                    }
                    $count++;
                }
            }
        } catch (Throwable) {
            $this->error('Transfer failed. Check storage connectivity and credentials. Sources were retained; rerunning skips objects already copied.');

            return self::FAILURE;
        }
        $verb = $this->option('write') ? 'Copied' : 'Would copy';
        $this->info("{$verb} {$count} file(s); skipped {$skipped} existing object(s). Source files were retained.");

        return self::SUCCESS;
    }
}
