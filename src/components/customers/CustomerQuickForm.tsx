import { useState } from 'react'
import { Input, Label, Select, Textarea, Button, Card } from '../ui/primitives'
import { createCustomer, findCustomerByPhone, type NewCustomerInput } from '../../services/customers'
import type { Customer } from '../../types/domain'
import { useAuth } from '../../hooks/useAuth'

const AGE_GROUPS = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+']
const HEARD_FROM = ['Walk-in / Stall', 'Instagram', 'Facebook', 'Friend / Referral', 'Google', 'Other']

export function CustomerQuickForm({
  onCreated,
  onExisting,
}: {
  onCreated: (customer: Customer) => void
  onExisting: (customer: Customer) => void
}) {
  const { profile } = useAuth()
  const [form, setForm] = useState<NewCustomerInput>({ name: '', phone: '', communication_consent: true })
  const [showMore, setShowMore] = useState(false)
  const [duplicate, setDuplicate] = useState<Customer | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof NewCustomerInput>(key: K, value: NewCustomerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handlePhoneBlur() {
    if (form.phone.trim().length < 10) return
    setChecking(true)
    try {
      const existing = await findCustomerByPhone(form.phone.trim())
      setDuplicate(existing)
    } finally {
      setChecking(false)
    }
  }

  async function handleSubmit() {
    if (!form.name.trim() || form.phone.trim().length < 10) {
      setError('Name and a valid 10-digit phone number are required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const created = await createCustomer({ ...form, created_by: profile?.id })
      onCreated(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save customer.')
    } finally {
      setSaving(false)
    }
  }

  if (duplicate) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="font-display text-base font-semibold text-amber-900">Customer already exists</p>
        <p className="mt-1 text-sm text-amber-800">
          {duplicate.name} ({duplicate.phone}) is already in the system.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onExisting(duplicate)}>Use this customer</Button>
          <Button variant="secondary" onClick={() => setDuplicate(null)}>Edit details instead</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Full Name *</Label>
        <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Rahul Kumar" autoFocus />
      </div>
      <div>
        <Label>Phone Number *</Label>
        <Input
          value={form.phone}
          onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          onBlur={handlePhoneBlur}
          placeholder="10-digit mobile number"
          inputMode="numeric"
        />
        {checking && <p className="mt-1 text-xs text-ink-400">Checking…</p>}
      </div>

      {!showMore ? (
        <button onClick={() => setShowMore(true)} className="text-sm font-semibold text-brand-600 hover:underline">
          + Add optional details (city, email, preferences)
        </button>
      ) : (
        <div className="space-y-4 rounded-xl bg-ink-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city ?? ''} onChange={(e) => update('city', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Age Group</Label>
              <Select value={form.age_group ?? ''} onChange={(e) => update('age_group', e.target.value)}>
                <option value="">Select</option>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender ?? ''} onChange={(e) => update('gender', e.target.value)}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>How did you hear about us?</Label>
            <Select value={form.heard_from ?? ''} onChange={(e) => update('heard_from', e.target.value)}>
              <option value="">Select</option>
              {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={form.communication_consent ?? false}
              onChange={(e) => update('communication_consent', e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            Customer consents to future communication (WhatsApp / email / calls)
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
        {saving ? 'Saving…' : 'Save Customer'}
      </Button>
    </div>
  )
}
