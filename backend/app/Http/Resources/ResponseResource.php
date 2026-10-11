<?php

namespace App\Http\Resources;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

/**
 * Standard success body: `{ "data": … }` (single item) or `{ "data": […], "meta": {…}, "links": {…} }` (list).
 *
 * Matches docs/api/README.md.
 */
class ResponseResource implements Responsable
{
    public function __construct(
        public readonly mixed $data,
        public readonly array $meta = [],
        public readonly array $links = [],
        public readonly int $status = 200,
    ) {}

    public static function item(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links, 200);
    }

    public static function make(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links, 200);
    }

    public static function created(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links, 201);
    }

    public static function collection(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links, 200);
    }

    public static function paginated(LengthAwarePaginator $paginator, array $items): self
    {
        return new self(
            data: $items,
            meta: [
                'page' => $paginator->currentPage(),
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'total_pages' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'path' => $paginator->path(),
            ],
            links: [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
            status: 200,
        );
    }

    public function toResponse($request): JsonResponse
    {
        if (is_iterable($this->data) && ! ($this->data instanceof Arrayable) && ! is_array($this->data)) {
            $items = [];
            foreach ($this->data as $item) {
                $items[] = $item instanceof Responsable ? $item->toResponse($request)->getData(true) : $item;
            }
            $data = $items;
        } elseif (is_array($this->data) && array_is_list($this->data)) {
            $data = array_map(
                fn ($item) => $item instanceof Responsable ? $item->toResponse($request)->getData(true) : $item,
                $this->data,
            );
        } elseif ($this->data instanceof Arrayable) {
            $data = $this->data->toArray();
        } else {
            $data = $this->data instanceof Responsable ? $this->data->toResponse($request)->getData(true) : $this->data;
        }

        $body = ['data' => $data];

        if ($this->meta !== []) {
            $body['meta'] = $this->meta;
        }

        if ($this->links !== []) {
            $body['links'] = $this->links;
        }

        return response()->json($body, $this->status);
    }
}
