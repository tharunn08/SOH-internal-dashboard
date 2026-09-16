import { useEffect, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import { PageHeader, Card, Button, Label, Input } from '../components/ui/primitives'
import { supabase } from '../lib/supabase'
import { listCustomers } from '../services/customers'
import { listProducts } from '../services/products'
import { listOrders } from '../services/orders'
import { listEvents } from '../services/events'
import { listFeedback, listFollowups } from '../services/feedback'
import { exportToCsv } from '../utils/exportCsv'
import { useAuth } from '../hooks/useAuth'

export function Settings() {
  const { isAdmin } = useAuth()
  const [segmentation, setSegmentation] = useState<{ vip_spend_threshold: number; repeat_order_threshold: number; inactive_days_threshold: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'customer_segmentation').single().then(({ data }) => {
      if (data) setSegmentation(data.value)
    })
  }, [])

  async function saveSegmentation() {
    if (!segmentation) return
    setSaving(true)
    await supabase.from('app_settings').update({ value: segmentation }).eq('key', 'customer_segmentation')
    setSaving(false)
  }

  async function downloadFullBackup() {
    const [customers, products, orders, events, feedback, followups] = await Promise.all([
      listCustomers({ page: 0, pageSize: 10000 }),
      listProducts({ includeInactive: true }),
      listOrders({ page: 0, pageSize: 10000 }),
      listEvents(),
      listFeedback(),
      listFollowups(),
    ])
    const backup = {
      generated_at: new Date().toISOString(),
      customers: customers.data,
      products,
      orders: orders.data,
      events,
      feedback,
      followups,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sake_of_health_backup_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings & Backup" description="Business configuration and data export tools." />

      <Card className="p-5">
        <p className="mb-2 font-display text-sm font-semibold text-ink-800">Why this page exists</p>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-500">
          <li>Change the rules that decide when a customer becomes <strong>Repeat</strong> or <strong>VIP</strong>, without needing a developer.</li>
          <li>Download a full backup of every record any time — useful before a big event, or just for peace of mind.</li>
          <li>See where your data actually lives, so it's clear that nothing is lost if the app or browser is reset.</li>
        </ul>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-brand-500" />
          <p className="font-display text-sm font-semibold text-ink-800">Where your data lives</p>
        </div>
        <p className="text-sm text-ink-500">
          All customer, order, and business data is stored permanently in your Supabase PostgreSQL database — never in browser
          storage or on Vercel's filesystem. This dashboard is just a window into that database. Deleting the app, clearing your
          browser, or redeploying to Vercel will never affect your data.
        </p>
      </Card>

      {isAdmin && (
        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Customer Segmentation Thresholds</p>
          {segmentation ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>VIP spend threshold (₹)</Label>
                <Input type="number" value={segmentation.vip_spend_threshold} onChange={(e) => setSegmentation({ ...segmentation, vip_spend_threshold: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Repeat order threshold</Label>
                <Input type="number" value={segmentation.repeat_order_threshold} onChange={(e) => setSegmentation({ ...segmentation, repeat_order_threshold: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Inactive after (days)</Label>
                <Input type="number" value={segmentation.inactive_days_threshold} onChange={(e) => setSegmentation({ ...segmentation, inactive_days_threshold: Number(e.target.value) })} />
              </div>
            </div>
          ) : <p className="text-sm text-ink-400">Loading…</p>}
          <Button className="mt-4" onClick={saveSegmentation} disabled={saving || !segmentation}>{saving ? 'Saving…' : 'Save Thresholds'}</Button>
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-1 font-display text-sm font-semibold text-ink-800">Full Data Backup</p>
        <p className="mb-4 text-sm text-ink-500">Download every customer, order, product, event, feedback, and follow-up record as a single structured JSON file.</p>
        <Button onClick={downloadFullBackup}><Download className="h-4 w-4" /> Download Full Backup</Button>
      </Card>

      <Card className="p-5">
        <p className="mb-1 font-display text-sm font-semibold text-ink-800">Export Individual Tables</p>
        <p className="mb-4 text-sm text-ink-500">Prefer separate CSVs? Use the export buttons on the Customers, Orders, and Reports pages.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={async () => exportToCsv('customers_backup', (await listCustomers({ page: 0, pageSize: 10000 })).data as unknown as Record<string, unknown>[])}>Customers CSV</Button>
          <Button variant="secondary" onClick={async () => exportToCsv('products_backup', (await listProducts({ includeInactive: true })) as unknown as Record<string, unknown>[])}>Products CSV</Button>
          <Button variant="secondary" onClick={async () => exportToCsv('events_backup', (await listEvents()) as unknown as Record<string, unknown>[])}>Events CSV</Button>
        </div>
      </Card>
    </div>
  )
}
