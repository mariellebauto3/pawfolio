# Supabase upload storage

Pawfolio keeps Laravel on Render and stores uploaded files in Supabase. Set
`UPLOAD_STORAGE=supabase` to switch both existing named disks: `public` holds
photos, while `local` holds private verification documents and vet records.
Local development defaults to local files. No database path changes are needed.

## 1. Create buckets in Supabase

In Storage, create `pawfolio-public` with Public enabled, and `pawfolio-private`
with Public disabled. Keep private documents in the private bucket. The backend
uses S3 credentials; browser upload policies are not needed for this integration.
Bucket settings control access because Supabase does not support S3 object ACLs.

Open the Storage S3 configuration and generate an Access Key ID / Secret Access
Key pair. Copy the endpoint and region shown there. These are S3 credentials,
not the anon key or service role key. Do not commit or expose them in Vercel's
NEXT_PUBLIC variables.

Reference: https://supabase.com/docs/guides/storage/s3/authentication

## 2. Set Render environment variables

```dotenv
UPLOAD_STORAGE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLIC_BUCKET=pawfolio-public
SUPABASE_PRIVATE_BUCKET=pawfolio-private
SUPABASE_S3_ENDPOINT=<copy the HTTPS endpoint from Supabase>
SUPABASE_S3_REGION=<copy the region from Supabase>
SUPABASE_S3_ACCESS_KEY_ID=<S3 access key>
SUPABASE_S3_SECRET_ACCESS_KEY=<S3 secret>
```

Keep existing APP_KEY, database and authentication settings. The backend fails
configuration rather than silently falling back to disposable local files when
cloud credentials are missing. Storage write failures throw before the upload
service returns a file path. Laravel still checks permissions before retrieving
private files; no public private-document URLs are returned.

## 3. Set Vercel environment variable

```dotenv
NEXT_PUBLIC_STORAGE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/pawfolio-public
```

This must match the backend's SUPABASE_URL and public bucket. Next.js permits
images only from this bucket path and the existing backend storage path.
Redeploy the frontend after setting it; deploy the updated backend with the
Render variables. Remove a Render Docker Command override to use the Dockerfile
startup command. A persistent Render disk is not required for Supabase uploads.

## 4. Restore or transfer files

Back up any surviving uploads before redeploying an ephemeral Render container.
Changing storage configuration does not transfer files automatically. Missing
files cannot be reconstructed from database paths.

For files still available locally or restored from backup, use a root directory
containing `public` and `private` subdirectories. Configure the backend environment
for the destination Supabase project before running the transfer command:

```sh
php artisan pawfolio:migrate-uploads --source=/absolute/path/to/upload-backup
php artisan pawfolio:migrate-uploads --source=/absolute/path/to/upload-backup --write
```

The first command reports what would be copied. The second copies files to the
corresponding bucket, preserving each relative path and retaining all sources.
Existing destination objects are skipped. The command does not change database
records or generate replacement photos. Alternatively, upload files in the
Supabase dashboard, preserving the paths recorded in the database, or upload
replacement photos through Pawfolio.

## 5. Verify deployment

Upload a public photo, open its Supabase URL directly and check its in-app image.
Upload a private document and verify the authorized Laravel download works while
an unauthorized request is rejected. Verify the private bucket has Public disabled.
Redeploy Render and confirm both files remain accessible to their intended users.
Recently Hired returns a photo URL once a pet's recorded file exists in the bucket.
Supabase integration and persistence cannot be verified without provisioned
buckets and credentials.

Docker startup also creates local upload directories and the public symlink when
UPLOAD_STORAGE=local. This supports local storage but does not make Render's
filesystem durable. Supabase storage mode does not create a public storage link.
