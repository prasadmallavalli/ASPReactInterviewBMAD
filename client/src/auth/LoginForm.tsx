import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthContext';
import './LoginForm.css';

/**
 * Controlled email/password form calling `AuthContext`'s `login()`. Per this
 * story's I/O matrix: a loading state while the request is in flight (submit
 * disabled, no re-entrant submits), and a visible inline error -- never
 * silent -- on invalid credentials or any other failure, with the form left
 * editable so the user can retry. No registration/logout UI (Never
 * boundary) -- an account must already exist.
 */
export function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      // Re-entrant submit while a request is already in flight -- ignore
      // (the submit button is also disabled, this is a defensive backstop).
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Trim only the email -- accidental copy-paste whitespace shouldn't
    // cause a spurious credential mismatch. The password is left untouched
    // since it can legitimately contain leading/trailing whitespace.
    const result = await login(email.trim(), password);

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    // On success, AuthProvider's status flips to 'authenticated' and App
    // swaps this form out for ProductList -- no local state to reset here,
    // and doing so anyway would be a no-op on an about-to-unmount component.
  };

  return (
    <div className="login-form">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <div className="login-form-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="login-form-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        {error && (
          <p className="login-form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
