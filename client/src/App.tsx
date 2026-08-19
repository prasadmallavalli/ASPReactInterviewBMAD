import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginForm } from './auth/LoginForm';
import ProductList from './components/ProductList';

/**
 * Gates rendering on `AuthContext`'s status: a brief checking indicator
 * while the mount-time `GET /api/auth/me` is in flight (avoids a flash of
 * the login form for an already-authenticated session), then either the
 * login form or `ProductList` -- never both, never neither.
 */
function AuthGate() {
  const { status } = useAuth();

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

  return <ProductList />;
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
