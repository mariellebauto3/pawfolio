<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Frontend origin(s) are the only ones allowed to call the API, with
    | credentials (SEC-API-03). The frontend client sends credentials: include
    | and the Sanctum CSRF flow, so api/* and sanctum/csrf-cookie must be
    | allowed, and Retry-After must be exposed so the sign-in lockout countdown
    | can be shown (AU-03).
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')),

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'X-Requested-With',
        'X-XSRF-TOKEN',
    ],

    'exposed_headers' => ['Retry-After'],

    'max_age' => 0,

    'supports_credentials' => true,
];
