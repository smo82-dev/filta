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
  /** Learned evidence for another category plus one of these cues counts for this one. */
  support?: { from: CategoryId; weight: number; minConfidence?: number; cues: string[] };
  /** Learned evidence for another category counts here when the story is about a person, not a work. */
  personFocus?: { from: CategoryId; weight: number; minConfidence: number; unless: CategoryId; works: string[] };
}
const terms = (weight: number, ...values: string[]): TermRule[] => values.map(term => ({ term, weight }));
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'celebrity', sections: ['celebrity', 'celebrities', 'gossip', 'royals', 'royal family', 'showbiz'], name: 'Celebrity & Gossip', threshold: 4,
    terms: [...terms(4, 'celebrity', 'celebrities', 'gossip', 'royal family', 'celeb', 'celebs', 'kardashian', 'kardashians', 'paparazzi',
      'red carpet', 'met gala', 'royal wedding', 'reality star', 'pop star', 'hollywood star', 'movie star', 'baby bump'), ...terms(1, 'actor', 'actress', 'singer', 'divorce', 'dating', 'royals'), ...terms(4, 'showbiz', 'celebrity gossip')],
    combinations: [{ terms: ['singer|actor|actress|performer|selena gomez', 'voice|singing|vaping|romance|wedding|dating'], weight: 4 }, { terms: ['celebrity', 'divorce'], weight: 2 }, { terms: ['star', 'dating'], weight: 3 }, { terms: ['princess|prince|king|queen', 'royal|tiara|palace|banquet|wedding'], weight: 4 }, { terms: ['actor|actress|singer|star', 'engaged|wedding|divorce|split|romance|dating'], weight: 4 }],
    contexts: terms(-4, 'charity research', 'scientific research'),
    // Headlines name the star rather than saying "celebrity". When the learned model reads a
    // story as entertainment and it turns on someone's personal life, that is gossip.
    support: { from: 'entertainment', weight: 4, minConfidence: -1, cues: ['baby', 'babies', 'pregnant', 'pregnancy', 'engaged', 'engagement', 'wedding', 'married',
      'divorce', 'divorcing', 'split', 'splits', 'breakup', 'break up', 'dating', 'romance', 'boyfriend', 'girlfriend', 'husband', 'hubby', 'wife',
      'ex', 'son', 'daughter', 'mom', 'dad', 'birthday', 'instagram', 'selfie', 'tattoo', 'outfit', 'hairstyle', 'shirtless', 'bikini', 'red carpet',
      'feud', 'slams', 'claps back', 'shade', 'kiss', 'apologizes', 'apologises', 'sues', 'sued', 'arrested', 'sentenced', 'meme', 'love', 'single'] },
    // An entertainment story that is about a person rather than a film, show or album is gossip.
    // Topical late-night comedy and stories led by a quoted title are entertainment, not gossip.
    personFocus: { from: 'entertainment', weight: 4, minConfidence: -0.5, unless: 'politics', works: ['film', 'films', 'movie', 'movies',
      'trailer', 'season', 'seasons', 'episode', 'episodes', 'series', 'album', 'box office', 'review', 'premiere', 'renewed', 'sequel', 'reboot',
      'show', 'shows', 'soundtrack', 'chart', 'charts', 'cast', 'casting', 'netflix', 'hbo', 'streaming', 'kimmel', 'colbert', 'seth meyers', 'trevor noah', 'fallon',
      'corden', 'snl', 'saturday night live', 'daily show', 'late show', 'late late show', 'tonight show', 'samantha bee', 'john oliver',
      'bill maher', 'weekend update'] } },
  { id: 'crime', sections: ['crime', 'courts', 'police', 'justice'], name: 'Crime', threshold: 4,
    terms: [...terms(5, 'murder', 'murdered', 'robbery', 'rape', 'homicide'), ...terms(4, 'crime', 'arrested', 'burglary', 'fraud', 'burglaries', 'arrests', 'homicides', 'robberies', 'ponzi', 'ponzi scheme', 'scam', 'scams', 'scammers', 'scammed',
      'kidnapping', 'smuggling', 'trafficking', 'drug trafficking', 'jailed', 'behind bars', 'convicted', 'pleads guilty', 'pleads not guilty', 'pleaded guilty', 'gunman', 'treason'),
      ...terms(3, 'criminal', 'sentenced', 'stabbing'), ...terms(2, 'conspiracy', 'prison', 'shooting'), ...terms(1, 'police', 'court', 'charged')],
    combinations: [{ terms: ['police', 'charged'], weight: 3 }, { terms: ['suspect|suspects', 'charged|arrest|custody'], weight: 4 }, { terms: ['court|trial', 'guilty|sentenced|verdict'], weight: 4 }, { terms: ['manhunt|police|suspect|suspects', 'stabbing|assault|knife|knifeman'], weight: 4 }],
    contexts: terms(-6, 'crime prevention', 'prevent crime', 'prevent fraud', 'fraud prevention') },
  { id: 'tragedy', sections: ['death', 'tragedy', 'obituaries'], name: 'Death & Tragedy', threshold: 4,
    terms: [...terms(5, 'killed', 'dead', 'fatal', 'died', 'tragedy', 'deaths', 'fatalities', 'dies', 'kills', 'killing', 'killings', 'murdered',
      'massacre', 'slain', 'death toll', 'shot dead', 'stabbed to death', 'drowned', 'perished', 'passed away', 'obituary', 'bodies found', 'body found', 'body of'),
      ...terms(4, 'deadly'), ...terms(3, 'death', 'funeral', 'victims', 'mourn', 'mourns', 'mourning', 'executed'), ...terms(2, 'kill', 'lives', 'crash')],
    combinations: [{ terms: ['crash', 'victims'], weight: 3 },
      { terms: ['shooting|crash|attack|bombing|blast|explosion|fire|stabbing', 'victims|toll|kill|kills|killed|lives'], weight: 4 },
      { terms: ['plane|bus|car|train|helicopter|truck|boat|airliner|jet|ferry', 'crash|crashed|collision|wreckage'], weight: 3 },
      { terms: ['death|deaths', 'child|children|boy|girl|baby|teen|teenager|man|woman|mother|father|patient|toddler'], weight: 2 }],
    contexts: terms(-7, 'prevent road deaths', 'reduce road deaths', 'prevent deaths', 'save lives', 'road safety', 'death rate falls', 'death rates fall',
      'deaths fall', 'deaths drop', 'deaths decline', 'dead heat', 'dead pool', 'dead end', 'walking dead', 'grateful dead', 'death metal',
      'game of thrones', 'killing it', 'kills it', 'to die for', 'die hard', 'murder mystery', 'dead body video', 'deadly downside', 'death penalty') },
  { id: 'sexual', sections: ['sexual content', 'adult content', 'pornography'], name: 'Sexual Content', threshold: 4,
    terms: terms(5, 'pornography', 'porn', 'sexual content', 'sex scandal', 'explicit images', 'sexually explicit', 'adult content', 'sexual assault', 'sexual assaults',
      'rape', 'raped', 'raping', 'rapist', 'sexual abuse', 'sex abuse', 'sex offence', 'sex offences', 'sex offender', 'sexual offending', 'indecent assault', 'child sex'),
    contexts: terms(-7, 'sexual health education', 'sexual health research') },
  { id: 'war', sections: ['war', 'conflict', 'armed conflict', 'defence', 'defense'], name: 'War & Conflict', threshold: 4,
    terms: [...terms(5, 'war', 'airstrike', 'airstrikes', 'armed conflict', 'invasion', 'bombing', 'air strike', 'air strikes', 'bombings',
      'car bomb', 'suicide bomber', 'suicide bombing', 'shelling', 'insurgents', 'insurgency', 'militants', 'militia', 'militias', 'rebels',
      'taliban', 'al qaeda', 'islamic state', 'hezbollah', 'jihadists', 'terrorist', 'terrorists', 'terrorism', 'terror attack', 'terror plot',
      'missile strike', 'missile strikes', 'drone strike', 'drone strikes', 'mortar attack', 'artillery', 'genocide', 'war crimes',
      'peacekeepers', 'guerrillas', 'warplanes', 'hostage', 'hostages'),
      ...terms(4, 'ceasefire', 'truce', 'coup'),
      ...terms(2, 'troops', 'military', 'soldiers', 'soldier', 'army', 'marines', 'blast', 'blasts', 'explosion', 'attack', 'bomb', 'bombs',
        'missile', 'missiles', 'siege', 'embargo', 'detainees', 'displaced', 'kidnapped', 'offensive', 'terror')],
    combinations: [{ terms: ['military', 'attack'], weight: 3 }, { terms: ['troops|forces', 'combat|offensive|shelling'], weight: 4 },
      { terms: ['military|army|troops|soldiers|forces|marines|militants|rebels', 'attack|attacks|kill|kills|killed|raid|raids|siege|strike|strikes'], weight: 4 },
      { terms: ['bomb|bombs|blast|blasts|explosion|attack|mortar|rocket|rockets', 'kills|killed|wounds|wounded|dead|injured|kill'], weight: 4 },
      { terms: ['terror|terrorist', 'alert|plot|video|charges|threat|scare|scares|suspects'], weight: 4 },
      { terms: ['missile|missiles|ballistic', 'test|tests|fired|fires|launch|launches'], weight: 4 },
      { terms: ['bombs|bombed|bombing|strikes|struck|drones|drone|missiles|shelling|attacks|attack|offensive|invades|troops|barrage|occupation',
        'kyiv|ukraine|ukrainian|russia|russian|moscow|gaza|israel|israeli|lebanon|syria|yemen|sudan|myanmar|iran|houthi|houthis|west bank'], weight: 4 }],
    contexts: terms(-6, 'price war', 'war on waste', 'trade war', 'war of words', 'star wars', 'culture war', 'bidding war', 'turf war',
      'console war', 'war chest', 'attack ad', 'attack ads', 'army of', 'red army', 'front line of', 'ceasefire over', 'hostage to', 'coup de', 'cold war') },
  { id: 'disaster', sections: ['disaster', 'disasters', 'earthquakes', 'wildfires', 'cyclones'], name: 'Disaster', threshold: 4,
    terms: [...terms(5, 'earthquake', 'tsunami', 'wildfire', 'natural disaster', 'disaster zone', 'disaster relief', 'killer heat', 'heat wave', 'chemical leak', 'flooding', 'cyclone', 'earthquakes', 'wildfires', 'quake', 'quakes',
      'typhoon', 'typhoons', 'tornado', 'tornadoes', 'landslide', 'landslides', 'mudslide', 'volcanic eruption', 'avalanche', 'bushfire',
      'bushfires', 'floods', 'flash flooding', 'drought', 'heatwave', 'storm surge', 'locusts'), ...terms(3, 'disaster', 'disasters'), ...terms(2, 'flood', 'hurricane', 'hurricanes', 'storm', 'storms', 'evacuations', 'evacuation')],
    combinations: [{ terms: ['flood|hurricane|storm', 'destroys|devastation|damage|displaced|victims|evacuated|deadly|killed|kills'], weight: 4 },
      { terms: ['disaster|disasters', 'flood|floods|quake|earthquake|storm|cyclone|fire|fires|relief|victims|survivors|dead|killed|toll'], weight: 2 },
      { terms: ['hurricane|typhoon|cyclone|storm|storms|gale|gales|gusts', 'hits|batter|batters|lashes|lash|roars|slams|kills|landfall|whip|whips|pounds|evacuate'], weight: 4 }],
    contexts: terms(-7, 'disaster preparedness', 'disaster prevention', 'earthquake resistant', 'cyclone resistant', 'like wildfire') },
  { id: 'politics', sections: ['politics', 'political', 'elections', 'parliament', 'government'], name: 'Politics', threshold: 4,
    terms: [...terms(4, 'politics', 'election', 'elections', 'parliament', 'prime minister', 'president',
      // Westminster-system vocabulary (NZ, UK, Australia); the learned model is US-centric.
      'mps', 'labour party', 'national party', 'green party', 'greens co leader', 'te pati maori', 'nz first', 'act party',
      'tories', 'tory', 'conservative party', 'liberal party', 'coalition government', 'select committee', 'by election',
      'general election', 'snap election', 'opposition leader', 'shadow minister', 'cabinet minister', 'finance minister',
      'foreign minister', 'deputy prime minister', 'downing street', 'westminster', 'beehive', 'canberra', 'question time',
      'luxon', 'hipkins', 'starmer', 'albanese', 'opportunity party', 'winston peters', 'leaders debate', 'leaders debates', 'election night', 'campaign trail', 'electorate', 'polling booth',
      // Elsewhere: legislatures, US election vocabulary and current national leaders (headlines name them, not "politics").
      'congress', 'senate', 'senator', 'senators', 'lawmakers', 'legislators', 'legislature', 'democrats', 'republicans', 'gop', 'midterm', 'midterms',
      'white house', 'ballot', 'ballots', 'early voting', 'voter id', 'referendum', 'gubernatorial', 'trump', 'trump administration',
      'modi', 'bjp', 'rahul gandhi', 'lok sabha', 'rajya sabha', 'chief minister', 'jaishankar', 'prabowo', 'anwar ibrahim', 'lula', 'bolsonaro',
      'macron', 'carney', 'erdogan', 'xi jinping', 'sheinbaum', 'milei', 'ramaphosa', 'tinubu', 'merz', 'kemi badenoch', 'nigel farage', 'reform uk'),
      ...terms(2, 'government', 'minister', 'policy', 'labour', 'mp', 'cabinet', 'coalition', 'opposition', 'caucus', 'councillor', 'mayor', 'candidate', 'voters', 'campaign',
        'governor', 'pm', 'administration', 'deportations', 'supreme court', 'voting', 'democracy', 'vance')],
    combinations: [{ terms: ['mp|senator|congress|senate|cabinet', 'vote|votes|bill|debate|reform'], weight: 4 },
      { terms: ['labour|national|greens|tories|conservatives|act', 'poll|polls|policy|leader|mps|caucus|campaign|coalition|candidate|minister'], weight: 4 },
      { terms: ['poll|polls|vote|votes|voters|voting', 'party|parties|labour|national|greens|election|candidate|candidates|cost of living'], weight: 4 }],
    contexts: terms(-5, 'company president', 'club president', 'president of the company', 'student election', 'labour weekend', 'labour day', 'labour shortage', 'labour market', 'in labour', 'national park', 'national team') },
  { id: 'sport', sections: ['sport', 'sports', 'rugby', 'football', 'cricket', 'tennis', 'golf', 'netball', 'racing', 'motorsport', 'nfl', 'nba', 'nrl', 'afl',
    'soccer', 'basketball', 'baseball', 'hockey', 'athletics', 'cycling', 'boxing', 'squash', 'othersports'], name: 'Sport', threshold: 4,
    terms: [
      ...terms(4, 'sport', 'sports', 'football', 'rugby', 'cricket', 'tennis', 'olympics', 'world cup', 'basketball',
        'nfl', 'nba', 'nrl', 'afl', 'mlb', 'nhl', 'fifa', 'uefa', 'premier league', 'champions league',
        'formula 1', 'formula one', 'f1', 'grand prix', 'super bowl', 'baseball', 'golf',
        'netball', 'motorsport', 'motogp', 'boxing', 'mma', 'ufc', 'wimbledon',
        'all blacks', 'black caps', 'silver ferns', 'wallabies', 'state of origin', 'ashes',
        // New Zealand competitions and national sides that are unambiguous on their own.
        'super rugby', 'black ferns', 'white ferns', 'tall blacks', 'ranfurly shield', 'bledisloe', 'bledisloe cup', 'america s cup',
        'npc final', 'super netball', 'a league', 'nrlw', 'socceroos', 'matildas', 'football ferns', 'all whites',
        'asian games', 'para games', 'paralympics', 'paralympic', 'commonwealth games', 'march madness', 'ncaa', 'all america', 'odi', 't20', 't20i', 'ipl', 'sepak takraw'),
      ...terms(3, 'goalkeeper', 'touchdown', 'quarterback', 'hat trick', 'penalty shootout',
        'playoffs', 'semifinal', 'semi-final', 'finals series', 'matchday', 'try scorer',
        'test match', 'pole position', 'qualifying lap', 'wicket', 'innings'),
      ...terms(2, 'coach', 'fixture', 'league', 'squad', 'tournament', 'championship', 'stadium',
        'striker', 'midfielder', 'referee', 'medal', 'podium', 'victory', 'season opener', 'wickets')
    ],
    combinations: [
      { terms: ['match', 'win'], weight: 4 }, { terms: ['team', 'defeat'], weight: 4 },
      { terms: ['coach', 'squad'], weight: 4 }, { terms: ['player', 'injury'], weight: 3 },
      { terms: ['race', 'pole'], weight: 4 },
      // Club names that are also ordinary words count only next to sporting language.
      { terms: ['crusaders|blues|chiefs|hurricanes|highlanders|warriors|breakers|phoenix|steelers|mystics|tactix|pulse|magic|stars|knights|storm|broncos|roosters',
        'win|wins|beat|beats|defeat|defeats|thrash|thrashing|clash|squad|coach|captain|match|final|semi|playoff|season|try|tries|signs|re sign|contract|hooker|halfback|prop|lock|winger|fullback|first five|lineup|line up|injury|injured|kick off'], weight: 4 }
    ] },
  { id: 'entertainment', sections: ['entertainment', 'culture', 'arts', 'film', 'movies', 'music', 'television', 'tv'], name: 'Entertainment', threshold: 4,
    terms: terms(4, 'entertainment', 'movie', 'movies', 'film', 'concert', 'music festival', 'television', 'tv show', 'cinema', 'album', 'box office'),
    combinations: [{ terms: ['series|drama', 'streaming|premiere|cast'], weight: 4 },
      { terms: ['producer|showrunner|screenwriter', 'show|shows|series|drama'], weight: 4 },
      { terms: ['the simpsons', 'voice|episode|episodes|apu'], weight: 4 },
      { terms: ['singer|singing|song|songs', 'voice|album|concert|tour'], weight: 4 }],
    contexts: terms(-6, 'film coating', 'plastic film', 'window film') },
  { id: 'opinion', sections: ['opinion', 'opinions', 'editorial', 'editorials', 'comment', 'commentary', 'analysis', 'columns', 'op ed', 'commentisfree', 'comment is free', 'columnists'], name: 'Opinion', threshold: 4,
    // "Analysis: …" and "Opinion | …" leads are the publisher's own label on the story.
    headlineDisclosures: ['opinion', 'analysis', 'comment', 'editorial', 'column', 'commentary', 'op ed', 'perspective'],
    terms: terms(4, 'opinion', 'editorial', 'commentary', 'columnist', 'op ed'),
    contexts: terms(-6, 'opinion poll', 'opinion polls', 'second opinion', 'medical opinion') },
  { id: 'business', sections: ['business', 'economy', 'economics', 'finance', 'money', 'markets', 'personal finance', 'banking', 'superannuation', 'invest', 'investing'], name: 'Business', threshold: 4,
    terms: [...terms(4, 'business', 'economy', 'stocks', 'stock market', 'finance', 'inflation', 'interest rates', 'job cuts', 'layoffs', 'redundancies', 'retrenches',
      'retrenchment', 'jobless', 'gdp', 'recession', 'tariff', 'tariffs', 'trade deal', 'trade deals', 'ipo', 'merger', 'superannuation', 'kiwisaver', 'mortgage rate',
      'mortgage rates', 'asx', 'nzx', 'nasdaq', 'ftse', 'sensex', 'nifty', 'msci', 'wall street'),
      ...terms(3, 'earnings', 'exports', 'unemployment', 'mortgage', 'insurer', 'retailer'), ...terms(2, 'company', 'investment', 'profit', 'profits', 'revenue', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'ceo', 'shares', 'factory', 'imports', 'airline', 'insurance')],
    combinations: [{ terms: ['bank|banks', 'rate|rates|lending'], weight: 4 }, { terms: ['company|firm', 'earnings|revenue|shares'], weight: 4 }, { terms: ['hiring', 'jobs|workers|staff'], weight: 4 },
      { terms: ['workers|staff|employees', 'strike|pay|wages|layoffs|cuts'], weight: 4 },
      { terms: ['firm|company|maker|brand|factory|plant', 'production|shut|shutter|closes|closure|bankrupt|bankruptcy|liquidation|receivership'], weight: 4 }],
    contexts: terms(-6, 'business as usual') },
  { id: 'technology', sections: ['technology', 'tech', 'gadgets', 'computing', 'cybersecurity', 'ai', 'artificial intelligence'], name: 'Technology', threshold: 4,
    terms: [...terms(4, 'technology', 'tech', 'software', 'artificial intelligence', 'cybersecurity', 'smartphone', 'internet', 'broadband', 'ransomware', 'data breach',
      'robot', 'robots', 'robotics', 'hackers', 'hacking', 'hack attempts', 'cyberattack', 'cyber attack', 'video game', 'video games', 'gaming', 'chatbot', 'chatgpt',
      'ai', 'openai', 'anthropic', 'nvidia', 'semiconductor', 'semiconductors', 'data centre', 'data centres', 'data center', 'data centers', 'quantum computing',
      'iphone', 'android', 'smart glasses', 'cyber security', 'cybercrime', 'vulnerabilities'),
      ...terms(3, 'google', 'microsoft', 'social media', 'foldable', 'vulnerability'), ...terms(2, 'app', 'apps', 'drone', 'online', 'apple', 'meta', 'chips')],
    combinations: [{ terms: ['ai', 'model|models|chip|chips|chatbot'], weight: 4 }, { terms: ['app|apps', 'launch|update|released'], weight: 4 }] },
  { id: 'science', sections: ['science', 'sciences', 'astronomy', 'space', 'environment science'], name: 'Science', threshold: 4,
    terms: [...terms(4, 'science', 'scientific', 'scientists', 'astronomy', 'space research'), ...terms(2, 'research', 'discovery', 'study')],
    combinations: [{ terms: ['researchers', 'discover|discovered|experiment|findings'], weight: 4 }, { terms: ['space|nasa', 'telescope|planet|mission|galaxy'], weight: 4 }],
    contexts: terms(-6, 'market research', 'bible study') },
  { id: 'sponsored', sections: ['sponsored', 'promoted', 'paid content', 'partner content', 'advertorial', 'branded content', 'brand stories', 'partner stories', 'brandvoice'], name: 'Sponsored & Paid Content', threshold: 4, fieldWeights: { label: 2 },
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
