<?php

namespace App\Models;

use App\Enums\PostType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    use HasFactory;

    protected $table = 'posts';

    protected $fillable = [
        'type',
        'title',
        'body',
    ];

    protected $casts = [
        'id' => 'integer',
        'author_user_id' => 'integer',
        'adopted_pet_id' => 'integer',
        'removed_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(PostPhoto::class)->orderBy('sort_order');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    public function adoptedPet(): BelongsTo
    {
        return $this->belongsTo(Pet::class, 'adopted_pet_id');
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('removed_at')->whereNull('deleted_at');
    }

    public function getPostType(): PostType
    {
        return $this->type instanceof PostType
            ? $this->type
            : (PostType::tryFrom((string) $this->type) ?: PostType::Post);
    }

    public function isAdoptionStory(): bool
    {
        return $this->getPostType() === PostType::AdoptionStory;
    }

    public function isForHire(): bool
    {
        return $this->getPostType() === PostType::ForHire;
    }

    public function isRemoved(): bool
    {
        return $this->removed_at !== null;
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }
}
