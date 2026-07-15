'use client';

import { useEffect, useState } from 'react';
import { useStaffApi } from '../../../../hooks/useStaffApi';
import { fetchServices, fetchPractitioners, fetchAvailability } from '../../../../lib/publicApi';
import { isoDate } from '../../../../lib/dateHelpers';
import type { Service, PractitionerSummary, Appointment, AvailabilitySlot } from '../../../../lib/types';
import Button from '../../../../components/Button';
import styles from './AppointmentModal.module.css';

interface AppointmentModalProps {
  appointment?: Appointment; // present => edit mode
  onClose: () => void;
  onSaved: () => void;
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = isoDate(d);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export default function AppointmentModal({ appointment, onClose, onSaved }: AppointmentModalProps) {
  const { request } = useStaffApi();
  const editing = Boolean(appointment);

  const initial = appointment ? splitDateTime(appointment.startsAt) : { date: isoDate(new Date()), time: '' };

  const [services, setServices] = useState<Service[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsOpen, setSlotsOpen] = useState(true);

  const [serviceId, setServiceId] = useState(appointment?.service.id ?? '');
  const [practitionerId, setPractitionerId] = useState(appointment?.practitioner.id ?? '');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [patientName, setPatientName] = useState(appointment?.patient.name ?? '');
  const [phone, setPhone] = useState(appointment?.patient.phone ?? '');
  const [email, setEmail] = useState(appointment?.patient.email ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');

  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices()
      .then((list) => {
        setServices(list);
        if (!serviceId && list.length > 0) setServiceId(list[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    fetchPractitioners(serviceId)
      .then((list) => {
        setPractitioners(list);
        if (!practitionerId && list.length > 0) setPractitionerId(list[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !date) return;
    fetchAvailability({
      serviceId,
      date,
      practitionerId: practitionerId || undefined,
      excludeAppointmentId: appointment?.id,
    })
      .then((res) => {
        setSlots(res.slots);
        setSlotsOpen(res.open);
        if (editing && time && !res.slots.some((s) => s.time === time)) {
          setSlots((prev) => [...prev, { time, practitionerId }]);
        }
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, practitionerId, date]);

  const nameValid = patientName.trim().length > 0;
  const phoneValid = /^[+]?[\d\s()-]{7,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 7;
  const timeValid = Boolean(time);

  const handleSubmit = async () => {
    setAttempted(true);
    setError(null);
    if (!nameValid || !phoneValid || !timeValid || !serviceId) return;

    setSubmitting(true);
    try {
      if (editing && appointment) {
        await request(`/api/appointments/${appointment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            serviceId,
            practitionerId,
            date,
            time,
            notes: notes.trim() || null,
            patient: { name: patientName.trim(), phone: phone.trim(), email: email.trim() || null },
          }),
        });
      } else {
        await request('/api/appointments', {
          method: 'POST',
          body: JSON.stringify({
            serviceId,
            practitionerId,
            date,
            time,
            notes: notes.trim() || undefined,
            patient: { name: patientName.trim(), phone: phone.trim(), email: email.trim() || undefined },
          }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      await request(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{editing ? 'Edit appointment' : 'New appointment'}</div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="patientName">Patient name</label>
              <input id="patientName" className={styles.input} value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              {attempted && !nameValid && <div className={styles.errorHint}>Required</div>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">Phone</label>
              <input id="phone" className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
              {attempted && !phoneValid && <div className={styles.errorHint}>Invalid</div>}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email (optional)</label>
            <input id="email" type="email" className={styles.input} value={email ?? ''} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="service">Service</label>
            <select id="service" className={styles.select} value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTime(''); }}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="practitioner">Practitioner</label>
            <select id="practitioner" className={styles.select} value={practitionerId} onChange={(e) => { setPractitionerId(e.target.value); setTime(''); }}>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="date">Date</label>
              <input id="date" type="date" className={styles.input} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="time">Time</label>
              {slotsOpen && slots.length > 0 ? (
                <select id="time" className={styles.select} value={time} onChange={(e) => setTime(e.target.value)}>
                  <option value="">Select…</option>
                  {slots.map((s) => (
                    <option key={s.time} value={s.time}>{s.time}</option>
                  ))}
                </select>
              ) : (
                <div className={styles.errorHint}>No open slots this day</div>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">Notes (optional)</label>
            <input id="notes" className={styles.input} value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div className={styles.errorHint}>{error}</div>}
        </div>
        <div className={styles.footer}>
          <Button size="large" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add appointment'}
          </Button>
          {editing && (
            <button type="button" className={styles.cancelLink} onClick={handleCancelAppointment} disabled={submitting}>
              Cancel this appointment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
