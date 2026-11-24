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
      <div className="rounded-xl border border-slate-800 bg-[#12171d] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">
            {isEn ? 'From' : 'Von'}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="ml-2 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            {isEn ? 'To' : 'Bis'}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="ml-2 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            />
          </label>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              {isEn ? 'Reset' : 'Zurücksetzen'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {report.totalEventsEvaluated} {isEn ? 'events evaluated' : 'Termine ausgewertet'}
            </span>
          )}
          {isStaff && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Export</span>
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading || !report ? (
        <div className="rounded-xl border border-slate-800 bg-[#12171d] p-8 text-center text-xs text-slate-400">
          {isEn ? 'Calculating attendance metrics…' : 'Statistiken werden berechnet…'}
        </div>
      ) : (
        <>
          {/* Gruppen-Auswertung nach Units / Positionen */}
          <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">
                  {isEn ? 'Group Comparison' : 'Gruppierte Beteiligung'}
                </h3>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b0e11] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGroupTab('UNIT')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    groupTab === 'UNIT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Units
                </button>
                <button
                  type="button"
                  onClick={() => setGroupTab('POSITION')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    groupTab === 'POSITION' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isEn ? 'Positions' : 'Positionen'}
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-slate-400">
                {isEn ? 'No group data available.' : 'Keine Gruppendaten vorhanden.'}
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.groupKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">
                        {g.groupKey}{' '}
                        <span className="text-slate-500 font-normal">
                          · {g.memberCount} {isEn ? 'Members' : 'Mitglieder'} ·{' '}
                          <span className="font-mono tabular-nums">{g.invitedSlots}</span>{' '}
                          {isEn ? 'invitations' : 'Einladungen'}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-white">
                        {g.attendanceRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, g.attendanceRatePercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Spieler-Tabelle */}
          <section className="rounded-xl border border-slate-800 bg-[#12171d] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {isEn
                  ? 'Attendance per Member (Invited Events Only)'
                  : 'Beteiligung pro Person (nur eingeladene Termine)'}
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {report.players.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 bg-[#0b0e11]">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">{isEn ? 'Member' : 'Name'}</th>
                    <th className="py-2.5 px-3 font-medium">Unit · Pos</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {isEn ? 'Invited' : 'Eingel.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-emerald-400">
                      {isEn ? 'Present' : 'Anw.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-amber-400">
                      {isEn ? 'Inactive' : 'Inakt.'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right text-red-400">
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
                <tbody className="divide-y divide-slate-800/70">
                  {report.players.map((p) => (
                    <tr key={p.userUuid} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-medium text-white whitespace-nowrap">
                        {p.trikotNummer && (
                          <span className="font-mono tabular-nums text-slate-400 mr-1.5">
                            #{p.trikotNummer}
                          </span>
                        )}
                        {p.vollerName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {p.units.join(', ')}
                        {p.position ? ` · ${p.position}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {p.invitedCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                        {p.presentCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-400">
                        {p.inactiveCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-400">
                        {p.absentCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {p.unansweredCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                        {p.attendanceRatePercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300">
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
