import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PluginLaufzeitKontext,
  SidelinePlugin,
  TeamRolle,
} from '@sidelineos/plugin-sdk';
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
import { OverviewListView } from './components/OverviewListView.tsx';
import { TeamSettingsPanel, UserSettingsPanel } from './components/SettingsPanels.tsx';
import { StatsView } from './components/StatsView.tsx';
import { PlayerNextEventWidget, StaffResponseRateWidget } from './components/Widgets.tsx';
import { tAttendance } from './services/i18n.ts';
import {
  buildEventDetailUrl,
  buildTabBaseUrl,
  readEventIdFromUrl,
} from './services/routing.ts';
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

  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRsvp, setBusyRsvp] = useState(false);

  // URL-synchronisierte Detail-Termin-ID (?event=<id>) — überlebt Reload, Direktlinks & Browser-History
  const [detailEventId, setDetailEventId] = useState<string | null>(() => readEventIdFromUrl());
  const [checkinEventId, setCheckinEventId] = useState<string | null>(null);

  const [eventDetail, setEventDetail] = useState<EventDetailView | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const defaultCutoffMinutes = bootstrap?.settings.defaultCutoffMinutes ?? 240;
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDraft, setEventDraft] = useState<EventFormDraft>(() =>
    createEventFormDraft(240, null)
  );

  const attachmentAdapter = useMemo(
    () => createEventAttachmentAdapter(ctx.team.id),
    [ctx.team.id]
  );

  const getEventHref = useCallback(
    (eventId: string) => buildEventDetailUrl(eventId, { currentTab: ctx.aktuellerTab }),
    [ctx.aktuellerTab]
  );

  const backHref = useMemo(
    () => buildTabBaseUrl({ currentTab: ctx.aktuellerTab }),
    [ctx.aktuellerTab]
  );

  const openEventDetail = useCallback(
    (eventId: string) => {
      setDetailEventId(eventId);
      setDetailError(null);
      if (typeof window !== 'undefined') {
        const nextUrl = buildEventDetailUrl(eventId, { currentTab: ctx.aktuellerTab });
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          try {
            window.history.pushState({ attendanceEventId: eventId }, '', nextUrl);
          } catch {
            // In restriktiven Sandbox-Umgebungen ignorieren
          }
        }
      }
    },
    [ctx.aktuellerTab]
  );

  const closeEventDetail = useCallback(
    (options: { replace?: boolean } = {}) => {
      setDetailEventId(null);
      setDetailError(null);
      if (typeof window !== 'undefined') {
        const nextUrl = buildTabBaseUrl({ currentTab: ctx.aktuellerTab });
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          try {
            if (options.replace) {
              window.history.replaceState(null, '', nextUrl);
            } else {
              window.history.pushState(null, '', nextUrl);
            }
          } catch {
            // In restriktiven Sandbox-Umgebungen ignorieren
          }
        }
      }
    },
    [ctx.aktuellerTab]
  );

  // Browser Zurück/Vorwärts synchronisieren
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      setDetailEventId(readEventIdFromUrl());
      setDetailError(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Tab-Wechsel in der Core-Topbar entfernt ?event=... aus der URL -> Detailansicht sauber schließen,
  // während ein direkter Reload auf /modules/attendance/<tab>?event=<id> die ID beibehält.
  useEffect(() => {
    setDetailEventId(readEventIdFromUrl());
    setDetailError(null);
  }, [ctx.aktuellerTab]);

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
      setDetailError(null);
      try {
        const detail = await fetchEventDetail(ctx.team.id, eventId);
        setEventDetail(detail);
      } catch (err) {
        setEventDetail(null);
        setDetailError(err instanceof Error ? err.message : 'Termindetails nicht verfügbar.');
      } finally {
        setLoadingDetail(false);
      }
    },
    [ctx.team.id]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeLoadedEventId =
    ctx.aktuellerTab === 'checkin' && isStaff ? checkinEventId : detailEventId;

  useEffect(() => {
    if (activeLoadedEventId) {
      void loadDetail(activeLoadedEventId);
    } else {
      setEventDetail(null);
      setDetailError(null);
    }
  }, [activeLoadedEventId, loadDetail]);

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
      if (detailEventId === eventId) {
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
    if (eventId && detailEventId === eventId) {
      await loadDetail(eventId);
    }
  }

  async function handleDeleteEvent(eventId: string, scope: 'single' | 'series') {
    await deleteEvent(ctx.team.id, eventId, scope);
    closeEventDetail({ replace: true });
    setEventDetail(null);
    await loadAll();
  }

  async function handleSaveCheckIn(eventId: string, userUuid: string, actualStatus: CheckInStatus) {
    await saveCheckIn(ctx.team.id, eventId, { userUuid, actualStatus });
    await loadDetail(eventId);
  }

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

  if (loading && !bootstrap && !detailEventId) {
    return (
      <div className="sl-attendance-scope">
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center text-sm text-sl-muted">
          {tAttendance(ctx.locale, 'loadingText')}
        </div>
      </div>
    );
  }

  const showDetailView = Boolean(detailEventId) && ctx.aktuellerTab !== 'checkin';

  return (
    <div className="sl-attendance-scope">
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-sl-danger/50 bg-sl-danger/10 px-4 py-3 text-xs text-sl-danger-text">
            {error}
          </div>
        )}

        {showDetailView && detailEventId ? (
          <EventDetailDrawer
            detail={eventDetail}
            loading={loadingDetail}
            loadError={detailError}
            teamRolle={ctx.aktiveTeamAnsicht}
            roster={bootstrap?.roster ?? []}
            attachmentAdapter={attachmentAdapter}
            backHref={backHref}
            locale={ctx.locale}
            onBack={() => closeEventDetail()}
            onSubmitRsvp={handleRsvp}
            onEditEvent={(detail) => openOverlayForEvent(detail.event)}
            onDeleteEvent={handleDeleteEvent}
            onReloadDetail={() => void loadDetail(detailEventId)}
          />
        ) : ctx.aktuellerTab === 'overview' ? (
          <OverviewListView
            events={bootstrap?.events ?? []}
            openInvitedEvents={openInvitedEvents}
            nextTeamEvent={nextTeamEvent}
            liveCheckinEnabled={bootstrap?.settings.liveCheckinEnabled ?? false}
            isStaff={isStaff}
            busyRsvp={busyRsvp}
            locale={ctx.locale}
            getEventHref={getEventHref}
            onSelectEvent={openEventDetail}
            onQuickRsvp={(id, st) => handleRsvp(id, st, '')}
            onCreateEvent={() => openOverlayForEvent(null)}
            onOpenCheckIn={(id) => {
              setCheckinEventId(id);
              ctx.onTabWechseln('checkin');
            }}
          />
        ) : ctx.aktuellerTab === 'calendar' ? (
          <CalendarView
            events={bootstrap?.events ?? []}
            isStaff={isStaff}
            locale={ctx.locale}
            getEventHref={getEventHref}
            onSelectEvent={openEventDetail}
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
            selectedEventId={checkinEventId}
            detail={eventDetail}
            loadingDetail={loadingDetail}
            liveCheckinEnabled={bootstrap?.settings.liveCheckinEnabled ?? false}
            roster={bootstrap?.roster ?? []}
            locale={ctx.locale}
            onSelectEvent={(id) => setCheckinEventId(id)}
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
