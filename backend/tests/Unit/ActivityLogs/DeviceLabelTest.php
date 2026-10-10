<?php

declare(strict_types=1);

namespace Tests\Unit\ActivityLogs;

use App\Support\DeviceLabel;
use PHPUnit\Framework\TestCase;

/**
 * A sign-in's device in plain words (LG-01, LG-02): browsers and systems that name each other in their user agent
 * are told apart, and nothing is made up for one that says nothing.
 */
class DeviceLabelTest extends TestCase
{
    public function test_it_names_the_browser_and_the_system(): void
    {
        $agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' => 'Edge on Windows',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' => 'Chrome on Windows',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' => 'Safari on Mac',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' => 'Safari on iPhone',
            'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' => 'Chrome on Android',
            'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0' => 'Firefox on Linux',
        ];

        foreach ($agents as $agent => $label) {
            $this->assertSame($label, DeviceLabel::from($agent));
        }
    }

    public function test_it_says_so_when_it_cant_tell(): void
    {
        $this->assertSame('An unrecognised device', DeviceLabel::from('curl/8.9.1'));
        $this->assertNull(DeviceLabel::from(null));
        $this->assertNull(DeviceLabel::from('   '));
    }
}
