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
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Render exposes the service port through PORT
EXPOSE 10000

CMD ["sh", "-c", "php docker/check-runtime.php && php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
