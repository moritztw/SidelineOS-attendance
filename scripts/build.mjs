import { build } from 'esbuild';
import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
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

async function runBuild() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  await Promise.all([
    build({
      entryPoints: [path.join(ROOT_DIR, 'src/client.tsx')],
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
      entryPoints: [path.join(ROOT_DIR, 'src/server.ts')],
      outfile: path.join(DIST_DIR, 'server.js'),
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node22'],
      sourcemap: false,
      minify: false,
      loader: {
        '.sql': 'text',
      },
      external: NODE_EXTERNALS,
    }),
  ]);

  const [clientStat, serverStat] = await Promise.all([
    fs.stat(path.join(DIST_DIR, 'client.js')),
    fs.stat(path.join(DIST_DIR, 'server.js')),
  ]);

  console.log(
    `Build abgeschlossen: dist/client.js (${clientStat.size} Bytes), dist/server.js (${serverStat.size} Bytes)`
  );
}

runBuild().catch((err) => {
  console.error('Plugin-Build fehlgeschlagen:', err);
  process.exitCode = 1;
});
