<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AdminSection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * When an admin last opened a counted section of the admin sidebar (`admin_section_views`). Written only by
 * `AdminSidebarCounts::markSeen`, with the session's admin and the server's clock; nothing is fillable from a
 * request (SEC-INPUT-04).
 */
class AdminSectionView extends Model
{
    protected $table = 'admin_section_views';

    protected $guarded = ['*'];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'section' => AdminSection::class,
        'seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
