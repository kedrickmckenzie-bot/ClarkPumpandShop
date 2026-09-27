# Email and routine follow-ups

The operator inbox is **Work → Email inbox**. Manual email capture works without a provider. Original text, reported dates and private attachments stay with the intake record. Linking an email adds a work note or creates a normal store request in the same transaction. A reported date never creates a confirmed appointment automatically.

## Receiving with Resend

Use the existing Resend account's receiving address or a configured receiving domain. Forward the maintenance mailbox there and subscribe an `email.received` webhook to `/api/integrations/email/resend`.

Set these server environment variables:

- `EMAIL_API_KEY`: a Resend API key with permission to read received messages.
- `OPS_RESEND_RECEIVING_SECRET`: the webhook signing secret.
- `OPS_EMAIL_INBOX_ADDRESS`: the exact receiving address allowed for this deployment.
- `OPS_EMAIL_INGRESS_ORGANIZATION_ID`: the tenant owning that address.
- Configure private R2 or S3 storage using the existing file-storage settings.

The endpoint verifies the signature and timestamp before calling the provider. It retrieves the text and attachments, checks the destination address, and uses provider-computed DMARC results for automatic routing. Only an exact company work-order reference plus the active vendor's dispatch address can auto-link a reply. A verified new message with one exact store number in the subject can create a request. Other messages wait for an operator.

Set `EMAIL_REPLY_TO` to the receiving address so vendor replies return to intake. No mailbox, domain, webhook, credentials or live delivery has been configured by this implementation.

Provider references: [received email API](https://resend.com/docs/api-reference/emails/retrieve-received-email), [attachment API](https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment), [webhook signature format](https://docs.svix.com/receiving/verifying-payloads/how-manual).

Limits: 30,000 characters of text; five PDF, JPEG, PNG, WebP or text attachments; 8 MB total. Failed provider/storage retrieval returns a retryable response. Review delivery attempts in the provider dashboard. Unsupported/oversized messages require manual capture; the endpoint does not silently drop attachments. Local preview uploads reset with the process.

## Other mailbox adapters

`POST /api/integrations/email` accepts a normalized JSON envelope with `messageKey`, `sender`, `subject`, `body`, optional `reportedDate`, optional `senderVerified`, and optional `attachments` (`name`, `mediaType`, `base64`). The adapter must verify sender authentication before setting `senderVerified`; the default is false. It must preserve the original message key across retries.

Configure `OPS_EMAIL_INGRESS_SECRET` (at least 32 random characters) and the organization variable above. Headers are `x-email-timestamp` (Unix seconds) and `x-email-signature` (hex HMAC-SHA256 of `timestamp.rawBody`). Five-minute tolerance; constant-time cryptographic verification; no tenant ID is accepted from the payload.

The one-mailbox deployment boundary is deliberate. Multi-tenant mailbox provisioning needs a durable, authenticated mailbox-to-tenant registry before enabling multiple addresses.

## Routine follow-ups

In **Setup → Notification delivery**, choose Off, daily, every two days or weekly. Off is the default. Run `npm run jobs:postgres` from the existing scheduled worker to create reminders and deliver through the configured email provider. Frequency is anchored to each action's due date. The local **Queue a preview cycle** action creates outbox entries without sending email.

The worker checks due actions, passed confirmed appointments without arrival evidence, and work awaiting store verification. Recipients follow active assignment/task membership and store scope; unresolved recipient configuration appears as a delivery failure. After two intervals, the existing escalation command flags unresolved work at its recorded destination. Maintenance receives the escalated routine reminder; separate escalation notification rules control additional recipients.

Every delivery rechecks work state, active assignment, current policy and version. Changed/resolved work or disabled reminders suppress stale messages. A transactional fence prevents duplicate reminders in a due-date/frequency window; provider idempotency protects retries. Existing SLA escalation remains a separate policy.

## Evidence rules

Cost prompts show source records; they never promise savings or prove a charge is invalid. Repeated work is equipment history, not inferred downtime. Vendor service reporting keeps unobserved arrivals separate. “Confirmed callbacks” requires rejected completion followed by another recorded visit from that vendor. Cost medians require five recorded, completed, single-provider jobs grouped by category, equipment make/model, part, priority and planned/reactive work. Missing and mixed-provider data remain visible; scope/parts differences still require review.
