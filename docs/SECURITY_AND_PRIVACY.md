# Security and privacy

VYRA holds intimate data. Security and privacy requirements are acceptance criteria for every
feature, not a later phase. Target regimes: India's DPDP Act 2023 first, GDPR-compatible by
design for expansion.

## In place now (Milestone 1)

| Control                                       | Where                                                           |
| --------------------------------------------- | --------------------------------------------------------------- |
| Fail-fast configuration, values never printed | `apps/api/src/config/env.ts` (+ test)                           |
| Security headers                              | `helmet` in `configure-app.ts` (e2e-tested)                     |
| CORS allow-list, default deny                 | `CORS_ORIGINS`                                                  |
| Baseline rate limiting                        | `ThrottlerGuard`, 120/min per IP                                |
| Uniform errors, no internal leakage           | `ApiExceptionFilter` (e2e-tested)                               |
| Request ids safe against log injection        | `request-id.middleware.ts` (e2e-tested)                         |
| Parameterised SQL only                        | Prisma; raw queries use tagged templates                        |
| Integrity rules in the database               | CHECK constraints (see DATABASE_SCHEMA.md)                      |
| Secrets stored only as hashes                 | Schema design: OTP codes, destinations, refresh tokens          |
| No secrets in the repository                  | `.env*` git-ignored; `.env.example` holds local dev values only |
| Response validation on the client             | `apiGet` parses every response with the shared schema           |

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

Authentication and authorisation do not exist yet, so no user data endpoint exists either.
Production payment, identity verification, SMS/e-mail delivery and object storage are not
integrated; they will be built behind interfaces with local fakes and only called "working"
after a real call succeeds. A formal security review is scheduled for Milestone 8, with a
lighter review at the end of each milestone.
