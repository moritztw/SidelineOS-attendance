import type { SprachWoerterbuecher } from '@sidelineos/plugin-sdk';
import { uebersetzeSchluessel } from '@sidelineos/plugin-sdk';

export const ATTENDANCE_DICTIONARY: SprachWoerterbuecher = {
  de: {
    tabOverview: 'Übersicht',
    tabCalendar: 'Kalender',
    tabAbsences: 'Abwesenheiten',
    tabCheckIn: 'Live-Check-In',
    tabStats: 'Statistiken',
    ctaNewEvent: 'Neuer Termin',
    statusPresent: 'Anwesend',
    statusInactive: 'Inaktiv',
    statusUncertain: 'Unsicher',
    statusAbsent: 'Abwesend',
    statusUnanswered: 'Offen',
    categoryTraining: 'Training',
    categoryMeeting: 'Meeting',
    categoryGame: 'Spiel',
    categoryOther: 'Sonstiges',
    notInvitedNotice: 'Nicht eingeladen · Nur Ansicht',
    cutoffLockedNotice: 'Rückmeldefrist abgelaufen',
    autoAbsenceBadge: 'Automatisch durch Abwesenheit',
    loadingText: 'Daten werden geladen…',
    noEventsTitle: 'Noch keine Termine in dieser Saison',
    noEventsHint: 'Erstelle den ersten Trainings- oder Meeting-Termin für dein Team.',
  },
  en: {
    tabOverview: 'Overview',
    tabCalendar: 'Calendar',
    tabAbsences: 'Absences',
    tabCheckIn: 'Live Check-In',
    tabStats: 'Statistics',
    ctaNewEvent: 'New Event',
    statusPresent: 'Present',
    statusInactive: 'Inactive',
    statusUncertain: 'Uncertain',
    statusAbsent: 'Absent',
    statusUnanswered: 'Open',
    categoryTraining: 'Training',
    categoryMeeting: 'Meeting',
    categoryGame: 'Game',
    categoryOther: 'Other',
    notInvitedNotice: 'Not invited · Read only',
    cutoffLockedNotice: 'Response deadline passed',
    autoAbsenceBadge: 'Auto-set via absence',
    loadingText: 'Loading attendance data…',
    noEventsTitle: 'No events scheduled for this season',
    noEventsHint: 'Create the first practice or meeting event for your team.',
  },
};

export function tAttendance(locale: string | undefined, key: string): string {
  return uebersetzeSchluessel(ATTENDANCE_DICTIONARY, locale, key);
}
