<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/** Replace small validated profile answer lists inside the parent's transaction. */
final class ProfileAnswers
{
    public static function replace(Model $parent, string $name, string $column, array $values): bool
    {
        $values = array_values(array_unique($values));
        $parent->loadMissing($name);
        $current = $parent->getRelation($name)->map(function ($row) use ($column) {
            $value = $row->{$column};

            return $value instanceof \BackedEnum ? $value->value : $value;
        })->all();
        $comparison = $values;
        sort($comparison);
        sort($current);
        if ($current === $comparison) {
            return false;
        }
        $relation = $parent->{$name}();
        $relation->delete();
        if ($values !== []) {
            $now = now()->toDateTimeString();
            $rows = array_map(fn ($value) => [
                $relation->getForeignKeyName() => $parent->getKey(), $column => $value,
                'created_at' => $now, 'updated_at' => $now,
            ], $values);
            $relation->getRelated()->newQuery()->insert($rows);
            $parent->setRelation($name, $relation->get());
        } else {
            $parent->setRelation($name, $relation->getRelated()->newCollection());
        }

        return true;
    }
}
