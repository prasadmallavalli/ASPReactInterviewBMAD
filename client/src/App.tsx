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
 * passed as `ProductList`'s `refreshSignal` prop, which its own mount effect
 * watches to refetch -- the change appears with no page reload and zero
 * changes to `ProductList`'s fetch logic itself (Story 3.3's original
 * design used this same value as a `key` prop instead, forcing a full
 * remount; retro fix, Epic 3 Finding B, switched to a plain prop because a
 * remount reset `ProductList`'s own delete-in-flight tracking, silently
 * dropping an unrelated row's in-flight delete whenever a Create/Edit
 * success landed at the same time).
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
      <ProductList
        refreshSignal={refreshKey}
        onEdit={setEditingProduct}
        busyProductId={editingProduct?.id ?? null}
      />
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
