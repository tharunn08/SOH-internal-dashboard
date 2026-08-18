import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, Badge, EmptyState, Spinner } from '../components/ui/primitives'
import { listCustomers } from '../services/customers'
import type { Customer } from '../types/domain'
import { formatDate } from '../utils/format'
import { exportToCsv } from '../utils/exportCsv'
import { Modal } from '../components/common/Modal'
import { CustomerQuickForm } from '../components/customers/CustomerQuickForm'

const PAGE_SIZE = 20

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const handle = setTimeout(async () => {
      const { data, count } = await listCustomers({ page, pageSize: PAGE_SIZE, status: status || undefined, search: search || undefined })
      if (!mounted) return
      setCustomers(data)
      setCount(count)
      setLoading(false)
    }, 300)
    return () => { mounted = false; clearTimeout(handle) }
  }, [page, status, search])

  async function handleExportAll() {
    const { data } = await listCustomers({ page: 0, pageSize: 5000, status: status || undefined, search: search || undefined })
    exportToCsv('sake_of_health_customers', data.map((c) => ({
      customer_code: c.customer_code,
      name: c.name,
      phone: c.phone,
      email: c.email,
      city: c.city,
      age_group: c.age_group,
      gender: c.gender,
      status: c.status,
      created_at: c.created_at,
    })))
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has purchased or engaged with Sake of Health."
        actions={
          <>
            <Button variant="secondary" onClick={handleExportAll}><Download className="h-4 w-4" /> Export CSV</Button>
            <Button onClick={() => setShowAdd(true)}>+ Add Customer</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Search name, phone, email…" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value) }} className="max-w-xs" />
        <Select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value) }} className="max-w-[160px]">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="active">Active</option>
          <option value="repeat">Repeat</option>
          <option value="vip">VIP</option>
          <option value="inactive">Inactive</option>
        </Select>
        {(status || search) && (
          <Button variant="ghost" onClick={() => { setStatus(''); setSearch('') }}>Clear Filters</Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner /></div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add your first customer to start tracking offline sales and follow-ups."
            action={<Button onClick={() => setShowAdd(true)}>+ Add Customer</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-b border-ink-50 hover:bg-ink-50" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-800">{c.name}</p>
                      <p className="text-xs text-ink-400">{c.customer_code}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{c.phone}</td>
                    <td className="px-4 py-3 text-ink-600">{c.city ?? '—'}</td>
                    <td className="px-4 py-3"><Badge status={c.status} /></td>
                    <td className="px-4 py-3 text-ink-400">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {count > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
          <span>{page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of {count}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
          <CustomerQuickForm
            onCreated={(c) => { setShowAdd(false); navigate(`/customers/${c.id}`) }}
            onExisting={(c) => { setShowAdd(false); navigate(`/customers/${c.id}`) }}
          />
        </Modal>
      )}

      <p className="mt-6 text-center text-xs text-ink-300">
        <Link to="/customers?archived=1" className="hover:underline">View archived customers</Link>
      </p>
    </div>
  )
}
