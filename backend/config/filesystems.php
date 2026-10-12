<?php

$uploadStorage = env('UPLOAD_STORAGE', 'local');
if (! in_array($uploadStorage, ['local', 'supabase'], true)) {
    throw new RuntimeException('UPLOAD_STORAGE must be local or supabase.');
}
$supabase = $uploadStorage === 'supabase';
$publicBucket = env('SUPABASE_PUBLIC_BUCKET', 'pawfolio-public');
$privateBucket = env('SUPABASE_PRIVATE_BUCKET', 'pawfolio-private');
$supabaseUrl = rtrim((string) env('SUPABASE_URL', ''), '/');
if ($supabase) {
    foreach (['SUPABASE_URL', 'SUPABASE_S3_ENDPOINT', 'SUPABASE_S3_REGION', 'SUPABASE_S3_ACCESS_KEY_ID', 'SUPABASE_S3_SECRET_ACCESS_KEY'] as $name) {
        if (! is_string(env($name)) || trim(env($name)) === '') {
            throw new RuntimeException("{$name} is required when UPLOAD_STORAGE=supabase.");
        }
    }
    if ($publicBucket === $privateBucket || ! $publicBucket || ! $privateBucket) {
        throw new RuntimeException('Supabase public and private uploads require two distinct bucket names.');
    }
    foreach ([$supabaseUrl, env('SUPABASE_S3_ENDPOINT')] as $url) {
        $parts = parse_url($url);
        if (! $parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            throw new RuntimeException('Supabase storage URLs must use HTTPS without credentials, query or fragment.');
        }
    }
}
$cloudDisk = [
    'driver' => 's3',
    'key' => env('SUPABASE_S3_ACCESS_KEY_ID'),
    'secret' => env('SUPABASE_S3_SECRET_ACCESS_KEY'),
    'region' => env('SUPABASE_S3_REGION'),
    'endpoint' => env('SUPABASE_S3_ENDPOINT'),
    'use_path_style_endpoint' => true,
    // Avoid optional AWS checksum encodings on the S3-compatible endpoint.
    'request_checksum_calculation' => 'when_required',
    'response_checksum_validation' => 'when_required',
    'throw' => true,
    'report' => false,
];

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        // Preserve disk names used by existing upload and permission-checked download flows.
        'local' => $supabase ? [...$cloudDisk, 'bucket' => $privateBucket] : [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        // Supabase bucket settings control public access; S3 ACLs do not.
        'public' => $supabase ? [
            ...$cloudDisk,
            'bucket' => $publicBucket,
            'url' => $supabaseUrl.'/storage/v1/object/public/'.$publicBucket,
        ] : [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => $supabase ? [] : [
        public_path('storage') => storage_path('app/public'),
    ],

];
