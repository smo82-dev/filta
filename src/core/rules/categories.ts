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
  sections?: string[];
  headlineDisclosures?: string[];
}
const terms = (weight: number, ...values: string[]): TermRule[] => values.map(term => ({ term, weight }));
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'celebrity', sections: ['celebrity', 'celebrities', 'gossip', 'royals', 'royal family', 'showbiz'], name: 'Celebrity & Gossip', threshold: 4,
    terms: [...terms(4, 'celebrity', 'celebrities', 'gossip', 'royal family'), ...terms(1, 'actor', 'actress', 'singer', 'divorce', 'dating', 'royals'), ...terms(4, 'showbiz', 'celebrity gossip')],
    combinations: [{ terms: ['singer|actor|actress|performer|selena gomez', 'voice|singing|vaping|romance|wedding|dating'], weight: 4 }, { terms: ['celebrity', 'divorce'], weight: 2 }, { terms: ['star', 'dating'], weight: 3 }, { terms: ['princess|prince|king|queen', 'royal|tiara|palace|banquet|wedding'], weight: 4 }, { terms: ['actor|actress|singer|star', 'engaged|wedding|divorce|split|romance|dating'], weight: 4 }],
    contexts: terms(-4, 'charity research', 'scientific research') },
  { id: 'crime', sections: ['crime', 'courts', 'police', 'justice'], name: 'Crime', threshold: 4,
    terms: [...terms(5, 'murder', 'murdered', 'robbery', 'rape', 'homicide'), ...terms(4, 'crime', 'arrested', 'burglary', 'fraud', 'burglaries', 'arrests', 'homicides', 'robberies'), ...terms(1, 'police', 'court', 'charged')],
    combinations: [{ terms: ['police', 'charged'], weight: 3 }, { terms: ['suspect|suspects', 'charged|arrest|custody'], weight: 4 }, { terms: ['court|trial', 'guilty|sentenced|verdict'], weight: 4 }, { terms: ['manhunt|police|suspect|suspects', 'stabbing|assault|knife|knifeman'], weight: 4 }],
    contexts: terms(-6, 'crime prevention', 'prevent crime', 'prevent fraud', 'fraud prevention') },
  { id: 'tragedy', sections: ['death', 'tragedy', 'obituaries'], name: 'Death & Tragedy', threshold: 4,
    terms: [...terms(5, 'killed', 'dead', 'fatal', 'died', 'tragedy', 'deaths', 'fatalities', 'dies'), ...terms(3, 'death', 'funeral', 'victims')],
    combinations: [{ terms: ['crash', 'victims'], weight: 3 }],
    contexts: terms(-7, 'prevent road deaths', 'reduce road deaths', 'prevent deaths', 'save lives', 'road safety', 'death rate falls', 'death rates fall') },
  { id: 'sexual', sections: ['sexual content', 'adult content', 'pornography'], name: 'Sexual Content', threshold: 4,
    terms: terms(5, 'pornography', 'porn', 'sexual content', 'sex scandal', 'explicit images', 'sexually explicit', 'adult content', 'sexual assault', 'sexual assaults'),
    contexts: terms(-7, 'sexual health education', 'sexual health research') },
  { id: 'war', sections: ['war', 'conflict', 'armed conflict', 'defence', 'defense'], name: 'War & Conflict', threshold: 4,
    terms: [...terms(5, 'war', 'airstrike', 'airstrikes', 'armed conflict', 'invasion', 'bombing', 'air strike', 'air strikes'), ...terms(2, 'troops', 'military', 'ceasefire')],
    combinations: [{ terms: ['military', 'attack'], weight: 3 }, { terms: ['troops|forces', 'combat|offensive|shelling'], weight: 4 }], contexts: terms(-6, 'price war', 'war on waste', 'trade war', 'war of words', 'star wars') },
  { id: 'disaster', sections: ['disaster', 'disasters', 'earthquakes', 'wildfires', 'cyclones'], name: 'Disaster', threshold: 4,
    terms: [...terms(5, 'earthquake', 'tsunami', 'wildfire', 'disaster', 'flooding', 'cyclone', 'hurricanes', 'earthquakes', 'wildfires'), ...terms(2, 'flood', 'hurricane')],
    combinations: [{ terms: ['flood|hurricane|storm', 'destroys|devastation|damage|displaced|victims|evacuated'], weight: 4 }],
    contexts: terms(-7, 'disaster preparedness', 'disaster prevention', 'earthquake resistant', 'cyclone resistant', 'like wildfire') },
  { id: 'politics', sections: ['politics', 'political', 'elections', 'parliament', 'government'], name: 'Politics', threshold: 4,
    terms: [...terms(4, 'politics', 'election', 'elections', 'parliament', 'prime minister', 'president',
      // Westminster-system vocabulary (NZ, UK, Australia); the learned model is US-centric.
      'mps', 'labour party', 'national party', 'green party', 'greens co leader', 'te pati maori', 'nz first', 'act party',
      'tories', 'tory', 'conservative party', 'liberal party', 'coalition government', 'select committee', 'by election',
      'general election', 'snap election', 'opposition leader', 'shadow minister', 'cabinet minister', 'finance minister',
      'foreign minister', 'deputy prime minister', 'downing street', 'westminster', 'beehive', 'canberra', 'question time',
      'luxon', 'hipkins', 'starmer', 'albanese'),
      ...terms(2, 'government', 'minister', 'policy', 'labour', 'mp', 'cabinet', 'coalition', 'opposition', 'caucus', 'councillor', 'mayor')],
    combinations: [{ terms: ['mp|senator|congress|senate|cabinet', 'vote|votes|bill|debate|reform'], weight: 4 },
      { terms: ['labour|national|greens|tories|conservatives|act', 'poll|polls|policy|leader|mps|caucus|campaign|coalition|candidate|minister'], weight: 4 }],
    contexts: terms(-5, 'company president', 'club president', 'president of the company', 'student election', 'labour weekend', 'labour day', 'labour shortage', 'labour market', 'in labour', 'national park', 'national team') },
  { id: 'sport', sections: ['sport', 'sports', 'rugby', 'football', 'cricket', 'tennis', 'golf', 'netball', 'racing', 'motorsport', 'nfl', 'nba', 'nrl', 'afl'], name: 'Sport', threshold: 4,
    terms: [
      ...terms(4, 'sport', 'sports', 'football', 'rugby', 'cricket', 'tennis', 'olympics', 'world cup', 'basketball',
        'nfl', 'nba', 'nrl', 'afl', 'mlb', 'nhl', 'fifa', 'uefa', 'premier league', 'champions league',
        'formula 1', 'formula one', 'f1', 'grand prix', 'super bowl', 'baseball', 'golf',
        'netball', 'motorsport', 'motogp', 'boxing', 'mma', 'ufc', 'wimbledon',
        'all blacks', 'black caps', 'silver ferns', 'wallabies', 'state of origin', 'ashes'),
      ...terms(3, 'goalkeeper', 'touchdown', 'quarterback', 'hat trick', 'penalty shootout',
        'playoffs', 'semifinal', 'semi-final', 'finals series', 'matchday', 'try scorer',
        'test match', 'pole position', 'qualifying lap', 'wicket', 'innings'),
      ...terms(2, 'coach', 'fixture', 'league', 'squad', 'tournament', 'championship', 'stadium',
        'striker', 'midfielder', 'referee', 'medal', 'podium', 'victory', 'season opener', 'wickets')
    ],
    combinations: [
      { terms: ['match', 'win'], weight: 4 }, { terms: ['team', 'defeat'], weight: 4 },
      { terms: ['coach', 'squad'], weight: 4 }, { terms: ['player', 'injury'], weight: 3 },
      { terms: ['race', 'pole'], weight: 4 }
    ] },
  { id: 'entertainment', sections: ['entertainment', 'culture', 'arts', 'film', 'movies', 'music', 'television', 'tv'], name: 'Entertainment', threshold: 4,
    terms: terms(4, 'entertainment', 'movie', 'movies', 'film', 'concert', 'music festival', 'television', 'tv show', 'cinema', 'album', 'box office'),
    combinations: [{ terms: ['series|drama', 'streaming|premiere|cast'], weight: 4 },
      { terms: ['producer|showrunner|screenwriter', 'show|shows|series|drama'], weight: 4 },
      { terms: ['the simpsons', 'voice|episode|episodes|apu'], weight: 4 },
      { terms: ['singer|singing|song|songs', 'voice|album|concert|tour'], weight: 4 }],
    contexts: terms(-6, 'film coating', 'plastic film', 'window film') },
  { id: 'opinion', sections: ['opinion', 'opinions', 'editorial', 'editorials', 'comment', 'commentary', 'analysis', 'columns', 'op ed'], name: 'Opinion', threshold: 4,
    terms: terms(4, 'opinion', 'editorial', 'commentary', 'columnist', 'op ed'),
    contexts: terms(-6, 'opinion poll', 'opinion polls', 'second opinion', 'medical opinion') },
  { id: 'business', sections: ['business', 'economy', 'economics', 'finance', 'money', 'markets', 'personal finance'], name: 'Business', threshold: 4,
    terms: [...terms(4, 'business', 'economy', 'stocks', 'stock market', 'finance', 'inflation', 'interest rates'), ...terms(2, 'company', 'investment', 'profit', 'profits')],
    combinations: [{ terms: ['bank|banks', 'rate|rates|lending'], weight: 4 }, { terms: ['company|firm', 'earnings|revenue|shares'], weight: 4 }, { terms: ['hiring', 'jobs|workers|staff'], weight: 4 }],
    contexts: terms(-6, 'business as usual') },
  { id: 'technology', sections: ['technology', 'tech', 'gadgets', 'computing', 'cybersecurity'], name: 'Technology', threshold: 4,
    terms: terms(4, 'technology', 'tech', 'software', 'artificial intelligence', 'cybersecurity', 'smartphone', 'internet', 'broadband', 'ransomware', 'data breach'),
    combinations: [{ terms: ['ai', 'model|models|chip|chips|chatbot'], weight: 4 }, { terms: ['app|apps', 'launch|update|released'], weight: 4 }] },
  { id: 'science', sections: ['science', 'sciences', 'astronomy', 'space', 'environment science'], name: 'Science', threshold: 4,
    terms: [...terms(4, 'science', 'scientific', 'scientists', 'astronomy', 'space research'), ...terms(2, 'research', 'discovery', 'study')],
    combinations: [{ terms: ['researchers', 'discover|discovered|experiment|findings'], weight: 4 }, { terms: ['space|nasa', 'telescope|planet|mission|galaxy'], weight: 4 }],
    contexts: terms(-6, 'market research', 'bible study') },
  { id: 'sponsored', sections: ['sponsored', 'promoted', 'paid content', 'partner content', 'advertorial', 'branded content'], name: 'Sponsored & Paid Content', threshold: 4, fieldWeights: { label: 2 },
    headlineDisclosures: ['sponsored', 'paid content', 'paid post', 'partner content', 'advertorial', 'advertisement', 'branded content', 'promoted'],
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
