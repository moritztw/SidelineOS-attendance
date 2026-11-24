# SidelineOS-attendance

Anwesenheits-, Kalender- und Verfügbarkeits-Plugin für **[SidelineOS-Core](https://github.com/moritztw/SidelineOS-core)** (SDK `v1.0`).

## Funktionsumfang

- **Eigenes Event- & Kalendermodul:** Einzeltermine und Serientermine (erzeugen eigenständige Einzeltermine gemäß Einzeltermin-Pflicht).
- **Zielgruppen-Einladungen & Sichtbarkeit:** Adressierung über Core-Units (`OFFENSE`, `DEFENSE`, `SPECIAL_TEAMS`), spezifische Positionen (`QB`, `OL`, `LB`, `DB`, …), Team-Rollen sowie Einzelpersonen. Team-Admins wählen zwischen transparenter Ansicht für Nicht-Eingeladene oder vollständigem Ausblenden.
- **4-Stufen-Statusmodell & Kommentar:** `PRESENT` (Anwesend), `INACTIVE` (Inaktiv auf dem Platz), `UNCERTAIN` (Unsicher), `ABSENT` (Abwesend) inkl. Freitext-Anmerkung.
- **Langzeitabwesenheiten:** Zeiträume (Urlaub, Verletzung, Privat) setzen zukünftige eingeladene Termine automatisch auf `ABSENT`, solange kein manueller Override am Einzeltermin gesetzt wird.
- **Fristen & Datenschutz:** Globale Standard-Rückmeldefrist mit Einzeltermin-Override sowie Team-Admin-Steuerung, ob Abmeldegründe und Status teamweit oder nur für Coaches/Staff sichtbar sind.
- **Live-Check-In (Opt-In):** Touch-optimiertes Platzwerkzeug für Coaches zum Soll-vs-Ist-Abgleich.
- **Statistiken & CSV-Export:** Beteiligungsquoten ausschließlich auf Basis eingeladener Termine, gruppiert nach Units und Positionen.
- **Vorbereitete Core-SDK-Schnittstellen:**
  - *Anhänge:* Sofort nutzbare Web-Links pro Termin sowie vorbereiteter `CoreAttachmentBridgeAdapter` (`CORE_ATTACHMENT`) für das kommende Core-Attachment-Modul.
  - *Widgets:* Entkoppelte Komponenten `PlayerNextEventWidget` und `StaffResponseRateWidget` im `Übersicht`-Tab, vorbereitet für künftige Hub-Widget-Slots.
  - *Cron / Erinnerungen:* `dispatchDueReminders` und `POST /reminders/dispatch` inkl. Idempotenz-Log zur Anbindung an die Core-Notification-API (`ctx.notifications.send`).

## Berechtigungen (`plugin.manifest.json`)

- `team:read`
- `team:roster-read`
- `db:plugin-tables` (`mod_attendance_*` im isolierten Schema `plugin_attendance`)
- `notifications:send`

## Lokale Entwicklung & Prüfung

```bash
npm install --legacy-peer-deps
npm run lint        # TypeScript-Prüfung (tsc --noEmit)
npm test            # Build + Domain- & Contract-Tests
npm run pack:plugin # Erzeugt build-release/sideline-plugin-v1.tar.gz + .sha256
```

## Installation in SidelineOS-Core

1. **Dev-Modus (`DEV_ALLOW_GIT_INSTALL=true`):** Im Sysadmin-Plugin-Store unter *Dev: Git Clone & Build* das Repository angeben.
2. **Offline-Upload:** `npm run pack:plugin` ausführen und `build-release/sideline-plugin-v1.tar.gz` (samt `.sha256`) hochladen.
3. **GitHub Release:** Tag pushen (`git tag v0.1.0 && git push origin v0.1.0`) — die GitHub Action veröffentlicht `sideline-plugin-v1.tar.gz`, `.sha256` und `plugin.manifest.json`.

## Lizenz

GNU Affero General Public License v3.0 (AGPLv3) — siehe `LICENSE`.
