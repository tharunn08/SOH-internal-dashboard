import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, User, Receipt, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Results {
  customers: { id: string; name: string; phone: string; customer_code: string }[]
  orders: { id: string; order_code: string; total_amount: number }[]
  products: { id: string; name: string; product_code: string }[]
}

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>({ customers: [], orders: [], products: [] })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults({ customers: [], orders: [], products: [] })
        return
      }
      setLoading(true)
      const [customers, orders, products] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone, customer_code')
          .is('deleted_at', null)
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,customer_code.ilike.%${query}%`)
          .limit(5),
        supabase.from('orders').select('id, order_code, total_amount').ilike('order_code', `%${query}%`).limit(5),
        supabase.from('products').select('id, name, product_code').ilike('name', `%${query}%`).limit(5),
      ])
      setResults({
        customers: customers.data ?? [],
        orders: orders.data ?? [],
        products: products.data ?? [],
      })
      setLoading(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  function go(path: string) {
    navigate(path)
    onClose()
  }

  const hasResults = results.customers.length || results.orders.length || results.products.length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3.5">
          <Search className="h-4.5 w-4.5 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, orders, products…"
            className="flex-1 text-sm outline-none placeholder:text-ink-300"
          />
          <button onClick={onClose}><X className="h-4.5 w-4.5 text-ink-400" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="px-3 py-3 text-sm text-ink-400">Searching…</p>}
          {!loading && query && !hasResults && <p className="px-3 py-6 text-center text-sm text-ink-400">No matches found.</p>}

          {results.customers.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-300">Customers</p>
              {results.customers.map((c) => (
                <button key={c.id} onClick={() => go(`/customers/${c.id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-50">
                  <User className="h-4 w-4 text-ink-400" />
                  <div>
                    <p className="text-sm font-medium text-ink-800">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.phone} · {c.customer_code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.orders.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-300">Orders</p>
              {results.orders.map((o) => (
                <button key={o.id} onClick={() => go(`/orders/${o.id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-50">
                  <Receipt className="h-4 w-4 text-ink-400" />
                  <div>
                    <p className="text-sm font-medium text-ink-800">{o.order_code}</p>
                    <p className="text-xs text-ink-400">₹{o.total_amount}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-300">Products</p>
              {results.products.map((p) => (
                <button key={p.id} onClick={() => go(`/products`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-50">
                  <Package className="h-4 w-4 text-ink-400" />
                  <div>
                    <p className="text-sm font-medium text-ink-800">{p.name}</p>
                    <p className="text-xs text-ink-400">{p.product_code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
