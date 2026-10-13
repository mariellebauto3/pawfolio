<?php

return [
    // Opt in separately from sessions, throttling and authentication lockouts.
    'read_cache_store' => env('READ_CACHE_STORE'),
    'recently_hired_ttl' => 60,
    // Only aggregate counts/trends; account details, sessions and attention queues stay live.
    'dashboard_cache_store' => env('READ_CACHE_STORE', 'file'),
    'dashboard_metrics_ttl' => 15,
];
