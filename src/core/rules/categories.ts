import type { CategoryId, Field } from '../types';
export interface TermRule { term: string; weight: number; fields?: Field[] }
export interface CombinationRule { terms: string[]; weight: number }
export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  threshold: number;
  terms: TermRule[];
  combinations?: CombinationRule[];
  contexts?: TermRule[];
  fieldWeights?: Partial<Record<Field, number>>;
}
const terms = (weight: number, ...values: string[]): TermRule[] => values.map(term => ({ term, weight }));
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'celebrity', name: 'Celebrity & Gossip', threshold: 4,
    terms: [...terms(4, 'celebrity', 'celebrities', 'gossip', 'royal family'), ...terms(1, 'actor', 'actress', 'singer', 'divorce', 'dating', 'royals')],
    combinations: [{ terms: ['celebrity', 'divorce'], weight: 2 }, { terms: ['star', 'dating'], weight: 3 }],
    contexts: terms(-4, 'charity research', 'scientific research') },
  { id: 'crime', name: 'Crime', threshold: 4,
    terms: [...terms(5, 'murder', 'murdered', 'robbery', 'rape', 'homicide'), ...terms(4, 'crime', 'arrested', 'burglary', 'fraud'), ...terms(1, 'police', 'court', 'charged')],
    combinations: [{ terms: ['police', 'charged'], weight: 3 }],
    contexts: terms(-6, 'crime prevention', 'prevent crime', 'prevent fraud', 'fraud prevention') },
  { id: 'tragedy', name: 'Death & Tragedy', threshold: 4,
    terms: [...terms(5, 'killed', 'dead', 'fatal', 'died', 'tragedy', 'deaths'), ...terms(3, 'death', 'funeral', 'victims')],
    combinations: [{ terms: ['crash', 'victims'], weight: 3 }],
    contexts: terms(-7, 'prevent road deaths', 'reduce road deaths', 'prevent deaths', 'save lives', 'road safety', 'death rate falls', 'death rates fall') },
  { id: 'sexual', name: 'Sexual Content', threshold: 4,
    terms: terms(5, 'pornography', 'porn', 'sexual content', 'sex scandal', 'explicit images'),
    contexts: terms(-7, 'sexual health education', 'sexual health research') },
  { id: 'war', name: 'War & Conflict', threshold: 4,
    terms: [...terms(5, 'war', 'airstrike', 'airstrikes', 'armed conflict', 'invasion', 'bombing'), ...terms(2, 'troops', 'military', 'ceasefire')],
    combinations: [{ terms: ['military', 'attack'], weight: 3 }], contexts: terms(-6, 'price war', 'war on waste', 'trade war') },
  { id: 'disaster', name: 'Disaster', threshold: 4,
    terms: [...terms(5, 'earthquake', 'tsunami', 'wildfire', 'disaster', 'flooding', 'cyclone'), ...terms(2, 'flood', 'hurricane')],
    contexts: terms(-7, 'disaster preparedness', 'disaster prevention', 'earthquake resistant', 'cyclone resistant') },
  { id: 'politics', name: 'Politics', threshold: 4,
    terms: [...terms(4, 'politics', 'election', 'elections', 'parliament', 'prime minister', 'president'), ...terms(2, 'government', 'minister', 'policy')] },
  { id: 'sport', name: 'Sport', threshold: 4,
    terms: terms(4, 'sport', 'sports', 'football', 'rugby', 'cricket', 'tennis', 'olympics', 'world cup', 'basketball') },
  { id: 'entertainment', name: 'Entertainment', threshold: 4,
    terms: terms(4, 'entertainment', 'movie', 'movies', 'film', 'concert', 'music festival', 'television', 'tv show') },
  { id: 'opinion', name: 'Opinion', threshold: 4,
    terms: terms(4, 'opinion', 'editorial', 'commentary', 'columnist', 'op ed') },
  { id: 'business', name: 'Business', threshold: 4,
    terms: [...terms(4, 'business', 'economy', 'stocks', 'stock market', 'finance', 'inflation', 'interest rates'), ...terms(2, 'company', 'investment', 'profit')] },
  { id: 'technology', name: 'Technology', threshold: 4,
    terms: terms(4, 'technology', 'software', 'artificial intelligence', 'cybersecurity', 'smartphone', 'internet', 'broadband') },
  { id: 'science', name: 'Science', threshold: 4,
    terms: [...terms(4, 'science', 'scientific', 'scientists', 'astronomy', 'space research'), ...terms(2, 'research', 'discovery', 'study')] },
  { id: 'sponsored', name: 'Sponsored & Paid Content', threshold: 4, fieldWeights: { label: 2 },
    terms: [
      ...terms(4, 'paid content', 'paid post', 'partner content', 'brand partner', 'branded content',
        'commercial content', 'presented by', 'brought to you by', 'in partnership with',
        'native advertising', 'sponsored by', 'partner feature'),
      // Ambiguous single words are decisive only in explicit card metadata.
      ...terms(4, 'sponsored', 'promoted', 'advertisement', 'advertorial')
        .map(rule => ({ ...rule, fields: ['label', 'section'] as Field[] })),
      ...terms(1, 'sponsored', 'promoted', 'advertisement', 'advertorial')
        .map(rule => ({ ...rule, fields: ['headline', 'description', 'url'] as Field[] })),
    ] },
];
