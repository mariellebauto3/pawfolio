<?php

namespace App\Models;

use App\Enums\PostType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    protected $table = 'posts';

    protected $fillable = [
        'author_user_id',
        'type',
        'title',
        'body',
        'adopted_pet_id',
        'removed_at',
        'deleted_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'author_user_id' => 'integer',
        'adopted_pet_id' => 'integer',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(PostPhoto::class);
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

    public function getPostType(): PostType
    {
        return PostType::tryFrom($this->type) ?: PostType::Post;
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
