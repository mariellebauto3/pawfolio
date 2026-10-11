<?php

namespace App\Models;

use App\Enums\PetSpecialNeed;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetSpecialNeedRow extends Model
{
    protected $table = 'pet_special_needs';

    protected $fillable = [
        'need',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'need' => PetSpecialNeed::class,
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
