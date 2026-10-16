/**
 * Checks every story in the built Storybook, as CI does after building it:
 *
 *   npm run build-storybook && npm run check-storybook
 *
 * - Accessibility, with axe. Stories show dark and light side by side, so
 *   one pass covers both; dialogs and menus open outside the story in the
 *   page's theme, so the page is turned to light for a second pass.
 * - The "Patterns we do not use" from #189 that a page can show, from
 *   storybook-patterns.js.
 *
 * A story can switch either off with `parameters.a11y.disable` or
 * `parameters.patterns.disable`, which should come with a reason.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { createServer } from 'http';
import { createRequire } from 'module';
import { extname, join, normalize } from 'path';
import { chromium, type Page } from 'playwright';

const STATIC_DIR = 'storybook-static';
const PORT = 6106;

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serves the build, so the check needs nothing else running. */
const serve = () =>
  createServer((request, response) => {
    const path = normalize(decodeURIComponent(request.url!.split('?')[0]));
    let file = join(STATIC_DIR, path);
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, 'index.html');
    }
    if (!file.startsWith(STATIC_DIR) || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  }).listen(PORT);

const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);
const PATTERNS_SOURCE = `${readFileSync(
  new URL('./storybook-patterns.js', import.meta.url),
  'utf8',
)}\nfindPatterns();`;

type Story = { id: string; title: string; name: string; type: string };

type Parameters = {
  a11y?: { disable?: boolean };
  patterns?: { disable?: boolean };
};

/** Waits for the story and its play function, and hands back its parameters. */
async function render(page: Page, id: string): Promise<Parameters> {
  await page.goto(
    `http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`,
  );
  await page.waitForFunction(() => {
    const phase = (window as any).__STORYBOOK_PREVIEW__?.currentRender?.phase;
    return phase === 'finished' || phase === 'errored' || phase === 'aborted';
  });
  // Let overlays finish fading in.
  await page.waitForTimeout(250);
  return page.evaluate(
    () => (window as any).__STORYBOOK_PREVIEW__.currentRender.story.parameters,
  );
}

async function axe(page: Page) {
  if (!(await page.evaluate(() => 'axe' in window))) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }
  const violations: {
    id: string;
    help: string;
    nodes: { target: string[] }[];
  }[] = await page.evaluate(async () => {
    const result = await (window as any).axe.run(
      // The preview's own frame is not ours to check.
      { exclude: [['#storybook-docs']] },
      {
        // WCAG A and AA. The best-practice rules are about whole pages (one
        // main landmark, an h1), which a story of one component is not.
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      },
    );
    return result.violations;
  });
  return violations.map(
    violation =>
      `${violation.id}: ${violation.help} (${violation.nodes
        .map(node => node.target.join(' '))
        .slice(0, 3)
        .join(', ')})`,
  );
}

async function main() {
  if (!existsSync(join(STATIC_DIR, 'index.json'))) {
    throw new Error('Build Storybook first: npm run build-storybook');
  }
  const index: { entries: Record<string, Story> } = JSON.parse(
    readFileSync(join(STATIC_DIR, 'index.json'), 'utf8'),
  );
  const stories = Object.values(index.entries).filter(
    entry => entry.type === 'story',
  );

  const server = serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const failures: string[] = [];

  for (const story of stories) {
    const problems: string[] = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', error => problems.push(`error: ${error.message}`));

    const parameters = await render(page, story.id);

    if (!parameters.a11y?.disable) {
      problems.push(...(await axe(page)).map(line => `a11y, dark: ${line}`));
      await page.evaluate(() =>
        document.documentElement.classList.remove('dark'),
      );
      // Colours ease between themes; let them settle.
      await page.waitForTimeout(250);
      problems.push(...(await axe(page)).map(line => `a11y, light: ${line}`));
    }

    if (!parameters.patterns?.disable) {
      const findings: string[] = await page.evaluate(PATTERNS_SOURCE);
      problems.push(...findings.map(line => `pattern: ${line}`));
    }

    const name = `${story.title} / ${story.name}`;
    if (problems.length > 0) {
      failures.push(`${name}\n  ${problems.join('\n  ')}`);
      console.log(`fail  ${name}`);
    } else {
      console.log(`ok    ${name}`);
    }
  }

  await browser.close();
  server.close();

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} of ${stories.length} stories failed:\n`,
    );
    console.error(failures.join('\n\n'));
    process.exit(1);
  }
  console.log(`\nAll ${stories.length} stories passed.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
