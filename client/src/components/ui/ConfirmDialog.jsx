import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

/**
 * Confirmation for anything destructive. The confirm button carries the loading
 * state itself, so a slow delete cannot be fired twice.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-muted">
        This cannot be undone.
      </p>
    </Modal>
  );
}
