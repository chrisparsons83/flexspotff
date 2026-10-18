/**
 * The "Patterns we do not use" from #189 that can be read off the source of
 * the routes and their components. check-storybook.ts covers the component
 * library from its rendered stories; this covers the pages, which have no
 * stories.
 *
 * A line can opt out with a comment naming why on the line before it:
 * `// check:patterns allow: <reason>`, for text the site does not show, such
 * as a Discord message.
 *
 * Usage: tsx scripts/check-patterns.ts [path ...]
 * With no paths it checks app/routes and app/components. Prints one line per
 * finding and a count per rule, and exits 1 if there are any.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Checked by check-storybook, or on their way out with #195. */
const SKIP = [
  /\.(test|stories)\.tsx?$/,
  /^app\/components\/ui\//,
  /^app\/components\/mocks\//,
  /^app\/routes\/design\./,
  // A reprinted magazine article, kept unlinked: its copy is not ours to edit.
  /^app\/routes\/in-a-dingy-corner-of-the-internet-is-a-message-board\.tsx$/,
];

const PALETTE =
  /^(?:[a-z-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|divide|outline|from|via|to|fill|stroke|decoration|placeholder|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?$/;

/** Rules read off the class names in string literals. */
const CLASS_RULES: [string, RegExp][] = [
  ['raw palette class', PALETTE],
  ['dark: variant', /^dark:/],
  ['rounded corner', /^(?:[a-z-]+:)*rounded(?:-[a-z0-9[\]]+)*$/],
  ['shadow', /^(?:[a-z-]+:)*shadow(?:-(?!none)[a-z0-9]+)?$/],
  ['gradient', /^(?:[a-z-]+:)*bg-gradient-/],
  ['eyebrow', /^(?:[a-z-]+:)*tracking-(?:wide|wider|widest)$/],
];

/** Rules read off the whole line. */
const LINE_RULES: [string, RegExp][] = [
  ['emoji', /\p{Extended_Pictographic}/u],
  ['tick, cross or star mark', /[✓✔✗✘✕★☆]/],
  ['dot or bullet as a separator', /\s[·•]\s|['">{]\s*[·•]\s*['"<}]/],
  ['em dash', /—/],
  ['Headless UI or Heroicons', /from '@(?:headlessui|heroicons)\//],
];

const STRING = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

const files = (path: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap(name => files(join(path, name)))
    : /\.tsx?$/.test(path)
    ? [path]
    : [];

const isComment = (line: string) => /^\s*(\/\/|\/?\*)/.test(line);

const args = process.argv.slice(2);
const targets = (args.length ? args : ['app/routes', 'app/components']).map(
  arg => join(ROOT, arg),
);

const counts = new Map<string, number>();
let total = 0;

for (const file of targets.flatMap(files)) {
  const path = relative(ROOT, file);
  if (SKIP.some(pattern => pattern.test(path))) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    if (isComment(line)) continue;
    if (lines[index - 1]?.includes('check:patterns allow')) continue;
    const found = new Set<string>();
    for (const [rule, pattern] of LINE_RULES) {
      if (pattern.test(line)) found.add(rule);
    }
    for (const [, , text] of line.matchAll(STRING)) {
      for (const token of text.split(/\s+/)) {
        for (const [rule, pattern] of CLASS_RULES) {
          if (pattern.test(token)) found.add(rule);
        }
      }
    }
    for (const rule of found) {
      console.log(`${path}:${index + 1}: ${rule}: ${line.trim()}`);
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
      total++;
    }
  }
}

if (total) {
  console.log('');
  for (const [rule, count] of counts) console.log(`${count}\t${rule}`);
  process.exit(1);
}
console.log('No patterns found.');
