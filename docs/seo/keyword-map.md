# Keyword map — VYRA website

Status: a working hypothesis, 14 November 2026. **No search-volume or difficulty data was
available** (no keyword-tool access from the development environment). Intent was checked by
reading what currently ranks for a handful of queries. Before investing in content beyond the
pages that exist, confirm volumes for India in Google Keyword Planner or Search Console.

## What the search results showed

| Query checked                                                         | What ranks today                                                                                                           | What it means for VYRA                                                                                                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "AI dating app"                                                       | A mix of three different things: AI matchmakers, AI "wingman" reply generators, and AI companion chatbots, plus listicles  | The term is ambiguous. VYRA is the first kind only. Copy says "suggests people" and "explains every suggestion" so the page is not mistaken for a companion or a reply bot |
| "relationship compatibility app / personality based dating app India" | Indian matchmaking products that claim multi-dimension compatibility, psychometric-test apps, and many thin location pages | Real commercial intent in the target market, and competitors already talk about "dimensions". VYRA's distinct angle is that the working is shown and unknowns are admitted |
| "what makes two people compatible in a relationship"                  | Advice articles and listicles ("10 signs of…") from relationship-advice sites                                              | Informational intent. A product page cannot win this alone. `/compatibility` answers it honestly in one section; a real article belongs in a future `/journal`             |
| "dating app without swiping"                                          | Round-ups of alternatives, plus apps positioning against swiping                                                           | Comparison intent. Worth a clear statement on the home and features pages; do not write a competitor round-up that claims VYRA is best                                     |

## Page-to-keyword map

One primary intent per page; no two pages compete for the same one.

| Page                 | Primary intent (candidate phrase)                                | Secondary                                                                                                        | Search intent              |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `/`                  | AI dating app · dating app based on compatibility                | dating beyond swiping · meaningful connections app                                                               | Navigational / commercial  |
| `/features`          | dating app features · dating app without swiping                 | shared interest dating · relationship discovery                                                                  | Commercial                 |
| `/how-it-works`      | how VYRA works · how an AI dating app works                      | dating app onboarding · find meaningful connections online                                                       | Informational              |
| `/ai-persona`        | AI dating profile / AI persona · use ChatGPT for dating profile  | AI relationship assistant · personality-based dating                                                             | Informational / commercial |
| `/compatibility`     | relationship compatibility app · how compatibility is calculated | what makes two people compatible · communication compatibility · how AI can help with relationship compatibility | Informational              |
| `/safety`            | dating app safety · dating app privacy                           | delete dating app data · AI privacy in dating apps                                                               | Informational / trust      |
| `/about`             | VYRA (brand) · about VYRA                                        | relationship discovery platform                                                                                  | Navigational               |
| `/contact`           | VYRA contact (brand)                                             | —                                                                                                                | Navigational               |
| `/privacy`, `/terms` | Not targeted; noindex while drafts                               | —                                                                                                                | —                          |

## How the phrases are used

- Each primary phrase, or a natural form of it, appears in the title or description and once
  in the opening text. Headings are written for readers; several contain no keyword at all.
- Long-tail questions are answered where they honestly belong: "What makes two people
  compatible?" is the first chapter of `/compatibility`, and "How can AI help with relationship
  compatibility?" is answered in that page's questions, as is "Is a higher number a better
  relationship?".
- No superlatives. The site never says best, most accurate, or largest, and makes no claim
  about outcomes, because there is no data to support one.

## Gaps worth filling later (not built: thin pages were avoided)

| Idea                                             | Intent        | Needs                                                                                              |
| ------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| `/journal/what-makes-two-people-compatible`      | Informational | A properly sourced article; `articleJsonLd()` is ready                                             |
| `/journal/how-personality-affects-relationships` | Informational | Citations to research, written or reviewed by an expert                                            |
| `/journal/dating-beyond-swiping`                 | Informational | An honest account, not a competitor take-down                                                      |
| Hindi and other Indian-language versions         | All           | Real translations; add the locale to `locales` in `src/lib/site.ts` and hreflang follows           |
| City pages                                       | Local         | Not recommended until there are real members in a city; doorway pages would be thin and misleading |

## Sources consulted

- [Is AI match-making the answer to the crisis of dating? — Dazed](https://www.dazeddigital.com/life-culture/article/70801/1/is-ai-match-making-the-answer-to-the-crisis-of-dating)
- [Sitch wants to fuse human personality and AI for matchmaking — TechCrunch](https://techcrunch.com/2025/06/25/sitch-wants-to-fuse-human-personality-and-ai-for-matchmaking)
- [Teaser AI, Iris, Blush: apps claim to make online dating easier — Bloomberg](https://www.bloomberg.com/news/articles/2023-08-09/teaser-ai-iris-blush-apps-claim-to-make-online-dating-easier)
- [Using AI to predict compatible relationships online — IndiaAI](https://indiaai.gov.in/article/shunning-age-old-system-of-matchmaking-and-using-ai-to-predict-compatible-relationships-online)
- [Most popular dating apps in India in 2026 — Zartek](https://www.zartek.in/most-popular-dating-apps-in-india/)
- [What is compatibility in a relationship — eharmony](https://www.eharmony.com/dating-advice/dating/compatibility-relationship)
- [10 strong signs of compatibility in relationships — Marriage.com](https://www.marriage.com/advice/relationship/relationship-compatibility/)
- [Opinion: swiping was revolutionary, now it's holding us back — DatingNews](https://www.datingnews.com/apps-and-sites/opinion-swiping-was-revolutionary-now-its-holding-us-back/)
