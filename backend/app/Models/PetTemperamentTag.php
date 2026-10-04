<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetTemperamentTag extends Model
{
    protected $table = 'pet_temperament_tags';

    protected $fillable = [
        'tag',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
