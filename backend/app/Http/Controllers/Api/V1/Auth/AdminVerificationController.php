<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\ApproveVerification;
use App\Actions\Auth\DenyVerification;
use App\Exceptions\VerificationAlreadyReviewed;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\DenyVerificationRequest;
use App\Http\Requests\Auth\VerificationQueueRequest;
use App\Http\Resources\Auth\VerificationQueueItemResource;
use App\Http\Resources\Auth\VerificationReviewResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\ResponseResource;
use App\Models\VerificationSubmission;
use App\Services\Auth\VerificationQueue;
use App\Services\Uploads\FileUploadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin verification: the queue, an account's review, its documents, approve and deny (BE-08, AU-22..AU-26, FR33).
 * Contract: docs/api/auth.md. Admins only, through the route's `role:admin` middleware (SEC-AUTHZ-07).
 */
class AdminVerificationController extends Controller
{
    private const ACCOUNT_NOT_FOUND = "We couldn't find that account.";

    private const DOCUMENT_NOT_FOUND = "We couldn't find that document.";

    public function __construct(
        private readonly VerificationQueue $queue,
    ) {}

    public function index(VerificationQueueRequest $request): ResponseResource
    {
        $paginator = $this->queue
            ->listing($request->role(), $request->search())
            ->with(['user.pet', 'user.homeProfile', 'documents'])
            ->paginate($request->perPage());

        return PaginatedResource::fromPaginator(
            $paginator,
            fn (VerificationSubmission $submission) => (new VerificationQueueItemResource($submission))->toArray($request),
        );
    }

    public function show(Request $request, int $accountId): ResponseResource
    {
        return $this->review($request, $this->latestOrFail($accountId));
    }

    /**
     * The file itself, from the private disk. There is no public URL, signed URL or path for a verification
     * document anywhere in the API (SEC-PRIV-01, SEC-FILE-04).
     */
    public function document(int $accountId, int $documentId): Response
    {
        // Only a document of that account's latest submission; any other answers like one that doesn't exist.
        $document = $this->latestOrFail($accountId)->documents()->whereKey($documentId)->first();
        $allowed = array_key_exists((string) $document?->mime_type, FileUploadService::DOCUMENT_MIMES);

        if ($document === null || ! $allowed || ! Storage::disk('local')->exists($document->file_path)) {
            abort(404, self::DOCUMENT_NOT_FOUND);
        }

        return response(Storage::disk('local')->get($document->file_path), 200, [
            'Content-Type' => $document->mime_type,
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function approve(Request $request, int $accountId, ApproveVerification $approve): ResponseResource|Response
    {
        $this->latestOrFail($accountId);

        try {
            $approve($accountId, $request->user(), $request->userAgent());
        } catch (VerificationAlreadyReviewed $conflict) {
            return ErrorResource::conflict($conflict->getMessage(), VerificationAlreadyReviewed::CODE)->toResponse($request);
        }

        return $this->review($request, $this->latestOrFail($accountId));
    }

    public function deny(DenyVerificationRequest $request, int $accountId, DenyVerification $deny): ResponseResource|Response
    {
        $this->latestOrFail($accountId);

        try {
            $deny($accountId, $request->user(), $request->reason(), $request->messageToOwner(), $request->userAgent());
        } catch (VerificationAlreadyReviewed $conflict) {
            return ErrorResource::conflict($conflict->getMessage(), VerificationAlreadyReviewed::CODE)->toResponse($request);
        }

        return $this->review($request, $this->latestOrFail($accountId));
    }

    /** 404 for an id that doesn't exist, an admin's id, or an account that never submitted (SEC-AUTHZ-04). */
    private function latestOrFail(int $accountId): VerificationSubmission
    {
        return $this->queue->latestFor($accountId) ?? abort(404, self::ACCOUNT_NOT_FOUND);
    }

    private function review(Request $request, VerificationSubmission $submission): ResponseResource
    {
        $submission->load(['user.pet', 'user.homeProfile', 'documents', 'reviewedBy']);

        return ResponseResource::make([
            ...(new VerificationReviewResource($submission))->toArray($request),
            'queue' => $this->queue->positionOf($submission),
        ]);
    }
}
