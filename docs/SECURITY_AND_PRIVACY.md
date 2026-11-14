# Security and privacy

VYRA holds intimate data. Security and privacy requirements are acceptance criteria for every
feature, not a later phase. Target regimes: India's DPDP Act 2023 first, GDPR-compatible by
design for expansion.

## In place now

| Control                                       | Where                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Fail-fast configuration, values never printed | `apps/api/src/config/env.ts` (+ test)                                                                                             |
| Security headers                              | `helmet` in `configure-app.ts` (e2e-tested)                                                                                       |
| CORS allow-list, default deny                 | `CORS_ORIGINS`                                                                                                                    |
| Baseline rate limiting                        | `ThrottlerGuard`, 120/min per IP                                                                                                  |
| Uniform errors, no internal leakage           | `ApiExceptionFilter` (e2e-tested)                                                                                                 |
| Request ids safe against log injection        | `request-id.middleware.ts` (e2e-tested)                                                                                           |
| Parameterised SQL only                        | Prisma; raw queries use tagged templates                                                                                          |
| Integrity rules in the database               | CHECK constraints (see DATABASE_SCHEMA.md)                                                                                        |
| Secrets stored only as hashes                 | Schema design: OTP codes, destinations, refresh tokens                                                                            |
| No secrets in the repository                  | `.env*` git-ignored; `.env.example` holds local dev values only                                                                   |
| Response validation on the client             | `apiGet` parses every response with the shared schema                                                                             |
| Connection actions are IDOR-safe              | Accept/decline only by the recipient, withdraw only by the sender, end only by a participant; anyone else gets `404` (e2e-tested) |
| One visibility rule for other people          | `PeopleService.visiblePair`: blocks, deletion and suspension always hide; leak suite covers Connections                           |
| Notes are plain text                          | ≤ 300 chars, control characters stripped, rendered as text, shown only to sender and recipient                                    |
| Blocks are total and silent                   | End the match, expire requests and remove saves both ways; the other person is not told; audited                                  |
| Pressure limits                               | Pass hides 30 days; decline blocks re-asking 30 days; ≤ 20 pending; 20 requests/min                                               |

## Threat model and planned controls

| Threat                            | Control                                                                                                      | Milestone |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| Account takeover, OTP brute force | Hashed OTPs, attempt caps, per-destination and per-IP limits, short expiry                                   | 2         |
| Token theft                       | Short-lived access JWT, rotating hashed refresh tokens, reuse detection                                      | 2         |
| IDOR / cross-user access          | Ownership checks in services; mandatory "other user's resource" tests                                        | 2 onward  |
| Under-age users                   | Date-of-birth gate at sign-up, CHECK on preferences, report reason                                           | 2         |
| Fake and automated accounts       | OTP on a real channel, rate limits, device and velocity signals                                              | 2, 8      |
| Malicious uploads                 | Type sniffing by content, size caps, re-encode images, strip EXIF/GPS                                        | 2         |
| Media scraping                    | Private bucket, short-lived signed URLs, no enumerable keys                                                  | 2         |
| ZIP bombs / malicious archives    | Isolated worker, caps on entries, per-file and total inflated size, ratio; no path traversal; never executed | 7         |
| Prompt injection via imports      | Content as delimited data, schema-only output, redaction, minimal context                                    | 3, 7      |
| Sensitive-trait inference         | No schema fields, prompt prohibition, post-filter                                                            | 3         |
| Stored XSS                        | Plain-text rendering in the app; output encoding in the admin console                                        | 5, 8      |
| Harassment                        | Messaging only between mutual connections; block, report, moderation queue                                   | 6         |
| AI impersonation                  | Wingman only suggests; every send is an explicit user action                                                 | 6         |
| Profile scraping                  | Authenticated, rate-limited, ranked discovery only — no listing endpoint                                     | 5         |
| Insider access to private data    | Roles, audit log of admin actions, no admin view of imported conversations                                   | 8         |
| Sensitive data in logs            | Structured logs of ids and codes only; no bodies, tokens or content                                          | ongoing   |

## Privacy commitments

- **Consent** is recorded per purpose and policy version in `user_consents`, and is revocable.
  AI processing, imports, photo analysis, astrology and Wingman message context are separate
  opt-ins.
- **Minimisation**: coarse location only; imports keep derived, approved attributes and
  nothing else; raw archives are deleted within 24 hours.
- **Control**: every persona attribute is visible, editable and removable. Account deletion
  and import deletion are self-service.
- **No training** of shared models on private conversations or imported data.
- **Astrology** is opt-in, labelled entertainment, and can be hidden entirely.

## Not yet done

- **No real OTP delivery.** Only the development sender exists; it returns the code in the API
  response. Production cannot boot until an SMS/e-mail adapter is added (O-1).
- **No real object storage.** Photos are on local disk; production cannot boot until an
  S3-compatible adapter is added (O-2).
- **Terms of Service and Privacy Policy do not exist as documents.** The consent screen records
  agreement to version `2026-11`, but there is nothing yet for a person to read. Required
  before any real user signs up.
- **Age verification is self-declared** date of birth only (O-6).
- **Moderation coverage**: the automated classifier detects nudity and sexual content only —
  not violence, weapons, minors, impersonation, hate symbols or text. Those rely on reports and
  human review. Someone must be given the `MODERATOR` role and work the queue; there is no
  admin console yet (API only).
- **Owner-scoped photo URLs** work for anyone who obtains one within its 10-minute lifetime;
  they are only ever sent to the owner.
- **Rate-limit state is per process** (in memory). It needs the Redis store before running
  more than one API instance.
- **The web build keeps the refresh token in `sessionStorage`.** It is a development and QA
  target; a public web app would need HTTP-only cookies instead.
- No automated account-fraud signals, no payment or identity-verification integrations.
- **Gemini provider unverified**: never run against the live API. `AI_PROVIDER=gemini` sends
  redacted profile text to Google; enabling it needs the privacy notice to say so.
- **Queue jobs run inside the API process** by default; `RUN_QUEUE_WORKERS=false` plus
  `node dist/worker.js` separates them.
- A formal security review is scheduled for Milestone 8, with a lighter one each milestone.
