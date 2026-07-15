'use client';

import { useEffect, useState } from 'react';
import { useStaffApi } from '../../../../hooks/useStaffApi';
import { nextNDays, formatLongDate, isoDate } from '../../../../lib/dateHelpers';
import type { Appointment } from '../../../../lib/types';
import styles from './Calendar.module.css';

const DAYS_AHEAD = 14;

interface PractitionerAvailability {
  id: string;
  availability: { weekday: number }[];
}

export default function CalendarPage() {
  const { request } = useStaffApi();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [openWeekdays, setOpenWeekdays] = useState<Set<number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      request<{ appointments: Appointment[] }>('/api/appointments?filter=today'),
      request<{ appointments: Appointment[] }>('/api/appointments?filter=upcoming'),
      request<{ practitioners: PractitionerAvailability[] }>('/api/settings'),
    ])
      .then(([today, upcoming, settings]) => {
        setAppointments([...today.appointments, ...upcoming.appointments]);
        const weekdays = new Set<number>();
        settings.practitioners.forEach((p) => p.availability.forEach((a) => weekdays.add(a.weekday)));
        setOpenWeekdays(weekdays);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className={styles.page}>{error}</div>;

  const todayIso = isoDate(new Date());
  const days = nextNDays(DAYS_AHEAD);

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.title}>Calendar</div>
        <div className={styles.subtitle}>Bookings at a glance for the next two weeks.</div>
      </div>

      <div className={styles.list}>
        {days.map((day) => {
          const isToday = day.iso === todayIso;
          const weekday = new Date(`${day.iso}T00:00:00`).getDay();
          const closed = openWeekdays ? !openWeekdays.has(weekday) : false;
          const count = appointments?.filter((a) => isoDate(new Date(a.startsAt)) === day.iso && a.status !== 'cancelled').length ?? 0;

          return (
            <div key={day.iso} className={`${styles.dayRow} ${isToday ? styles.dayRowToday : ''}`}>
              <span className={styles.dayLabel}>
                {formatLongDate(day.iso)}
                {isToday && <span className={styles.todayTag}>Today</span>}
              </span>
              <span className={`${styles.dayMeta} ${closed ? styles.dayMetaClosed : ''}`}>
                {appointments === null ? '…' : closed ? 'Closed' : `${count} booked`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
