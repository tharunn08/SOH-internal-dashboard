import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Archive, User, MessageCircle, Mail } from 'lucide-react'
import { Card, PageHeader, Button, Badge, Spinner } from '../components/ui/primitives'
import { getOrder, archiveOrder } from '../services/orders'
import type { Order } from '../types/domain'
import { formatCurrency, formatDateTime } from '../utils/format'
import { ConfirmDialog } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'
import { buildWhatsAppLink } from '../services/feedback'

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [showArchive, setShowArchive] = useState(false)
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { if (id) getOrder(id).then(setOrder).finally(() => setLoading(false)) }, [id])

  async function handleArchive() {
    if (!id) return
    await archiveOrder(id, profile?.id)
    setShowArchive(false)
    navigate('/orders')
  }

  if (loading || !order) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const invoiceText = buildInvoiceMessage(order)
  const waLink = order.customer?.phone ? buildWhatsAppLink(order.customer.phone, invoiceText) : '#'
  const mailLink = order.customer?.email
    ? `mailto:${order.customer.email}?subject=${encodeURIComponent(`Your Sake of Health Invoice — ${order.order_code}`)}&body=${encodeURIComponent(invoiceText)}`
    : '#'

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/orders" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="no-print">
        <PageHeader
          title={order.order_code}
          description={formatDateTime(order.order_date)}
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
              {isAdmin && order.order_status === 'completed' && (
                <Button variant="ghost" onClick={() => setShowArchive(true)}><Archive className="h-4 w-4" /> Archive</Button>
              )}
            </>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <a href={waLink} target="_blank" rel="noreferrer" onClick={(e) => !order.customer?.phone && e.preventDefault()}>
            <Button variant="secondary" disabled={!order.customer?.phone}>
              <MessageCircle className="h-4 w-4" /> Send Invoice via WhatsApp
            </Button>
          </a>
          <a href={mailLink} onClick={(e) => !order.customer?.email && e.preventDefault()}>
            <Button variant="secondary" disabled={!order.customer?.email}>
              <Mail className="h-4 w-4" /> Email Invoice
            </Button>
          </a>
        </div>
        {!order.customer?.email && (
          <p className="mb-2 text-xs text-ink-400">Add an email to this customer's profile to enable emailing the invoice.</p>
        )}
        <p className="mb-2 text-xs text-ink-300">
          Tip: for a clean printout without the browser's own date/URL header, open the print dialog's "More settings" and
          uncheck "Headers and footers" (Chrome/Edge) — it only needs doing once, the browser remembers it after.
        </p>
        <p className="mb-4 text-xs text-ink-300">
          Order IDs are built from the products purchased — e.g. <strong>CUR-001</strong> is a Curcumin-only order,{' '}
          <strong>MUL-IRN-001</strong> is Multivitamin + Iron, and 3+ different products use single-letter initials
          (e.g. <strong>MIP-0001</strong> for Multivitamin, Iron, Probiotic).
        </p>
      </div>

      <Card className="print-area p-6">
        <div className="mb-5 flex items-center justify-between border-b border-ink-100 pb-5">
          <div>
            <p className="font-display text-lg font-semibold text-ink-900">Sake of Health</p>
            <p className="text-xs text-ink-400">Ixitek Healthcare and Wellness Pvt. Ltd.</p>
          </div>
          <div className="text-right">
            <Badge status={order.payment_status}>{order.payment_status}</Badge>
            <p className="mt-1.5 text-sm font-semibold text-ink-800">{order.order_code}</p>
            <p className="text-xs text-ink-400">{formatDateTime(order.order_date)}</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-ink-400">Customer</p>
            <Link to={`/customers/${order.customer_id}`} className="flex items-center gap-1.5 font-medium text-ink-800 hover:text-brand-600">
              <User className="h-3.5 w-3.5" /> {order.customer?.name}
            </Link>
            <p className="text-ink-500">{order.customer?.phone}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-ink-400">Event</p>
            <p className="text-ink-700">{order.event?.name ?? '— Direct sale —'}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
              <th className="py-2">Product</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item) => (
              <tr key={item.id} className="border-b border-ink-50">
                <td className="py-2.5">{item.product?.name}</td>
                <td className="py-2.5 text-center">{item.quantity}</td>
                <td className="py-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-2.5 text-right">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-ink-100 pt-4 text-sm">
          <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
          <div className="flex justify-between text-ink-500"><span>Discount</span><span>-{formatCurrency(order.discount)}</span></div>
          <div className="flex justify-between font-display text-base font-semibold text-ink-900"><span>Total</span><span>{formatCurrency(order.total_amount)}</span></div>
          <div className="flex justify-between text-ink-500 capitalize"><span>Payment Method</span><span>{order.payment_method}</span></div>
        </div>

        {order.notes && <p className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">{order.notes}</p>}
      </Card>

      {showArchive && (
        <ConfirmDialog
          title="Archive order?"
          message="This order will be archived and excluded from active reports. Inventory already deducted for this order is not restored automatically."
          confirmLabel="Archive Order"
          danger
          onConfirm={handleArchive}
          onClose={() => setShowArchive(false)}
        />
      )}
    </div>
  )
}

function buildInvoiceMessage(order: Order) {
  const lines = order.order_items?.map(
    (i) => `${i.product?.name} x${i.quantity} — ${formatCurrency(i.total_price)}`
  ) ?? []
  return [
    `Sake of Health — Invoice ${order.order_code}`,
    formatDateTime(order.order_date),
    '',
    ...lines,
    '',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Discount: -${formatCurrency(order.discount)}`,
    `Total: ${formatCurrency(order.total_amount)}`,
    `Payment: ${order.payment_method} (${order.payment_status})`,
    '',
    'Thank you for shopping with Sake of Health!',
  ].join('\n')
}
