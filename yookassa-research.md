# YooKassa integration research

| Topic | Verified requirement |
|---|---|
| Server SDK | YooKassa officially lists PHP and Python server SDKs. The documented Node.js option is community-maintained `@a2seven/yoo-checkout`; YooKassa does not verify third-party SDK code. |
| API auth | Standard merchants use HTTP Basic Auth with Shop ID and Secret Key. |
| Idempotency | POST and DELETE requests require `Idempotence-Key`; YooKassa recommends UUID v4 and retains an idempotency key for 24 hours. |
| Recurring charge | The initial payment must request saved payment method. The application stores only payment method ID and creates each future charge server-side. |
| Webhooks | YooKassa sends `payment.succeeded`, `payment.canceled`, and `payment.waiting_for_capture`. The endpoint must return HTTP 200; non-2xx responses retry for 24 hours. |
| Webhook authenticity | YooKassa does not provide a Stripe-like signature header. Verify the reported payment by fetching it from YooKassa and checking expected metadata/amount/status; optionally restrict to the documented YooKassa IP ranges only behind a trusted proxy. |

## Sources

- https://yookassa.ru/developers/using-api/using-sdks
- https://yookassa.ru/developers/using-api/interaction-format
- https://yookassa.ru/developers/using-api/webhooks
