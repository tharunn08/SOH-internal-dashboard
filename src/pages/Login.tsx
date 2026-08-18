import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button, Input, Label, Card } from '../components/ui/primitives'
import { isSupabaseConfigured } from '../lib/supabase'
import { AlertTriangle } from 'lucide-react'
import logo from '../assets/logo.png'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    const from = (location.state as { from?: string })?.from ?? '/'
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Sake of Health" className="h-20 w-20 object-contain" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900">Sake of Health</h1>
          <p className="text-sm text-ink-400">Internal team dashboard</p>
        </div>

        {!isSupabaseConfigured && (
          <Card className="mb-4 flex gap-2.5 border-amber-200 bg-amber-50 p-3.5 text-amber-800">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <p className="text-xs">
              Supabase isn't configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
              <code> .env</code> file — see README.md.
            </p>
          </Card>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sakeofhealth.in" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-400">
          Access is restricted to the Sake of Health team. Contact your admin for an account.
        </p>
      </div>
    </div>
  )
}
