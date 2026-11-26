import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const ALLOWED_ARTIFACTS = new Map([
  ['/plugin.manifest.json', { file: 'plugin.manifest.json', contentType: 'application/json; charset=utf-8' }],
  ['/dist/client.js', { file: 'dist/client.js', contentType: 'application/javascript; charset=utf-8' }],
  ['/dist/client.css', { file: 'dist/client.css', contentType: 'text/css; charset=utf-8' }],
  ['/dist/server.js', { file: 'dist/server.js', contentType: 'application/javascript; charset=utf-8' }],
  ['/migrations/001_init.sql', { file: 'migrations/001_init.sql', contentType: 'text/plain; charset=utf-8' }],
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function ensureBuilt() {
  try {
    await fs.access(path.join(ROOT_DIR, 'dist/client.js'));
    await fs.access(path.join(ROOT_DIR, 'dist/client.css'));
    await fs.access(path.join(ROOT_DIR, 'dist/server.js'));
  } catch {
    await execFileAsync(process.execPath, [path.join(ROOT_DIR, 'scripts/build.mjs')], {
      cwd: ROOT_DIR,
    });
  }
}

async function collectArtifactInfo() {
  const manifestRaw = await fs.readFile(path.join(ROOT_DIR, 'plugin.manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const files = [];

  for (const [route, entry] of ALLOWED_ARTIFACTS.entries()) {
    try {
      const stat = await fs.stat(path.join(ROOT_DIR, entry.file));
      files.push({ route, file: entry.file, size: stat.size, exists: true });
    } catch {
      files.push({ route, file: entry.file, size: 0, exists: false });
    }
  }

  return { manifest, files };
}

function renderIndexHtml(manifest, files) {
  const permissionsHtml = (manifest.permissions || [])
    .map((perm) => `<span class="badge">${escapeHtml(perm)}</span>`)
    .join('');

  const artifactRows = files
    .map(
      (item) => `
      <tr>
        <td><a href="${escapeHtml(item.route)}" class="link">${escapeHtml(item.file)}</a></td>
        <td>${item.exists ? formatBytes(item.size) : 'Fehlt'}</td>
        <td><span class="${item.exists ? 'status-ok' : 'status-err'}">${item.exists ? 'Bereit' : 'Nicht gebaut'}</span></td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)} · SidelineOS Plugin Dev Server</title>
    <style>
      :root {
        --sl-bg-canvas: #0b0e11;
        --sl-bg-surface: #13171d;
        --sl-bg-elevated: #1c222b;
        --sl-border: #262e3a;
        --sl-text-heading: #f8fafc;
        --sl-text-primary: #cbd5e1;
        --sl-text-muted: #94a3b8;
        --sl-accent: #38bdf8;
        --sl-accent-contrast: #0f172a;
        --sl-success-text: #34d399;
        --sl-danger-text: #f87171;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--sl-bg-canvas);
        color: var(--sl-text-primary);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 32px 20px;
      }
      .container {
        max-width: 820px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .card {
        background: var(--sl-bg-surface);
        border: 1px solid var(--sl-border);
        border-radius: 14px;
        padding: 22px;
      }
      h1 {
        margin: 0 0 6px 0;
        color: var(--sl-text-heading);
        font-size: 1.5rem;
      }
      h2 {
        margin: 0 0 14px 0;
        color: var(--sl-text-heading);
        font-size: 1rem;
      }
      p { margin: 0; color: var(--sl-text-muted); line-height: 1.5; }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .meta-item {
        background: var(--sl-bg-elevated);
        border: 1px solid var(--sl-border);
        border-radius: 10px;
        padding: 12px;
      }
      .meta-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--sl-text-muted);
      }
      .meta-val {
        margin-top: 4px;
        font-weight: 600;
        color: var(--sl-text-heading);
        font-size: 0.95rem;
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .badge {
        background: var(--sl-bg-elevated);
        border: 1px solid var(--sl-border);
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 0.78rem;
        color: var(--sl-text-primary);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th, td {
        text-align: left;
        padding: 10px 8px;
        border-bottom: 1px solid var(--sl-border);
      }
      th {
        color: var(--sl-text-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .link {
        color: var(--sl-accent);
        text-decoration: none;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .link:hover { text-decoration: underline; }
      .status-ok { color: var(--sl-success-text); font-weight: 600; }
      .status-err { color: var(--sl-danger-text); font-weight: 600; }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="card">
        <h1>${escapeHtml(manifest.name)}</h1>
        <p>${escapeHtml(manifest.description || '')}</p>
        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Plugin-ID</div>
            <div class="meta-val">${escapeHtml(manifest.id)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Version</div>
            <div class="meta-val">v${escapeHtml(manifest.version)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">SDK / Min Core</div>
            <div class="meta-val">SDK ${escapeHtml(manifest.sdkVersion)} · ${escapeHtml(manifest.minCoreVersion)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">DB-Präfix</div>
            <div class="meta-val">${escapeHtml(manifest.dbPrefix)}</div>
          </div>
        </div>
        <div class="badges">${permissionsHtml}</div>
      </section>

      <section class="card">
        <h2>Build-Artefakte (SidelineOS-Core Plugin-Bundle)</h2>
        <table>
          <thead>
            <tr>
              <th>Datei</th>
              <th>Größe</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${artifactRows}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

async function startServer() {
  await ensureBuilt();

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', plugin: 'attendance' }));
      return;
    }

    if (ALLOWED_ARTIFACTS.has(pathname)) {
      const entry = ALLOWED_ARTIFACTS.get(pathname);
      try {
        const content = await fs.readFile(path.join(ROOT_DIR, entry.file));
        res.writeHead(200, {
          'Content-Type': entry.contentType,
          'Cache-Control': 'no-store',
        });
        res.end(content);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Artefakt nicht gefunden. Bitte zuerst `npm run build` ausführen.');
      }
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      try {
        const { manifest, files } = await collectArtifactInfo();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(renderIndexHtml(manifest, files));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Fehler beim Laden des Plugin-Status: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(PORT, HOST, () => {
    console.log(`SidelineOS Attendance Plugin Dev-Server läuft auf http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Dev-Server konnte nicht gestartet werden:', err);
  process.exit(1);
});
