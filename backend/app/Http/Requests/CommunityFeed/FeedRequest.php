<?php

declare(strict_types=1);

namespace App\Http\Requests\CommunityFeed;

use App\Enums\PostType;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Pagination\Cursor;
use Illuminate\Validation\Rule;

class FeedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'pagination' => ['sometimes', Rule::in(['page', 'cursor'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,50'],
            'author_user_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'type' => ['bail', 'sometimes', 'nullable', 'string', 'max:160', function (string $attribute, mixed $value, Closure $fail): void {
                if (array_diff(explode(',', $value), array_column(PostType::cases(), 'value')) !== []) {
                    $fail('Choose a listed post type.');
                }
            }],
            'include_home' => ['sometimes', 'boolean'],
            'cursor' => ['bail', 'sometimes', 'nullable', 'string', 'max:2048', function (string $attribute, mixed $value, Closure $fail): void {
                if ($value === null || $value === '') {
                    return;
                }
                $decoded = json_decode(base64_decode(strtr($value, '-_', '+/'), true) ?: '', true);
                if (! is_array($decoded)
                    || ! isset($decoded['created_at'], $decoded['id'], $decoded['_pointsToNextItems'])
                    || ! is_string($decoded['created_at'])
                    || ! preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?$/', $decoded['created_at'])
                    || strtotime($decoded['created_at']) === false
                    || (! is_int($decoded['id']) && ! (is_string($decoded['id']) && ctype_digit($decoded['id'])))
                    || filter_var($decoded['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false
                    || $decoded['_pointsToNextItems'] !== true) {
                    $fail('Choose a valid feed cursor.');
                }
            }],
        ];
    }

    public function feedCursor(): ?Cursor
    {
        return $this->filled('cursor') ? Cursor::fromEncoded($this->string('cursor')->toString()) : null;
    }
}
