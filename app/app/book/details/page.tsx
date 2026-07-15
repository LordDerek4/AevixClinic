'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '../../../context/BookingContext';
import { createAppointment } from '../../../lib/publicApi';
import { formatTime12h } from '../../../lib/dateHelpers';
import Button from '../../../components/Button';
import { PatientPage, BackHeader, Body, StepLabel, StepTitle, StepIntro } from '../PatientLayout';
import styles from './PatientDetails.module.css';

export default function PatientDetailsPage() {
  const router = useRouter();
  const { state, setDetails, setConfirmedAppointment } = useBooking();

  useEffect(() => {
    if (!state.date || !state.time) router.replace('/book');
  }, [state.date, state.time, router]);

  const [fullName, setFullName] = useState(state.details?.fullName ?? '');
  const [mobile, setMobile] = useState(state.details?.mobile ?? '');
  const [dob, setDob] = useState(state.details?.dateOfBirth ?? '');
  const [notes, setNotes] = useState(state.details?.notes ?? '');
  const [smsReminder, setSmsReminder] = useState(state.details?.smsReminder ?? true);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameValid = fullName.trim().length > 0;
  const mobileValid = /^[+]?[\d\s()-]{7,20}$/.test(mobile) && mobile.replace(/\D/g, '').length >= 7;

  const handleSubmit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!nameValid || !mobileValid) return;
    if (!state.serviceId || !state.date || !state.time) return;

    setSubmitting(true);
    try {
      const explicitPractitionerId =
        state.practitionerChoice && state.practitionerChoice !== 'first-available' ? state.practitionerChoice : undefined;

      const appointment = await createAppointment({
        serviceId: state.serviceId,
        practitionerId: explicitPractitionerId,
        date: state.date,
        time: state.time,
        notes: notes.trim() || undefined,
        patient: { name: fullName.trim(), phone: mobile.trim(), email: undefined },
      });

      setDetails({ fullName: fullName.trim(), mobile: mobile.trim(), dateOfBirth: dob.trim(), notes: notes.trim(), smsReminder });
      setConfirmedAppointment(appointment);
      router.push('/book/confirmation');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PatientPage>
      <BackHeader
        context={`${state.dateWeekday} ${state.dateDayOfMonth} · ${state.time ? formatTime12h(state.time) : ''} · ${state.resolvedPractitionerName ?? state.practitionerChoiceName}`}
      />
      <Body>
        <div>
          <StepLabel step="Step 3 of 3" />
          <StepTitle>Your details</StepTitle>
          <StepIntro>No account needed — we just need a way to reach you.</StepIntro>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${styles.input} ${attempted && !nameValid ? styles.inputError : ''}`}
              placeholder="e.g. Margaret Ellis"
            />
            {attempted && !nameValid && <div className={styles.errorHint}>Please enter your name.</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mobile">Mobile number</label>
            <input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className={`${styles.input} ${attempted && !mobileValid ? styles.inputError : ''}`}
              placeholder="(555) 014-2276"
            />
            {attempted && !mobileValid ? (
              <div className={styles.errorHint}>Please enter a valid mobile number.</div>
            ) : (
              <div className={styles.hint}>We&apos;ll text your confirmation and reminder here.</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dob">Date of birth</label>
            <input
              id="dob"
              type="text"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="DD / MM / YYYY"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">
              Anything the doctor should know? <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. repeat prescription"
              className={styles.input}
            />
          </div>
        </div>

        <button type="button" className={styles.consent} onClick={() => setSmsReminder((v) => !v)}>
          <span className={`${styles.consentCheck} ${smsReminder ? styles.consentCheckOn : styles.consentCheckOff}`}>
            {smsReminder ? '✓' : ''}
          </span>
          <span className={styles.consentText}>Send me an SMS reminder before my appointment.</span>
        </button>

        {submitError && <div className={styles.errorHint}>{submitError}</div>}

        <div className={styles.footer}>
          <Button size="large" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Booking…' : 'Confirm booking'}
          </Button>
          <div className={styles.footerNote}>Your details are only used for this appointment and are never shared.</div>
        </div>
      </Body>
    </PatientPage>
  );
}
