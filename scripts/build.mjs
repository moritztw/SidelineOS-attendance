import { compile, optimize } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/** Verbindliche ImportMap-Externals aus SidelineOS-Core (index.html / pluginRuntime.ts). */
const CORE_IMPORTMAP_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'lucide-react',
  '@sidelineos/plugin-sdk',
];

const NODE_EXTERNALS = [
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
  '@sidelineos/plugin-sdk',
];

const CSS_SCOPE_SELECTOR = '.sl-attendance-scope';

async function buildClientCss() {
  const cssEntry = path.join(SRC_DIR, 'client.css');
  const cssSource = await fs.readFile(cssEntry, 'utf8');
  const compiler = await compile(cssSource, {
    base: SRC_DIR,
    onDependency: () => {},
  });

  const scanner = new Scanner({
    sources: [{ base: SRC_DIR, pattern: '**/*.{ts,tsx}', negated: false }],
  });
  const candidates = scanner.scan();
  const rawCss = compiler.build(candidates);

  // Globale Tailwind-Selektoren (:root, :host, *) strikt auf das Plugin-Root-Element isolieren,
  // damit weder CSS-Variablen noch Utility-Klassen in SidelineOS-Core auslaufen.
  const normalized = optimize(rawCss, { minify: false }).code;
  const scopedCss = normalized
    .replaceAll(':root, :host', CSS_SCOPE_SELECTOR)
    .replaceAll(
      '*, ::before, ::after, ::backdrop',
      `${CSS_SCOPE_SELECTOR}, ${CSS_SCOPE_SELECTOR} *, ${CSS_SCOPE_SELECTOR} ::before, ${CSS_SCOPE_SELECTOR} ::after, ${CSS_SCOPE_SELECTOR} ::backdrop`
    )
    .replaceAll(
      '*, :before, :after, ::backdrop',
      `${CSS_SCOPE_SELECTOR}, ${CSS_SCOPE_SELECTOR} *, ${CSS_SCOPE_SELECTOR} :before, ${CSS_SCOPE_SELECTOR} :after, ${CSS_SCOPE_SELECTOR} ::backdrop`
    );

  const prettyCheck = optimize(scopedCss, { minify: false }).code;
  const leakedLines = prettyCheck
    .split('\n')
    .filter(
      (line) =>
        line.includes('{') &&
        !line.trim().startsWith('@') &&
        !line.includes(CSS_SCOPE_SELECTOR)
    );
  if (leakedLines.length > 0 || /:root\b|:host\b/.test(prettyCheck)) {
    throw new Error(
      `Unisolierte CSS-Selektoren gefunden: ${leakedLines.join('; ')}`
    );
  }

  const optimized = optimize(scopedCss, { minify: true });
  await fs.writeFile(path.join(DIST_DIR, 'client.css'), optimized.code, 'utf8');
}

async function runBuild() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  await Promise.all([
    build({
      entryPoints: [path.join(SRC_DIR, 'client.tsx')],
      outfile: path.join(DIST_DIR, 'client.js'),
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      jsx: 'automatic',
      sourcemap: false,
      minify: false,
      external: CORE_IMPORTMAP_EXTERNALS,
    }),
    build({
      entryPoints: [path.join(SRC_DIR, 'server.ts')],
      outfile: path.join(DIST_DIR, 'server.js'),
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node22'],
      sourcemap: false,
      minify: false,
      external: NODE_EXTERNALS,
    }),
    buildClientCss(),
  ]);

  const [clientStat, cssStat, serverStat] = await Promise.all([
    fs.stat(path.join(DIST_DIR, 'client.js')),
    fs.stat(path.join(DIST_DIR, 'client.css')),
    fs.stat(path.join(DIST_DIR, 'server.js')),
  ]);

  console.log(
    `Build abgeschlossen: dist/client.js (${clientStat.size} Bytes), dist/client.css (${cssStat.size} Bytes), dist/server.js (${serverStat.size} Bytes)`
  );
}

runBuild().catch((err) => {
  console.error('Plugin-Build fehlgeschlagen:', err);
  process.exitCode = 1;
});
