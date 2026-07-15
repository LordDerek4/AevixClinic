'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
