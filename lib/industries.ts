// lib/industries.ts — Industry profiles (Business Proposal §5: target markets).
//
// AIBOS speaks each business's language: a lodge owner thinks in guests and
// bookings, a miner in output and equipment, a shop owner in stock and
// customers. One registry tailors terminology, suggested questions and record
// examples per vertical — with a generic fallback so NO business is left out.
//
// Everything here maps to capability that EXISTS today (spine intents, glossary,
// Grok with real context). No profile promises analysis we can't run yet —
// vertical engines (menu engineering, yield analysis, occupancy) plug in here
// when they ship.

export interface IndustryProfile {
  key: string;
  /** Human label shown in copy, e.g. "hotel & lodge". */
  label: string;
  /** What this business calls its inventory: stock, supplies, ingredients… */
  stockWord: string;
  /** What this business calls the people it serves. */
  customerWord: string;
  /** A natural-language Record example in the owner's own vocabulary. */
  saleExample: string;
  /** Suggested assistant questions — every one answerable from real data today. */
  prompts: string[];
}

const PROFILES: Record<string, IndustryProfile> = {
  restaurant: {
    key: 'restaurant',
    label: 'restaurant',
    stockWord: 'ingredients & stock',
    customerWord: 'customers',
    saleExample: 'sold 12 plates of nshima with chicken, K840',
    prompts: [
      'How much did I make today?',
      "What's a good food cost?",
      "What's my current inventory?",
      'How much cash do I have?',
    ],
  },
  hospitality: {
    key: 'hospitality',
    label: 'hotel & lodge',
    stockWord: 'supplies',
    customerWord: 'guests',
    saleExample: '3 rooms booked tonight at K650 each',
    prompts: [
      'How much did I make today?',
      "What's a good occupancy rate?",
      'How much cash do I have?',
      'Who owes me money?',
    ],
  },
  retail: {
    key: 'retail',
    label: 'shop',
    stockWord: 'stock',
    customerWord: 'customers',
    saleExample: 'sold 3 bags of mealie meal for K450',
    prompts: [
      "What's my current inventory?",
      'How much did I make today?',
      'Are my suppliers delivering today?',
      'How much cash do I have?',
    ],
  },
  ecommerce: {
    key: 'ecommerce',
    label: 'online store',
    stockWord: 'stock',
    customerWord: 'buyers',
    saleExample: 'sold 2 pairs of sneakers online, K1,300',
    prompts: [
      "What's my current inventory?",
      'How much did I make today?',
      "What's a good conversion rate?",
      'How much cash do I have?',
    ],
  },
  mine: {
    key: 'mine',
    label: 'mining operation',
    stockWord: 'materials & consumables',
    customerWord: 'buyers',
    saleExample: 'delivered 20 tonnes of aggregate to ZamBuild, K48,000',
    prompts: [
      'How much cash do I have?',
      'What should cost per tonne be?',
      'What do I owe suppliers?',
      'How much did I make today?',
    ],
  },
  farm: {
    key: 'farm',
    label: 'farm',
    stockWord: 'produce & inputs',
    customerWord: 'buyers',
    saleExample: 'sold 40 trays of eggs at K85 each',
    prompts: [
      'How much did I make today?',
      "What's my current inventory?",
      'Who owes me money?',
      'How much cash do I have?',
    ],
  },
  services: {
    key: 'services',
    label: 'service business',
    stockWord: 'supplies',
    customerWord: 'clients',
    saleExample: 'invoiced Mwansa K2,500 for consulting',
    prompts: [
      'Who owes me money?',
      'How much did I make today?',
      'How much cash do I have?',
      'What should I focus on first?',
    ],
  },
  manufacturing: {
    key: 'manufacturing',
    label: 'production business',
    stockWord: 'raw materials & stock',
    customerWord: 'customers',
    saleExample: 'sold 200 concrete blocks to Lusaka Builders, K3,000',
    prompts: [
      "What's my current inventory?",
      'What do I owe suppliers?',
      'How much did I make today?',
      'How much cash do I have?',
    ],
  },
  generic: {
    key: 'generic',
    label: 'business',
    stockWord: 'stock',
    customerWord: 'customers',
    saleExample: 'sold 3 bags of mealie meal for K450',
    prompts: [
      'How much cash do I have?',
      'How much did I make today?',
      "What's my current inventory?",
      'What should I focus on first?',
    ],
  },
};

// Keyword → profile matching over business_type + industry free text. First
// match wins; order puts the more specific words ahead of the broad ones.
const MATCHERS: Array<[RegExp, keyof typeof PROFILES]> = [
  [/restaurant|food|cafe|café|kitchen|catering|takeaway|fast.?food|bar\b|pub\b/, 'restaurant'],
  [/hotel|lodge|guest.?house|hospitality|accommodation|bnb|airbnb|resort/, 'hospitality'],
  [/mine|mining|quarry|extract|drill|aggregate|gemstone|copper|cobalt|gold/, 'mine'],
  [/e-?com|online|marketplace|dropship/, 'ecommerce'],
  [/farm|agri|poultry|livestock|crop|horticult|fisher/, 'farm'],
  [/manufactur|production|factory|workshop|fabricat|process/, 'manufacturing'],
  [/retail|shop|store|trading|grocer|boutique|hardware|pharmacy/, 'retail'],
  [/service|consult|salon|barber|clinic|law|account|transport|logistics|repair|cleaning/, 'services'],
];

/** Resolve the industry profile for a business. Never returns null. */
export function industryOf(businessType?: string | null, industry?: string | null): IndustryProfile {
  const hay = `${businessType ?? ''} ${industry ?? ''}`.toLowerCase();
  if (hay.trim()) {
    for (const [re, key] of MATCHERS) {
      if (re.test(hay)) return PROFILES[key];
    }
  }
  return PROFILES.generic;
}
