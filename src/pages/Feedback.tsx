import { useEffect, useState } from 'react'
import { PageHeader, Card, Button, Badge, Spinner, Select, EmptyState } from '../components/ui/primitives'
import { listFeedback, updateFeedback } from '../services/feedback'
import type { Feedback as FeedbackT, FeedbackStatus } from '../types/domain'
import { formatDate } from '../utils/format'

export function Feedback() {
  const [items, setItems] = useState<FeedbackT[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    setItems(await listFeedback({ status: status || undefined }))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [status])

  async function handleStatusChange(id: string, newStatus: FeedbackStatus) {
    await updateFeedback(id, { status: newStatus })
    refresh()
  }

  return (
    <div>
      <PageHeader title="Feedback" description="What customers are telling us about our products and experience." />

      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="follow_up_required">Follow-up Required</option>
          <option value="resolved">Resolved</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState title="No feedback yet" description="Feedback collected from customers after purchase will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-800">{f.customer?.name}</p>
                    <span className="text-amber-500">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                  </div>
                  <p className="text-xs text-ink-400">{f.product?.name ?? 'General'} · {f.feedback_type.replace(/_/g, ' ')} · {formatDate(f.created_at)}</p>
                </div>
                <Badge status={f.status} />
              </div>
              {f.review && <p className="mt-2 text-sm text-ink-600">{f.review}</p>}
              <div className="mt-3 flex gap-2">
                {f.status !== 'reviewed' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(f.id, 'reviewed')}>Mark Reviewed</Button>}
                {f.status !== 'resolved' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(f.id, 'resolved')}>Mark Resolved</Button>}
                {!f.follow_up_required && f.status !== 'resolved' && <Button size="sm" variant="ghost" onClick={() => handleStatusChange(f.id, 'follow_up_required')}>Needs Follow-up</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
