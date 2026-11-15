import { readFileSync, readdirSync } from 'node:fs';
import yaml from 'js-yaml';

const DIR = 'public/game-list';
const PAT = {
  '자기 행위 논평 (~고 있다로 닫음)': /[.?!]\s[^.?!]{1,30}(세고|보고|듣고|기다리고|하고|적고|헤아리고|따지고|묻고|찾고) 있다\.?$/,
  '~것도 없다 / ~것뿐이다 / ~것만 안다': /(것도 없다|것뿐이다|것만 안다|것만 알겠다|것뿐이었다|것도 없었다)[.…]?$/,
  '없다 두 번 이상': /없다[^.?!]*[.?!][^.?!]*없다/,
  '모른다·모르겠다 두 번 이상': /(모른다|모르겠다)[^.?!]*[.?!][^.?!]*(모른다|모르겠다)/,
};

for (const g of readdirSync(DIR).filter((d) => !d.includes('.') && d !== 'live2dtest')) {
  const hits = {};
  for (const f of readdirSync(`${DIR}/${g}`).filter((f) => f.endsWith('.yaml')).sort()) {
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      for (const [k, v] of Object.entries(n)) {
        if (k === 'say' && v && typeof v.text === 'string') {
          const who = v.char ?? `#${v.channel ?? 'narration'}`;
          for (const [name, re] of Object.entries(PAT)) {
            if (re.test(v.text.trim())) (hits[name] ??= []).push(`${g}/${f} [${who}] ${v.text}`);
          }
          continue;
        }
        walk(v);
      }
    };
    walk(yaml.load(readFileSync(`${DIR}/${g}/${f}`, 'utf8')));
  }
  const total = Object.values(hits).flat().length;
  if (!total) continue;
  console.log(`\n===== ${g} (${total}건)`);
  for (const [name, rows] of Object.entries(hits)) {
    console.log(`  -- ${name}`);
    rows.forEach((r) => console.log('     ' + r));
  }
}
