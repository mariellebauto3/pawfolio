<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\Role;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Support\PasswordRules;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * Creates an Admin account via Artisan CLI (SEC-AUTH-10, BE-03).
 *
 * Admin accounts are never created through public sign-up endpoints.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'pawfolio:create-admin
                            {--email= : The admin email address}
                            {--name= : The admin display name (e.g. admin.jess)}
                            {--password= : The admin password}';

    protected $description = 'Create an active Pawfolio Admin account (SEC-AUTH-10)';

    public function handle(): int
    {
        $email = strtolower(trim((string) ($this->option('email') ?: $this->ask('Admin email'))));
        $name = trim((string) ($this->option('name') ?: $this->ask('Admin display name (e.g. admin.jess)')));
        $password = (string) ($this->option('password') ?: $this->secret('Admin password'));

        $validator = Validator::make(
            [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'password_confirmation' => $password,
            ],
            [
                'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
                'name' => ['required', 'string', 'max:80'],
                'password' => PasswordRules::rules(checkUncompromised: false),
            ],
            PasswordRules::messages(),
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $admin = DB::transaction(function () use ($email, $name, $password): User {
            $user = new User;
            $user->name = $name;
            $user->email = $email;
            $user->password = Hash::make($password);
            $user->role = Role::Admin;
            $user->status = AccountStatus::Active;
            $user->email_verified_at = now();
            $user->save();

            $user->notificationPreference()->create([
                'requests_and_invites' => true,
                'meet_and_greets' => true,
                'post_activity' => true,
                'announcements' => true,
            ]);

            ActivityLogger::log(
                type: ActivityLogType::Account,
                action: 'admin_account_created',
                actor: $user,
                subject: $user,
                before: null,
                after: AccountStatus::Active->value,
                reason: 'Created via pawfolio:create-admin CLI',
            );

            return $user;
        });

        $this->info("Admin account created: {$admin->name} <{$admin->email}> (id: {$admin->id})");

        return self::SUCCESS;
    }
}
