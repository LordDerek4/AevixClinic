'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '../../../context/BookingContext';
import { CLINIC } from '../../../lib/clinicInfo';
import { downloadIcs } from '../../../lib/ics';
import Button from '../../../components/Button';
import { PatientPage } from '../PatientLayout';
import styles from './Confirmation.module.css';

export default function ConfirmationPage() {
  const router = useRouter();
  const { state, reset } = useBooking();
  const appointment = state.confirmedAppointment;

  useEffect(() => {
    if (!appointment) router.replace('/book');
  }, [appointment, router]);

  if (!appointment) return null;

  const start = new Date(appointment.startsAt);
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(start);
  const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(start);
  const firstName = appointment.patient.name.split(' ')[0];

  const handleDone = () => {
    reset();
    router.push('/book');
  };

  return (
    <PatientPage>
      <div className={styles.hero}>
        <div className={styles.check}>✓</div>
        <div>
          <div className={styles.heading}>You&apos;re booked, {firstName}</div>
          <div className={styles.subheading}>A confirmation text is on its way to {appointment.patient.phone}.</div>
        </div>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          {dateLabel} · {timeLabel}
        </div>
        <div className={styles.summaryBody}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryRowLabel}>Service</span>
            <span className={styles.summaryRowValue}>{appointment.service.name}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryRowLabel}>Practitioner</span>
            <span className={styles.summaryRowValue}>{appointment.practitioner.name}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryRowLabel}>Where</span>
            <span className={styles.summaryRowValue}>{CLINIC.fullAddress}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div>
          <div className={styles.nextStepsLabel}>What happens next</div>
          <div className={styles.nextStepsList} style={{ marginTop: 12 }}>
            <div className={styles.nextStep}>
              <div className={styles.dot} />
              <div className={styles.nextStepText}>You&apos;ll get an SMS reminder before your visit.</div>
            </div>
            <div className={styles.nextStep}>
              <div className={styles.dot} />
              <div className={styles.nextStepText}>
                Need to change it? Call {CLINIC.phone} — no charge.
              </div>
            </div>
            <div className={styles.nextStep}>
              <div className={styles.dot} />
              <div className={styles.nextStepText}>Arrive 5 minutes early; check in at the front desk.</div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" size="large" onClick={() => downloadIcs(appointment, CLINIC.name, CLINIC.fullAddress)}>
            Add to calendar
          </Button>
          <button type="button" className={styles.doneLink} onClick={handleDone}>
            Done
          </button>
        </div>
      </div>
    </PatientPage>
  );
}
