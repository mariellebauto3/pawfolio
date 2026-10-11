<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\SignUpHuman;
use App\Actions\Auth\SignUpPet;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SignUpHumanRequest;
use App\Http\Requests\Auth\SignUpPetRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Http\Resources\ErrorResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignUpController extends Controller
{
    private const ALREADY_SIGNED_IN = "You're already signed in. Log out to create another account.";

    public function signUpPet(Request $rawRequest, SignUpPet $signUpPet): JsonResponse
    {
        if ($rawRequest->user() !== null) {
            return ErrorResource::forbidden(self::ALREADY_SIGNED_IN)->toResponse($rawRequest);
        }

        $formRequest = app(SignUpPetRequest::class);
        $user = $signUpPet($formRequest);

        return (new AuthenticatedUserResource($user))
            ->toResponse($rawRequest)
            ->setStatusCode(201);
    }

    public function signUpHuman(Request $rawRequest, SignUpHuman $signUpHuman): JsonResponse
    {
        if ($rawRequest->user() !== null) {
            return ErrorResource::forbidden(self::ALREADY_SIGNED_IN)->toResponse($rawRequest);
        }

        $formRequest = app(SignUpHumanRequest::class);
        $user = $signUpHuman($formRequest);

        return (new AuthenticatedUserResource($user))
            ->toResponse($rawRequest)
            ->setStatusCode(201);
    }
}
