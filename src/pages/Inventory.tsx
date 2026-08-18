import { useEffect, useState } from 'react'
import { PageHeader, Card, Button, Badge, Spinner, Input, Label, Select, Textarea } from '../components/ui/primitives'
import { listProducts, adjustInventory, listInventoryTransactions } from '../services/products'
import type { Product, InventoryTransaction, InventoryTxnType } from '../types/domain'
import { formatDateTime } from '../utils/format'
import { Modal } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const { profile } = useAuth()

  async function refresh() {
    setLoading(true)
    const [p, t] = await Promise.all([listProducts({ includeInactive: true }), listInventoryTransactions()])
    setProducts(p)
    setTxns(t as unknown as InventoryTransaction[])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const lowStock = products.filter((p) => p.status === 'active' && p.stock_quantity <= p.minimum_stock)

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels and movement history for every product." />

      {lowStock.length > 0 && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">⚠ Low Stock Alerts</p>
          <ul className="mt-2 space-y-1 text-sm text-red-600">
            {lowStock.map((p) => <li key={p.id}>{p.name} — only {p.stock_quantity} units remaining</li>)}
          </ul>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Current Stock</th>
              <th className="px-4 py-3">Min Level</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-ink-50">
                <td className="px-4 py-3 font-medium text-ink-800">{p.name}</td>
                <td className="px-4 py-3">
                  <span className={p.stock_quantity <= p.minimum_stock ? 'font-semibold text-red-600' : 'text-ink-700'}>{p.stock_quantity}</span>
                </td>
                <td className="px-4 py-3 text-ink-400">{p.minimum_stock}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setAdjustingProduct(p)}>Adjust Stock</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mb-3 font-display text-sm font-semibold text-ink-800">Recent Inventory Movements</p>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-b border-ink-50">
                <td className="px-4 py-3 text-ink-700">{t.product?.name}</td>
                <td className="px-4 py-3"><Badge status={t.transaction_type} /></td>
                <td className={`px-4 py-3 font-medium ${t.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{t.quantity > 0 ? '+' : ''}{t.quantity}</td>
                <td className="px-4 py-3 text-ink-400">{t.notes ?? '—'}</td>
                <td className="px-4 py-3 text-ink-400">{formatDateTime(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {adjustingProduct && (
        <AdjustStockModal
          product={adjustingProduct}
          userId={profile?.id}
          onClose={() => setAdjustingProduct(null)}
          onSaved={() => { setAdjustingProduct(null); refresh() }}
        />
      )}
    </div>
  )
}

function AdjustStockModal({ product, userId, onClose, onSaved }: { product: Product; userId?: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<InventoryTxnType>('restock')
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (quantity === 0) return
    setSaving(true)
    try {
      const signed = type === 'restock' ? Math.abs(quantity) : type === 'damaged' ? -Math.abs(quantity) : quantity
      await adjustInventory(product.id, type as 'restock' | 'adjustment' | 'damaged' | 'returned', signed, notes, userId)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Adjust Stock — ${product.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">Current stock: <strong>{product.stock_quantity}</strong></p>
        <div>
          <Label>Movement Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as InventoryTxnType)}>
            <option value="restock">Restock (add stock)</option>
            <option value="damaged">Damaged (remove stock)</option>
            <option value="returned">Returned (add stock)</option>
            <option value="adjustment">Manual Adjustment (+/-)</option>
          </Select>
        </div>
        <div>
          <Label>{type === 'adjustment' ? 'Quantity (use negative to subtract)' : 'Quantity'}</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Restocked before Bengaluru Expo" />
        </div>
        <Button className="w-full" onClick={handleSave} disabled={saving || quantity === 0}>
          {saving ? 'Saving…' : 'Save Movement'}
        </Button>
      </div>
    </Modal>
  )
}
