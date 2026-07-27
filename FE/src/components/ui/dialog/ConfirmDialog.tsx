import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Modal } from '../modal';
import Button from '../button/Button';

export type ConfirmTone = 'default' | 'danger' | 'success';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const toneConfig: Record<
  ConfirmTone,
  { icon: React.ReactNode; wrapper: string; variant: 'primary' | 'danger' | 'success' }
> = {
  default: {
    icon: <HelpCircle className="h-5 w-5" />,
    wrapper: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
    variant: 'primary',
  },
  danger: {
    icon: <AlertTriangle className="h-5 w-5" />,
    wrapper: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    variant: 'danger',
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    wrapper: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    variant: 'success',
  },
};

/** Shared confirmation prompt for destructive or state-changing POS actions. */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const config = toneConfig[tone];

  return (
    <Modal isOpen={open} onClose={onCancel} showCloseButton={false} className="max-w-md p-6">
      <div className="flex items-start gap-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.wrapper}`}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          {message && (
            <div className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{message}</div>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button size="sm" variant={config.variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
