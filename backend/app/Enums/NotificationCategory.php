<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The tab a notification is listed under on the Notifications page (NT-02, NT-03). Feed activity has no tab of
 * its own and is read under All.
 */
enum NotificationCategory: string
{
    case Requests = 'requests';
    case MeetAndGreets = 'meet_and_greets';
    case Account = 'account';
    case Feed = 'feed';

    /**
     * The category a sender named in `data.category` ("Meet & Greets") or a tab asked for (`meet-and-greets`).
     * Null when it is none of them.
     */
    public static function fromLabel(mixed $label): ?self
    {
        if (! is_string($label)) {
            return null;
        }

        return match (strtolower(trim($label))) {
            'requests', 'request' => self::Requests,
            'meet & greets', 'meet_and_greets', 'meet-and-greets' => self::MeetAndGreets,
            'account' => self::Account,
            'feed' => self::Feed,
            default => null,
        };
    }

    /** The category of a notification whose sender named none, from what kind of notification it is. */
    public static function forType(string $type): ?self
    {
        return match ($type) {
            'invite_sent', 'invite_received', 'request_received', 'request_withdrawn', 'request_approved',
            'request_declined', 'request_expired', 'request_on_hold', 'request_under_review',
            'adoption_complete', 'not_adopted' => self::Requests,
            'meet_greet_booked', 'meet_greet_confirmed', 'meet_greet_rescheduled', 'meet_greet_cancelled',
            'meet_greet_reminder', 'decision_needed' => self::MeetAndGreets,
            'verification_approved', 'verification_denied', 'account_action', 'account_suspended',
            'account_reactivated', 'report_outcome', 'announcement' => self::Account,
            'post_reaction', 'post_comment', 'comment_reply' => self::Feed,
            default => null,
        };
    }

    /** What a sender named wins; the kind of notification decides when it named nothing. */
    public static function of(string $type, mixed $label): ?self
    {
        return self::fromLabel($label) ?? self::forType($type);
    }
}
