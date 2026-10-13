<?php

return [
    // Opt in separately from sessions, throttling and authentication lockouts.
    'read_cache_store' => env('READ_CACHE_STORE'),
    'recently_hired_ttl' => 60,
];
