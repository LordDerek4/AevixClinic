'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function StaffAuthGate({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace('/staff/login');
    }
  }, [configured, loading, user, router]);

  if (!configured) {
    // No Firebase project wired up yet — let staff through so the UI can still be reviewed,
    // but the login screen surfaces a setup notice.
    return <>{children}</>;
  }

  if (loading || !user) return null;

  return <>{children}</>;
}
