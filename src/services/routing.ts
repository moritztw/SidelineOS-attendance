export const EVENT_QUERY_PARAM = 'event';

const VALID_DETAIL_TABS = new Set(['overview', 'calendar']);

/**
 * Ermittelt den stabilen Core-Modulpfad für das Attendance-Plugin.
 * SidelineOS-Core validiert `window.location.pathname` strikt auf `/modules/<pluginId>/<tab>`
 * (maximal 2 Segmente unter `/modules/`), lässt aber Query-Parameter (`?event=<id>`)
 * bei Reload, Direktlinks und History-Navigation vollständig unangetastet.
 */
export function resolveDetailBasePath(currentTab?: string, currentPathname?: string): string {
  const normalizedTab = currentTab && VALID_DETAIL_TABS.has(currentTab) ? currentTab : 'overview';

  if (currentPathname) {
    const clean = currentPathname.replace(/\/+$/, '') || '/';
    const match = /^\/modules\/attendance\/([^/]+)$/.exec(clean);
    if (match && VALID_DETAIL_TABS.has(match[1])) {
      return `/modules/attendance/${match[1]}`;
    }
  }

  return `/modules/attendance/${normalizedTab}`;
}

/**
 * Erzeugt eine reload- und teilbare Deep-Link-URL für die Termindetailansicht.
 */
export function buildEventDetailUrl(
  eventId: string,
  options: { currentTab?: string; currentPathname?: string; currentSearch?: string } = {}
): string {
  const pathname = resolveDetailBasePath(
    options.currentTab,
    options.currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : undefined)
  );
  const params = new URLSearchParams(
    options.currentSearch ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  params.set(EVENT_QUERY_PARAM, eventId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Entfernt den `event`-Parameter aus der aktuellen URL und liefert die Basis-Tab-URL.
 */
export function buildTabBaseUrl(
  options: { currentTab?: string; currentPathname?: string; currentSearch?: string } = {}
): string {
  const rawPathname =
    options.currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const pathname = rawPathname || resolveDetailBasePath(options.currentTab);
  const params = new URLSearchParams(
    options.currentSearch ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  params.delete(EVENT_QUERY_PARAM);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Liest eine Termin-ID aus `window.location.search` (`?event=<id>`) oder optionalem Hash (`#event=<id>`).
 */
export function readEventIdFromUrl(locationLike?: { search: string; hash?: string }): string | null {
  const loc =
    locationLike ??
    (typeof window !== 'undefined'
      ? { search: window.location.search, hash: window.location.hash }
      : { search: '', hash: '' });

  const params = new URLSearchParams(loc.search || '');
  const fromQuery = params.get(EVENT_QUERY_PARAM)?.trim();
  if (fromQuery) {
    return fromQuery;
  }

  const hash = (loc.hash || '').replace(/^#/, '');
  if (hash.startsWith(`${EVENT_QUERY_PARAM}=`)) {
    try {
      const decoded = decodeURIComponent(hash.slice(EVENT_QUERY_PARAM.length + 1)).trim();
      if (decoded) return decoded;
    } catch {
      // Ungültiges Hash-Encoding ignorieren
    }
  }

  return null;
}

/**
 * Erkennt Modifikator-Klicks (Neuer Tab / Neues Fenster / Rechtsklick),
 * damit native `<a>`-Links auf Termine vollständig wie echte Browser-Links funktionieren.
 */
export function isModifiedLinkClick(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}): boolean {
  return Boolean(
    event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (typeof event.button === 'number' && event.button !== 0)
  );
}
