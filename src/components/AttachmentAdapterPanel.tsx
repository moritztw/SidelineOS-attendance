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
    <section className="space-y-3 pt-4 border-t border-slate-800">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-white">
          {isEn ? 'Attachments & Links' : 'Anhänge & Links'}
        </h3>
        <span className="text-xs text-slate-400 font-mono tabular-nums">
          {attachments.length}
        </span>
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">
          {isEn
            ? 'No links or documents attached to this event yet.'
            : 'Noch keine Links oder Dokumente zu diesem Termin hinterlegt.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-[#0b0e11]">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex items-center gap-2.5">
                {att.kind === 'CORE_ATTACHMENT' ? (
                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-100 hover:text-sky-400 font-medium inline-flex items-center gap-1.5 truncate max-w-full"
                    >
                      <span className="truncate">{att.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    </a>
                  ) : (
                    <span className="text-slate-100 font-medium truncate block">{att.title}</span>
                  )}
                  <p className="text-xs text-slate-500 truncate">
                    {att.kind === 'CORE_ATTACHMENT' ? 'Core-Attachment' : att.url}
                  </p>
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(att.id)}
                  aria-label={isEn ? 'Remove attachment' : 'Anhang entfernen'}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-2.5">
          <form onSubmit={handleAddLink} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isEn ? 'Title (e.g. Practice Script)' : 'Titel (z. B. Trainingsplan)'}
              className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={submitting || !title.trim() || !url.trim()}
              className="min-h-[36px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-45"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'Add Link' : 'Link hinzufügen'}</span>
            </button>
          </form>

          {!adapter.isCoreAttachmentModuleAvailable && (
            <p className="text-xs text-slate-500">
              {isEn
                ? 'File uploads via the central Core Attachment SDK will automatically appear here once enabled by SidelineOS-Core.'
                : 'Datei-Uploads über das zentrale Core-Attachment-Modul werden automatisch an dieser Schnittstelle freigeschaltet, sobald SidelineOS-Core das SDK-Modul bereitstellt.'}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
