<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetVetRecord extends Model
{
    protected $table = 'pet_vet_records';

    protected $fillable = [
        'file_path',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'size_bytes' => 'integer',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
