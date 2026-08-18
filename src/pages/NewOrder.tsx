import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Minus, Plus, Check, User, ArrowLeft } from 'lucide-react'
import { PageHeader, Card, Button, Input, Select, Badge } from '../components/ui/primitives'
import { findCustomerByPhone, getCustomer, searchCustomers } from '../services/customers'
import { listProducts } from '../services/products'
import { listEvents } from '../services/events'
import { createOfflineOrder } from '../services/orders'
import type { Customer, Product, Event, PaymentMethod, OrderItemInput } from '../types/domain'
import { formatCurrency } from '../utils/format'
import { CustomerQuickForm } from '../components/customers/CustomerQuickForm'
import { useAuth } from '../hooks/useAuth'

type Step = 'customer' | 'products' | 'payment' | 'done'

export function NewOrder() {
  const [step, setStep] = useState<Step>('customer')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderCode, setOrderCode] = useState('')
  const [clientTxnId] = useState(() => crypto.randomUUID())
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { profile } = useAuth()

  useEffect(() => {
    listProducts().then(setProducts)
    listEvents().then((evts) => {
      setEvents(evts)
      const active = evts.find((e) => e.status === 'active')
      if (active) setEventId(active.id)
    })
    const presetCustomerId = params.get('customer')
    if (presetCustomerId) {
      getCustomer(presetCustomerId).then((c) => { setCustomer(c); setStep('products') })
    }
  }, [params])

  const subtotal = products.reduce((sum, p) => sum + (cart[p.id] ?? 0) * Number(p.selling_price), 0)
  const total = Math.max(0, subtotal - discount)

  function updateQty(productId: string, delta: number) {
    setCart((c) => {
      const next = Math.max(0, (c[productId] ?? 0) + delta)
      return { ...c, [productId]: next }
    })
  }

  async function handleConfirm() {
    if (!customer) return
    const items: OrderItemInput[] = products
      .filter((p) => (cart[p.id] ?? 0) > 0)
      .map((p) => ({ product_id: p.id, quantity: cart[p.id], unit_price: Number(p.selling_price), discount: 0 }))

    if (items.length === 0) {
      setError('Add at least one product to the cart.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const order = await createOfflineOrder({
        clientTxnId,
        customerId: customer.id,
        eventId: eventId || null,
        staffId: profile?.id ?? null,
        items,
        discount,
        paymentMethod,
        paymentStatus: 'paid',
        notes,
      })
      setOrderCode(order.order_code)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the order. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Order Saved</h1>
        <p className="mt-1 text-ink-500">{orderCode} · {formatCurrency(total)}</p>
        <div className="mt-8 flex flex-col gap-2.5">
          <Button size="lg" onClick={() => navigate(`/customers/${customer?.id}`)}>Collect Feedback / Schedule Follow-up</Button>
          <Button size="lg" variant="secondary" onClick={() => window.location.reload()}>Start Next Order</Button>
          <Button size="lg" variant="ghost" onClick={() => navigate('/orders')}>View All Orders</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step !== 'customer' && (
        <button onClick={() => setStep(step === 'payment' ? 'products' : 'customer')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <PageHeader title="New Offline Order" description="Fast entry for event-stall sales." />

      <StepIndicator step={step} />

      {step === 'customer' && (
        <CustomerStep onSelected={(c) => { setCustomer(c); setStep('products') }} />
      )}

      {step === 'products' && customer && (
        <div>
          <Card className="mb-4 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-ink-800">{customer.name}</p>
                <p className="text-xs text-ink-400">{customer.phone}</p>
              </div>
            </div>
            <Badge status={customer.status} />
          </Card>

          <Card className="mb-4 p-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">Event</label>
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">No event (direct sale)</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-800">{p.name}</p>
                    <p className="text-sm font-semibold text-brand-600">{formatCurrency(Number(p.selling_price))}</p>
                    <p className="text-xs text-ink-300">{p.stock_quantity} in stock</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-2 py-1.5">
                    <button onClick={() => updateQty(p.id, -1)} className="rounded-lg bg-white p-1.5 shadow-sm"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-5 text-center font-semibold">{cart[p.id] ?? 0}</span>
                    <button onClick={() => updateQty(p.id, 1)} disabled={(cart[p.id] ?? 0) >= p.stock_quantity} className="rounded-lg bg-white p-1.5 shadow-sm disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="sticky bottom-4 mt-4 p-4 shadow-lg">
            <div className="flex items-center justify-between text-sm text-ink-500">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <Button size="lg" className="mt-3 w-full" disabled={subtotal === 0} onClick={() => setStep('payment')}>
              Continue — {formatCurrency(subtotal)}
            </Button>
          </Card>
        </div>
      )}

      {step === 'payment' && customer && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 font-display text-sm font-semibold text-ink-800">Order Summary</p>
            <ul className="space-y-1.5 text-sm">
              {products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => (
                <li key={p.id} className="flex justify-between text-ink-600">
                  <span>{p.name} × {cart[p.id]}</span>
                  <span>{formatCurrency(Number(p.selling_price) * cart[p.id])}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-ink-100 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-ink-500">Discount (₹)</label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-28 text-right" />
              </div>
              <div className="mt-2 flex justify-between font-semibold text-ink-900">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 font-display text-sm font-semibold text-ink-800">Payment Method</p>
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'upi', 'card', 'other'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl border py-2.5 text-sm font-medium capitalize transition-colors ${paymentMethod === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">Notes (optional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this order" />
            </div>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button size="lg" className="w-full" disabled={saving} onClick={handleConfirm}>
            {saving ? 'Saving order…' : `Confirm Order — ${formatCurrency(total)}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'customer', label: 'Customer' },
    { key: 'products', label: 'Products' },
    { key: 'payment', label: 'Payment' },
  ]
  const idx = steps.findIndex((s) => s.key === step)
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400'}`}>
            {i + 1}
          </div>
          <span className={`text-sm ${i <= idx ? 'text-ink-800' : 'text-ink-300'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`h-px flex-1 ${i < idx ? 'bg-brand-400' : 'bg-ink-100'}`} />}
        </div>
      ))}
    </div>
  )
}

function CustomerStep({ onSelected }: { onSelected: (c: Customer) => void }) {
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Customer[]>([])
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    if (phone.length < 3) { setSuggestions([]); return }
    setSearching(true)
    const handle = setTimeout(async () => {
      const results = await searchCustomers(phone, 5)
      setSuggestions(results)
      setSearching(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [phone])

  async function handlePhoneCheck() {
    if (phone.trim().length < 10) return
    const existing = await findCustomerByPhone(phone.trim())
    if (existing) onSelected(existing)
    else setShowNewForm(true)
  }

  if (showNewForm) {
    return (
      <Card className="p-5">
        <CustomerQuickForm onCreated={onSelected} onExisting={onSelected} />
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">Customer Phone Number</label>
      <div className="flex gap-2">
        <Input
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          inputMode="numeric"
          onKeyDown={(e) => e.key === 'Enter' && handlePhoneCheck()}
        />
        <Button onClick={handlePhoneCheck} disabled={phone.length < 10}>Continue</Button>
      </div>

      {searching && <p className="mt-2 text-xs text-ink-400">Searching…</p>}

      {suggestions.length > 0 && (
        <div className="mt-3 divide-y divide-ink-50 rounded-xl border border-ink-100">
          {suggestions.map((c) => (
            <button key={c.id} onClick={() => onSelected(c)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-ink-50">
              <div>
                <p className="text-sm font-medium text-ink-800">{c.name}</p>
                <p className="text-xs text-ink-400">{c.phone}</p>
              </div>
              <Badge status={c.status} />
            </button>
          ))}
        </div>
      )}

      <button onClick={() => setShowNewForm(true)} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
        + New customer instead
      </button>
    </Card>
  )
}
