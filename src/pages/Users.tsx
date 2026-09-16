import { useEffect, useState } from 'react'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader, Card, Badge, Spinner, Select, Button, Input, Label } from '../components/ui/primitives'
import { supabase } from '../lib/supabase'
import type { AppUser, UserRole } from '../types/domain'
import { formatDate } from '../utils/format'
import { useAuth } from '../hooks/useAuth'
import { inviteUser } from '../services/users'
import { Modal } from '../components/common/Modal'

// Mirrors the actual Postgres row-level-security policies in
// supabase/migrations/0001_init.sql — this table is documentation, not
// enforcement. Access is enforced by the database regardless of what the
// UI shows or hides.
type Access = 'full' | 'view' | 'none'
const PERMISSIONS: { area: string; admin: Access; manager: Access; staff: Access; note?: string }[] = [
  { area: 'Dashboard & Analytics', admin: 'full', manager: 'full', staff: 'view' },
  { area: 'Orders (create & view)', admin: 'full', manager: 'full', staff: 'full' },
  { area: 'Orders (archive)', admin: 'full', manager: 'none', staff: 'none', note: 'Admin only' },
  { area: 'Customers (create/edit)', admin: 'full', manager: 'full', staff: 'full' },
  { area: 'Customers (archive/delete)', admin: 'full', manager: 'none', staff: 'none', note: 'Admin only' },
  { area: 'Products (create/edit)', admin: 'full', manager: 'full', staff: 'view' },
  { area: 'Products (delete)', admin: 'full', manager: 'none', staff: 'none', note: 'Admin only' },
  { area: 'Inventory adjustments', admin: 'full', manager: 'full', staff: 'full' },
  { area: 'Events', admin: 'full', manager: 'full', staff: 'full', note: 'Delete is admin-only' },
  { area: 'Feedback & Follow-ups', admin: 'full', manager: 'full', staff: 'full' },
  { area: 'Reports & Audit Logs', admin: 'full', manager: 'full', staff: 'none', note: 'Manager+ only' },
  { area: 'Settings (thresholds)', admin: 'full', manager: 'view', staff: 'none', note: 'Admin edits, others read-only info' },
  { area: 'Users (manage roles)', admin: 'full', manager: 'none', staff: 'none', note: 'Admin only' },
]

function AccessIcon({ level }: { level: Access }) {
  if (level === 'full') return <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3.5 w-3.5" /> Full</span>
  if (level === 'view') return <span className="inline-flex items-center gap-1 text-amber-600"><Check className="h-3.5 w-3.5" /> View only</span>
  return <span className="inline-flex items-center gap-1 text-ink-300"><X className="h-3.5 w-3.5" /> No access</span>
}

export function Users() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showPermissions, setShowPermissions] = useState(true)
  const { profile } = useAuth()

  async function refresh() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true })
    setUsers((data ?? []) as AppUser[])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  async function updateRole(id: string, role: AppUser['role']) {
    await supabase.from('users').update({ role }).eq('id', id)
    refresh()
  }

  async function toggleActive(u: AppUser) {
    await supabase.from('users').update({ active: !u.active }).eq('id', u.id)
    refresh()
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div>
      <PageHeader
        title="Users"
        description="Team members with access to this dashboard."
        actions={<Button onClick={() => setShowAdd(true)}>+ Add User</Button>}
      />

      <Card className="mb-4 overflow-hidden">
        <button
          onClick={() => setShowPermissions((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <p className="font-display text-sm font-semibold text-ink-800">What can each role access?</p>
            <p className="text-xs text-ink-400">Enforced by the database (row-level security) — this is not just UI hiding.</p>
          </div>
          {showPermissions ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
        </button>
        {showPermissions && (
          <div className="overflow-x-auto border-t border-ink-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
                  <th className="px-5 py-2.5">Area</th>
                  <th className="px-5 py-2.5">Admin</th>
                  <th className="px-5 py-2.5">Manager</th>
                  <th className="px-5 py-2.5">Staff</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.area} className="border-b border-ink-50">
                    <td className="px-5 py-2.5 font-medium text-ink-700">
                      {p.area}
                      {p.note && <span className="ml-2 text-xs font-normal text-ink-400">({p.note})</span>}
                    </td>
                    <td className="px-5 py-2.5"><AccessIcon level={p.admin} /></td>
                    <td className="px-5 py-2.5"><AccessIcon level={p.manager} /></td>
                    <td className="px-5 py-2.5"><AccessIcon level={p.staff} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-ink-50">
                <td className="px-4 py-3 font-medium text-ink-800">{u.name}</td>
                <td className="px-4 py-3 text-ink-500">{u.email}</td>
                <td className="px-4 py-3">
                  <Select
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value as AppUser['role'])}
                    disabled={u.id === profile?.id}
                    className="w-32"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </Select>
                </td>
                <td className="px-4 py-3"><Badge status={u.active ? 'active' : 'inactive'} /></td>
                <td className="px-4 py-3 text-ink-400">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== profile?.id && (
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-ink-400">
        Deactivating a user keeps their record (and audit history) but should be paired with disabling or deleting their login
        in Supabase Authentication if you want to fully revoke access immediately.
      </p>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh() }} />}
    </div>
  )
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Name, email, and a password of at least 6 characters are required.')
      return
    }
    setSaving(true)
    try {
      await inviteUser({ name, email, password, role })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" autoFocus />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@sakeofhealth.in" />
        </div>
        <div>
          <Label>Temporary Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          <p className="mt-1 text-xs text-ink-400">Share this with them directly — they can change it after logging in.</p>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="staff">Staff — day-to-day sales &amp; customers</option>
            <option value="manager">Manager — analytics, reports, feedback</option>
            <option value="admin">Admin — full access</option>
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
      </div>
    </Modal>
  )
}
