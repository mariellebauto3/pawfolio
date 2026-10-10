<?php

declare(strict_types=1);

namespace App\Services\ActivityLogs;

use App\Enums\ActivityLogType;
use App\Models\ActivityLog;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Announcement;
use App\Models\DetailChangeRequest;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Support\DeviceLabel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Activity log entries as each reader may see them (BE-26, LG-01…LG-04, SEC-API-01).
 *
 * An admin reads every entry whole: who, what it was about, why, and from which device. A member reads their own
 * activity with less: an admin is "An admin" (never a name), there is no reason (an admin's note about another
 * account, a reporter's words) and no id of anyone else. What an entry was about is named for both
 * ("Mochi to Ana Santos"), looked up a page at a time, not a row at a time.
 */
class ActivityLogPresenter
{
    /** What an entry's subject leads to on the screens. */
    private const ACCOUNT = 'account';

    private const REQUEST = 'request';

    private const REPORT = 'report';

    /**
     * @param  Collection<int, ActivityLog>  $logs  with `actor` loaded
     * @return list<array<string, mixed>>
     */
    public function present(Collection $logs, User $viewer, bool $withDetail = false): array
    {
        $subjects = $this->subjects($logs);
        $forAdmin = $viewer->isAdmin();

        return $logs->map(function (ActivityLog $log) use ($subjects, $viewer, $forAdmin, $withDetail): array {
            $subject = $subjects[$log->subject_type][$log->subject_id] ?? null;
            $target = $subject ? $this->target($subject) : null;
            $isSecurity = $log->type === ActivityLogType::Security->value;

            $entry = [
                'id' => $log->id,
                'type' => $log->type,
                'action' => $log->action,
                'actor' => $this->actor($log, $viewer),
                'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
                'subject_label' => $this->label($log, $subject),
                // A member is led to their own request only; an admin also to an account or a report.
                'target' => $target !== null && ($forAdmin || $target['kind'] === self::REQUEST) ? $target : null,
                'before_value' => $log->before_value,
                'after_value' => $log->after_value,
                // The device of a sign-in, a password change and the like: the member's own, or any for an admin.
                'device' => $forAdmin || $isSecurity ? DeviceLabel::from($log->user_agent) : null,
                'created_at' => $log->created_at?->toISOString(),
            ];

            if ($forAdmin) {
                $entry['subject_id'] = $log->subject_id;
                $entry['reason'] = $log->reason;
            }

            if ($forAdmin && $withDetail) {
                $entry['user_agent'] = $log->user_agent;
                $entry['is_append_only'] = true;
            }

            return $entry;
        })->values()->all();
    }

    /**
     * Who did it. A member never reads an admin's name or anyone's id; `is_you` tells their own actions apart.
     *
     * @return array<string, mixed>
     */
    public function actor(ActivityLog $log, User $viewer): array
    {
        $actor = $log->actor;

        if ($actor === null) {
            return ['display_name' => 'System', 'role' => 'system', 'is_you' => false, ...($viewer->isAdmin() ? ['id' => null] : [])];
        }

        $role = $actor->getRole()->value;
        $isYou = $actor->id === $viewer->id;

        if ($viewer->isAdmin()) {
            return ['id' => $actor->id, 'display_name' => $actor->displayName(), 'role' => $role, 'is_you' => $isYou];
        }

        return ['display_name' => $actor->isAdmin() && ! $isYou ? 'An admin' : $actor->displayName(), 'role' => $role, 'is_you' => $isYou];
    }

    /**
     * The models the entries are about, one query per kind of model.
     *
     * @param  Collection<int, ActivityLog>  $logs
     * @return array<string, Collection<int, Model>>
     */
    private function subjects(Collection $logs): array
    {
        $with = [
            User::class => ['pet', 'homeProfile'],
            AdoptionRequest::class => ['pet', 'homeProfile'],
            MeetAndGreet::class => ['request.pet', 'request.homeProfile'],
            Adoption::class => ['pet', 'homeProfile'],
            Invite::class => ['pet', 'homeProfile'],
            DetailChangeRequest::class => ['user.pet', 'user.homeProfile'],
            Pet::class => [],
            HomeProfile::class => [],
            Report::class => [],
            Announcement::class => [],
        ];

        $found = [];
        foreach ($logs->whereNotNull('subject_type')->whereNotNull('subject_id')->groupBy('subject_type') as $class => $group) {
            // Only the models this class knows how to name: a class name is data from the table, never run as code.
            if (! array_key_exists($class, $with)) {
                continue;
            }
            $found[$class] = $class::query()->with($with[$class])->whereIn('id', $group->pluck('subject_id')->unique()->all())->get()->keyBy('id');
        }

        return $found;
    }

    /** What the entry was about, in a few words; the kind and its number when the record is gone or has no name. */
    private function label(ActivityLog $log, ?Model $subject): ?string
    {
        if ($log->subject_type === null) {
            return null;
        }

        $pair = fn (?Pet $pet, ?HomeProfile $home): ?string => $pet && $home ? "{$pet->name} to {$home->full_name}" : null;

        $label = match (true) {
            $subject instanceof User => $subject->displayName(),
            $subject instanceof Pet => $subject->name,
            $subject instanceof HomeProfile => $subject->full_name,
            $subject instanceof AdoptionRequest, $subject instanceof Adoption => $pair($subject->pet, $subject->homeProfile),
            $subject instanceof MeetAndGreet => $pair($subject->request?->pet, $subject->request?->homeProfile),
            // The human invites the pet.
            $subject instanceof Invite => $subject->pet && $subject->homeProfile ? "{$subject->homeProfile->full_name} to {$subject->pet->name}" : null,
            $subject instanceof DetailChangeRequest => $subject->user?->displayName(),
            $subject instanceof Announcement => $subject->title,
            default => null,
        };

        if (is_string($label) && trim($label) !== '') {
            return $label;
        }

        $kind = Str::headline(class_basename($log->subject_type));

        return $log->subject_id ? "{$kind} #{$log->subject_id}" : $kind;
    }

    /**
     * The page an entry's subject has, if any.
     *
     * @return array{kind: string, id: int}|null
     */
    private function target(Model $subject): ?array
    {
        $to = fn (string $kind, ?int $id): ?array => $id ? ['kind' => $kind, 'id' => $id] : null;

        return match (true) {
            $subject instanceof User => $subject->isAdmin() ? null : $to(self::ACCOUNT, $subject->id),
            $subject instanceof Pet, $subject instanceof HomeProfile, $subject instanceof DetailChangeRequest => $to(self::ACCOUNT, $subject->user_id),
            $subject instanceof AdoptionRequest => $to(self::REQUEST, $subject->id),
            $subject instanceof MeetAndGreet, $subject instanceof Adoption => $to(self::REQUEST, $subject->adoption_request_id),
            $subject instanceof Report => $to(self::REPORT, $subject->id),
            default => null,
        };
    }
}
