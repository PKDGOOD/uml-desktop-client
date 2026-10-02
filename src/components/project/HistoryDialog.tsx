import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VersionManager } from '../../engine/versionManager';
import { localVersionStorage } from '../../engine/localVersionStorage';
import type { ProjectData, Snapshot } from '../../types';

export function HistoryDialog({ project, getSnapshot, onRestore, onClose }: {
  project: ProjectData; getSnapshot: () => ProjectData;
  onRestore: (project: ProjectData) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const manager = useMemo(() => new VersionManager(localVersionStorage(localStorage)), []);
  const location = encodeURIComponent(`${project.metadata.createdAt}:${project.metadata.name}`);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
    manager.getHistory(location).then(setHistory).catch((error) => setError(String(error)));
  }, [manager, location]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); setHistory(await manager.getHistory(location)); }
    catch (error) { setError(`Could not update history: ${(error as Error).message}`); }
    finally { setBusy(false); }
  };
  return <dialog ref={ref} className="create-dialog history-dialog" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} aria-labelledby="history-title">
    <h2 id="history-title">Project history</h2>
    <p className="history-help">Snapshots stay on this device. Save a project file for a portable copy.</p>
    <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await manager.createSnapshot(location, getSnapshot(), message.trim() || 'Snapshot'); setMessage(''); }); }}>
      <label htmlFor="snapshot-name" className="field-label">Snapshot note</label>
      <input id="snapshot-name" autoFocus className="field-input" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={120} placeholder="Before changing the order flow" />
      <button disabled={busy} className="menu-button" type="submit">Create snapshot</button>
    </form>
    {error && <p role="alert" className="status-error">{error}</p>}
    <div className="history-list">
      {!history.length && <p>No snapshots yet.</p>}
      {[...history].reverse().map((snapshot) => <div className="history-entry" key={snapshot.id}>
        <div><strong>{snapshot.message}</strong><small>{snapshot.createdAt.toLocaleString()}</small></div>
        <button className="menu-button" disabled={busy} onClick={() => void run(async () => {
          const restored = await manager.restoreSnapshot(location, snapshot.id);
          await manager.createSnapshot(location, getSnapshot(), 'Before restore');
          onRestore(restored);
        })}>Restore</button>
        <button className="menu-button" disabled={busy} onClick={() => {
          if (window.confirm(`Delete snapshot "${snapshot.message}"?`)) void run(() => manager.deleteSnapshot(location, snapshot.id));
        }}>Delete</button>
      </div>)}
    </div>
    <p className="history-help">Restoring first backs up your current work. Save afterward to update your project file.</p>
    <div className="dialog-actions"><button className="menu-button" disabled={busy} onClick={onClose}>Close</button></div>
  </dialog>;
}
