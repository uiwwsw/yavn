// `{{variable}}` placeholders let reading text show story state, such as a name the player typed.
// `{{variable|은}}` also attaches a Korean particle that agrees with the value's final sound
// (은/는, 이/가, 을/를, 과/와, 으로/로 …), because a typed name may or may not end in a batchim.
// Unknown placeholders are left as written so a typo stays visible instead of silently vanishing;
// the parser rejects placeholders that name undeclared state.

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\|\s*([가-힣]+)\s*)?\}\}/g;

// [after a batchim, after a vowel]
const PARTICLE_PAIRS: Array<[string, string]> = [
  ['은', '는'], ['이', '가'], ['을', '를'], ['과', '와'], ['아', '야'], ['이여', '여'],
  ['이랑', '랑'], ['이나', '나'], ['이란', '란'], ['으로', '로'], ['이라', '라'], ['이에요', '예요'],
];

// Korean readings of digits: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 end in a batchim.
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);
const RIEUL = 8;

function finalSound(word: string): { batchim: boolean; rieul: boolean } | undefined {
  const last = word.trim().slice(-1);
  if (!last) return undefined;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === RIEUL };
  }
  if (/[0-9]/.test(last)) return { batchim: DIGIT_BATCHIM.has(last), rieul: last === '1' || last === '7' || last === '8' };
  return undefined;
}

export function attachParticle(word: string, particle: string): string {
  const pair = PARTICLE_PAIRS.find(([withBatchim, withoutBatchim]) => particle === withBatchim || particle === withoutBatchim);
  if (!pair) return `${word}${particle}`;
  const sound = finalSound(word);
  // Unknown final sound (Latin letters, symbols): write both forms, as Korean text conventionally does.
  if (!sound) return `${word}${pair[0]}(${pair[1]})`;
  if (pair[0] === '으로') return `${word}${sound.batchim && !sound.rieul ? '으로' : '로'}`;
  return `${word}${sound.batchim ? pair[0] : pair[1]}`;
}

export function interpolateText(text: string, vars: Record<string, unknown>): string {
  if (!text.includes('{{')) return text;
  return text.replace(PLACEHOLDER, (match, key: string, particle: string | undefined) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const value = vars[key];
    const word = value === undefined || value === null ? '' : String(value);
    return particle ? attachParticle(word, particle) : word;
  });
}

export function collectTextVariables(text: string | undefined): string[] {
  if (!text || !text.includes('{{')) return [];
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
}
