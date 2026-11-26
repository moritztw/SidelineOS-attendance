import { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { fetchStatsCsvExport, fetchStatsReport } from '../api/attendanceApi.ts';
import type { StatsReport } from '../types.ts';

export function StatsView({
  teamId,
  season,
  isStaff,
  locale = 'de',
}: {
  teamId: string;
  season: string;
  isStaff: boolean;
  locale?: string;
}) {
  const isEn = locale.startsWith('en');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<StatsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupTab, setGroupTab] = useState<'UNIT' | 'POSITION'>('UNIT');

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStatsReport(teamId, {
        season,
        from: fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined,
        to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
      });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Statistiken konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, [teamId, season, fromDate, toDate]);

  async function handleExportCsv() {
    try {
      const { filename, csv } = await fetchStatsCsvExport(teamId, {
        season,
        from: fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined,
        to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen.');
    }
  }

  const groups = groupTab === 'UNIT' ? report?.byUnit ?? [] : report?.byPosition ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sl-border bg-sl-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-sl-muted">
            {isEn ? 'From' : 'Von'}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="ml-2 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
            />
          </label>
          <label className="text-xs text-sl-muted">
            {isEn ? 'To' : 'Bis'}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="ml-2 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
            />
          </label>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-2.5 py-1.5 text-xs text-sl-primary hover:text-sl-heading"
            >
              {isEn ? 'Reset' : 'Zurücksetzen'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <span className="text-xs font-mono tabular-nums text-sl-muted">
              {report.totalEventsEvaluated} {isEn ? 'events evaluated' : 'Termine ausgewertet'}
            </span>
          )}
          {isStaff && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-lg border border-sl-border bg-sl-elevated hover:border-sl-border-strong text-xs font-medium text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Export</span>
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-sl-danger-text">{error}</p>}

      {loading || !report ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center text-xs text-sl-muted">
          {isEn ? 'Calculating attendance metrics…' : 'Statistiken werden berechnet…'}
        </div>
      ) : (
        <>
          {/* Gruppen-Auswertung nach Units / Positionen */}
          <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sl-accent" />
                <h3 className="text-sm font-semibold text-sl-heading">
                  {isEn ? 'Group Comparison' : 'Gruppierte Beteiligung'}
                </h3>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-sl-canvas border border-sl-border">
                <button
                  type="button"
                  onClick={() => setGroupTab('UNIT')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    groupTab === 'UNIT' ? 'bg-sl-elevated text-sl-heading' : 'text-sl-muted hover:text-sl-heading'
                  }`}
                >
                  Units
                </button>
                <button
                  type="button"
                  onClick={() => setGroupTab('POSITION')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    groupTab === 'POSITION' ? 'bg-sl-elevated text-sl-heading' : 'text-sl-muted hover:text-sl-heading'
                  }`}
                >
                  {isEn ? 'Positions' : 'Positionen'}
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-sl-muted">
                {isEn ? 'No group data available.' : 'Keine Gruppendaten vorhanden.'}
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.groupKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-sl-primary">
                        {g.groupKey}{' '}
                        <span className="text-sl-subtle font-normal">
                          · {g.memberCount} {isEn ? 'Members' : 'Mitglieder'} ·{' '}
                          <span className="font-mono tabular-nums">{g.invitedSlots}</span>{' '}
                          {isEn ? 'invitations' : 'Einladungen'}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-sl-heading">
                        {g.attendanceRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-sl-elevated overflow-hidden">
                      <div
                        className="h-full bg-sl-success transition-all"
                        style={{ width: `${Math.min(100, g.attendanceRatePercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Spieler-Tabelle */}
          <section className="rounded-xl border border-sl-border bg-sl-surface overflow-hidden">
            <div className="px-5 py-3.5 border-b border-sl-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-sl-heading">
                {isEn
                  ? 'Attendance per Member (Invited Events Only)'
                  : 'Beteiligung pro Person (nur eingeladene Termine)'}
              </h3>
              <span className="text-xs font-mono tabular-nums text-sl-muted">
                {report.players.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-sl-border text-sl-muted bg-sl-canvas">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">{isEn ? 'Member' : 'Name'}</th>
                    <th className="py-2.5 px-3 font-medium">Unit · Pos</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {isEn ? 'Invited' : 'Eingel.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-sl-success-text">
                      {isEn ? 'Present' : 'Anw.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-sl-warning-text">
                      {isEn ? 'Inactive' : 'Inakt.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-sl-danger-text">
                      {isEn ? 'Absent' : 'Abw.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {isEn ? 'Open' : 'Offen'}
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right">
                      {isEn ? 'Rate' : 'Quote'}
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right">Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sl-border">
                  {report.players.map((p) => (
                    <tr key={p.userUuid} className="hover:bg-sl-elevated/40">
                      <td className="py-2.5 px-4 font-medium text-sl-heading whitespace-nowrap">
                        {p.trikotNummer && (
                          <span className="font-mono tabular-nums text-sl-muted mr-1.5">
                            #{p.trikotNummer}
                          </span>
                        )}
                        {p.vollerName}
                      </td>
                      <td className="py-2.5 px-3 text-sl-muted whitespace-nowrap">
                        {p.units.join(', ')}
                        {p.position ? ` · ${p.position}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sl-primary">
                        {p.invitedCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sl-success-text">
                        {p.presentCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sl-warning-text">
                        {p.inactiveCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sl-danger-text">
                        {p.absentCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sl-muted">
                        {p.unansweredCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-sl-heading">
                        {p.attendanceRatePercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-sl-primary">
                        {p.checkinTotal > 0 ? `${p.checkinPresentCount}/${p.checkinTotal}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
