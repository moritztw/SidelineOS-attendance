import { useState } from 'react';
import { ExternalLink, FileText, Link2, Plus, Trash2 } from 'lucide-react';
import type { CoreAttachmentBridgeAdapter, EventAttachment } from '../types.ts';

export function AttachmentAdapterPanel({
  eventId,
  attachments,
  canManage,
  adapter,
  locale = 'de',
  onChanged,
}: {
  eventId: string;
  attachments: EventAttachment[];
  canManage: boolean;
  adapter: CoreAttachmentBridgeAdapter;
  locale?: string;
  onChanged: () => void;
}) {
  const isEn = locale.startsWith('en');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await adapter.addLink(eventId, { title: title.trim(), url: url.trim() });
      setTitle('');
      setUrl('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(attachmentId: string) {
    setError(null);
    try {
      await adapter.remove(eventId, attachmentId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Entfernen');
    }
  }

  return (
    <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-sl-heading">
          {isEn ? 'Attachments & Links' : 'Anhänge & Links'}
        </h3>
        <span className="text-xs text-sl-muted font-mono tabular-nums">
          {attachments.length}
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className="divide-y divide-sl-border border border-sl-border rounded-lg bg-sl-canvas overflow-hidden">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
              <div className="min-w-0 flex items-center gap-2.5">
                {att.kind === 'CORE_ATTACHMENT' ? (
                  <FileText className="w-4 h-4 text-sl-accent shrink-0" />
                ) : (
                  <Link2 className="w-4 h-4 text-sl-muted shrink-0" />
                )}
                <div className="min-w-0">
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sl-primary hover:text-sl-accent font-medium inline-flex items-center gap-1.5 truncate max-w-full"
                    >
                      <span className="truncate">{att.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-sl-subtle" />
                    </a>
                  ) : (
                    <span className="text-sl-primary font-medium truncate block">{att.title}</span>
                  )}
                  <p className="text-xs text-sl-subtle truncate">
                    {att.kind === 'CORE_ATTACHMENT' ? 'Core-Attachment' : att.url}
                  </p>
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(att.id)}
                  aria-label={isEn ? 'Remove attachment' : 'Anhang entfernen'}
                  className="p-1.5 rounded-md text-sl-muted hover:text-sl-danger-text hover:bg-sl-elevated transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {attachments.length === 0 && !canManage && (
        <p className="text-xs text-sl-muted">
          {isEn
            ? 'No links or documents attached to this event yet.'
            : 'Noch keine Links oder Dokumente zu diesem Termin hinterlegt.'}
        </p>
      )}

      {canManage && (
        <div className="space-y-2.5">
          <form onSubmit={handleAddLink} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_auto] gap-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isEn ? 'Title (e.g. Practice Script)' : 'Titel (z. B. Trainingsplan)'}
              className="min-h-[40px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link (https://...)"
              className="min-h-[40px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
            />
            <button
              type="submit"
              disabled={submitting || !title.trim() || !url.trim()}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-semibold text-sl-accent-contrast inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-45"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'Add Link' : 'Link hinzufügen'}</span>
            </button>
          </form>

          {!adapter.isCoreAttachmentModuleAvailable && (
            <p className="text-xs text-sl-subtle">
              {isEn
                ? 'File uploads via the central Core Attachment SDK will automatically appear here once enabled by SidelineOS-Core.'
                : 'Datei-Uploads über das zentrale Core-Attachment-Modul werden automatisch hier freigeschaltet, sobald SidelineOS-Core das SDK-Modul bereitstellt.'}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-sl-danger-text">{error}</p>}
    </section>
  );
}
