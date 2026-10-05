<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\AcceptedSpecies;
use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLevel;
use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\AnnouncementAudience;
use App\Enums\HomeType;
use App\Enums\HoursAway;
use App\Enums\HouseholdMember;
use App\Enums\MeetAndGreetStatus;
use App\Enums\MeetGreetPlaceType;
use App\Enums\OutdoorSpace;
use App\Enums\PetEnergyLevel;
use App\Enums\PetExperience;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetStatus;
use App\Enums\PetTimeAlone;
use App\Enums\PostType;
use App\Enums\PreferredAgeGroup;
use App\Enums\PreferredSize;
use App\Enums\Role;
use App\Enums\SpecialNeedsWillingness;
use App\Enums\VerificationDocumentType;
use App\Enums\VerificationSubmissionStatus;
use App\Models\AccountAction;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Announcement;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use App\Models\VerificationDocument;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Local/development demo seeder covering all roles, account statuses, pet statuses, and request lifecycle states (BE-09).
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder must never run in production.');
        }

        $passwordHash = Hash::make('password');

        // 1. Admin persona
        $admin = User::query()->where('email', 'admin@example.com')->first();
        if (! $admin) {
            $admin = new User;
            $admin->name = 'admin.jess';
            $admin->email = 'admin@example.com';
            $admin->password = $passwordHash;
            $admin->role = Role::Admin;
            $admin->status = AccountStatus::Active;
            $admin->email_verified_at = now();
            $admin->save();
            $admin->createNotificationPreference();
        }

        // 2. Active Pet — Mochi (Looking for a Home)
        [$mochiUser, $mochi] = $this->upsertPetAccount(
            email: 'mochi@example.com',
            name: 'Mochi',
            accountStatus: AccountStatus::Active,
            petStatus: PetStatus::LookingForAHome,
            species: 'dog',
            breed: 'Aspin',
            ageMonths: 24,
            city: 'Quezon City',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: true,
        );

        // 3. Active Pet — Bantay (In Process)
        [$bantayUser, $bantay] = $this->upsertPetAccount(
            email: 'bantay@example.com',
            name: 'Bantay',
            accountStatus: AccountStatus::Active,
            petStatus: PetStatus::InProcess,
            species: 'dog',
            breed: 'Aspin Mix',
            ageMonths: 36,
            city: 'Pasig',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: true,
        );

        // 4. Active Pet — Luna (Adopted / Hired)
        [$lunaUser, $luna] = $this->upsertPetAccount(
            email: 'luna@example.com',
            name: 'Luna',
            accountStatus: AccountStatus::Active,
            petStatus: PetStatus::AdoptedHired,
            species: 'cat',
            breed: 'Puspin',
            ageMonths: 18,
            city: 'Makati',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: true,
        );

        // 5. Active Pet — Draft resume
        $this->upsertPetAccount(
            email: 'pebbles@example.com',
            name: 'Pebbles',
            accountStatus: AccountStatus::Active,
            petStatus: PetStatus::Draft,
            species: 'cat',
            breed: 'Puspin',
            ageMonths: 6,
            city: 'Taguig',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: false,
        );

        // 6. Pending Verification Pet — Kulit
        $this->upsertPetAccount(
            email: 'kulit@example.com',
            name: 'Kulit',
            accountStatus: AccountStatus::PendingVerification,
            petStatus: PetStatus::Draft,
            species: 'cat',
            breed: 'Puspin',
            ageMonths: 8,
            city: 'Pasig',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: false,
        );

        // 7. Suspended Pet — Biscuit
        [$biscuitUser] = $this->upsertPetAccount(
            email: 'biscuit@example.com',
            name: 'Biscuit',
            accountStatus: AccountStatus::Suspended,
            petStatus: PetStatus::Draft,
            species: 'dog',
            breed: 'Shih Tzu',
            ageMonths: 14,
            city: 'Manila',
            province: 'Metro Manila',
            passwordHash: $passwordHash,
            completeResume: false,
        );
        if (! $biscuitUser->accountActions()->exists()) {
            $aa = new AccountAction;
            $aa->user_id = $biscuitUser->id;
            $aa->performed_by_user_id = $admin->id;
            $aa->action = AccountActionEnum::Suspend->value;
            $aa->reason = 'Listing contained a price request, which violates our adoption-only policy.';
            $aa->save();
        }

        // 8. Active Humans (Ana Santos, Cruz Family, Garcia Home)
        [$anaUser, $anaHome] = $this->upsertHumanAccount(
            email: 'ana.santos@example.com',
            fullName: 'Ana Santos',
            accountStatus: AccountStatus::Active,
            city: 'Quezon City',
            province: 'Metro Manila',
            openToAdopt: true,
            completedQuiz: true,
            passwordHash: $passwordHash,
        );

        [$cruzUser, $cruzHome] = $this->upsertHumanAccount(
            email: 'cruz@example.com',
            fullName: 'Marco Cruz',
            accountStatus: AccountStatus::Active,
            city: 'Pasig',
            province: 'Metro Manila',
            openToAdopt: true,
            completedQuiz: true,
            passwordHash: $passwordHash,
        );

        [$garciaUser, $garciaHome] = $this->upsertHumanAccount(
            email: 'garcia@example.com',
            fullName: 'Elena Garcia',
            accountStatus: AccountStatus::Active,
            city: 'Makati',
            province: 'Metro Manila',
            openToAdopt: true,
            completedQuiz: true,
            passwordHash: $passwordHash,
        );

        // 9. Pending Verification Human — Bea Navarro
        $this->upsertHumanAccount(
            email: 'bea.navarro@example.com',
            fullName: 'Bea Navarro',
            accountStatus: AccountStatus::PendingVerification,
            city: 'Marikina',
            province: 'Metro Manila',
            openToAdopt: false,
            completedQuiz: false,
            passwordHash: $passwordHash,
        );

        // 10. Denied Human — Carla Mendoza
        [$carlaUser] = $this->upsertHumanAccount(
            email: 'carla.mendoza@example.com',
            fullName: 'Carla Mendoza',
            accountStatus: AccountStatus::Denied,
            city: 'Mandaluyong',
            province: 'Metro Manila',
            openToAdopt: false,
            completedQuiz: false,
            passwordHash: $passwordHash,
            denialReason: 'id_photo_unreadable',
            denialMessage: "The ID photo is blurry and the name can't be read. Please upload a clearer photo.",
        );

        // 11. Deactivated Human — Jun Reyes
        [$junUser] = $this->upsertHumanAccount(
            email: 'jun.reyes@example.com',
            fullName: 'Jun Reyes',
            accountStatus: AccountStatus::Deactivated,
            city: 'San Juan',
            province: 'Metro Manila',
            openToAdopt: false,
            completedQuiz: false,
            passwordHash: $passwordHash,
        );

        // 12. Calculate compatibility match scores
        $calculator = app(MatchScoreCalculator::class);
        $calculator->recalculateForPet($mochi);
        $calculator->recalculateForPet($bantay);

        // 13. Invite to Apply (Ana -> Mochi)
        if (! Invite::query()->where('pet_id', $mochi->id)->where('home_profile_id', $anaHome->id)->exists()) {
            $inv = new Invite;
            $inv->pet_id = $mochi->id;
            $inv->home_profile_id = $anaHome->id;
            $inv->note = "We'd love to welcome Mochi into our home in Quezon City!";
            $inv->save();
        }

        // 14. Adoption requests across lifecycle states
        // Sent request: Mochi -> Marco Cruz
        if (! AdoptionRequest::query()->where('pet_id', $mochi->id)->where('home_profile_id', $cruzHome->id)->exists()) {
            $arSent = new AdoptionRequest;
            $arSent->pet_id = $mochi->id;
            $arSent->home_profile_id = $cruzHome->id;
            $arSent->status = AdoptionRequestStatus::Sent->value;
            $arSent->cover_letter = 'Hi Marco! I am Mochi, a gentle and potty-trained Aspin who loves daily walks and quiet evenings with family.';
            $arSent->caretaker_notes = 'Up to date on 5-in-1 and anti-rabies vaccines.';
            $arSent->sent_at = now()->subDays(2);
            $arSent->expires_at = now()->addDays(12);
            $arSent->save();
        }

        // Approved / MeetScheduled request: Bantay -> Ana Santos
        if (! AdoptionRequest::query()->where('pet_id', $bantay->id)->where('home_profile_id', $anaHome->id)->exists()) {
            $arMeet = new AdoptionRequest;
            $arMeet->pet_id = $bantay->id;
            $arMeet->home_profile_id = $anaHome->id;
            $arMeet->status = AdoptionRequestStatus::MeetScheduled->value;
            $arMeet->cover_letter = 'Hello Ana! I am Bantay, an affectionate and leash-trained companion looking for an active household.';
            $arMeet->approval_message = "We'd love to meet Bantay this weekend!";
            $arMeet->sent_at = now()->subDays(5);
            $arMeet->approved_at = now()->subDays(3);
            $arMeet->meet_scheduled_at = now()->subDay();
            $arMeet->save();

            $slot = new MeetGreetSlot;
            $slot->home_profile_id = $anaHome->id;
            $slot->starts_at = now()->addDays(2)->setHour(10)->setMinute(0);
            $slot->place_type = MeetGreetPlaceType::PublicSpot->value;
            $slot->place_details = 'UP Diliman Academic Oval';
            $slot->save();

            $mg = new MeetAndGreet;
            $mg->adoption_request_id = $arMeet->id;
            $mg->meet_greet_slot_id = $slot->id;
            $mg->status = MeetAndGreetStatus::Confirmed->value;
            $mg->booked_at = now()->subDays(2);
            $mg->confirmed_at = now()->subDay();
            $mg->save();
        }

        // Adopted requests & alumni records, newest first. Luna -> Elena Garcia is the LoFi's; the other three give
        // the landing page's Recently Hired gallery (AU-01) and the admin alumni list more than one pet to show.
        $this->seedAdoption(
            pet: $luna,
            home: $garciaHome,
            adoptedDaysAgo: 10,
            coverLetter: 'Hi Elena! I am Luna, a calm indoor Puspin who loves sunny windowsills and quiet company.',
        );

        $alumni = [
            ['choco.jr@example.com', 'Choco Jr.', 'dog', 'Aspin', 30, 'Pasig', $cruzHome, 16, 'Hi Marco! I am Choco Jr., a cheerful Aspin who loves morning walks and already knows sit and stay.'],
            ['brownie@example.com', 'Brownie', 'dog', 'Beagle Mix', 48, 'Pasig', $cruzHome, 25, 'Hi Marco! I am Brownie, a gentle Beagle mix who gets along with other dogs and naps through the afternoon.'],
            ['pancit@example.com', 'Pancit', 'cat', 'Puspin', 14, 'Makati', $garciaHome, 38, 'Hi Elena! I am Pancit, a curious Puspin who is litter trained and happy to share a home with another cat.'],
        ];

        foreach ($alumni as [$email, $name, $species, $breed, $ageMonths, $city, $home, $adoptedDaysAgo, $coverLetter]) {
            [, $alumnus] = $this->upsertPetAccount(
                email: $email,
                name: $name,
                accountStatus: AccountStatus::Active,
                petStatus: PetStatus::AdoptedHired,
                species: $species,
                breed: $breed,
                ageMonths: $ageMonths,
                city: $city,
                province: 'Metro Manila',
                passwordHash: $passwordHash,
                completeResume: true,
            );

            $this->seedAdoption($alumnus, $home, $adoptedDaysAgo, $coverLetter);
        }

        // 15. Community post & Announcement
        if (! Post::query()->where('author_user_id', $mochiUser->id)->exists()) {
            $post = new Post;
            $post->author_user_id = $mochiUser->id;
            $post->type = PostType::ForHire->value;
            $post->title = 'Mochi is Looking for a Home!';
            $post->body = 'Hi everyone! My résumé is live and I am looking for a loving home in Metro Manila.';
            $post->save();
        }

        if (! Announcement::query()->exists()) {
            $ann = new Announcement;
            $ann->admin_user_id = $admin->id;
            $ann->title = 'Welcome to Pawfolio!';
            $ann->message = 'Every adoption on Pawfolio is free — selling or rehoming fees are strictly prohibited.';
            $ann->audience = AnnouncementAudience::Everyone->value;
            $ann->publish_at = now();
            $ann->published_at = now();
            $ann->save();
        }

        $this->storeSampleIds();

        ActivityLogger::log(
            type: ActivityLogType::System,
            action: 'demo_seed_completed',
            actor: null,
            reason: 'Seeded local demo dataset',
        );
    }

    /**
     * @return array{0: User, 1: Pet}
     */
    private function upsertPetAccount(
        string $email,
        string $name,
        AccountStatus $accountStatus,
        PetStatus $petStatus,
        string $species,
        string $breed,
        int $ageMonths,
        string $city,
        string $province,
        string $passwordHash,
        bool $completeResume,
    ): array {
        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $user = new User;
            $user->name = $name;
            $user->email = $email;
            $user->password = $passwordHash;
            $user->role = Role::Pet;
            $user->status = $accountStatus;
            $user->terms_accepted_at = now();
            $user->email_verified_at = $accountStatus === AccountStatus::Active ? now() : null;
            $user->save();
            $user->createNotificationPreference();
        }

        $pet = $user->pet;
        if (! $pet) {
            $pet = new Pet;
            $pet->user_id = $user->id;
        }

        $pet->name = $name;
        $pet->species = $species;
        $pet->breed = $breed;
        $pet->approximate_age_months = $ageMonths;
        $pet->currently_at = 'Foster home';
        $pet->city = $city;
        $pet->province = $province;
        $pet->caretaker_name = 'Caretaker '.$name;
        $pet->caretaker_contact_number = '09171234567';
        $pet->status = $petStatus;

        if ($completeResume) {
            $pet->sex = PetSex::Female;
            $pet->size = PetSize::Medium;
            $pet->bio = "Hi! I'm {$name}, an affectionate and well-socialized {$breed} who loves spending time with family and learning new tricks.";
            $pet->energy_level = PetEnergyLevel::Medium;
            $pet->good_with_kids = PetGoodWith::Yes;
            $pet->good_with_dogs = PetGoodWith::Yes;
            $pet->good_with_cats = PetGoodWith::Yes;
            $pet->time_alone = PetTimeAlone::UpTo4Hrs;
            $pet->space_needs = PetSpaceNeeds::ApartmentOk;
            $pet->experience_needed = PetExperienceNeeded::FirstTimeOk;
            $pet->health_notes = 'Vaccinated, dewormed, and spayed/neutered.';
            $pet->published_at = $pet->published_at ?? now()->subDays(7);
        }

        $pet->save();

        if ($pet->photos()->count() === 0) {
            $count = $completeResume ? 3 : 1;
            for ($i = 1; $i <= $count; $i++) {
                $pet->photos()->create([
                    'file_path' => "pets/photos/demo-{$pet->id}-{$i}.jpg",
                    'caption' => "{$name} photo {$i}",
                    'sort_order' => $i,
                ]);
            }
        }

        $this->storeDemoPhotos($pet, $species);

        if ($completeResume && $pet->temperamentTags()->count() === 0) {
            foreach (['Friendly', 'Gentle', 'Playful'] as $tag) {
                $pet->temperamentTags()->create(['tag' => $tag]);
            }
        }

        if (! $user->verificationSubmissions()->exists()) {
            $sub = new VerificationSubmission;
            $sub->user_id = $user->id;
            $sub->status = $accountStatus === AccountStatus::Active
                ? VerificationSubmissionStatus::Approved->value
                : VerificationSubmissionStatus::Pending->value;
            $sub->submitted_at = now()->subDays(3);
            $sub->reviewed_at = $accountStatus === AccountStatus::Active ? now()->subDays(2) : null;
            $sub->save();

            $sub->documents()->create([
                'document_type' => VerificationDocumentType::ValidId->value,
                'file_path' => "verification/ids/demo-user-{$user->id}.jpg",
                'mime_type' => 'image/jpeg',
                'size_bytes' => 124000,
            ]);
        }

        return [$user, $pet];
    }

    /**
     * Puts a sample photo behind each demo photo row, so resumes and the landing page have pictures to show.
     * The files in database/seeders/assets/pets are stock photos (see the README there), not real Pawfolio pets
     * (SEC-PRIV-06).
     */
    private function storeDemoPhotos(Pet $pet, string $species): void
    {
        $kind = $species === 'cat' ? 'cat' : 'dog';

        foreach ($pet->photos()->orderBy('sort_order')->get() as $photo) {
            if (! str_starts_with($photo->file_path, 'pets/photos/demo-') || Storage::disk('public')->exists($photo->file_path)) {
                continue;
            }

            // Three samples per kind, started at a different one for each pet.
            $sample = (($pet->id + $photo->sort_order) % 3) + 1;
            Storage::disk('public')->put(
                $photo->file_path,
                (string) file_get_contents(database_path("seeders/assets/pets/{$kind}-{$sample}.jpg")),
            );
        }
    }

    /**
     * A finished adoption: the Adopted request, the alumni record, and the human's Furparent date.
     */
    private function seedAdoption(Pet $pet, HomeProfile $home, int $adoptedDaysAgo, string $coverLetter): void
    {
        if (Adoption::query()->where('pet_id', $pet->id)->exists()) {
            return;
        }

        $adoptedAt = now()->subDays($adoptedDaysAgo);

        $request = new AdoptionRequest;
        $request->pet_id = $pet->id;
        $request->home_profile_id = $home->id;
        $request->status = AdoptionRequestStatus::Adopted->value;
        $request->cover_letter = $coverLetter;
        $request->sent_at = now()->subDays($adoptedDaysAgo + 10);
        $request->approved_at = now()->subDays($adoptedDaysAgo + 7);
        $request->meet_scheduled_at = now()->subDays($adoptedDaysAgo + 4);
        $request->awaiting_decision_at = now()->subDays($adoptedDaysAgo + 1);
        $request->closed_at = $adoptedAt;
        $request->save();

        // A Furparent since their first adoption.
        if ($home->furparent_at === null || $adoptedAt->lt($home->furparent_at)) {
            $home->furparent_at = $adoptedAt;
            $home->save();
        }

        $adoption = new Adoption;
        $adoption->pet_id = $pet->id;
        $adoption->home_profile_id = $home->id;
        $adoption->adoption_request_id = $request->id;
        $adoption->adopted_at = $adoptedAt;
        $adoption->save();
    }

    /**
     * @return array{0: User, 1: HomeProfile}
     */
    private function upsertHumanAccount(
        string $email,
        string $fullName,
        AccountStatus $accountStatus,
        string $city,
        string $province,
        bool $openToAdopt,
        bool $completedQuiz,
        string $passwordHash,
        ?string $denialReason = null,
        ?string $denialMessage = null,
    ): array {
        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $user = new User;
            $user->name = $fullName;
            $user->email = $email;
            $user->password = $passwordHash;
            $user->role = Role::Human;
            $user->status = $accountStatus;
            $user->terms_accepted_at = now();
            $user->email_verified_at = $accountStatus === AccountStatus::Active ? now() : null;
            $user->save();
            $user->createNotificationPreference();
        }

        $home = $user->homeProfile;
        if (! $home) {
            $home = new HomeProfile;
            $home->user_id = $user->id;
        }

        $home->full_name = $fullName;
        $home->birthdate = '1994-05-15';
        $home->contact_number = '09181234567';
        $home->city = $city;
        $home->province = $province;
        $home->street_address = '123 Sampaguita St.';
        $home->headline = 'Warm, pet-loving household ready to adopt';
        $home->about_home = 'Quiet residential home with a fenced yard and remote-work schedule.';
        $home->is_open_to_adopt = $openToAdopt;

        if ($completedQuiz) {
            $home->home_type = HomeType::House->value;
            $home->outdoor_space = OutdoorSpace::SmallYard->value;
            $home->activity_level = ActivityLevel::Moderate->value;
            $home->hours_away = HoursAway::ThreeToFive->value;
            $home->pet_experience = PetExperience::Experienced->value;
            $home->special_needs_willingness = SpecialNeedsWillingness::Yes->value;
            $home->quiz_completed_at = $home->quiz_completed_at ?? now()->subDays(5);
        }

        $home->save();

        if ($completedQuiz) {
            if ($home->householdMembers()->count() === 0) {
                $home->householdMembers()->create(['member' => HouseholdMember::Partner->value]);
            }
            if ($home->acceptedSpecies()->count() === 0) {
                $home->acceptedSpecies()->create(['species' => AcceptedSpecies::Dog->value]);
                $home->acceptedSpecies()->create(['species' => AcceptedSpecies::Cat->value]);
            }
            if ($home->preferredSizes()->count() === 0) {
                $home->preferredSizes()->create(['size' => PreferredSize::Small->value]);
                $home->preferredSizes()->create(['size' => PreferredSize::Medium->value]);
            }
            if ($home->preferredAges()->count() === 0) {
                $home->preferredAges()->create(['age_group' => PreferredAgeGroup::Adult->value]);
            }
        }

        if (! $user->verificationSubmissions()->exists()) {
            $sub = new VerificationSubmission;
            $sub->user_id = $user->id;
            $sub->status = match ($accountStatus) {
                AccountStatus::Active => VerificationSubmissionStatus::Approved->value,
                AccountStatus::Denied => VerificationSubmissionStatus::Denied->value,
                default => VerificationSubmissionStatus::Pending->value,
            };
            $sub->submitted_at = now()->subDays(3);
            $sub->reviewed_at = in_array($accountStatus, [AccountStatus::Active, AccountStatus::Denied], true) ? now()->subDays(2) : null;
            $sub->denial_reason = $denialReason;
            $sub->message_to_owner = $denialMessage;
            $sub->save();

            $sub->documents()->create([
                'document_type' => VerificationDocumentType::ValidId->value,
                'id_type' => 'umid',
                'file_path' => "verification/ids/demo-user-{$user->id}.jpg",
                'mime_type' => 'image/jpeg',
                'size_bytes' => 145000,
            ]);
        }

        return [$user, $home];
    }

    /**
     * Puts a picture behind each demo ID, so the admin's document viewer (AU-23, AU-24) has something to open.
     * It is drawn here and says it is a sample: no real ID is ever used as seed data (SEC-PRIV-06).
     */
    private function storeSampleIds(): void
    {
        $documents = VerificationDocument::query()
            ->where('file_path', 'like', 'verification/ids/demo-user-%')
            ->with(['submission.user.pet', 'submission.user.homeProfile'])
            ->get();

        foreach ($documents as $document) {
            if (Storage::disk('local')->exists($document->file_path)) {
                continue;
            }

            $owner = $document->submission?->user;
            $name = $owner?->isPet() ? ($owner->pet?->caretaker_name ?? 'Caretaker') : ($owner?->displayName() ?: 'Account holder');

            $card = imagecreatetruecolor(640, 400);
            $ink = imagecolorallocate($card, 31, 41, 55);
            imagefilledrectangle($card, 0, 0, 639, 399, imagecolorallocate($card, 243, 244, 246));
            imagefilledrectangle($card, 0, 0, 639, 69, imagecolorallocate($card, 52, 64, 196));
            imagestring($card, 5, 24, 26, 'SAMPLE ID  -  NOT A REAL DOCUMENT', imagecolorallocate($card, 255, 255, 255));
            imagefilledrectangle($card, 24, 100, 203, 329, imagecolorallocate($card, 209, 213, 219));
            imagestring($card, 5, 232, 110, 'Name', $ink);
            imagestring($card, 5, 232, 134, mb_strtoupper($name), $ink);
            imagestring($card, 5, 232, 190, 'ID number', $ink);
            imagestring($card, 5, 232, 214, '0000-0000-0000', $ink);
            imagestring($card, 3, 24, 356, 'Pawfolio demo data', $ink);

            ob_start();
            imagejpeg($card, null, 85);
            $jpeg = (string) ob_get_clean();
            imagedestroy($card);

            Storage::disk('local')->put($document->file_path, $jpeg);
            $document->size_bytes = strlen($jpeg);
            $document->save();
        }
    }
}
