import { useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Modal } from '../common/Modal'
import { Button, Input, Label } from '../ui/primitives'
import { correctCustomerPhone, findDuplicateByPhone, mergeCustomerRecords } from '../../services/customers'
import { useAuth } from '../../hooks/useAuth'
import type { Customer } from '../../types/domain'

/**
 * Fixes the "wrong number entered at an offline event" problem:
 *  1. Staff types the correct number.
 *  2. If no one else has it — save immediately, keep a change-history entry.
 *  3. If ANOTHER customer already has that number (classic duplicate caused
 *     by a typo when they were first added), we surface that record and let
 *     staff merge the two into one customer instead of silently overwriting
 *     anything or ending up with two records for the same person.
 */
export function FixPhoneModal({
  customer,
  onClose,
  onSaved,
  onMerged,
}: {
  customer: Customer
  onClose: () => void
  onSaved: () => void
  /** Called instead of onSaved when this customer was merged into another — pass the surviving customer's id. */
  onMerged?: (targetCustomerId: string) => void
}) {
  const { profile } = useAuth()
  const [phone, setPhone] = useState(customer.phone)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Customer | null>(null)

  async function handleSave() {
    setError(null)
    const trimmed = phone.trim()
    if (!trimmed || trimmed === customer.phone) {
      onClose()
      return
    }
    setSaving(true)
    try {
      // Check up front so we can offer the merge flow with a clear message,
      // rather than surfacing the raw database error.
      const existing = await findDuplicateByPhone(trimmed, customer.id)
      if (existing) {
        setDuplicate(existing)
        setSaving(false)
        return
      }
      await correctCustomerPhone(customer.id, trimmed, profile?.id, reason || undefined)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the phone number.')
      setSaving(false)
    }
  }

  async function handleMerge() {
    if (!duplicate) return
    setSaving(true)
    setError(null)
    try {
      // The existing record with the correct number is the source of truth;
      // this customer's history (orders, feedback, follow-ups) moves into it.
      await mergeCustomerRecords(duplicate.id, customer.id, profile?.id)
      if (onMerged) onMerged(duplicate.id)
      else onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not merge the customer records.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Fix Phone Number" onClose={onClose}>
      {!duplicate ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            Correct the number for <strong>{customer.name}</strong>. If it was entered wrong during an offline sale, fixing it
            here keeps their order history, feedback, and follow-ups attached to the same customer.
          </p>
          <div>
            <Label>Current Number</Label>
            <Input value={customer.phone} disabled className="bg-ink-50 text-ink-400" />
          </div>
          <div>
            <Label>Correct Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" autoFocus />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer said we noted it wrong at the stall" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" onClick={handleSave} disabled={saving || !phone.trim()}>
            {saving ? 'Checking…' : 'Save Correct Number'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              That number already belongs to <strong>{duplicate.name}</strong> ({duplicate.customer_code}). This usually means
              the same person was accidentally added twice. You can merge the two records into one.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div className="text-center">
              <p className="font-medium text-ink-800">{customer.name}</p>
              <p className="text-xs text-ink-400">{customer.customer_code} · this record</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
            <div className="text-center">
              <p className="font-medium text-ink-800">{duplicate.name}</p>
              <p className="text-xs text-ink-400">{duplicate.customer_code} · keeps the number</p>
            </div>
          </div>

          <p className="text-xs text-ink-400">
            Merging moves all orders, feedback, and follow-ups from <strong>{customer.name}</strong> onto{' '}
            <strong>{duplicate.name}</strong>, then archives this duplicate record. This can't be undone automatically.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDuplicate(null)} disabled={saving}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleMerge} disabled={saving}>
              {saving ? 'Merging…' : `Merge into ${duplicate.name}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
