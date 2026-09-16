import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Customers } from './pages/Customers'
import { CustomerDetail } from './pages/CustomerDetail'
import { NewOrder } from './pages/NewOrder'
import { Orders } from './pages/Orders'
import { OrderDetail } from './pages/OrderDetail'
import { Products } from './pages/Products'
import { Inventory } from './pages/Inventory'
import { Events } from './pages/Events'
import { EventDetail } from './pages/EventDetail'
import { Followups } from './pages/Followups'
import { Analytics } from './pages/Analytics'
import { Reports } from './pages/Reports'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            {/* /sales used to duplicate /orders exactly (same component) — now redirects */}
            <Route path="/sales" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/in-stock" element={<Inventory initialFilter="in" />} />
            <Route path="/inventory/low-stock" element={<Inventory initialFilter="low" />} />
            <Route path="/inventory/out-of-stock" element={<Inventory initialFilter="out" />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
