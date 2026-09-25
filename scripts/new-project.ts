import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// Plan §3.1: run once in a fresh clone. `npm run new-project -- <name> <port>`, or answer the prompts.
// Rewrites only clone-owned files. FOUNDATION_VERSION is left alone: it records the release this clone
// started from, and foundation:drift diffs against it.
const TEMPLATE_PORT = '4100';

export function rewrite(files: { pkg: string; playwright: string; ci: string; readme: string }, name: string, port: string, version: string) {
  const pkg = JSON.parse(files.pkg) as { name: string; scripts: Record<string, string> };
  pkg.name = name;
  for (const k of Object.keys(pkg.scripts)) {
    if (k === 'dev:template' || k === 'predev:template') delete pkg.scripts[k];
    else pkg.scripts[k] = pkg.scripts[k]!.replaceAll('__PORT__', port).replaceAll(TEMPLATE_PORT, port);
  }
  return {
    pkg: `${JSON.stringify(pkg, null, 2)}\n`,
    playwright: files.playwright.replaceAll(TEMPLATE_PORT, port),
    ci: files.ci.replaceAll(TEMPLATE_PORT, port).replaceAll('saas_foundation', name.replaceAll('-', '_')),
    readme: `# ${name}\n\n> Cloned from saas-foundation ${version}. Port ${port}. Upgrade with \`npm run foundation:status\`; template-owned paths are listed in the template's plan §3.2.\n\n${files.readme.replace(/^# .*\n+/, '')}`,
  };
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const name = process.argv[2] ?? (await rl.question('Project name (kebab-case): ')).trim();
  const port = process.argv[3] ?? (await rl.question('Port (next free hundred in ~/.claude/CLAUDE.md): ')).trim();
  rl.close();
  if (!/^[a-z][a-z0-9-]*$/.test(name) || name === 'saas-foundation') throw new Error('Name must be kebab-case and not "saas-foundation".');
  if (!/^\d{4,5}$/.test(port) || port === TEMPLATE_PORT) throw new Error(`Port must be 4-5 digits and not ${TEMPLATE_PORT} (the template's).`);

  const read = (f: string) => readFileSync(f, 'utf8');
  const out = rewrite(
    { pkg: read('package.json'), playwright: read('playwright.config.ts'), ci: read('.github/workflows/ci.yml'), readme: read('README.md') },
    name, port, read('FOUNDATION_VERSION').trim(),
  );
  writeFileSync('package.json', out.pkg);
  writeFileSync('playwright.config.ts', out.playwright);
  writeFileSync('.github/workflows/ci.yml', out.ci);
  writeFileSync('README.md', out.readme);
  console.log(`Rewrote package.json, playwright.config.ts, ci.yml and README.md for ${name} on :${port}.

Still to do by hand:
  [ ] ~/.claude/CLAUDE.md: add the port-table row (${name} -> ${port}) in this commit
  [ ] Neon project: pooled URL for DATABASE_URL, unpooled for DIRECT_URL (deployed environments only)
  [ ] Vercel project (Root Directory "."; the ignoreCommand in vercel.json is already set)
  [ ] Private GitHub repo, then: git remote add origin <url>
  [ ] Before the first push: git ls-files | grep -iE "\\.env|secret|credential|\\.pem$|\\.key$"  (only .env.example may appear)
  [ ] Add this clone's row to the template's CLONES.md
Then: npm run db:setup && npm run seed:demo && npm run dev`);
}

if (process.argv[1]?.endsWith('new-project.ts')) await main();
