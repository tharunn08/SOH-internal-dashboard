import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { PageHeader, Card, Button, Badge, Spinner, Input, Label, Select, Textarea } from '../components/ui/primitives'
import { listProducts, adjustInventory, listInventoryTransactions, lowStockProducts, outOfStockProducts, inStockProducts } from '../services/products'
import type { Product, InventoryTransaction, InventoryTxnType } from '../types/domain'
import { formatDateTime } from '../utils/format'
import { Modal } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'

type StockFilter = 'all' | 'in' | 'low' | 'out'

export function Inventory({ initialFilter = 'all' }: { initialFilter?: StockFilter }) {
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [filter, setFilter] = useState<StockFilter>(initialFilter)
  const { profile } = useAuth()

  async function refresh() {
    setLoading(true)
    const [p, t] = await Promise.all([listProducts({ includeInactive: true }), listInventoryTransactions()])
    setProducts(p)
    setTxns(t as unknown as InventoryTransaction[])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => { setFilter(initialFilter) }, [initialFilter])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const lowStock = lowStockProducts(products)
  const outOfStock = outOfStockProducts(products)
  const inStock = inStockProducts(products)

  const visibleProducts =
    filter === 'low' ? lowStock :
    filter === 'out' ? outOfStock :
    filter === 'in' ? inStock :
    products

  const tabs: { key: StockFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Products', count: products.length },
    { key: 'in', label: 'In Stock', count: inStock.length },
    { key: 'low', label: 'Low Stock', count: lowStock.length },
    { key: 'out', label: 'Out of Stock', count: outOfStock.length },
  ]

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels and movement history for every product." />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={clsx(
              'rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
              filter === t.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300'
            )}
          >
            {t.label} <span className="ml-1 text-xs text-ink-400">({t.count})</span>
          </button>
        ))}
      </div>

      {outOfStock.length > 0 && filter !== 'out' && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">⚠ Out of Stock</p>
          <ul className="mt-2 space-y-1 text-sm text-red-600">
            {outOfStock.map((p) => <li key={p.id}>{p.name} — 0 units remaining</li>)}
          </ul>
        </Card>
      )}

      {lowStock.length > 0 && filter !== 'low' && filter !== 'out' && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-700">⚠ Low Stock Alerts</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
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
            {visibleProducts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">No products in this view.</td></tr>
            ) : visibleProducts.map((p) => (
              <tr key={p.id} className="border-b border-ink-50">
                <td className="px-4 py-3 font-medium text-ink-800">{p.name}</td>
                <td className="px-4 py-3">
                  <span className={p.stock_quantity <= 0 ? 'font-semibold text-red-600' : p.stock_quantity <= p.minimum_stock ? 'font-semibold text-amber-600' : 'text-ink-700'}>{p.stock_quantity}</span>
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
