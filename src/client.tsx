import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PluginLaufzeitKontext,
  SidelinePlugin,
  TeamRolle,
} from '@sidelineos/plugin-sdk';
import { Calendar, Plus } from 'lucide-react';
import manifest from '../plugin.manifest.json';
import {
  createAbsence,
  createEvent,
  createEventAttachmentAdapter,
  deleteAbsence,
  deleteEvent,
  fetchBootstrap,
  fetchCoreTeamRoster,
  fetchEventDetail,
  saveCheckIn,
  submitRsvp,
  syncRosterWithPlugin,
  updateEvent,
  type BootstrapPayload,
  type SaveEventPayload,
} from './api/attendanceApi.ts';
import { AbsencesView } from './components/AbsencesView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { EventDetailDrawer } from './components/EventDetailDrawer.tsx';
import {
  EventFormModal,
  EventFormTabView,
  createEventFormDraft,
  type EventFormDraft,
} from './components/EventFormModal.tsx';
import { LiveCheckInView } from './components/LiveCheckInView.tsx';
import { TeamSettingsPanel, UserSettingsPanel } from './components/SettingsPanels.tsx';
import { StatsView } from './components/StatsView.tsx';
import { PlayerNextEventWidget, StaffResponseRateWidget } from './components/Widgets.tsx';
import { tAttendance } from './services/i18n.ts';
import type {
  AttendanceEvent,
  AttendanceStatus,
  CheckInStatus,
  EventDetailView,
} from './types.ts';

export { PlayerNextEventWidget, StaffResponseRateWidget };

const OPEN_CREATE_MODAL_EVENT = 'sideline-attendance:open-create';

function AttendanceMainView({ ctx }: { ctx: PluginLaufzeitKontext }) {
  const isStaff = ctx.aktiveTeamAnsicht === 'TEAM_ADMIN' || ctx.aktiveTeamAnsicht === 'COACH';
  const isEn = ctx.locale.startsWith('en');

  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRsvp, setBusyRsvp] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetailView | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const defaultCutoffMinutes = bootstrap?.settings.defaultCutoffMinutes ?? 240;
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDraft, setEventDraft] = useState<EventFormDraft>(() =>
    createEventFormDraft(240, null)
  );

  const attachmentAdapter = useMemo(
    () => createEventAttachmentAdapter(ctx.team.id),
    [ctx.team.id]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coreMembers = await fetchCoreTeamRoster(ctx.team.id);
      if (coreMembers.length > 0) {
        await syncRosterWithPlugin(ctx.team.id, coreMembers);
      }
      const data = await fetchBootstrap(ctx.team.id, ctx.gewaehlteSaison);
      setBootstrap(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [ctx.team.id, ctx.gewaehlteSaison]);

  const loadDetail = useCallback(
    async (eventId: string) => {
      setLoadingDetail(true);
      try {
        const detail = await fetchEventDetail(ctx.team.id, eventId);
        setEventDetail(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Termindetails nicht verfügbar.');
      } finally {
        setLoadingDetail(false);
      }
    },
    [ctx.team.id]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedEventId) {
      void loadDetail(selectedEventId);
    } else {
      setEventDetail(null);
    }
  }, [selectedEventId, loadDetail]);

  const openOverlayForEvent = useCallback(
    (event?: AttendanceEvent | null) => {
      setEventDraft(createEventFormDraft(defaultCutoffMinutes, event ?? null));
      setShowEventModal(true);
    },
    [defaultCutoffMinutes]
  );

  useEffect(() => {
    const onOpenCreate = () => {
      openOverlayForEvent(null);
    };
    window.addEventListener(OPEN_CREATE_MODAL_EVENT, onOpenCreate);
    return () => window.removeEventListener(OPEN_CREATE_MODAL_EVENT, onOpenCreate);
  }, [openOverlayForEvent]);

  async function handleRsvp(
    eventId: string,
    status: AttendanceStatus,
    comment: string,
    targetUserUuid?: string
  ) {
    setBusyRsvp(true);
    try {
      await submitRsvp(ctx.team.id, eventId, { status, comment, targetUserUuid });
      await loadAll();
      if (selectedEventId === eventId) {
        await loadDetail(eventId);
      }
    } finally {
      setBusyRsvp(false);
    }
  }

  async function handleSaveEvent(payload: SaveEventPayload, eventId?: string) {
    if (eventId) {
      await updateEvent(ctx.team.id, eventId, payload);
    } else {
      await createEvent(ctx.team.id, payload);
    }
    setEventDraft(createEventFormDraft(defaultCutoffMinutes, null));
    setShowEventModal(false);
    if (ctx.aktuellerTab === 'editor') {
      ctx.onTabWechseln('calendar');
    }
    await loadAll();
    if (eventId && selectedEventId === eventId) {
      await loadDetail(eventId);
    }
  }

  async function handleDeleteEvent(eventId: string, scope: 'single' | 'series') {
    await deleteEvent(ctx.team.id, eventId, scope);
    setSelectedEventId(null);
    setEventDetail(null);
    await loadAll();
  }

  async function handleSaveCheckIn(eventId: string, userUuid: string, actualStatus: CheckInStatus) {
    await saveCheckIn(ctx.team.id, eventId, { userUuid, actualStatus });
    await loadDetail(eventId);
  }

  const nextInvitedEvent = useMemo(() => {
    const nowMs = Date.now();
    return (
      bootstrap?.events.find(
        (ev) => ev.isInvited && Date.parse(ev.endsAt) >= nowMs - 1800_000
      ) ?? null
    );
  }, [bootstrap]);

  const nextTeamEvent = useMemo(() => {
    const nowMs = Date.now();
    return (
      bootstrap?.events.find((ev) => Date.parse(ev.endsAt) >= nowMs - 1800_000) ?? null
    );
  }, [bootstrap]);

  const openInvitedEvents = useMemo(() => {
    const nowMs = Date.now();
    return (bootstrap?.events ?? []).filter(
      (ev) => ev.isInvited && ev.myResponse === null && Date.parse(ev.startsAt) >= nowMs
    );
  }, [bootstrap]);

  if (loading && !bootstrap) {
    return (
      <div className="sl-attendance-scope">
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center text-sm text-sl-muted">
          {tAttendance(ctx.locale, 'loadingText')}
        </div>
      </div>
    );
  }

  return (
    <div className="sl-attendance-scope">
      <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-sl-danger/50 bg-sl-danger/10 px-4 py-3 text-xs text-sl-danger-text">
          {error}
        </div>
      )}

      {selectedEventId && (ctx.aktuellerTab === 'overview' || ctx.aktuellerTab === 'calendar') ? (
        <EventDetailDrawer
          detail={eventDetail}
          loading={loadingDetail}
          teamRolle={ctx.aktiveTeamAnsicht}
          currentUserUuid={ctx.benutzer.uuid}
          roster={bootstrap?.roster ?? []}
          attachmentAdapter={attachmentAdapter}
          locale={ctx.locale}
          onBack={() => setSelectedEventId(null)}
          onSubmitRsvp={handleRsvp}
          onEditEvent={(detail) => openOverlayForEvent(detail.event)}
          onDeleteEvent={handleDeleteEvent}
          onReloadDetail={() => void loadDetail(selectedEventId)}
        />
      ) : ctx.aktuellerTab === 'overview' ? (
        <div className="space-y-5">
          {isStaff && (
            <StaffResponseRateWidget
              event={nextTeamEvent}
              liveCheckinEnabled={bootstrap?.settings.liveCheckinEnabled ?? false}
              locale={ctx.locale}
              onOpenDetail={(id) => setSelectedEventId(id)}
              onOpenCheckIn={(id) => {
                setSelectedEventId(id);
                ctx.onTabWechseln('checkin');
              }}
            />
          )}

          <PlayerNextEventWidget
            event={nextInvitedEvent}
            locale={ctx.locale}
            busy={busyRsvp}
            onSubmitRsvp={(id, st, comment) => handleRsvp(id, st, comment)}
            onOpenDetail={(id) => setSelectedEventId(id)}
          />

          {openInvitedEvents.length > 0 && (
            <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-sl-heading">
                  {isEn ? 'Pending Responses' : 'Offene Rückmeldungen'}
                </h3>
                <span className="text-xs font-mono tabular-nums text-sl-warning-text">
                  {openInvitedEvents.length}
                </span>
              </div>
              <ul className="divide-y divide-sl-border border border-sl-border rounded-lg bg-sl-canvas">
                {openInvitedEvents.slice(0, 5).map((ev) => (
                  <li
                    key={ev.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className="font-medium text-sl-heading hover:text-sl-accent text-left"
                    >
                      {ev.title}
                    </button>
                    <span className="font-mono tabular-nums text-sl-muted">
                      {new Date(ev.startsAt).toLocaleDateString(
                        isEn ? 'en-GB' : 'de-DE',
                        { weekday: 'short', day: '2-digit', month: '2-digit' }
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(bootstrap?.events.length ?? 0) === 0 && (
            <section className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center space-y-3">
              <Calendar className="w-8 h-8 text-sl-subtle mx-auto" />
              <p className="text-sm font-medium text-sl-heading">
                {tAttendance(ctx.locale, 'noEventsTitle')}
              </p>
              <p className="text-xs text-sl-muted">
                {tAttendance(ctx.locale, 'noEventsHint')}
              </p>
              {isStaff && (
                <button
                  type="button"
                  onClick={() => openOverlayForEvent(null)}
                  className="px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-medium text-sl-accent-contrast inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tAttendance(ctx.locale, 'ctaNewEvent')}</span>
                </button>
              )}
            </section>
          )}
        </div>
      ) : ctx.aktuellerTab === 'calendar' ? (
        <CalendarView
          events={bootstrap?.events ?? []}
          isStaff={isStaff}
          locale={ctx.locale}
          onSelectEvent={(id) => setSelectedEventId(id)}
          onQuickRsvp={(id, st) => handleRsvp(id, st, '')}
          onCreateEvent={() => openOverlayForEvent(null)}
        />
      ) : ctx.aktuellerTab === 'absences' ? (
        <AbsencesView
          absences={bootstrap?.absences ?? []}
          roster={bootstrap?.roster ?? []}
          currentUserUuid={ctx.benutzer.uuid}
          isStaff={isStaff}
          locale={ctx.locale}
          onCreateAbsence={async (payload) => {
            const res = await createAbsence(ctx.team.id, payload);
            await loadAll();
            return res;
          }}
          onDeleteAbsence={async (id) => {
            await deleteAbsence(ctx.team.id, id);
            await loadAll();
          }}
        />
      ) : ctx.aktuellerTab === 'checkin' && isStaff ? (
        <LiveCheckInView
          events={bootstrap?.events ?? []}
          selectedEventId={selectedEventId}
          detail={eventDetail}
          loadingDetail={loadingDetail}
          liveCheckinEnabled={bootstrap?.settings.liveCheckinEnabled ?? false}
          roster={bootstrap?.roster ?? []}
          locale={ctx.locale}
          onSelectEvent={(id) => setSelectedEventId(id)}
          onSaveCheckIn={handleSaveCheckIn}
          onOpenTeamSettings={ctx.onTeamSettingsOeffnen}
        />
      ) : ctx.aktuellerTab === 'editor' && isStaff ? (
        <EventFormTabView
          season={ctx.gewaehlteSaison}
          draft={eventDraft}
          onDraftChange={setEventDraft}
          roster={bootstrap?.roster ?? []}
          locale={ctx.locale}
          onCancel={() => {
            setEventDraft(createEventFormDraft(defaultCutoffMinutes, null));
            ctx.onTabWechseln('calendar');
          }}
          onPopInOverlay={() => {
            ctx.onTabWechseln('calendar');
            setShowEventModal(true);
          }}
          onSave={handleSaveEvent}
        />
      ) : (
        <StatsView
          teamId={ctx.team.id}
          season={ctx.gewaehlteSaison}
          isStaff={isStaff}
          locale={ctx.locale}
        />
      )}

      {showEventModal && isStaff && (
        <EventFormModal
          season={ctx.gewaehlteSaison}
          draft={eventDraft}
          onDraftChange={setEventDraft}
          roster={bootstrap?.roster ?? []}
          locale={ctx.locale}
          onClose={() => setShowEventModal(false)}
          onPopOutToTab={() => {
            setShowEventModal(false);
            ctx.onTabWechseln('editor');
          }}
          onSave={handleSaveEvent}
        />
      )}
      </div>
    </div>
  );
}

function getAttendanceTabs({ teamRolle, locale }: { teamRolle: TeamRolle; locale?: string }) {
  const base = [
    { id: 'overview', label: tAttendance(locale, 'tabOverview') },
    { id: 'calendar', label: tAttendance(locale, 'tabCalendar') },
    { id: 'absences', label: tAttendance(locale, 'tabAbsences') },
  ];
  if (teamRolle === 'TEAM_ADMIN' || teamRolle === 'COACH') {
    base.push({ id: 'checkin', label: tAttendance(locale, 'tabCheckIn') });
  }
  base.push({ id: 'stats', label: tAttendance(locale, 'tabStats') });
  if (teamRolle === 'TEAM_ADMIN' || teamRolle === 'COACH') {
    base.push({ id: 'editor', label: tAttendance(locale, 'tabEditor') });
  }
  return base;
}

export const plugin: SidelinePlugin = {
  manifest: manifest as SidelinePlugin['manifest'],
  defaultTab: 'overview',
  getTabs: getAttendanceTabs,
  PrimaerAktion: ({ ctx, className }) =>
    ctx.aktiveTeamAnsicht !== 'PLAYER' ? (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_MODAL_EVENT))}
        className={className}
      >
        {tAttendance(ctx.locale, 'ctaNewEvent')}
      </button>
    ) : null,
  renderMainView: (ctx) => <AttendanceMainView ctx={ctx} />,
  settingsPanels: {
    user: UserSettingsPanel,
    team: TeamSettingsPanel,
  },
};

export default plugin;
