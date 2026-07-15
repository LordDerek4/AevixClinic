'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { CLINIC } from '../../../lib/clinicInfo';
import styles from './DashboardShell.module.css';

function initialsFor(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'ST';
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'ST';
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/staff/login');
  };

  const tabClass = (href: string) => `${styles.navTab} ${pathname === href ? styles.navTabActive : ''}`;

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <div className={styles.left}>
          <div className={styles.brand}>
            <div className={styles.logo}>C</div>
            <span className={styles.clinicName}>{CLINIC.name}</span>
          </div>
          <nav className={styles.navTabs}>
            <Link href="/staff/today" className={tabClass('/staff/today')}>Today</Link>
            <Link href="/staff/calendar" className={tabClass('/staff/calendar')}>Calendar</Link>
            <Link href="/staff/settings" className={tabClass('/staff/settings')}>Settings</Link>
          </nav>
        </div>
        <div className={styles.right}>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
          >
            {initialsFor(user?.displayName, user?.email)}
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              {user?.email && <div className={styles.dropdownEmail}>{user.email}</div>}
              <button type="button" className={styles.dropdownItem} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
