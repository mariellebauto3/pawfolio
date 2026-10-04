<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostPhoto extends Model
{
    use HasFactory;

    protected $table = 'post_photos';

    protected $fillable = [
        'file_path',
        'sort_order',
    ];

    protected $casts = [
        'id' => 'integer',
        'post_id' => 'integer',
        'sort_order' => 'integer',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
