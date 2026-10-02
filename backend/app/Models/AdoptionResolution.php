<?php

namespace App\Models;

use App\Enums\AdoptionAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdoptionResolution extends Model
{
    protected $table = 'adoption_resolutions';

    protected $fillable = [
        'admin_user_id',
        'pet_id',
        'adoption_request_id',
        'action',
        'reason',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'adoption_request_id' => 'integer',
        'admin_user_id' => 'integer',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function adoptionRequest(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function getAction(): AdoptionAction
    {
        return AdoptionAction::tryFrom($this->action) ?: AdoptionAction::CloseRequest;
    }
}
