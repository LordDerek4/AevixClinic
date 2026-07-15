'use client';

import type { ReactNode } from 'react';
import { BookingProvider } from '../../context/BookingContext';

export default function BookLayout({ children }: { children: ReactNode }) {
  return <BookingProvider>{children}</BookingProvider>;
}
