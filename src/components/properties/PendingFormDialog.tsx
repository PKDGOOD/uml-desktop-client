import React, { useEffect, useRef } from 'react';
import type { PendingChoice } from './pendingForm';

/** Asks what to do with typed but unapplied changes. Escape keeps editing. */
export function PendingFormDialog({ label, onChoose }: { label: string; onChoose: (choice: PendingChoice) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="create-dialog" onCancel={(event) => { event.preventDefault(); onChoose('cancel'); }} aria-labelledby="pending-title">
    <form method="dialog" onSubmit={(event) => event.preventDefault()}>
      <h2 id="pending-title">Unapplied changes</h2>
      <p className="history-help">You changed the properties of {label || 'this element'} but did not apply them.</p>
      <div className="dialog-actions">
        <button type="button" className="menu-button" onClick={() => onChoose('cancel')}>Keep editing</button>
        <button type="button" className="menu-button" onClick={() => onChoose('discard')}>Discard</button>
        <button type="button" className="menu-button" autoFocus onClick={() => onChoose('apply')}>Apply</button>
      </div>
    </form>
  </dialog>;
}
