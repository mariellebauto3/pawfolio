<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Closure;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Helper to format a LengthAwarePaginator into standard `{ data, meta, links }` JSON.
 */
class PaginatedResource
{
    public static function fromPaginator(LengthAwarePaginator $paginator, ?Closure $mapper = null): ResponseResource
    {
        $items = $paginator->getCollection();
        if ($mapper !== null) {
            $items = $items->map($mapper);
        }

        return ResponseResource::paginated($paginator, $items->values()->all());
    }
}
