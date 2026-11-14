# AI visibility benchmark — VYRA

A repeatable manual test of whether AI search products mention, cite and correctly describe
VYRA. **No baseline has been recorded: the site is not deployed.** Run the first round two to
four weeks after launch and monthly after that.

## How to run it

1. Use a fresh, signed-out or temporary session on each product, with web search switched on
   where that is a setting. Note the model or mode shown.
2. Paste each prompt exactly as written. Do not add hints, the brand name (except in the brand
   prompts) or follow-up nudges.
3. Record what appears. A mention is the name in the answer. A citation is a link to a VYRA
   URL among the sources.
4. Save a screenshot or the exported answer for each row.
5. Do not re-run a prompt until it gives a better answer. Record the first one.

Answers vary between runs and people. One result is an observation, not a ranking. Never
report "VYRA is recommended by ChatGPT" on the strength of a test.

## Products

ChatGPT (search on) · Google AI Overviews and AI Mode · Gemini · Microsoft Copilot ·
Perplexity · Claude (search on).

## Prompts

| #   | Type     | Prompt                                                                   |
| --- | -------- | ------------------------------------------------------------------------ |
| B1  | Brand    | What is VYRA?                                                            |
| B2  | Brand    | How does VYRA use AI?                                                    |
| B3  | Brand    | Is VYRA an AI dating app?                                                |
| B4  | Brand    | Is VYRA available to download?                                           |
| C1  | Category | What are some AI-powered relationship discovery platforms?               |
| C2  | Category | What are alternatives to swipe-based dating?                             |
| C3  | Category | Which dating apps in India match people on personality or compatibility? |
| T1  | Topic    | How can someone understand compatibility beyond profile photos?          |
| T2  | Topic    | What makes two people compatible in a relationship?                      |
| T3  | Topic    | How can AI help users understand their communication preferences?        |
| T4  | Topic    | Should I share my ChatGPT conversations with a dating app?               |
| T5  | Topic    | What makes online dating safer in India?                                 |

Keep the set fixed so that months can be compared. Add prompts at the end; never reword one.

## Record

| Date | Product and mode | Prompt | Mentioned? | Cited? | URL cited | Others named | Description accurate? | Notes |
| ---- | ---------------- | ------ | ---------- | ------ | --------- | ------------ | --------------------- | ----- |
|      |                  |        |            |        |           |              |                       |       |

Accuracy: **correct** (category and status right), **partly** (for example, called a swipe
app, or said to be available), **wrong**. For anything wrong, note what and check whether a
page on the site could have caused it.

## Measurement framework

Track the three groups separately. A crawler visit is not a citation, and a citation is not a
sign-up.

| Group              | Metric                                                            | Source                                                           | Baseline |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| Traditional search | Indexed pages                                                     | Search Console, Bing Webmaster Tools                             | Not live |
|                    | Impressions, clicks, CTR, average position                        | Search Console Performance                                       | Not live |
|                    | Organic sign-up intent (`cta_click`, `cta = enter_vyra`) and rate | GA4                                                              | Not live |
| AEO / GEO          | Prompts with a mention, out of 12 per product                     | This benchmark                                                   | Not run  |
|                    | Prompts with a citation, and which URLs                           | This benchmark                                                   | Not run  |
|                    | Cited pages and grounding queries in Copilot                      | Bing Webmaster Tools AI Performance, if available on the account | Not live |
|                    | AI referral sessions (`ai_referral` by `ai_source`)               | GA4                                                              | Not live |
|                    | Sign-up intent from AI referrals                                  | GA4, sessions with `ai_referral`                                 | Not live |
|                    | Branded versus non-branded prompts with a mention                 | This benchmark (B versus C and T)                                | Not run  |
|                    | Search and AI crawler visits by crawler                           | Host logs, `crawler_visit`                                       | Not live |
| Brand authority    | Genuine external mentions                                         | Outreach sheet, alerts                                           | 0        |
|                    | Referring domains of real quality                                 | Bing Webmaster Tools, Search Console links                       | 0        |
|                    | Editorial citations; partner references                           | Outreach sheet                                                   | 0        |

## Monthly report

```
VYRA search and AI visibility — <month year>

1. Traditional search
   Indexed pages:            (previous: )
   Impressions / clicks / CTR / position:
   Top queries:
   Organic sign-up intent and rate:

2. AEO / GEO
   Benchmark run on <date>: mentions __/72, citations __/72
   By product:
   URLs cited:
   Accuracy problems found, and what was done:
   AI referral sessions by source:
   Crawler visits by crawler (visits only, not citations):

3. Brand authority
   New genuine mentions (with links):
   Outreach sent / replies / published:

4. Changes made to the site this month:
5. Next month:
```
