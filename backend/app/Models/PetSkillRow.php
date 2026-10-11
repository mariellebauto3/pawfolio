<?php

namespace App\Models;

use App\Enums\PetSkill;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetSkillRow extends Model
{
    protected $table = 'pet_skills';

    protected $fillable = [
        'skill',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'skill' => PetSkill::class,
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
