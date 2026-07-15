'use client';

import type { ReactNode } from 'react';
import StaffAuthGate from '../../../components/StaffAuthGate';
import DashboardShell from './DashboardShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <StaffAuthGate>
      <DashboardShell>{children}</DashboardShell>
    </StaffAuthGate>
  );
}
