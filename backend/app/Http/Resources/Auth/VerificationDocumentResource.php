<?php

declare(strict_types=1);

namespace App\Http\Resources\Auth;

use App\Models\VerificationDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A submitted file as admins see it listed: described, never linked. No path, URL or file name (SEC-PRIV-01); the
 * file itself comes from `GET /admin/verifications/{accountId}/documents/{documentId}`.
 *
 * @mixin VerificationDocument
 */
class VerificationDocumentResource extends JsonResource
{
    /** The review needs the id that opens the file; the queue's rows don't carry it. */
    public function __construct(VerificationDocument $resource, private readonly bool $withId = false)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            ...($this->withId ? ['id' => $this->id] : []),
            'document_type' => $this->document_type,
            'id_type' => $this->id_type,
            'mime_type' => $this->mime_type,
            'size_bytes' => (int) $this->size_bytes,
            'uploaded_at' => ($this->created_at ?? now())->toISOString(),
        ];
    }
}
