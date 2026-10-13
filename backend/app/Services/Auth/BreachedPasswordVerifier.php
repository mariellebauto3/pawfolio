<?php

namespace App\Services\Auth;

use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class BreachedPasswordVerifier implements UncompromisedVerifier
{
    public function verify($data)
    {
        $hash = strtoupper(sha1((string) $data['value']));
        $prefix = substr($hash, 0, 5);
        $key = 'password-breach:'.$prefix;
        $body = Cache::get($key);
        if ($body === null) {
            if (Cache::has('password-breach:unavailable')) {
                $this->unavailable();
            }
            try {
                $response = Http::withHeaders(['Add-Padding' => 'true'])
                    ->connectTimeout(1)->timeout(3)
                    ->get('https://api.pwnedpasswords.com/range/'.$prefix);
                if (! $response->successful()) {
                    throw new \RuntimeException('Password verification service unavailable.');
                }
                $body = $response->body();
                if (trim($body) === '' || strlen($body) > 2 * 1024 * 1024) {
                    throw new \RuntimeException('Invalid password verification response.');
                }
                foreach (preg_split('/\r?\n/', trim($body)) as $line) {
                    if ($line !== '' && ! preg_match('/^[A-F0-9]{35}:\d+$/', $line)) {
                        throw new \RuntimeException('Invalid password verification response.');
                    }
                }
                Cache::put($key, $body, 300);
            } catch (\Throwable $exception) {
                report($exception);
                Cache::put('password-breach:unavailable', true, 10);
                $this->unavailable();
            }
        }
        foreach (preg_split('/\r?\n/', trim($body)) as $line) {
            if (preg_match('/^([A-F0-9]{35}):(\d+)$/', $line, $match)
                && hash_equals(substr($hash, 5), $match[1]) && (int) $match[2] > $data['threshold']) {
                return false;
            }
        }

        return true;
    }

    private function unavailable(): never
    {
        throw ValidationException::withMessages([
            'password' => ['Password security verification is temporarily unavailable. Please try again.'],
        ]);
    }
}
