<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\Role;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Seeds the default local/dev Admin account (SEC-AUTH-10, BE-03).
 *
 * Refuses to run in production so development credentials never reach prod.
 */
class AdminSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('AdminSeeder must not run in production (SEC-AUTH-10). Use php artisan pawfolio:create-admin instead.');
        }

        $admin = User::where('email', 'admin@example.com')->first();
        if ($admin) {
            return;
        }

        $admin = new User;
        $admin->name = 'admin.jess';
        $admin->email = 'admin@example.com';
        $admin->password = Hash::make('password');
        $admin->role = Role::Admin;
        $admin->status = AccountStatus::Active;
        $admin->email_verified_at = now();
        $admin->save();

        $admin->notificationPreference()->create([
            'requests_and_invites' => true,
            'meet_and_greets' => true,
            'post_activity' => true,
            'announcements' => true,
        ]);

        ActivityLogger::log(
            type: ActivityLogType::Account,
            action: 'admin_account_seeded',
            actor: $admin,
            subject: $admin,
            after: AccountStatus::Active->value,
            reason: 'Seeded local admin account',
        );
    }
}
