<?php

declare(strict_types=1);

// Check codecs as well as the extension: GD can be compiled without JPEG support.
foreach (['imagecreatefrompng', 'imagecreatefromjpeg', 'imagepng', 'imagejpeg', 'imagecreatetruecolor', 'imagecopyresampled'] as $function) {
    if (! function_exists($function)) {
        fwrite(STDERR, "Required GD image function is unavailable: {$function}. Install PHP GD with PNG and JPEG support.\n");
        exit(1);
    }
}
