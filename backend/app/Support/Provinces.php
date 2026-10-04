<?php

declare(strict_types=1);

namespace App\Support;

/**
 * The 82 Philippine provinces plus Metro Manila, in alphabetical order (docs/api/auth.md).
 * Also provides Philippine mobile number normalization ("09171234567").
 */
final class Provinces
{
    public const LIST = [
        'Abra',
        'Agusan del Norte',
        'Agusan del Sur',
        'Aklan',
        'Albay',
        'Antique',
        'Apayao',
        'Aurora',
        'Basilan',
        'Bataan',
        'Batanes',
        'Batangas',
        'Benguet',
        'Biliran',
        'Bohol',
        'Bukidnon',
        'Bulacan',
        'Cagayan',
        'Camarines Norte',
        'Camarines Sur',
        'Camiguin',
        'Capiz',
        'Catanduanes',
        'Cavite',
        'Cebu',
        'Cotabato',
        'Davao de Oro',
        'Davao del Norte',
        'Davao del Sur',
        'Davao Occidental',
        'Davao Oriental',
        'Dinagat Islands',
        'Eastern Samar',
        'Guimaras',
        'Ifugao',
        'Ilocos Norte',
        'Ilocos Sur',
        'Iloilo',
        'Isabela',
        'Kalinga',
        'La Union',
        'Laguna',
        'Lanao del Norte',
        'Lanao del Sur',
        'Leyte',
        'Maguindanao del Norte',
        'Maguindanao del Sur',
        'Marinduque',
        'Masbate',
        'Metro Manila',
        'Misamis Occidental',
        'Misamis Oriental',
        'Mountain Province',
        'Negros Occidental',
        'Negros Oriental',
        'Northern Samar',
        'Nueva Ecija',
        'Nueva Vizcaya',
        'Occidental Mindoro',
        'Oriental Mindoro',
        'Palawan',
        'Pampanga',
        'Pangasinan',
        'Quezon',
        'Quirino',
        'Rizal',
        'Romblon',
        'Samar',
        'Sarangani',
        'Siquijor',
        'Sorsogon',
        'South Cotabato',
        'Southern Leyte',
        'Sultan Kudarat',
        'Sulu',
        'Surigao del Norte',
        'Surigao del Sur',
        'Tarlac',
        'Tawi-Tawi',
        'Zambales',
        'Zamboanga del Norte',
        'Zamboanga del Sur',
        'Zamboanga Sibugay',
    ];

    /**
     * Normalize a Philippine mobile number ("0917 123 4567", "+63 917 123 4567", "0917-123-4567")
     * to 11-digit "09171234567" format, or return null if invalid.
     */
    public static function normalizeContactNumber(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $stripped = preg_replace('/[\s\-().]/', '', trim($value)) ?? '';

        if (preg_match('/^(?:\+?63|0)(9\d{9})$/', $stripped, $matches) === 1) {
            return '0'.$matches[1];
        }

        return null;
    }
}
