<?php

namespace App\Mail;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as HttpFactory;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\MessageConverter;

/**
 * Sends mail through Brevo's HTTPS API (`POST /v3/smtp/email`, port 443). Render's free plan blocks outbound SMTP
 * (ports 25, 465 and 587), so Brevo's SMTP relay can't be reached from there (ADR 0007).
 */
class BrevoTransport extends AbstractTransport
{
    public const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

    public function __construct(
        private readonly HttpFactory $http,
        #[\SensitiveParameter] private readonly string $key,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());
        if ($email->getAttachments() !== []) {
            throw new TransportException('The Brevo transport does not send attachments.');
        }
        $from = $email->getFrom()[0] ?? throw new TransportException('The email has no sender.');

        $payload = array_filter([
            'sender' => $this->address($from),
            'to' => array_map($this->address(...), $email->getTo()),
            'cc' => array_map($this->address(...), $email->getCc()),
            'bcc' => array_map($this->address(...), $email->getBcc()),
            'replyTo' => isset($email->getReplyTo()[0]) ? $this->address($email->getReplyTo()[0]) : null,
            'subject' => $email->getSubject(),
            'htmlContent' => $this->body($email->getHtmlBody()),
            'textContent' => $this->body($email->getTextBody()),
        ], fn ($value) => $value !== null && $value !== []);

        try {
            $response = $this->http->withHeaders(['api-key' => $this->key])
                ->acceptJson()->connectTimeout(3)->timeout(10)
                ->post(self::ENDPOINT, $payload);
        } catch (ConnectionException $exception) {
            throw new TransportException('Brevo could not be reached.', 0, $exception);
        }

        // Only the status and Brevo's error code are kept: the body may repeat the recipient (SEC-LOG-03).
        if (! $response->successful()) {
            $code = $response->json('code');
            throw new TransportException('Brevo refused the email (HTTP '.$response->status().(is_string($code) ? ", {$code}" : '').').');
        }

        $messageId = $response->json('messageId');
        if (is_string($messageId)) {
            $message->setMessageId($messageId);
        }
    }

    public function __toString(): string
    {
        return 'brevo+api://api.brevo.com';
    }

    /** @return array{email: string, name?: string} */
    private function address(Address $address): array
    {
        return array_filter(['email' => $address->getAddress(), 'name' => $address->getName()], fn ($value) => $value !== '');
    }

    /** @param resource|string|null $body */
    private function body(mixed $body): ?string
    {
        return is_resource($body) ? stream_get_contents($body) : $body;
    }
}
