# Brand authority plan — VYRA

14 November 2026. Being cited by search engines and AI assistants depends far more on what
credible third parties say about VYRA than on anything on VYRA's own site. This is a plan for
earning that honestly. **No outreach has been done and no outlet below has agreed to
anything.** Outlet names are examples of the kind of place to approach, to be researched and
qualified by whoever does the outreach; none is a relationship or an endorsement.

## What VYRA can honestly offer a journalist or community today

| Asset                                                                                   | Why it is worth someone's attention                     | State                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| A compatibility engine that shows its working and says "not enough to say"              | Unusual in a category that sells percentages            | Built; documented at `/compatibility`                    |
| "Ask your AI": a persona from the assistant a person already uses, with no account link | A concrete, privacy-minded answer to a current question | Built; `/ai-persona`                                     |
| A site that labels every feature built, in development or planned                       | A credibility signal that can be checked                | Live in the repo                                         |
| A founder with a point of view on swipe fatigue and AI in dating                        | Interviews and podcasts need a person                   | **Needs the founder's real name, biography and consent** |

Until the app can be used, the story is the approach and the people, not traction. Do not
pitch numbers that do not exist.

## Phases

| Phase              | When                 | Goal                             | Activities                                                                                                                                                                                                           |
| ------------------ | -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Foundations     | Before any outreach  | Be checkable                     | Domain live; reviewed privacy policy and terms; contact address; official profiles created with the canonical description and added to `NEXT_PUBLIC_SAME_AS`; a press page with logo files and a factual boilerplate |
| 1. Own voice       | Pre-launch           | Something to point at            | Founder writing on why and how (own blog, LinkedIn); a build-in-public record; talks at local meetups                                                                                                                |
| 2. Earned mentions | Around a usable beta | Independent descriptions of VYRA | Targeted pitches; podcasts; startup-ecosystem listings; launch platforms                                                                                                                                             |
| 3. Evidence        | After real usage     | Give others something to cite    | First-party research (`research-report-template.md`); a transparent methodology page                                                                                                                                 |
| 4. Listings        | At public release    | Complete the entity              | App Store and Play Store listings; add `SoftwareApplication` markup                                                                                                                                                  |

## Where to look

| Kind                                | Examples to research                                                                      | What they would need                                        | Suitable when                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Indian technology and startup press | YourStory, Inc42, Entrackr, The Ken, Economic Times Tech, Mint                            | A news hook: launch, funding, data, a founder story         | Phase 2                         |
| Consumer technology and culture     | Indian Express Tech, The Hindu's technology pages, Vogue India, Homegrown, The Juggernaut | A human angle on dating fatigue and AI                      | Phase 2–3                       |
| Product launch platforms            | Product Hunt, Peerlist, BetaList                                                          | A working product people can try                            | Phase 2                         |
| Startup directories                 | Crunchbase, Tracxn, Startup India (DPIIT registration, only if registered)                | Accurate company facts                                      | Phase 0–2, once the facts exist |
| Podcasts                            | Indian startup and technology shows; relationship and psychology shows                    | A founder willing to speak, with a clear thesis             | Phase 1–2                       |
| Academic and incubator ecosystems   | The founders' own universities, incubators and accelerators                               | A real affiliation                                          | Only where one truly exists     |
| Researchers                         | Relationship-science and HCI academics                                                    | A genuine question or a dataset; an invitation to criticise | Phase 3                         |
| Communities                         | Indian founder and product communities; relevant subreddits                               | Participation under real names, disclosing the affiliation  | Ongoing                         |
| App directories                     | App Store, Google Play                                                                    | A released app                                              | Phase 4                         |

## Rules

- Never buy reviews, links, upvotes, followers or "guest posts" on link farms.
- Never post about VYRA in a community without saying who you are.
- Never invent a quotation, an expert, a partner, a user or a number.
- No Wikipedia article until independent sources exist that would justify one, and then not
  written by anyone connected to VYRA.
- Directory listings only where the listing is accurate and the directory is one real people
  use. Twenty good ones beat five hundred.
- Paid placements, if ever used, are labelled as paid.
- Describe VYRA with the sentence in `apps/landing/src/lib/entity.ts`, everywhere.

## Tracking

Keep one sheet: date, outlet, contact, pitch, outcome, URL of any resulting mention, whether it
links, and whether the description of VYRA is accurate. Report monthly with the template in
`ai-visibility-benchmark.md`. Correct inaccurate descriptions politely at the source.

## Needs from the product owner before Phase 0 can finish

Legal entity and registration details; founder names and biographies; a production domain; a
monitored contact address; official social handles; a decision on training crawlers.
