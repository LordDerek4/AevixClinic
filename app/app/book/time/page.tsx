'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAvailability, fetchPractitioners } from '../../../lib/publicApi';
import { nextNDays, formatTime12h } from '../../../lib/dateHelpers';
import { useBooking } from '../../../context/BookingContext';
import Button from '../../../components/Button';
import { PatientPage, BackHeader, Body, StepLabel, StepTitle, Loading, ErrorBanner } from '../PatientLayout';
import styles from './TimeSelect.module.css';
import type { AvailabilitySlot } from '../../../lib/types';

const DAYS_AHEAD = 10;

export default function TimeSelectPage() {
  const router = useRouter();
  const { state, setDateTime } = useBooking();

  useEffect(() => {
    if (!state.serviceId) router.replace('/book');
  }, [state.serviceId, router]);

  const days = nextNDays(DAYS_AHEAD);
  const [activeDayIso, setActiveDayIso] = useState(state.date ?? days[0].iso);
  const [selectedTime, setSelectedTime] = useState<string | null>(state.time);
  const [practitionerNames, setPractitionerNames] = useState<Record<string, string>>({});
  const [availabilityResult, setAvailabilityResult] = useState<{
    key: string;
    open: boolean;
    slots: AvailabilitySlot[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explicitPractitionerId =
    state.practitionerChoice && state.practitionerChoice !== 'first-available' ? state.practitionerChoice : undefined;
  const requestKey = `${state.serviceId ?? ''}|${explicitPractitionerId ?? ''}|${activeDayIso}`;

  useEffect(() => {
    if (!state.serviceId) return;
    fetchPractitioners(state.serviceId)
      .then((list) => setPractitionerNames(Object.fromEntries(list.map((p) => [p.id, p.name]))))
      .catch((err) => setError(err.message));
  }, [state.serviceId]);

  useEffect(() => {
    if (!state.serviceId) return;
    let cancelled = false;
    fetchAvailability({ serviceId: state.serviceId, date: activeDayIso, practitionerId: explicitPractitionerId })
      .then((res) => {
        if (cancelled) return;
        setAvailabilityResult({ key: requestKey, open: res.open, slots: res.slots });
        setSelectedTime((prev) => (prev && res.slots.some((s) => s.time === prev) ? prev : null));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (error) return <PatientPage><ErrorBanner>{error}</ErrorBanner></PatientPage>;

  const availability = availabilityResult?.key === requestKey ? availabilityResult : null;
  const morning = availability?.slots.filter((s) => Number(s.time.slice(0, 2)) < 12) ?? [];
  const afternoon = availability?.slots.filter((s) => Number(s.time.slice(0, 2)) >= 12) ?? [];
  const activeDay = days.find((d) => d.iso === activeDayIso) ?? days[0];

  const selectedSlot = availability?.slots.find((s) => s.time === selectedTime);
  const continueLabel = selectedTime
    ? `Continue — ${activeDay.weekday} ${activeDay.dayOfMonth}, ${formatTime12h(selectedTime)}`
    : 'Pick a time to continue';

  const handleContinue = () => {
    if (!selectedTime || !selectedSlot) return;
    const name = practitionerNames[selectedSlot.practitionerId] ?? 'your practitioner';
    setDateTime(activeDayIso, activeDay.weekday, activeDay.dayOfMonth, selectedTime, selectedSlot.practitionerId, name);
    router.push('/book/details');
  };

  return (
    <PatientPage>
      <BackHeader context={`${state.serviceName ?? 'Appointment'} · ${state.practitionerChoiceName}`} />
      <Body>
        <div>
          <StepLabel step="Step 2 of 3" />
          <StepTitle>Pick a time</StepTitle>
        </div>

        <div className={styles.dateStrip}>
          {days.map((day) => {
            const isSelected = day.iso === activeDayIso;
            return (
              <button
                key={day.iso}
                type="button"
                className={`${styles.dateCell} ${isSelected ? styles.dateCellSelected : ''}`}
                onClick={() => setActiveDayIso(day.iso)}
              >
                <span className={`${styles.weekday} ${isSelected ? styles.weekdaySelected : ''}`}>{day.weekday}</span>
                <span className={`${styles.dayNum} ${isSelected ? styles.dayNumSelected : ''}`}>{day.dayOfMonth}</span>
              </button>
            );
          })}
        </div>

        {!availability ? (
          <Loading>Checking availability…</Loading>
        ) : !availability.open ? (
          <div className={styles.emptyState}>Closed on this day. Pick another day.</div>
        ) : availability.slots.length === 0 ? (
          <div className={styles.emptyState}>No open slots left this day. Pick another day.</div>
        ) : (
          <div className={styles.periodGroup}>
            {morning.length > 0 && (
              <>
                <div className={styles.periodLabel}>Morning</div>
                <div className={styles.slotGrid}>
                  {morning.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={`${styles.slot} ${selectedTime === slot.time ? styles.slotSelected : ''}`}
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      {formatTime12h(slot.time)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {afternoon.length > 0 && (
              <>
                <div className={styles.periodLabel}>Afternoon</div>
                <div className={styles.slotGrid}>
                  {afternoon.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={`${styles.slot} ${selectedTime === slot.time ? styles.slotSelected : ''}`}
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      {formatTime12h(slot.time)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <Button size="large" disabled={!selectedTime} onClick={handleContinue}>
          {continueLabel}
        </Button>
      </Body>
    </PatientPage>
  );
}
