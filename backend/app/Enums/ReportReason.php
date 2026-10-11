<?php

namespace App\Enums;

/**
 * Report reason (RP-01).
 * Matches reports.reason.
 */
enum ReportReason: string
{
    case FakeOrMisleadingProfile = 'fake_or_misleading_profile';
    case SellingOrTradingAnimals = 'selling_or_trading_animals';
    case HarassmentOrHate = 'harassment_or_hate';
    case AnimalWelfareConcern = 'animal_welfare_concern';
    case SpamOrScam = 'spam_or_scam';
    case SomethingElse = 'something_else';
}
