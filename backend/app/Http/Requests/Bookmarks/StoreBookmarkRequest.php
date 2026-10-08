<?php

declare(strict_types=1);

namespace App\Http\Requests\Bookmarks;

use App\Models\Bookmark;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of `POST /bookmarks` (BM-03, FR8, FR23): the one profile to save. A human sends `pet_id` and a pet sends
 * `home_profile_id`; the other field is refused, so a human can't save a home or a pet another pet.
 */
class StoreBookmarkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Bookmark::class) ?? false;
    }

    public function rules(): array
    {
        [$saved, $refused] = $this->user()->isHuman() ? ['pet_id', 'home_profile_id'] : ['home_profile_id', 'pet_id'];

        return [
            $saved => ['required', 'integer', 'min:1'],
            $refused => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'pet_id.required' => 'Choose a pet to bookmark.',
            'pet_id.integer' => 'Choose a pet to bookmark.',
            'pet_id.min' => 'Choose a pet to bookmark.',
            'pet_id.prohibited' => 'A pet bookmarks Home Profiles, not other pets.',
            'home_profile_id.required' => 'Choose a Home Profile to bookmark.',
            'home_profile_id.integer' => 'Choose a Home Profile to bookmark.',
            'home_profile_id.min' => 'Choose a Home Profile to bookmark.',
            'home_profile_id.prohibited' => 'A human bookmarks pets, not Home Profiles.',
        ];
    }

    /** The pet a human is saving; null for a pet account. */
    public function petId(): ?int
    {
        return $this->user()->isHuman() ? (int) $this->validated('pet_id') : null;
    }

    /** The home a pet is saving; null for a human. */
    public function homeProfileId(): ?int
    {
        return $this->user()->isHuman() ? null : (int) $this->validated('home_profile_id');
    }
}
