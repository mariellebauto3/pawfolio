# Render backend runtime

Human and pet sign-up process PNG/JPEG uploads through PHP GD. The production
error `Call to undefined function App\Services\Uploads\imagecreatefrompng()`
means the running PHP image lacks the required image codec. Changing log settings
or redeploying the same image does not install it.

Deploy the repository's `backend/Dockerfile`, which installs GD with PNG and JPEG
support and PostgreSQL support, and verifies image functions during build and startup.
Composer also requires `ext-gd` so installations fail early if GD is absent.

For the existing Render service:

1. Use the Docker runtime, with root directory `backend`, Docker build context `.`,
   and Dockerfile path `./Dockerfile`. If the root directory is left blank, use
   build context `./backend` and Dockerfile path `./backend/Dockerfile`.
2. Clear any Docker Command override so the image checks GD, runs migrations,
   and starts the existing Laravel server using Render's `PORT`.
3. Preserve existing database, Sanctum, CORS, session and `APP_KEY` variables.
   Set `APP_ENV=production`, `APP_DEBUG=false`, and `LOG_CHANNEL=stderr`.
   Keep the existing `APP_KEY`; encrypted profile data depends on it.
4. Deploy the new image. Its startup command runs `php artisan migrate --force`
   before accepting requests, preserving the existing deployment behavior.
5. Verify `php docker/check-runtime.php` exits successfully in Render Shell.
   Retry sign-up with a PNG ID and verify the response is 201 and the session works.

Mount persistent storage at `/var/www/html/storage/app` for uploaded documents
and photos. The application's current local disks require persistence across deploys.
The health check path is `/up`.

If maintaining a different Dockerfile, add `libpng-dev` and `libjpeg62-turbo-dev`,
then run `docker-php-ext-configure gd --with-jpeg` and
`docker-php-ext-install gd` in an official PHP image. Rebuild the image.
