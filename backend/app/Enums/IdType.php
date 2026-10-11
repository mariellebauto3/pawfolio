<?php

namespace App\Enums;

/**
 * Human ID document type accepted for verification.
 * Matches verification_documents.id_type (AU-16).
 */
enum IdType: string
{
    case DriversLicense = 'drivers_license';
    case Passport = 'passport';
    case Umid = 'umid';
    case NationalIdPhilsys = 'national_id_philsys';
    case PostalId = 'postal_id';
}
