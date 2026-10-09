<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\CommunityFeed;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AnnouncementAudience;
use App\Enums\PostType;
use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTargetType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Adoption;
use App\Models\Announcement;
use App\Models\Comment;
use App\Models\Post;
use App\Models\Reaction;
use App\Models\Report;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use App\Services\Uploads\FileUploadService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Community feed, posts, adoption stories, comments (1-level replies), reactions, and price/payment keyword flagging (BE-21, FD-01..FD-07).
 */
class CommunityFeedController extends Controller
{
    private const SELLING_KEYWORDS = [
        'for sale',
        'selling',
        'rehoming fee',
        'adoption fee',
        'gcash',
        'paymaya',
        'bank transfer',
        'price:',
        'dm for price',
        'pm for price',
    ];

    /**
     * The author block of each account already written into this answer, by user id: a page of posts and a thread of
     * comments name the same few accounts again and again.
     *
     * @var array<int, array<string, mixed>>
     */
    private array $authorBlocks = [];

    public function __construct(
        private readonly FileUploadService $uploads,
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = Post::query()
            ->visible()
            ->with([
                'author.pet.photos',
                'author.homeProfile',
                'photos',
                'adoptedPet.photos',
            ])
            ->withCount($this->postCounts())
            ->byActiveAuthor()
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $types = array_values(array_filter(explode(',', $request->string('type')->toString())));
            if ($types !== []) {
                $query->whereIn('type', $types);
            }
        }

        if ($request->filled('author_user_id')) {
            $query->where('author_user_id', (int) $request->query('author_user_id'));
        }

        $paginator = $query->paginate($perPage);

        $postIds = $paginator->getCollection()->pluck('id')->all();
        $reactedPostIds = $user && $postIds !== []
            ? Reaction::query()
                ->where('user_id', $user->id)
                ->whereIn('post_id', $postIds)
                ->pluck('post_id')
                ->flip()
            : collect();

        $audiences = [AnnouncementAudience::Everyone->value];
        if ($user->isPet()) {
            $audiences[] = AnnouncementAudience::Pets->value;
        } elseif ($user->isHuman()) {
            $audiences[] = AnnouncementAudience::Humans->value;
        }

        $announcements = Announcement::query()
            ->published()
            ->whereIn('audience', $audiences)
            ->orderByDesc('published_at')
            ->limit(3)
            ->get()
            ->map(fn (Announcement $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'message' => $a->message,
                'audience' => $a->audience()->value,
                'published_at' => $a->published_at?->toISOString(),
            ])
            ->values()
            ->all();

        $items = $paginator->getCollection()
            ->map(fn (Post $post) => $this->formatPost($post, $reactedPostIds->has($post->id), $user))
            ->values()
            ->all();

        return ResponseResource::make(
            data: $items,
            meta: [
                'page' => $paginator->currentPage(),
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'total_pages' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'path' => $paginator->path(),
                'announcements' => $announcements,
            ],
            links: [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
        );
    }

    public function show(Request $request, Post $post)
    {
        $user = $request->user();

        if ($post->isDeleted() || (($post->isRemoved() || ! $this->isByActiveAccount($post->author)) && ! $user->isAdmin())) {
            return ErrorResource::notFound("We couldn't find that post.")->toResponse($request);
        }

        $post->load([
            'author.pet.photos',
            'author.homeProfile',
            'photos',
            'adoptedPet.photos',
        ])->loadCount($this->postCounts());

        $hasReacted = Reaction::query()
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->exists();

        $topComments = Comment::query()
            ->visible()
            ->byActiveAuthor()
            ->with([
                'author.pet.photos',
                'author.homeProfile',
                'replies' => fn ($q) => $q->whereNull('removed_at')->byActiveAuthor()->with(['author.pet.photos', 'author.homeProfile'])->withCount('reactions')->orderBy('created_at'),
            ])
            ->withCount('reactions')
            ->where('post_id', $post->id)
            ->whereNull('parent_comment_id')
            ->orderBy('created_at')
            ->get();

        $allCommentIds = $topComments->pluck('id')
            ->merge($topComments->flatMap(fn (Comment $c) => $c->replies->pluck('id')))
            ->unique()
            ->values()
            ->all();

        $reactedCommentIds = $allCommentIds !== []
            ? Reaction::query()
                ->where('user_id', $user->id)
                ->whereIn('comment_id', $allCommentIds)
                ->pluck('comment_id')
                ->flip()
            : collect();

        $data = $this->formatPost($post, $hasReacted, $user);
        $data['comments'] = $topComments->map(function (Comment $comment) use ($reactedCommentIds, $user): array {
            $row = $this->formatComment($comment, $reactedCommentIds->has($comment->id), $user);
            $row['replies'] = $comment->replies
                ->map(fn (Comment $reply) => $this->formatComment($reply, $reactedCommentIds->has($reply->id), $user))
                ->values()
                ->all();

            return $row;
        })->values()->all();

        return ResponseResource::make($data);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'type' => ['sometimes', 'string', Rule::in([PostType::Post->value, PostType::Update->value])],
            'title' => ['nullable', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:2000'],
            'photos' => ['sometimes', 'array', 'max:4'],
            'photos.*' => ['file'],
        ]);

        $storedPhotos = [];
        if ($request->hasFile('photos')) {
            /** @var list<UploadedFile> $files */
            $files = array_values($request->file('photos', []));
            foreach ($files as $idx => $file) {
                $storedPhotos[] = $this->uploads->storePublicPhoto($file, 'posts/photos', "photos.{$idx}");
            }
        }

        $post = DB::transaction(function () use ($user, $validated, $storedPhotos, $request): Post {
            $post = new Post;
            $post->author_user_id = $user->id;
            $post->type = $validated['type'] ?? ($user->isPet() ? PostType::Update->value : PostType::Post->value);
            $post->title = isset($validated['title']) && trim($validated['title']) !== '' ? trim($validated['title']) : null;
            $post->body = trim($validated['body']);
            $post->save();

            foreach ($storedPhotos as $idx => $meta) {
                $post->photos()->create([
                    'file_path' => $meta['file_path'],
                    'sort_order' => $idx + 1,
                ]);
            }

            $this->flagIfContainsSellingKeywords($post, $user->id);

            ActivityLogger::log(
                type: ActivityLogType::Feed,
                action: 'post_created',
                actor: $user,
                subject: $post,
                userAgent: $request->userAgent(),
            );

            return $post;
        });

        $post->load(['author.pet.photos', 'author.homeProfile', 'photos', 'adoptedPet.photos'])
            ->loadCount($this->postCounts());

        return ResponseResource::created($this->formatPost($post, false, $user));
    }

    public function storeAdoptionStory(Request $request)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile) {
            return ErrorResource::forbidden('Only Furparents can publish an adoption story.')->toResponse($request);
        }

        $validated = $request->validate([
            'adopted_pet_id' => ['required', 'integer', 'exists:pets,id'],
            'title' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:3000'],
            'photos' => ['sometimes', 'array', 'max:4'],
            'photos.*' => ['file'],
        ]);

        $adoptedPetId = (int) $validated['adopted_pet_id'];
        $ownsAdoption = Adoption::query()
            ->where('home_profile_id', $user->homeProfile->id)
            ->where('pet_id', $adoptedPetId)
            ->active()
            ->exists();

        if (! $ownsAdoption) {
            return ErrorResource::forbidden('You can only write an adoption story for a pet you adopted on Pawfolio.')->toResponse($request);
        }

        $storedPhotos = [];
        if ($request->hasFile('photos')) {
            /** @var list<UploadedFile> $files */
            $files = array_values($request->file('photos', []));
            foreach ($files as $idx => $file) {
                $storedPhotos[] = $this->uploads->storePublicPhoto($file, 'posts/stories', "photos.{$idx}");
            }
        }

        $post = DB::transaction(function () use ($user, $adoptedPetId, $validated, $storedPhotos, $request): Post {
            $post = new Post;
            $post->author_user_id = $user->id;
            $post->adopted_pet_id = $adoptedPetId;
            $post->type = PostType::AdoptionStory->value;
            $post->title = trim($validated['title']);
            $post->body = trim($validated['body']);
            $post->save();

            foreach ($storedPhotos as $idx => $meta) {
                $post->photos()->create([
                    'file_path' => $meta['file_path'],
                    'sort_order' => $idx + 1,
                ]);
            }

            ActivityLogger::log(
                type: ActivityLogType::Feed,
                action: 'adoption_story_created',
                actor: $user,
                subject: $post,
                userAgent: $request->userAgent(),
            );

            return $post;
        });

        $post->load(['author.pet.photos', 'author.homeProfile', 'photos', 'adoptedPet.photos'])
            ->loadCount($this->postCounts());

        return ResponseResource::created($this->formatPost($post, false, $user));
    }

    public function update(Request $request, Post $post)
    {
        $user = $request->user();

        if ($post->author_user_id !== $user->id || $post->isDeleted() || $post->isRemoved()) {
            return ErrorResource::forbidden('You can only edit your own active posts.')->toResponse($request);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:3000'],
        ]);

        if (array_key_exists('title', $validated)) {
            $post->title = $validated['title'] !== null && trim($validated['title']) !== '' ? trim($validated['title']) : null;
        }
        $post->body = trim($validated['body']);
        $post->save();

        $this->flagIfContainsSellingKeywords($post, $user->id);

        $post->load(['author.pet.photos', 'author.homeProfile', 'photos', 'adoptedPet.photos'])
            ->loadCount($this->postCounts());

        // An edit changes the words only: the author's own like stays as it was.
        $hasReacted = Reaction::query()
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->exists();

        return ResponseResource::make($this->formatPost($post, $hasReacted, $user));
    }

    public function destroy(Request $request, Post $post)
    {
        $user = $request->user();

        if ($post->author_user_id !== $user->id && ! $user->isAdmin()) {
            return ErrorResource::forbidden('You can only delete your own posts.')->toResponse($request);
        }

        $post->deleted_at = now();
        $post->save();

        ActivityLogger::log(
            type: ActivityLogType::Feed,
            action: 'post_deleted',
            actor: $user,
            subject: $post,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::make(['deleted' => true]);
    }

    public function storeComment(Request $request, Post $post)
    {
        $user = $request->user();

        if ($this->isClosedToMembers($post)) {
            return ErrorResource::notFound("We couldn't find that post.")->toResponse($request);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
            'parent_comment_id' => ['nullable', 'integer'],
        ]);

        $parentId = null;
        if (! empty($validated['parent_comment_id'])) {
            $parent = Comment::query()
                ->visible()
                ->byActiveAuthor()
                ->where('post_id', $post->id)
                ->find((int) $validated['parent_comment_id']);

            if (! $parent) {
                return ErrorResource::notFound('Parent comment not found.')->toResponse($request);
            }

            if ($parent->parent_comment_id !== null) {
                throw ValidationException::withMessages([
                    'parent_comment_id' => ['Replies can only be added to top-level comments.'],
                ]);
            }

            $parentId = $parent->id;
        }

        $comment = new Comment;
        $comment->post_id = $post->id;
        $comment->user_id = $user->id;
        $comment->parent_comment_id = $parentId;
        $comment->body = trim($validated['body']);
        $comment->save();

        // Notify post author if someone else commented and post_activity notifications are enabled.
        if ($post->author_user_id !== $user->id && $post->author) {
            $prefs = $post->author->notificationPreference;
            if (! $prefs || $prefs->shouldPostActivity()) {
                $this->notifications->store(
                    recipient: $post->author,
                    type: 'post_comment',
                    title: "{$user->displayName()} commented on your post",
                    body: mb_substr($comment->body, 0, 140),
                    data: [
                        'category' => 'Feed',
                        'post_id' => $post->id,
                        'comment_id' => $comment->id,
                        'link' => "/posts/{$post->id}",
                    ],
                    urgency: 'info',
                    actionUrl: "/posts/{$post->id}",
                );
            }
        }

        $comment->load(['author.pet.photos', 'author.homeProfile'])->loadCount('reactions');

        return ResponseResource::created($this->formatComment($comment, false, $user));
    }

    public function destroyComment(Request $request, Comment $comment)
    {
        $user = $request->user();

        if ($comment->user_id !== $user->id && $comment->post?->author_user_id !== $user->id && ! $user->isAdmin()) {
            return ErrorResource::forbidden('You can only delete your own comments.')->toResponse($request);
        }

        $comment->removed_at = now();
        $comment->save();

        return ResponseResource::make(['deleted' => true]);
    }

    public function togglePostReaction(Request $request, Post $post)
    {
        $user = $request->user();

        if ($this->isClosedToMembers($post)) {
            return ErrorResource::notFound("We couldn't find that post.")->toResponse($request);
        }

        $existing = Reaction::query()
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $reacted = false;
        } else {
            $reaction = new Reaction;
            $reaction->user_id = $user->id;
            $reaction->post_id = $post->id;
            $reaction->save();
            $reacted = true;
        }

        $count = Reaction::query()->where('post_id', $post->id)->count();

        return ResponseResource::make([
            'reacted' => $reacted,
            'reactions_count' => $count,
        ]);
    }

    public function toggleCommentReaction(Request $request, Comment $comment)
    {
        $user = $request->user();

        // A like needs a comment that is still listed: on a post that is still open, by an account that is still Active.
        if ($comment->removed_at !== null || ! $this->isByActiveAccount($comment->author) || $comment->post === null || $this->isClosedToMembers($comment->post)) {
            return ErrorResource::notFound('Comment not found.')->toResponse($request);
        }

        $existing = Reaction::query()
            ->where('user_id', $user->id)
            ->where('comment_id', $comment->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $reacted = false;
        } else {
            $reaction = new Reaction;
            $reaction->user_id = $user->id;
            $reaction->comment_id = $comment->id;
            $reaction->save();
            $reacted = true;
        }

        $count = Reaction::query()->where('comment_id', $comment->id)->count();

        return ResponseResource::make([
            'reacted' => $reacted,
            'reactions_count' => $count,
        ]);
    }

    private function flagIfContainsSellingKeywords(Post $post, int $authorUserId): void
    {
        $haystack = mb_strtolower(($post->title ?? '').' '.$post->body);
        $matchedKeyword = null;

        foreach (self::SELLING_KEYWORDS as $keyword) {
            if (str_contains($haystack, $keyword)) {
                $matchedKeyword = $keyword;
                break;
            }
        }

        if ($matchedKeyword === null && preg_match('/(₱|\bphp\s*\d|\b\d[\d,]*\s*pesos\b)/iu', $haystack)) {
            $matchedKeyword = 'currency_amount';
        }

        if ($matchedKeyword === null) {
            return;
        }

        $alreadyFlagged = Report::query()
            ->where('post_id', $post->id)
            ->where('status', ReportStatus::Open->value)
            ->exists();

        if (! $alreadyFlagged) {
            $report = new Report;
            $report->reporter_user_id = $authorUserId;
            $report->reported_user_id = $authorUserId;
            $report->target_type = ReportTargetType::Post->value;
            $report->post_id = $post->id;
            $report->reason = ReportReason::SellingOrTradingAnimals->value;
            $report->details = "Auto-flagged by keyword check ({$matchedKeyword}).";
            $report->status = ReportStatus::Open->value;
            $report->save();
        }
    }

    /** Whether the account that wrote a post or a comment is Active. A suspended or deactivated one's words are hidden (SEC-ABUSE-04, SEC-PRIV-05). */
    private function isByActiveAccount(?User $author): bool
    {
        return $author !== null && $author->getStatus() === AccountStatus::Active;
    }

    /** A post nobody can comment on or like any more: deleted, removed by an admin, or by an account that isn't Active. */
    private function isClosedToMembers(Post $post): bool
    {
        return $post->isDeleted() || $post->isRemoved() || ! $this->isByActiveAccount($post->author);
    }

    /**
     * The two counts every post carries. A comment counts while it can be read on the post's page (FD-05): not once
     * it is removed, not while its author's account isn't Active, and not a reply whose comment is hidden for either
     * reason, since that reply is no longer listed.
     *
     * @return array<int|string, mixed>
     */
    private function postCounts(): array
    {
        return [
            'reactions',
            'comments as comments_count' => fn ($q) => $q
                ->whereNull('removed_at')
                ->byActiveAuthor()
                ->where(fn ($visible) => $visible
                    ->whereNull('parent_comment_id')
                    ->orWhereHas('parent', fn ($parent) => $parent->whereNull('removed_at')->byActiveAuthor())),
        ];
    }

    /**
     * Who wrote a post or a comment, as the feed names them (FD-01, FD-05): the name and photo, and the public line
     * under the name: a pet's breed and city, a human's city and Furparent label (SEC-PRIV-03). `is_profile_viewable`
     * is the profile's own policy, so a name links to a resume or a Home Profile only when this viewer may open it:
     * a Draft isn't linked, nor a home whose Open to Adopt is off (SEC-AUTHZ-04).
     *
     * @return array<string, mixed>|null
     */
    private function formatAuthor(?User $author, User $viewer): ?array
    {
        if ($author === null) {
            return null;
        }

        if (isset($this->authorBlocks[$author->id])) {
            return $this->authorBlocks[$author->id];
        }

        $pet = $author->isPet() ? $author->pet : null;
        $home = $author->isHuman() ? $author->homeProfile : null;
        $profile = $pet ?? $home;

        return $this->authorBlocks[$author->id] = [
            'id' => $author->id,
            'role' => $author->getRole()->value,
            'display_name' => $author->displayName(),
            'avatar_url' => $author->avatarUrl(),
            'profile_id' => $author->profileId(),
            'breed' => $pet?->breed,
            'city' => $profile?->city,
            'is_furparent' => $home?->isFurparent() ?? false,
            'is_profile_viewable' => $profile !== null && $viewer->can('view', $profile),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatPost(Post $post, bool $hasReacted, User $viewer): array
    {
        return [
            'id' => $post->id,
            'type' => $post->getPostType()->value,
            'title' => $post->title,
            'body' => $post->body,
            'author' => $this->formatAuthor($post->author, $viewer),
            'adopted_pet' => $post->adoptedPet ? PetResource::summary($post->adoptedPet) : null,
            'photos' => $post->photos->map(fn ($p) => [
                'id' => $p->id,
                'url' => Storage::disk('public')->url($p->file_path),
                'sort_order' => $p->sort_order,
            ])->values()->all(),
            'reactions_count' => (int) ($post->reactions_count ?? 0),
            'comments_count' => (int) ($post->comments_count ?? 0),
            'has_reacted' => $hasReacted,
            'created_at' => $post->created_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatComment(Comment $comment, bool $hasReacted, User $viewer): array
    {
        return [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'parent_comment_id' => $comment->parent_comment_id,
            'body' => $comment->body,
            'author' => $this->formatAuthor($comment->author, $viewer),
            'reactions_count' => (int) ($comment->reactions_count ?? 0),
            'has_reacted' => $hasReacted,
            'created_at' => $comment->created_at?->toISOString(),
        ];
    }
}
