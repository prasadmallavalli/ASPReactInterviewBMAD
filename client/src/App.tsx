import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginForm } from './auth/LoginForm';
import CreateProductForm from './components/CreateProductForm';
import ProductList from './components/ProductList';

/**
 * Gates rendering on `AuthContext`'s status: a brief checking indicator
 * while the mount-time `GET /api/auth/me` is in flight (avoids a flash of
 * the login form for an already-authenticated session), then either the
 * login form or `CreateProductForm` + `ProductList` -- never both, never
 * neither.
 *
 * Owns `refreshKey`: bumped by `CreateProductForm`'s `onCreated` callback on
 * a successful create, and passed as `ProductList`'s `key` prop so a
 * changing key forces a clean remount (re-running its existing fetch
 * effect) -- the new product appears with no page reload and zero changes
 * to `ProductList`'s own internals (Story 3.3's Ask-First-approved
 * key-remount trick, in place of a shared state-management library).
 */
function AuthGate() {
  const { status } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  if (status === 'checking') {
    return (
      <div role="status">
        <p>Checking session…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginForm />;
  }

  return (
    <>
      <CreateProductForm onCreated={() => setRefreshKey((key) => key + 1)} />
      <ProductList key={refreshKey} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
