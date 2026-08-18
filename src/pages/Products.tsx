import { useEffect, useState } from 'react'
import { PageHeader, Card, Button, Badge, Spinner, Input, Label, Select, Textarea } from '../components/ui/primitives'
import { listProducts, createProduct, updateProduct, archiveProduct } from '../services/products'
import type { Product, ProductCategory } from '../types/domain'
import { formatCurrency } from '../utils/format'
import { Modal } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES: ProductCategory[] = ['multivitamin', 'iron', 'probiotic_prebiotic', 'curcumin', 'other']

export function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | null>(null)
  const [showNew, setShowNew] = useState(false)
  const { isManager } = useAuth()

  async function refresh() {
    setLoading(true)
    setProducts(await listProducts({ includeInactive: true }))
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  return (
    <div>
      <PageHeader
        title="Products"
        description="Sake of Health's gummy supplement catalog."
        actions={isManager ? <Button onClick={() => setShowNew(true)}>+ Add Product</Button> : undefined}
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-400">{p.product_code} · {p.sku}</p>
                </div>
                <Badge status={p.status} />
              </div>
              <p className="mt-2 text-sm text-ink-500">{p.description}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-lg font-semibold text-brand-600">{formatCurrency(p.selling_price)}</span>
                {p.original_price && p.original_price > p.selling_price && (
                  <span className="text-sm text-ink-300 line-through">{formatCurrency(p.original_price)}</span>
                )}
              </div>
              <p className={`mt-1 text-xs ${p.stock_quantity <= p.minimum_stock ? 'font-semibold text-red-600' : 'text-ink-400'}`}>
                {p.stock_quantity} in stock {p.stock_quantity <= p.minimum_stock && '⚠ Low'}
              </p>
              {isManager && (
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setEditing(p)}>Edit</Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <ProductForm
          product={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Product>>(
    product ?? { name: '', category: 'other', selling_price: 0, original_price: 0, stock_quantity: 0, minimum_stock: 10, status: 'active' }
  )
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (product) await updateProduct(product.id, form)
      else await createProduct(form)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!product) return
    await archiveProduct(product.id)
    onSaved()
  }

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={form.category ?? 'other'} onChange={(e) => update('category', e.target.value as ProductCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' & ')}</option>)}
            </Select>
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku ?? ''} onChange={(e) => update('sku', e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={form.description ?? ''} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Selling Price (₹)</Label>
            <Input type="number" value={form.selling_price ?? 0} onChange={(e) => update('selling_price', Number(e.target.value))} />
          </div>
          <div>
            <Label>Original Price (₹)</Label>
            <Input type="number" value={form.original_price ?? 0} onChange={(e) => update('original_price', Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Stock Quantity</Label>
            <Input type="number" value={form.stock_quantity ?? 0} onChange={(e) => update('stock_quantity', Number(e.target.value))} disabled={!!product} />
            {product && <p className="mt-1 text-xs text-ink-400">Use the Inventory page to adjust stock (keeps an audit trail).</p>}
          </div>
          <div>
            <Label>Minimum Stock Level</Label>
            <Input type="number" value={form.minimum_stock ?? 10} onChange={(e) => update('minimum_stock', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status ?? 'active'} onChange={(e) => update('status', e.target.value as Product['status'])}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        <div className="flex justify-between pt-2">
          {product ? <Button variant="danger" onClick={handleArchive}>Archive</Button> : <span />}
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</Button>
        </div>
      </div>
    </Modal>
  )
}
