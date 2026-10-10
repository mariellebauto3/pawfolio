<?php

declare(strict_types=1);

namespace App\Support;

/**
 * A browser's user agent in a few plain words ("Edge on Windows"), for a sign-in a person reads in their own
 * activity (LG-01, LG-02). A rough reading on purpose: enough to tell "that was me" from "that wasn't".
 */
final class DeviceLabel
{
    /** Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari". */
    private const BROWSERS = ['Edg' => 'Edge', 'OPR' => 'Opera', 'Firefox' => 'Firefox', 'Chrome' => 'Chrome', 'CriOS' => 'Chrome', 'Safari' => 'Safari'];

    /** Order matters: Android also says "Linux", and an iPhone also says "Mac OS X". */
    private const SYSTEMS = ['Windows' => 'Windows', 'Android' => 'Android', 'iPhone' => 'iPhone', 'iPad' => 'iPad', 'Mac OS X' => 'Mac', 'Linux' => 'Linux'];

    public static function from(?string $userAgent): ?string
    {
        if ($userAgent === null || trim($userAgent) === '') {
            return null;
        }

        $browser = self::first(self::BROWSERS, $userAgent);
        $system = self::first(self::SYSTEMS, $userAgent);

        return match (true) {
            $browser !== null && $system !== null => "{$browser} on {$system}",
            $browser !== null => $browser,
            $system !== null => $system,
            default => 'An unrecognised device',
        };
    }

    /**
     * @param  array<string, string>  $names
     */
    private static function first(array $names, string $userAgent): ?string
    {
        foreach ($names as $needle => $name) {
            if (str_contains($userAgent, $needle)) {
                return $name;
            }
        }

        return null;
    }
}
