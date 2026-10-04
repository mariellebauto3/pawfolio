<?php

namespace App\Models;

use App\Enums\AdoptionAction;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdoptionResolution extends Model
{
    use HasFactory;

    protected $table = 'adoption_resolutions';

    protected $fillable = [
        'action',
        'reason',
    ];

    protected $casts = [
        'id' => 'integer',
        'admin_user_id' => 'integer',
        'pet_id' => 'integer',
        'adoption_request_id' => 'integer',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function getAction(): AdoptionAction
    {
        return $this->action instanceof AdoptionAction
            ? $this->action
            : (AdoptionAction::tryFrom((string) $this->action) ?: AdoptionAction::CloseRequest);
    }
}
