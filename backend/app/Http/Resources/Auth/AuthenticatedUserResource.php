<?php

namespace App\Http\Resources\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shape for GET /api/v1/auth/me and POST /auth/sign-in (docs/api/auth.md).
 *
 * Fields match frontend/src/types/account.ts and the mock personas: id, role, status,
 * email, display_name (pet name / human full name / admin name), avatar_url, profile_id
 * (pet id for pets, home profile id for humans, null for admins). No contact details or
 * documents (NFR4).
 */
class AuthenticatedUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->resource->getRole()->value,
            'status' => $this->resource->getStatus()->value,
            'email' => $this->email,
            'display_name' => $this->resource->displayName(),
            'avatar_url' => $this->resource->avatarUrl(),
            'profile_id' => $this->resource->profileId(),
        ];
    }
}
