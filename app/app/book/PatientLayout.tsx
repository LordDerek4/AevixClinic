'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CLINIC } from '../../lib/clinicInfo';
import styles from './PatientLayout.module.css';

export function PatientPage({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>{children}</div>
    </div>
  );
}

export function ClinicHeader() {
  return (
    <div className={styles.clinicHeader}>
      <div className={styles.clinicLogo}>C</div>
      <div>
        <div className={styles.clinicName}>{CLINIC.name}</div>
        <div className={styles.clinicMeta}>
          {CLINIC.address} · {CLINIC.phone}
        </div>
      </div>
    </div>
  );
}

export function BackHeader({ context, onBack }: { context: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <div className={styles.backHeader}>
      <button
        type="button"
        className={styles.backArrow}
        aria-label="Back"
        onClick={onBack ?? (() => router.back())}
      >
        ←
      </button>
      <div className={styles.backContext}>{context}</div>
    </div>
  );
}

export function StepLabel({ step }: { step: string }) {
  return <div className={styles.stepLabel}>{step}</div>;
}

export function StepTitle({ children }: { children: ReactNode }) {
  return <div className={styles.stepTitle}>{children}</div>;
}

export function StepIntro({ children }: { children: ReactNode }) {
  return <div className={styles.stepIntro}>{children}</div>;
}

export function Body({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return <div className={styles.loading}>{children}</div>;
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className={styles.errorBanner}>{children}</div>;
}
