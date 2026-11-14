# First-party research report — template

Use this for anything VYRA publishes from its own data or surveys. **No research has been
conducted. This file contains no findings**, and none may be added to it or to the website
until the data exists.

## Before collecting anything

- [ ] A written question the research is meant to answer.
- [ ] Participants are told what is collected, why, and that results will be published in
      aggregate; consent is recorded and can be withdrawn.
- [ ] For product data: the privacy policy covers this use, and counsel has confirmed it under
      the Digital Personal Data Protection Act, 2023.
- [ ] No sensitive characteristics are collected or inferred.
- [ ] A minimum group size is fixed in advance (suggested: no figure reported for fewer than
      50 people) so that nobody can be identified.

## Report structure

1. **Summary.** Three to five findings, each with its number and the sample it comes from.
2. **Question.** What was asked and why.
3. **Method.** Survey or product data; dates; how people were recruited; the exact questions.
4. **Sample.** Number of people; age bands, gender and city tier as far as known; who is missing.
5. **Findings.** One section each: the result, the base size, a chart with labelled axes.
6. **Limitations.** Self-selection, small or unrepresentative samples, self-report, wording.
7. **What this does not show.** State plainly what should not be concluded.
8. **Data and contact.** Whether aggregate tables are available, and whom to ask.

## Wording rules

- Say "of the N people who answered", never "Indians" or "users in India", unless the sample
  was designed to be representative and a statistician has confirmed it.
- Report base sizes beside every percentage.
- Do not turn a difference into a headline unless it would survive a different sample.
- Correlation is described as correlation.

## Topics worth studying when there are people to ask

How people define a meaningful connection; how they prefer to handle disagreement early on;
what they dislike about swipe-based discovery; how they think about compatibility; how they
prefer to meet in person for the first time.

## Publishing

Add the report as a Learn article with its own entry in `apps/landing/src/content/learn.ts`,
the method and limitations in full, and Article markup. Add a `Dataset` entry only if the
aggregate data is actually published.
