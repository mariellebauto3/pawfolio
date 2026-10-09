<?php

namespace App\Models;

use App\Enums\AccountStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    use HasFactory;

    protected $table = 'comments';

    protected $fillable = [
        'body',
    ];

    protected $casts = [
        'id' => 'integer',
        'post_id' => 'integer',
        'user_id' => 'integer',
        'parent_comment_id' => 'integer',
        'removed_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_comment_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_comment_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('removed_at');
    }

    /**
     * Written by an account that is Active. A suspended or deactivated account's words are hidden with its profile
     * (SEC-ABUSE-04, SEC-PRIV-05); nothing is deleted, so they are back when the account is.
     */
    public function scopeByActiveAuthor($query)
    {
        return $query->whereHas('author', fn ($author) => $author->where('status', AccountStatus::Active->value));
    }

    public function getRemovedAt(): ?\DateTimeInterface
    {
        return $this->removed_at;
    }
}
