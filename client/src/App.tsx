import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginForm } from './auth/LoginForm';
import ProductForm from './components/ProductForm';
import ProductList from './components/ProductList';
import type { ProductDto } from './api/types';

/**
 * Gates rendering on `AuthContext`'s status: a brief checking indicator
 * while the mount-time `GET /api/auth/me` is in flight (avoids a flash of
 * the login form for an already-authenticated session), then either the
 * login form or `ProductForm` + `ProductList` -- never both, never neither.
 *
 * Owns `refreshKey` and `editingProduct`. `refreshKey` is bumped by
 * `ProductForm`'s `onSaved` callback on a successful create or edit, and
 * passed as `ProductList`'s `key` prop so a changing key forces a clean
 * remount (re-running its existing fetch effect) -- the change appears with
 * no page reload and zero changes to `ProductList`'s own internals (Story
 * 3.3's Ask-First-approved key-remount trick, in place of a shared
 * state-management library; reused unchanged for edit per Story 3.4's
 * Always boundary).
 *
 * `editingProduct` tracks which product (if any) is being edited:
 * `ProductList`'s `onEdit` sets it (switching `ProductForm` into edit mode,
 * pre-filled), and either a successful save (`onSaved`) or Cancel
 * (`onCancel`) clears it back to `null`, returning `ProductForm` to create
 * mode.
 */
function AuthGate() {
  const { status } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);

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

  const handleSaved = () => {
    setEditingProduct(null);
    setRefreshKey((key) => key + 1);
  };

  return (
    <>
      {editingProduct ? (
        <ProductForm
          mode="edit"
          initialProduct={editingProduct}
          onSaved={handleSaved}
          onCancel={() => setEditingProduct(null)}
        />
      ) : (
        <ProductForm mode="create" onSaved={handleSaved} />
      )}
      <ProductList key={refreshKey} onEdit={setEditingProduct} />
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
