'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { CLINIC } from '../../../lib/clinicInfo';
import Button from '../../../components/Button';
import styles from './Login.module.css';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, configured, signIn, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/staff/today');
  }, [loading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.push('/staff/today');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(ERROR_MESSAGES[code] ?? 'Something went wrong signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above first, then click "Forgot?".');
      return;
    }
    setError(null);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(ERROR_MESSAGES[code] ?? 'Could not send reset email. Please try again.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>C</div>
          <div>
            <div className={styles.clinicName}>{CLINIC.name}</div>
            <div className={styles.subtitle}>Staff sign in</div>
          </div>
        </div>

        {!configured && (
          <div className={styles.noticeBanner}>
            Firebase isn&apos;t configured yet — add your project credentials to <code>.env</code> (see{' '}
            <code>.env.example</code>) to enable real sign-in. Until then, staff pages are open for review.
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}
        {resetSent && <div className={styles.successBanner}>Password reset email sent — check your inbox.</div>}

        <form className={styles.fields} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="asha@cedargroveclinic.com"
              required
            />
          </div>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="password">Password</label>
              <button type="button" className={styles.forgotLink} onClick={handleForgotPassword}>
                Forgot?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </div>
          <Button type="submit" size="large" disabled={submitting || !configured}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className={styles.footer}>
          For clinic staff only. Patients don&apos;t need an account — they book at cedargrove.clinic/book.
        </div>
      </div>
    </div>
  );
}
