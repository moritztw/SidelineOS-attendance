-- SidelineOS Attendance & Availability Plugin — Initialschema (plugin_attendance)

CREATE TABLE IF NOT EXISTS mod_attendance_team_settings (
  team_id TEXT PRIMARY KEY,
  non_invited_visibility TEXT NOT NULL DEFAULT 'TRANSPARENT',
  response_visibility TEXT NOT NULL DEFAULT 'TEAM',
  default_cutoff_minutes INTEGER NOT NULL DEFAULT 240,
  live_checkin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mod_attendance_user_settings (
  team_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  notify_on_invite BOOLEAN NOT NULL DEFAULT TRUE,
  notify_before_cutoff BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_uuid)
);

CREATE TABLE IF NOT EXISTS mod_attendance_roster_cache (
  team_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  voller_name TEXT NOT NULL,
  benutzername TEXT NOT NULL,
  rolle TEXT NOT NULL,
  units_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  position TEXT NOT NULL DEFAULT '',
  trikot_nummer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'AKTIV',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_uuid)
);

CREATE TABLE IF NOT EXISTS mod_attendance_series (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  season TEXT NOT NULL,
  title TEXT NOT NULL,
  recurrence_kind TEXT NOT NULL,
  interval_count INTEGER NOT NULL DEFAULT 1,
  until_date TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_series_team
  ON mod_attendance_series (team_id, season);

CREATE TABLE IF NOT EXISTS mod_attendance_events (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  season TEXT NOT NULL,
  series_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'TRAINING',
  location TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  cutoff_minutes_override INTEGER,
  target_all BOOLEAN NOT NULL DEFAULT TRUE,
  target_units_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_positions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_roles_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_user_uuids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  invited_user_uuids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_events_team_season_start
  ON mod_attendance_events (team_id, season, starts_at);

CREATE TABLE IF NOT EXISTS mod_attendance_responses (
  event_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  status TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  absence_id TEXT,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_uuid)
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_responses_team_user
  ON mod_attendance_responses (team_id, user_uuid);

CREATE TABLE IF NOT EXISTS mod_attendance_checkins (
  event_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  actual_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  checked_by TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_uuid)
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_checkins_team
  ON mod_attendance_checkins (team_id, event_id);

CREATE TABLE IF NOT EXISTS mod_attendance_absences (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  reason_type TEXT NOT NULL DEFAULT 'VACATION',
  reason_text TEXT NOT NULL DEFAULT '',
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_absences_team_user
  ON mod_attendance_absences (team_id, user_uuid, starts_on, ends_on);

CREATE TABLE IF NOT EXISTS mod_attendance_event_attachments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'LINK',
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  core_attachment_id TEXT,
  mime_type TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_attendance_attachments_event
  ON mod_attendance_event_attachments (team_id, event_id);

CREATE TABLE IF NOT EXISTS mod_attendance_reminder_log (
  event_id TEXT NOT NULL,
  user_uuid TEXT NOT NULL,
  reminder_kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_uuid, reminder_kind)
);
