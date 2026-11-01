import { Effort, LoopMode, MODES } from './config';

export type Tier = 'NANO' | 'MICRO' | 'STANDARD' | 'DEEP';

export interface Intents {
  code: boolean;
  app: boolean;
  json: boolean;
  fresh: boolean;
  image: boolean;
  model3d: boolean;
  video: boolean;
}

export interface Route {
  tier: Tier;
  intents: Intents;
  maxTokens: number;
  effort: Effort;
  /** how many recent messages to send verbatim */
  historyMsgs: number;
  maxRefines: number;
  allowSearch: boolean;
  /** zero-token local reply (greeting, /budget …). Present => no API call. */
  reflex?: string;
  /** slash command to run locally */
  command?: 'budget' | 'notes' | 'forget' | 'help' | 'mode';
}

const REFLEX: Array<[RegExp, string]> = [
  [/^(hi|hey|hello|yo|sup|hola|gm)\b[\s.!?]*$/i, 'AIX Alpha v3 online. What are we building?'],
  [/^(thanks|thank you|thx|ty|cheers)\b[\s.!?]*$/i, 'Anytime. Send the next task when ready.'],
  [/^(ok|okay|cool|nice|great|got it|perfect|awesome|k|👍)[\s.!?]*$/i, 'Acknowledged. Standing by.'],
];

const COMMANDS: Array<[RegExp, NonNullable<Route['command']>]> = [
  [/^\/(budget|cost|usage)\b/i, 'budget'],
  [/^\/notes\b/i, 'notes'],
  [/^\/(forget|clear)\b/i, 'forget'],
  [/^\/(help|\?)\b/i, 'help'],
  [/^\/mode\b/i, 'mode'],
];

const BUILD_VERB = /\b(build|create|make|write|generate|code|implement|design|develop|scaffold|refactor|debug|fix|port|convert)\b/i;
const BUILD_OBJECT = /\b(app|game|website|web ?page|page|landing|dashboard|component|script|html|css|function|class|api|server|endpoint|plugin|extension|bot|tool|widget|site|ui|module|library|cli|sql|schema|three\.?js|react)\b/i;

export function detectIntents(prompt: string): Intents {
  const p = prompt.toLowerCase();
  const code = BUILD_VERB.test(p) && BUILD_OBJECT.test(p) || /```/.test(prompt);
  const app = /\b(html|web ?app|website|landing ?page|dashboard|game|single[- ]file|three\.?js|canvas|app)\b/i.test(p) && BUILD_VERB.test(p);
  return {
    code,
    app,
    json: /\bjson\b/.test(p) && /\b(return|output|give|respond|as|in|format)\b/.test(p),
    fresh: /\b(today|latest|current(ly)?|news|right now|this week|this month|breaking|price of|weather|score|stock|who is the (current )?|release date|just (released|announced))\b/.test(p) || /\b202[5-9]\b/.test(p),
    image: /\b(generate image|create image|draw|picture of|photo of|illustration|wallpaper|logo concept)\b/.test(p),
    model3d: /\b(3d model|3d |mesh|webgl model|texture)\b/.test(p),
    video: /\b(video|animate|animation|motion clip)\b/.test(p),
  };
}

export function route(
  prompt: string,
  opts: { mode: LoopMode; hasAttachments?: boolean; searchEnabled?: boolean; personaEffort?: Effort },
): Route {
  const mode = MODES[opts.mode] ?? MODES.eco;
  const trimmed = (prompt || '').trim();
  const intents = detectIntents(trimmed);
  const base = { intents, allowSearch: false, maxRefines: 0, effort: 'low' as Effort, historyMsgs: 2, maxTokens: 300 };

  // Layer 0 — reflexes cost zero tokens.
  if (!opts.hasAttachments) {
    for (const [re, command] of COMMANDS) if (re.test(trimmed)) return { ...base, tier: 'NANO', command };
    if (trimmed.length <= 24) for (const [re, reply] of REFLEX) if (re.test(trimmed)) return { ...base, tier: 'NANO', reflex: reply };
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const heavy = intents.app || (intents.code && words > 25) || trimmed.length > 1500 || /\b(architecture|analy[sz]e|compare|in depth|deep dive|step[- ]by[- ]step|essay|report|full|complete|comprehensive|audit|review)\b/i.test(trimmed);
  const small = words <= 14 && !intents.code && !opts.hasAttachments;

  const scale = (n: number) => Math.round(n * mode.capScale);
  const hist = (n: number) => Math.round(n * mode.histScale);
  const allowSearch = !!opts.searchEnabled && intents.fresh;

  if (small) {
    return { ...base, tier: 'MICRO', maxTokens: scale(450), effort: 'low', historyMsgs: hist(4), maxRefines: Math.min(1, mode.maxRefines), allowSearch };
  }
  if (!heavy) {
    return { ...base, tier: 'STANDARD', maxTokens: scale(1600), effort: 'low', historyMsgs: hist(8), maxRefines: mode.maxRefines, allowSearch };
  }
  return {
    ...base,
    tier: 'DEEP',
    maxTokens: scale(intents.app ? 9000 : 5000),
    effort: opts.personaEffort === 'low' ? 'low' : mode.deepEffort,
    historyMsgs: hist(6),
    maxRefines: mode.maxRefines,
    allowSearch,
  };
}
