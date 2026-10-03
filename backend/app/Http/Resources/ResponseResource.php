<?php

namespace App\Http\Resources;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
    ) {
    }

    public static function item(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links);
    }

    public static function collection(mixed $data, array $meta = [], array $links = []): self
    {
        return new self($data, $meta, $links);
    }

    public function toResponse($request): JsonResponse
    {
        if (is_iterable($this->data) && !($this->data instanceof \Illuminate\Contracts\Support\Arrayable)) {
            $data = array_map(fn ($item) => $item instanceof Responsable ? $item->toResponse($request)->getData(true) : $item, $this->data);
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

        return response()->json($body);
    }
}
