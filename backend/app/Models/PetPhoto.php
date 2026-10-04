<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetPhoto extends Model
{
    protected $table = 'pet_photos';

    protected $fillable = [
        'file_path',
        'caption',
        'sort_order',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'sort_order' => 'integer',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
