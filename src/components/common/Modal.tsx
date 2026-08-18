import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
  requireTypedConfirmation,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
  requireTypedConfirmation?: boolean
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-ink-600">{message}</p>
      {requireTypedConfirmation && <TypedConfirm onConfirm={onConfirm} onClose={onClose} danger={danger} confirmLabel={confirmLabel} />}
      {!requireTypedConfirmation && (
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Cancel</button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </Modal>
  )
}

function TypedConfirm({ onConfirm, onClose, danger, confirmLabel }: { onConfirm: () => void; onClose: () => void; danger?: boolean; confirmLabel: string }) {
  const [text, setText] = useState('')
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-ink-400">Type <strong>DELETE</strong> to confirm.</p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Cancel</button>
        <button
          disabled={text !== 'DELETE'}
          onClick={onConfirm}
          className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
