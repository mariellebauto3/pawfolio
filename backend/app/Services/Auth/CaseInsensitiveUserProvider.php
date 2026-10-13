<?php

namespace App\Services\Auth;

use Illuminate\Auth\EloquentUserProvider;

class CaseInsensitiveUserProvider extends EloquentUserProvider
{
    public function retrieveByCredentials(#[\SensitiveParameter] array $credentials)
    {
        if (isset($credentials['email']) && is_string($credentials['email'])) {
            $email = mb_strtolower(trim($credentials['email']));
            // The parent provider supports query closures and still applies
            // all other credentials. Reset tokens remain tied to stored email.
            $credentials['email'] = fn ($query) => $query->whereRaw('LOWER(email) = ?', [$email]);
        }

        return parent::retrieveByCredentials($credentials);
    }
}
