'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Appointment } from '../lib/types';

export interface BookingDetails {
  fullName: string;
  mobile: string;
  dateOfBirth: string;
  notes: string;
  smsReminder: boolean;
}

export interface BookingState {
  serviceId: string | null;
  serviceName: string | null;
  serviceDuration: number | null;
  practitionerChoice: string | null; // 'first-available' sentinel, or a specific practitioner id
  practitionerChoiceName: string;
  date: string | null; // YYYY-MM-DD
  dateWeekday: string | null;
  dateDayOfMonth: number | null;
  time: string | null; // HH:MM 24h
  resolvedPractitionerId: string | null;
  resolvedPractitionerName: string | null;
  details: BookingDetails | null;
  confirmedAppointment: Appointment | null;
}

const emptyState: BookingState = {
  serviceId: null,
  serviceName: null,
  serviceDuration: null,
  practitionerChoice: 'first-available',
  practitionerChoiceName: 'First available',
  date: null,
  dateWeekday: null,
  dateDayOfMonth: null,
  time: null,
  resolvedPractitionerId: null,
  resolvedPractitionerName: null,
  details: null,
  confirmedAppointment: null,
};

interface BookingContextValue {
  state: BookingState;
  setService: (id: string, name: string, durationMinutes: number) => void;
  setPractitionerChoice: (id: string, name: string) => void;
  setDateTime: (
    date: string,
    weekday: string,
    dayOfMonth: number,
    time: string,
    resolvedPractitionerId: string,
    resolvedPractitionerName: string,
  ) => void;
  setDetails: (details: BookingDetails) => void;
  setConfirmedAppointment: (appt: Appointment) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(emptyState);

  const value = useMemo<BookingContextValue>(
    () => ({
      state,
      setService: (id, name, durationMinutes) =>
        setState((prev) => ({ ...prev, serviceId: id, serviceName: name, serviceDuration: durationMinutes })),
      setPractitionerChoice: (id, name) =>
        setState((prev) => ({ ...prev, practitionerChoice: id, practitionerChoiceName: name })),
      setDateTime: (date, weekday, dayOfMonth, time, resolvedPractitionerId, resolvedPractitionerName) =>
        setState((prev) => ({
          ...prev,
          date,
          dateWeekday: weekday,
          dateDayOfMonth: dayOfMonth,
          time,
          resolvedPractitionerId,
          resolvedPractitionerName,
        })),
      setDetails: (details) => setState((prev) => ({ ...prev, details })),
      setConfirmedAppointment: (appt) => setState((prev) => ({ ...prev, confirmedAppointment: appt })),
      reset: () => setState(emptyState),
    }),
    [state],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
