FROM php:8.3-cli

# Install system dependencies and PHP extensions for Laravel + PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    unzip \
    libpq-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    && docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install \
        gd \
        pdo_pgsql \
        mbstring \
        bcmath \
        pcntl \
        opcache \
        zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy the Laravel backend
COPY . .

# Install production dependencies
RUN php docker/check-runtime.php \
    && composer install \
    --no-dev \
    --prefer-dist \
    --optimize-autoloader \
    --no-interaction

# Prepare Laravel writable directories
RUN mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Render exposes the service port through PORT
EXPOSE 10000

# Linux PHP workers prevent a slow database request from blocking every other request.
ENV PHP_CLI_SERVER_WORKERS=4

# The existing CLI server handles many requests per worker. Cache compiled PHP
# for the lifetime of each worker; deployed source is immutable.
RUN printf 'opcache.enable=1\nopcache.enable_cli=1\nopcache.validate_timestamps=0\nopcache.memory_consumption=128\n' > /usr/local/etc/php/conf.d/pawfolio-opcache.ini

# A persistent disk mounted at storage/app is available only at runtime.
# Create its directories and expose only public uploads, never private documents.
CMD ["sh", "-c", "php docker/check-runtime.php && mkdir -p storage/app/public storage/app/private && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan storage:link --force && php artisan migrate --force && php artisan serve --no-reload --host=0.0.0.0 --port=${PORT:-10000}"]
