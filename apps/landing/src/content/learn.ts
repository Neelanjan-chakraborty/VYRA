/**
 * The Learn library. Each article answers one question, cites what it relies
 * on, and says what is not known. Rules for anything added here:
 *
 * - Every factual claim about research names a source in `references`, and
 *   every reference is a real, checked publication (DOIs resolve at doi.org).
 * - No statistics about VYRA's members: there are none to report yet.
 * - Articles are written by the VYRA team and say so. No expert byline or
 *   review is claimed, because none has been verified.
 * - One article per distinct question. Do not add near-duplicates.
 */
export type Block =
  | { readonly p: string }
  | { readonly list: readonly string[] }
  | {
      readonly table: {
        readonly head: readonly string[];
        readonly rows: readonly (readonly string[])[];
      };
    }
  | { readonly example: { readonly title: string; readonly text: string } };

export interface Reference {
  readonly id: string;
  readonly citation: string;
  readonly url: string;
}

export interface Article {
  readonly slug: string;
  /** The page's H1: the question it answers. */
  readonly question: string;
  readonly metaTitle: string;
  readonly description: string;
  /** Shown first on the page. Complete and understandable on its own. */
  readonly answer: string;
  readonly kicker: string;
  readonly published: string;
  readonly updated: string;
  readonly sections: readonly { readonly heading: string; readonly blocks: readonly Block[] }[];
  /** How VYRA's product relates to the topic. Kept separate from the general explanation. */
  readonly vyra: { readonly heading: string; readonly paragraphs: readonly string[] };
  readonly faq: readonly { readonly q: string; readonly a: string }[];
  readonly references: readonly Reference[];
  readonly productLinks: readonly { readonly href: string; readonly label: string }[];
  readonly related: readonly string[];
}

const REF = {
  finkel2012: {
    id: 'finkel2012',
    citation:
      'Finkel, E. J., Eastwick, P. W., Karney, B. R., Reis, H. T., & Sprecher, S. (2012). Online dating: A critical analysis from the perspective of psychological science. Psychological Science in the Public Interest, 13(1), 3–66.',
    url: 'https://doi.org/10.1177/1529100612436522',
  },
  joel2017: {
    id: 'joel2017',
    citation:
      'Joel, S., Eastwick, P. W., & Finkel, E. J. (2017). Is romantic desire predictable? Machine learning applied to initial romantic attraction. Psychological Science, 28(10), 1478–1489.',
    url: 'https://doi.org/10.1177/0956797617714580',
  },
  joel2020: {
    id: 'joel2020',
    citation:
      'Joel, S., Eastwick, P. W., Allison, C. J., Arriaga, X. B., et al. (2020). Machine learning uncovers the most robust self-report predictors of relationship quality across 43 longitudinal couples studies. Proceedings of the National Academy of Sciences, 117(32), 19061–19071.',
    url: 'https://doi.org/10.1073/pnas.1917036117',
  },
  montoya2008: {
    id: 'montoya2008',
    citation:
      'Montoya, R. M., Horton, R. S., & Kirchner, J. (2008). Is actual similarity necessary for attraction? A meta-analysis of actual and perceived similarity. Journal of Social and Personal Relationships, 25(6), 889–922.',
    url: 'https://doi.org/10.1177/0265407508096700',
  },
  dyrenforth2010: {
    id: 'dyrenforth2010',
    citation:
      'Dyrenforth, P. S., Kashy, D. A., Donnellan, M. B., & Lucas, R. E. (2010). Predicting relationship and life satisfaction from personality in nationally representative samples from three countries: The relative importance of actor, partner, and similarity effects. Journal of Personality and Social Psychology, 99(4), 690–702.',
    url: 'https://doi.org/10.1037/a0020385',
  },
  malouff2010: {
    id: 'malouff2010',
    citation:
      'Malouff, J. M., Thorsteinsson, E. B., Schutte, N. S., Bhullar, N., & Rooke, S. E. (2010). The Five-Factor Model of personality and relationship satisfaction of intimate partners: A meta-analysis. Journal of Research in Personality, 44(1), 124–127.',
    url: 'https://doi.org/10.1016/j.jrp.2009.09.004',
  },
  karney1995: {
    id: 'karney1995',
    citation:
      'Karney, B. R., & Bradbury, T. N. (1995). The longitudinal course of marital quality and stability: A review of theory, method, and research. Psychological Bulletin, 118(1), 3–34.',
    url: 'https://doi.org/10.1037/0033-2909.118.1.3',
  },
  rosenfeld2019: {
    id: 'rosenfeld2019',
    citation:
      'Rosenfeld, M. J., Thomas, R. J., & Hausen, S. (2019). Disintermediating your friends: How online dating in the United States displaces other ways of meeting. Proceedings of the National Academy of Sciences, 116(36), 17753–17758.',
    url: 'https://doi.org/10.1073/pnas.1908630116',
  },
  iyengar2000: {
    id: 'iyengar2000',
    citation:
      'Iyengar, S. S., & Lepper, M. R. (2000). When choice is demotivating: Can one desire too much of a good thing? Journal of Personality and Social Psychology, 79(6), 995–1006.',
    url: 'https://doi.org/10.1037/0022-3514.79.6.995',
  },
  scheibehenne2010: {
    id: 'scheibehenne2010',
    citation:
      'Scheibehenne, B., Greifeneder, R., & Todd, P. M. (2010). Can there ever be too many options? A meta-analytic review of choice overload. Journal of Consumer Research, 37(3), 409–425.',
    url: 'https://doi.org/10.1086/651235',
  },
  dpdp: {
    id: 'dpdp',
    citation:
      'Ministry of Electronics and Information Technology, Government of India. Data protection framework, including the Digital Personal Data Protection Act, 2023.',
    url: 'https://www.meity.gov.in/data-protection-framework',
  },
  cybercrime: {
    id: 'cybercrime',
    citation:
      'Ministry of Home Affairs, Government of India. National Cyber Crime Reporting Portal (helpline 1930).',
    url: 'https://cybercrime.gov.in/',
  },
  openaiBots: {
    id: 'openaiBots',
    citation: 'OpenAI. Overview of OpenAI crawlers (OAI-SearchBot, GPTBot, ChatGPT-User).',
    url: 'https://developers.openai.com/api/docs/bots',
  },
} as const satisfies Record<string, Reference>;

export const articles: readonly Article[] = [
  {
    slug: 'relationship-compatibility',
    kicker: 'Compatibility',
    question: 'What is relationship compatibility?',
    metaTitle: 'What is relationship compatibility? A plain answer',
    description:
      'Relationship compatibility is how well two people’s goals, values, communication and daily lives fit. What research supports, and what no score can tell you.',
    answer:
      'Relationship compatibility is the degree to which two people’s goals, values, ways of communicating and day-to-day lives fit together well enough for a relationship to work for both of them. It has several dimensions, it changes as people and circumstances change, and it cannot be reliably reduced to one universal score.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'A short definition',
        blocks: [
          {
            p: 'Compatibility describes fit between two particular people. It is a property of the pair, not of either person: someone can be easy to live with and still be a poor fit for you. It is also different from attraction, which is about wanting someone, and from relationship quality, which is how things are actually going.',
          },
        ],
      },
      {
        heading: 'The dimensions people usually mean',
        blocks: [
          {
            table: {
              head: ['Dimension', 'The question behind it'],
              rows: [
                [
                  'Relationship expectations',
                  'Do you want the same kind of relationship, on a similar timescale?',
                ],
                ['Values', 'Do you care about the same things when a choice has to be made?'],
                [
                  'Communication',
                  'Can you each say what you mean, and hear the other, in a way that works for both?',
                ],
                [
                  'Handling disagreement',
                  'When you disagree, does one of you need space while the other needs to talk at once?',
                ],
                [
                  'Emotional understanding',
                  'Do you show and read care in ways the other recognises?',
                ],
                ['Lifestyle', 'Do your energy, pace and weekends have a compatible shape?'],
                [
                  'Shared interests',
                  'Is there enough you both enjoy to spend time together gladly?',
                ],
              ],
            },
          },
          {
            p: 'These overlap, and people weigh them differently. For one couple a mismatch in weekend habits is trivial; for another it is a weekly argument.',
          },
        ],
      },
      {
        heading: 'What research supports',
        blocks: [
          {
            p: 'The clearest finding is about where relationship quality comes from. An analysis of 43 longitudinal studies of couples found that the strongest predictors were a person’s own judgements of the relationship itself, such as how committed and appreciative they believed their partner to be and how they handled conflict. Individual traits predicted less, and knowing the partner’s own traits added little beyond that (Joel and colleagues, 2020).',
          },
          {
            p: 'Similarity matters less than most people assume. A meta-analysis of 313 studies found that in established relationships it was perceived similarity, not measured similarity, that went with attraction (Montoya, Horton and Kirchner, 2008). A study of nationally representative samples in three countries found that how similar two partners’ personalities were explained almost none of the difference in their satisfaction (Dyrenforth and colleagues, 2010).',
          },
          {
            p: 'A long-standing model of how relationships fare over time points the same way: what each person brings matters, but so do the stresses a couple meets and, above all, how they adapt to them together (Karney and Bradbury, 1995).',
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'Two people who look alike on paper',
              text: 'Two people both love trekking, both read a great deal and both describe themselves as honest. On paper they are a strong match. One of them, though, wants to settle down within a couple of years and talks through any disagreement immediately. The other is not sure what they want and goes quiet for a day when upset. The shared interests are real. The parts most likely to cause difficulty are the two that a profile rarely shows.',
            },
          },
        ],
      },
      {
        heading: 'What a compatibility score can and cannot tell you',
        blocks: [
          {
            list: [
              'It can show overlap between two descriptions: where your stated goals, habits and values line up, and where they differ.',
              'It can rule out clear non-starters, such as wanting different kinds of relationship.',
              'It cannot predict attraction. A study that applied machine learning to more than a hundred self-reported traits could not predict which particular pairs of speed-daters would desire each other (Joel, Eastwick and Finkel, 2017).',
              'It cannot predict whether a relationship will last. A review of online dating found no compelling evidence for matching algorithms’ claims to do so (Finkel and colleagues, 2012).',
            ],
          },
          {
            p: 'A fair reading of a score is therefore modest: a reason to look more closely at someone, and a set of questions worth asking early.',
          },
        ],
      },
    ],
    vyra: {
      heading: 'How VYRA handles compatibility',
      paragraphs: [
        'VYRA calls its figure estimated alignment, not a compatibility prediction. It checks hard limits first, such as age range and whether two people want the same kind of relationship, then compares six weighted dimensions using fixed rules, and shows which parts lined up and which did not.',
        'When too little is known about two people, VYRA shows “not enough to say” instead of a number. The weights it uses are product hypotheses that have not yet been tested against outcomes, and VYRA says so.',
      ],
    },
    faq: [
      {
        q: 'Is compatibility the same as chemistry?',
        a: 'No. Chemistry usually means attraction and ease in each other’s company, which is felt in person. Compatibility is about fit over time. A pair can have one without the other.',
      },
      {
        q: 'Do opposites attract?',
        a: 'Research gives little support to either slogan. Measured similarity in personality explains very little of how satisfied partners are (Dyrenforth and colleagues, 2010). Shared goals and how a couple handles conflict are better documented.',
      },
      {
        q: 'Can compatibility change?',
        a: 'Yes. People’s goals and circumstances change, and couples develop ways of adapting to each other. Compatibility is better thought of as something maintained than something fixed at the start.',
      },
    ],
    references: [
      REF.joel2020,
      REF.montoya2008,
      REF.dyrenforth2010,
      REF.karney1995,
      REF.joel2017,
      REF.finkel2012,
    ],
    productLinks: [
      { href: '/compatibility', label: 'How VYRA calculates estimated alignment' },
      { href: '/features', label: 'What VYRA does today and what is planned' },
    ],
    related: [
      'communication-styles',
      'personality-and-relationships',
      'ai-in-relationship-discovery',
    ],
  },
  {
    slug: 'personality-and-relationships',
    kicker: 'Personality',
    question: 'How does personality affect relationships?',
    metaTitle: 'How does personality affect relationships?',
    description:
      'Personality shapes how people handle closeness, stress and conflict, but explains less about a relationship than the relationship itself. What research says.',
    answer:
      'Personality affects relationships mainly through how each person tends to handle stress, closeness and disagreement. Some traits, especially emotional stability and agreeableness, are modestly linked to more satisfied partners. But personality explains much less about how a relationship goes than what happens between the two people, and having similar personalities matters very little.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'What “personality” means here',
        blocks: [
          {
            p: 'Personality is a person’s fairly stable pattern of thinking, feeling and behaving. Psychologists most often describe it with five broad traits, known as the Big Five or five-factor model: openness to experience, conscientiousness, extraversion, agreeableness and neuroticism (the tendency to experience negative emotion; its opposite is emotional stability).',
          },
        ],
      },
      {
        heading: 'Which traits are linked to relationship satisfaction',
        blocks: [
          {
            p: 'A meta-analysis of studies of intimate partners found that people tended to be more satisfied when their partner was lower in neuroticism and higher in agreeableness, conscientiousness and extraversion (Malouff and colleagues, 2010). These are averages across many couples, and the links are modest: plenty of anxious or introverted people are in happy relationships.',
          },
          {
            table: {
              head: ['Kind of effect', 'What it means', 'How much it explains'],
              rows: [
                [
                  'Your own traits',
                  'How your personality colours your own experience of the relationship',
                  'The largest of the three',
                ],
                [
                  'Your partner’s traits',
                  'How your partner’s personality affects your satisfaction',
                  'Smaller',
                ],
                ['Similarity', 'How alike the two of you are', 'Very little'],
              ],
            },
          },
          {
            p: 'That ordering comes from nationally representative samples in Australia, the United Kingdom and Germany (Dyrenforth and colleagues, 2010).',
          },
        ],
      },
      {
        heading: 'Why personality is not the whole story',
        blocks: [
          {
            p: 'When researchers combined 43 longitudinal studies of couples, individual differences such as personality and attachment style predicted relationship quality noticeably less well than a person’s judgements of the relationship itself: feeling appreciated, believing the partner is committed, and how conflict goes (Joel and colleagues, 2020). Traits set tendencies. The relationship is built from what two people repeatedly do.',
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'The same trait, two outcomes',
              text: 'Someone who recharges alone is paired with someone who recharges around people. In one couple this becomes a standing complaint about never going out. In another, they agree that Saturday is for friends and Sunday is quiet. The trait difference is identical. What differs is whether it was named and planned for.',
            },
          },
        ],
      },
      {
        heading: 'Limits and common misconceptions',
        blocks: [
          {
            list: [
              'Type labels are not destiny. Four-letter types and similar systems sort people into boxes; the research above uses continuous traits, and most people sit near the middle of each.',
              'A questionnaire measures how you describe yourself, which is not always how you behave with a partner.',
              'Personality cannot tell you whom you will be attracted to. Self-reported traits did not predict which pairs clicked at speed-dating events (Joel, Eastwick and Finkel, 2017).',
              'Most of this research comes from Western countries. It should be applied to India with care rather than assumed to transfer exactly.',
            ],
          },
        ],
      },
    ],
    vyra: {
      heading: 'How VYRA uses personality',
      paragraphs: [
        'VYRA does not assign a personality type. Its persona records tendencies on a few plain scales, such as recharging alone or around people, and needing space or talking things through at once. Each one is marked as stated by the person or inferred, with a confidence level, and the person can change or remove any of them.',
        'VYRA describes the persona as a working description for making suggestions, not a psychological assessment.',
      ],
    },
    faq: [
      {
        q: 'Is personality more important than attraction?',
        a: 'They answer different questions. Attraction decides whether two people want to begin; personality and habits affect what daily life together is like. Neither can stand in for the other, and research cannot yet predict attraction from personality.',
      },
      {
        q: 'Should I look for someone with the same personality as me?',
        a: 'There is little evidence that it helps. Similar personalities explain very little of partners’ satisfaction. Wanting the same kind of relationship and handling disagreement well are better supported.',
      },
      {
        q: 'Can an app measure my personality?',
        a: 'An app can record how you describe yourself and what you tell it. That is useful as a starting description, but it is not a clinical measurement and should not be presented as one.',
      },
    ],
    references: [REF.malouff2010, REF.dyrenforth2010, REF.joel2020, REF.joel2017],
    productLinks: [
      { href: '/ai-persona', label: 'How the VYRA persona works' },
      { href: '/compatibility', label: 'How personality feeds into estimated alignment' },
    ],
    related: ['relationship-compatibility', 'communication-styles', 'ai-in-relationship-discovery'],
  },
  {
    slug: 'communication-styles',
    kicker: 'Communication',
    question: 'What is communication compatibility?',
    metaTitle: 'What is communication compatibility in a relationship?',
    description:
      'Communication compatibility is whether two people’s ways of expressing themselves and handling disagreement work together. Styles can differ and still fit.',
    answer:
      'Communication compatibility is how well two people’s habits of expressing themselves, listening and handling disagreement work together. It does not require the same style. Two different styles can suit each other, and two identical ones can clash. What matters most is whether each person ends up feeling heard, particularly during conflict.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'The parts of a communication style',
        blocks: [
          {
            table: {
              head: ['Aspect', 'One end', 'The other end'],
              rows: [
                ['Amount', 'Says it briefly', 'Talks it through at length'],
                ['Tone', 'Playful, light', 'Reflective, considered'],
                ['Feelings', 'Keeps them private', 'Shares them openly'],
                ['Disagreement', 'Needs space first', 'Wants to talk at once'],
                ['Showing care', 'Quietly, through actions', 'Openly, in words'],
              ],
            },
          },
          {
            p: 'None of these ends is the healthy one. They are preferences, and most people sit somewhere between.',
          },
        ],
      },
      {
        heading: 'Why disagreement is the part that matters most',
        blocks: [
          {
            p: 'In a review of 115 longitudinal studies of marriage, how couples behaved with each other, including how they dealt with problems, was among the most consistent predictors of how satisfied they stayed and whether they remained together (Karney and Bradbury, 1995). More recently, an analysis of 43 studies found that conflict and feeling appreciated by one’s partner were among the strongest predictors of relationship quality (Joel and colleagues, 2020).',
          },
          {
            p: 'The pattern that causes most trouble in everyday life is a mismatch in timing: one person pursues the conversation while the other withdraws to think. Each reads the other’s habit as hostility or indifference, when it is neither.',
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'Space first, or talk now',
              text: 'After an argument about cancelled plans, one partner wants to resolve it before bed. The other needs an hour alone. If neither knows this about the other, the first feels ignored and the second feels cornered. If they do know, the second can say “I need an hour, then I want to talk”, which gives the first what they actually wanted: certainty that the conversation will happen.',
            },
          },
        ],
      },
      {
        heading: 'How to find out early',
        blocks: [
          {
            list: [
              'Ask directly: “When you are upset, do you want to talk straight away or later?”',
              'Notice how a small disagreement goes, such as choosing a place to eat. It is a low-stakes preview.',
              'Say your own preference out loud. Most mismatches hurt because they are unstated.',
              'Treat texting habits with caution. How often someone messages says little about how they talk in person.',
            ],
          },
        ],
      },
      {
        heading: 'Limits',
        blocks: [
          {
            p: 'Styles are tendencies, not rules, and they shift with stress, tiredness and trust. Self-descriptions are also imperfect: people often describe how they would like to communicate. And no description of style can show whether someone communicates with respect, which matters more than any style.',
          },
        ],
      },
    ],
    vyra: {
      heading: 'How VYRA looks at communication',
      paragraphs: [
        'A VYRA persona records a communication style (concise, expansive, playful or reflective) and where a person sits between needing space first and talking things through at once. In estimating alignment, VYRA does not treat different styles as a mismatch by default: some pairings of different styles are scored as fitting well.',
        'Communication is one of six dimensions in the estimate, and VYRA shows the specific reason for each result, for example that both people lean towards talking things through right away.',
      ],
    },
    faq: [
      {
        q: 'Do couples need the same communication style?',
        a: 'No. What helps is knowing each other’s style and adjusting to it. Two people who both avoid difficult conversations share a style and may still struggle.',
      },
      {
        q: 'What is emotional compatibility?',
        a: 'It usually means that two people express and recognise feelings and care in ways the other can read. It overlaps heavily with communication: the feelings may be there, but they have to be shown in a form the other person notices.',
      },
      {
        q: 'Can AI understand my communication preferences?',
        a: 'An AI system can summarise how you describe yourself, or patterns in text you choose to share with it. That is a description to check, not a fact about you. You should be able to see it and correct it.',
      },
    ],
    references: [REF.karney1995, REF.joel2020],
    productLinks: [
      { href: '/compatibility', label: 'The six dimensions VYRA compares' },
      { href: '/ai-persona', label: 'How communication style is recorded in a persona' },
    ],
    related: [
      'relationship-compatibility',
      'personality-and-relationships',
      'dating-beyond-swiping',
    ],
  },
  {
    slug: 'ai-in-relationship-discovery',
    kicker: 'AI',
    question: 'Can AI help with relationship compatibility?',
    metaTitle: 'Can AI help with relationship compatibility?',
    description:
      'AI can help people describe themselves and compare profiles. It cannot predict attraction or whether a relationship will last. An honest guide.',
    answer:
      'AI can help with parts of relationship discovery: it can help people put into words how they communicate and live, summarise what two profiles have in common, and take over repetitive sorting. It cannot predict attraction between two specific people or whether a relationship will last, and published research gives no support to claims that it can.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Three different things called “AI dating”',
        blocks: [
          {
            table: {
              head: ['Kind of product', 'What the AI does', 'What to ask'],
              rows: [
                [
                  'AI-assisted matching or discovery',
                  'Helps describe people and suggests who to meet',
                  'Can I see why someone was suggested?',
                ],
                [
                  'AI wingman or reply writer',
                  'Drafts profiles and messages for you',
                  'Does the other person know a machine wrote it?',
                ],
                [
                  'AI companion',
                  'Is itself the conversation partner',
                  'Is this a substitute for meeting people, and is that what I want?',
                ],
              ],
            },
          },
          {
            p: 'These are often discussed as one category. They raise different questions, and this article is about the first.',
          },
        ],
      },
      {
        heading: 'What AI is reasonably good at',
        blocks: [
          {
            list: [
              'Turning a few lines someone wrote about themselves into a structured description they can check.',
              'Finding overlap between two descriptions quickly and consistently.',
              'Narrowing a very large pool to a short list that fits stated limits.',
              'Explaining a suggestion in plain language, if the system was built to do so.',
            ],
          },
        ],
      },
      {
        heading: 'What it cannot do',
        blocks: [
          {
            p: 'In a well-known study, researchers gave a machine-learning model more than a hundred traits and preferences that people reported before speed-dating. The model could predict who tended to desire others, and who tended to be desired. It could not predict which specific pairs would be drawn to each other (Joel, Eastwick and Finkel, 2017).',
          },
          {
            p: 'A broad review of online dating reached a similar conclusion about long-term outcomes: there was no compelling evidence that matching algorithms deliver better relationships than other ways of meeting (Finkel and colleagues, 2012). Much of what makes a relationship work emerges only once two people interact (Joel and colleagues, 2020).',
          },
        ],
      },
      {
        heading: 'Can my existing AI conversations build a personality profile?',
        blocks: [
          {
            p: 'An assistant you have used for a long time may hold a fair picture of how you think and write. There are two ways to use that: handing a service your chat history, or asking the assistant to summarise you and sharing only the summary.',
          },
          {
            list: [
              'A summary you have read is far safer than a raw history. Histories contain other people’s names, work matters, health questions and much else unrelated to dating.',
              'Assistants that do not keep memory between chats will guess. A good prompt should allow “unknown” as an answer.',
              'An assistant’s view of you comes from one setting, usually work or problem-solving. It may say little about how you are with a partner.',
              'Treat the result as a draft. You should be able to see every inference and delete it.',
            ],
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'A useful suggestion, honestly labelled',
              text: 'A system suggests someone and says: “You are both looking for something serious, you both prefer to talk problems through quickly, and you differ on how social your weekends are.” That is useful. It gives three things to check on a first date and claims nothing about how it will turn out. The same suggestion labelled “94% match” would tell you less while implying far more.',
            },
          },
        ],
      },
      {
        heading: 'Questions to ask any AI-assisted service',
        blocks: [
          {
            list: [
              'What does it read about me, and did I agree to each kind of reading separately?',
              'Can I see, correct and delete what it has inferred?',
              'Does it infer sensitive things such as health, religion, caste, sexuality or politics?',
              'Does it send or post anything in my name?',
              'Is my data used to train models?',
              'When it does not know, does it say so?',
            ],
          },
        ],
      },
    ],
    vyra: {
      heading: 'How VYRA uses AI',
      paragraphs: [
        'VYRA uses AI for one job: helping a person draft a persona, which they then review and approve. A person can also ask the AI assistant they already use to answer VYRA’s short questionnaire and paste the answer back; VYRA never connects to that assistant’s account and does not keep the pasted reply.',
        'The comparison between two people is not made by an AI model. It is calculated by fixed, testable rules, so the reasons can always be shown. VYRA has no field for sensitive traits, never sends anything in a person’s name, and does not use private data to train shared models.',
      ],
    },
    faq: [
      {
        q: 'Is VYRA an AI dating app?',
        a: 'VYRA is an AI-assisted relationship discovery platform. People would use it to meet potential partners, so it sits in the same broad space as dating apps. It is not an AI companion, it does not write or send messages for you, and it has no swipe deck.',
      },
      {
        q: 'What are the limits of AI-generated personality insights?',
        a: 'They depend entirely on what the system was given, they can sound more certain than they are, and they describe how you present yourself in text. They should be shown with their source and confidence, and be editable.',
      },
      {
        q: 'Should I share private AI conversations with a dating platform?',
        a: 'Be cautious. Prefer services that ask for a summary you can read first over ones that ask for full exports, and check what is kept afterwards.',
      },
    ],
    references: [REF.joel2017, REF.finkel2012, REF.joel2020],
    productLinks: [
      { href: '/ai-persona', label: 'The VYRA AI persona, and the “Ask your AI” questionnaire' },
      { href: '/safety', label: 'What VYRA does with your data' },
    ],
    related: [
      'relationship-compatibility',
      'online-dating-safety',
      'personality-and-relationships',
    ],
  },
  {
    slug: 'dating-beyond-swiping',
    kicker: 'Discovery',
    question: 'What are the alternatives to swipe-based dating?',
    metaTitle: 'Alternatives to swipe-based dating',
    description:
      'Swiping is fast but rewards photos and quick judgements. The alternatives: fewer, fuller profiles, prompts, compatibility-led suggestions and meeting in person.',
    answer:
      'The main alternatives to swipe-based dating are services that show fewer people in more depth, ask you to respond to something specific on a profile, suggest people on the basis of stated compatibility, or organise meeting in person. They trade the speed of swiping for more information about each person before you decide.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'What swiping is good at, and where it falls short',
        blocks: [
          {
            p: 'Swiping makes it effortless to see many people and removes the sting of rejection, because you only learn about mutual interest. Meeting online has become ordinary: in a large United States survey it had become the most common way for heterosexual couples to meet by 2017 (Rosenfeld, Thomas and Hausen, 2019). That figure is for the United States and should not be read as describing India.',
          },
          {
            p: 'The weaknesses come from the same design. A review of online dating warned that comparing many profiles side by side encourages a judging, shopping frame of mind and attention to features that are easy to compare, such as looks, over ones that matter in person (Finkel and colleagues, 2012).',
          },
          {
            p: 'More choice is not always better, either. In a classic experiment people offered a very large set of options were less likely to choose at all than people offered a few (Iyengar and Lepper, 2000). Later analysis found that this effect is not universal and depends on the situation (Scheibehenne, Greifeneder and Todd, 2010), so it is best treated as a risk rather than a law.',
          },
        ],
      },
      {
        heading: 'The alternatives, compared',
        blocks: [
          {
            table: {
              head: ['Approach', 'How it works', 'Strength', 'Trade-off'],
              rows: [
                [
                  'Limited daily suggestions',
                  'A few people a day instead of an endless stack',
                  'Attention on each person',
                  'Slower; fewer chances per day',
                ],
                [
                  'Prompt-led profiles',
                  'You reply to a specific answer or photo',
                  'Conversations start from something real',
                  'Still largely photo-first',
                ],
                [
                  'Compatibility-led discovery',
                  'People are suggested from stated goals, habits and values',
                  'Reasons to look closer; filters clear non-starters',
                  'Cannot predict attraction; depends on honest profiles',
                ],
                [
                  'Matchmaking',
                  'A person or team introduces you',
                  'Human judgement',
                  'Costly; small pool',
                ],
                [
                  'Events and communities',
                  'Meeting through an activity',
                  'Chemistry is tested immediately',
                  'Depends on where you live and your schedule',
                ],
              ],
            },
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'Thirty seconds or three minutes',
              text: 'On a swipe deck, a person decides about thirty profiles in a few minutes, mostly from the first photo. Reading three full profiles takes the same time. The second evening produces fewer matches. It is more likely to produce a first message that refers to something the other person actually said.',
            },
          },
        ],
      },
      {
        heading: 'How to choose',
        blocks: [
          {
            list: [
              'If you want to meet many people quickly, swiping does that well.',
              'If you tire of small talk that goes nowhere, try a service that limits suggestions or leads with prompts.',
              'If you already know your non-negotiables, look for one that filters on them openly.',
              'Whatever you use, meet reasonably soon. No profile, however detailed, replaces an hour in person.',
            ],
          },
        ],
      },
      {
        heading: 'Limits of this comparison',
        blocks: [
          {
            p: 'There is no good evidence that any one format produces better relationships than another. The comparison above describes how the formats differ in experience, not in outcomes.',
          },
        ],
      },
    ],
    vyra: {
      heading: 'Where VYRA sits',
      paragraphs: [
        'VYRA is a compatibility-led discovery platform with no swipe deck. Profiles are meant to be read in full, and each suggestion comes with its reasons.',
        'VYRA is in development: a first Discover list and profile preview are built, while the Orbit view and the actions to connect, save or pass are still being made. VYRA does not claim that its approach leads to better relationships, because there is no outcome data yet to support such a claim.',
      ],
    },
    faq: [
      {
        q: 'Are there dating apps without swiping?',
        a: 'Yes. Several limit daily suggestions, lead with prompts, or suggest people from compatibility questions. They differ mainly in how much you learn about someone before deciding.',
      },
      {
        q: 'Is swiping bad for you?',
        a: 'Not inherently. It is efficient for meeting many people. Its design favours quick, appearance-led judgements, which suits some people and frustrates others.',
      },
      {
        q: 'How can people discover meaningful relationships online?',
        a: 'Be specific about what you want, read profiles in full, ask about goals and habits early, and meet in person once it feels safe to. The format matters less than those habits.',
      },
    ],
    references: [REF.rosenfeld2019, REF.finkel2012, REF.iyengar2000, REF.scheibehenne2010],
    productLinks: [
      { href: '/features', label: 'Discovery in VYRA: Orbit and Discover' },
      { href: '/how-it-works', label: 'How VYRA works, step by step' },
    ],
    related: ['relationship-compatibility', 'communication-styles', 'online-dating-safety'],
  },
  {
    slug: 'online-dating-safety',
    kicker: 'Safety',
    question: 'What makes online dating safer?',
    metaTitle: 'What makes online dating safer? A guide for India',
    description:
      'Safer online dating needs platform safeguards and personal habits: limit what you share, verify before you trust, meet in public, and know where to report.',
    answer:
      'Online dating is safer when a platform limits what strangers can learn about you and gives you control over your data, and when you add a few habits of your own: share location and contact details late, check that someone is who they say they are, meet first in a public place, never send money, and report problems promptly.',
    published: '2026-11-14',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'What a platform should do for you',
        blocks: [
          {
            table: {
              head: ['Safeguard', 'Why it matters'],
              rows: [
                [
                  'Adults only, checked at sign-up',
                  'Keeps minors off a service that is not meant for them',
                ],
                [
                  'Photos reviewed before others see them',
                  'Reduces explicit, stolen or abusive images',
                ],
                [
                  'Location shown as a rough distance',
                  'Prevents someone working out where you live',
                ],
                ['Messages only between people who both agreed', 'Stops unsolicited contact'],
                [
                  'Blocking and reporting that are easy to find',
                  'Lets you end contact and flag harm quickly',
                ],
                [
                  'Consent asked separately for each use of your data',
                  'You can agree to one thing without agreeing to all',
                ],
                [
                  'Deletion you can do yourself',
                  'Your data should not outlast your wish to be there',
                ],
              ],
            },
          },
        ],
      },
      {
        heading: 'Habits that protect you',
        blocks: [
          {
            list: [
              'Keep early conversation inside the app. Moving to a private messenger removes the platform’s protections and reveals your number.',
              'Do not share your home or work address, your daily routine or identity documents before you have met and trust someone.',
              'Make a video call before meeting. It is the simplest check that the person matches the profile.',
              'Meet in a public place, arrange your own transport, and tell a friend where you are and when you expect to be back.',
              'Never send money, gift cards or investment funds to someone you have met online, whatever the story. Requests for money are the clearest sign of fraud.',
              'Be wary of anyone who pushes for intimate photos or tries to rush closeness. Images can be used for blackmail.',
            ],
          },
        ],
      },
      {
        heading: 'Your personal data, including AI data',
        blocks: [
          {
            p: 'A dating profile contains some of the most personal information you will put online. Before signing up, look for what is collected, whether sensitive characteristics are inferred, who your profile is shown to, and how to delete everything.',
          },
          {
            p: 'In India, the Digital Personal Data Protection Act, 2023 sets out duties for organisations that process personal data and rights for individuals, built around consent for stated purposes. Its detailed rules and enforcement are being brought into effect in stages, so check the government’s current guidance for what applies today (Ministry of Electronics and Information Technology).',
          },
          {
            p: 'If a service asks for your conversations with an AI assistant, prefer one that takes a summary you have read over a full export, and find out whether the original is kept.',
          },
        ],
      },
      {
        heading: 'A practical example',
        blocks: [
          {
            example: {
              title: 'A request that should stop the conversation',
              text: 'After two weeks of warm messages, someone who has always been “travelling for work” says their card has been blocked abroad and asks for a small transfer, to be repaid next week. Everything about the request is designed to feel reasonable. The safe response is the same every time: do not send money, stop replying, report the profile to the platform, and report the attempt.',
            },
          },
        ],
      },
      {
        heading: 'If something goes wrong in India',
        blocks: [
          {
            list: [
              'In immediate danger, call the emergency number 112.',
              'For online financial fraud, call the national cybercrime helpline 1930 as soon as possible; speed improves the chance of stopping a transfer.',
              'Report cybercrime, including harassment and blackmail, on the National Cyber Crime Reporting Portal (Ministry of Home Affairs).',
              'Report and block the profile in the app, and keep screenshots of messages and payment details.',
            ],
          },
        ],
      },
      {
        heading: 'Limits',
        blocks: [
          {
            p: 'No platform feature and no checklist removes risk entirely. This guide is general information, not legal advice, and helpline numbers and procedures can change; confirm them on the official sites linked below.',
          },
        ],
      },
    ],
    vyra: {
      heading: 'What VYRA does, and does not yet do',
      paragraphs: [
        'In the current build, VYRA checks date of birth at sign-up and refuses anyone under 18, moderates every photo before anyone else can see it, removes location data from uploaded photos, stores only a rough area and shows others a distance band, asks consent separately for each kind of AI processing, and lets a person delete their account in the app.',
        'VYRA is in development. Blocking, a reporting screen, and messaging limited to mutual connections are not built yet. The age check is a self-declared date of birth, not identity verification.',
      ],
    },
    faq: [
      {
        q: 'How should dating apps protect personal information?',
        a: 'By collecting as little as they need, asking consent per purpose, never revealing exact location, keeping photos private until approved, and offering deletion that takes effect without a request to support.',
      },
      {
        q: 'How can I control what appears on a dating profile?',
        a: 'Use services that let you see and edit every field, including anything inferred about you, and that let you hide your profile without deleting it.',
      },
      {
        q: 'Is it safe to share my location on a dating app?',
        a: 'A rough area is usually enough to find people nearby. Avoid any service that shows others your precise position or lets them track movement.',
      },
    ],
    references: [REF.dpdp, REF.cybercrime],
    productLinks: [
      { href: '/safety', label: 'Safety, privacy and your controls in VYRA' },
      { href: '/privacy', label: 'VYRA privacy policy (working draft)' },
    ],
    related: [
      'ai-in-relationship-discovery',
      'dating-beyond-swiping',
      'relationship-compatibility',
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
