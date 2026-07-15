'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStaffApi } from '../../../../hooks/useStaffApi';
import { fetchPractitioners } from '../../../../lib/publicApi';
import { formatLongDate } from '../../../../lib/dateHelpers';
import { isoDate } from '../../../../lib/dateHelpers';
import type { Appointment, AppointmentStatus, PractitionerSummary } from '../../../../lib/types';
import StatusBadge from '../../../../components/StatusBadge';
import AppointmentModal from './AppointmentModal';
import styles from './Dashboard.module.css';

type Tab = 'today' | 'upcoming' | 'past';

interface NoShowStat {
  currentRate: number | null;
  previousRate: number | null;
  sampleSize: number;
}

export default function DashboardPage() {
  const { request } = useStaffApi();

  const [tab, setTab] = useState<Tab>('today');
  const [practitionerFilter, setPractitionerFilter] = useState<string>('all');
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([]);

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [todaySummary, setTodaySummary] = useState<Appointment[] | null>(null);
  const [noShowStat, setNoShowStat] = useState<NoShowStat | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [modalAppointment, setModalAppointment] = useState<Appointment | 'new' | null>(null);

  useEffect(() => {
    fetchPractitioners().then(setPractitioners).catch((err) => setError(err.message));
  }, []);

  const loadTable = useCallback(() => {
    const qs = new URLSearchParams({ filter: tab });
    if (practitionerFilter !== 'all') qs.set('practitionerId', practitionerFilter);
    request<{ appointments: Appointment[] }>(`/api/appointments?${qs.toString()}`)
      .then((res) => setAppointments(res.appointments))
      .catch((err) => setError(err.message));
  }, [tab, practitionerFilter, request]);

  const loadSummary = useCallback(() => {
    request<{ appointments: Appointment[] }>('/api/appointments?filter=today')
      .then((res) => setTodaySummary(res.appointments))
      .catch((err) => setError(err.message));
    request<NoShowStat>('/api/stats/no-show-rate')
      .then(setNoShowStat)
      .catch((err) => setError(err.message));
  }, [request]);

  useEffect(loadTable, [loadTable]);
  useEffect(loadSummary, [loadSummary]);

  const refreshAll = () => {
    loadTable();
    loadSummary();
  };

  const setStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await request(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      const result = await request<{ remindersSent: number; nudgesSent: number }>('/api/reminders/run', { method: 'POST' });
      setReminderResult(
        result.remindersSent === 0 && result.nudgesSent === 0
          ? 'No reminders due right now.'
          : `Sent ${result.remindersSent} reminder(s), ${result.nudgesSent} nudge(s).`,
      );
      refreshAll();
    } catch (err) {
      setReminderResult(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSendingReminders(false);
    }
  };

  if (error) return <div className={styles.errorBanner}>{error}</div>;

  const completedCount = todaySummary?.filter((a) => a.status === 'completed').length ?? 0;
  const noShowCount = todaySummary?.filter((a) => a.status === 'no_show').length ?? 0;

  const attentionItems = (todaySummary ?? []).flatMap((a) => {
    if (a.status === 'booked' && !a.reminderSentAt) {
      return [{ id: a.id, title: `${a.patient.name} hasn't been reminded yet`, subtitle: 'No reminder sent so far' }];
    }
    if (a.status === 'no_show') {
      return [{ id: a.id, title: `${a.patient.name} missed their visit`, subtitle: `${a.service.name} at ${new Date(a.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` }];
    }
    return [];
  });

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.dateTitle}>{formatLongDate(isoDate(new Date()))}</div>
            <div className={styles.dateSubtitle}>
              {todaySummary?.length ?? 0} appointments · {completedCount} completed · {noShowCount} no-show
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.remindersButton} onClick={handleSendReminders} disabled={sendingReminders}>
              {sendingReminders ? 'Sending…' : 'Send due reminders now'}
            </button>
            <button type="button" className={styles.newApptButton} onClick={() => setModalAppointment('new')}>
              + New appointment
            </button>
          </div>
        </div>

        {reminderResult && <div className={styles.dateSubtitle}>{reminderResult}</div>}

        <div className={styles.tabRow}>
          {(['today', 'upcoming', 'past'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.filterChips}>
          <button
            type="button"
            className={`${styles.chip} ${practitionerFilter === 'all' ? styles.chipActive : ''}`}
            onClick={() => setPractitionerFilter('all')}
          >
            All
          </button>
          {practitioners.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.chip} ${practitionerFilter === p.id ? styles.chipActive : ''}`}
              onClick={() => setPractitionerFilter(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className={styles.table}>
          <div className={styles.tableInner}>
            <div className={`${styles.row} ${styles.headRow}`}>
              <span>Time</span><span>Patient</span><span>Service</span><span>Contact</span><span>Status</span><span></span>
            </div>
            {appointments === null ? (
              <div className={styles.emptyRow}>Loading…</div>
            ) : appointments.length === 0 ? (
              <div className={styles.emptyRow}>No appointments here.</div>
            ) : (
              appointments.map((a) => {
                const isDimmed = a.status !== 'booked';
                const time = new Date(a.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={a.id} className={`${styles.row} ${isDimmed ? styles.rowDimmed : ''}`}>
                    <span className={styles.time}>{time}</span>
                    <div className={styles.patientCell}>
                      <button
                        type="button"
                        className={styles.patientName}
                        style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit' }}
                        onClick={() => setModalAppointment(a)}
                      >
                        {a.patient.name}
                      </button>
                      <span className={styles.patientMeta}>{a.practitioner.name}</span>
                    </div>
                    <span className={styles.serviceCell}>{a.service.name}</span>
                    <span className={styles.contactCell}>{a.patient.phone}</span>
                    <StatusBadge status={a.status} />
                    {a.status === 'booked' ? (
                      <div className={styles.actions}>
                        <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => setStatus(a.id, 'completed')}>
                          Complete
                        </button>
                        <button type="button" className={styles.actionBtn} onClick={() => setStatus(a.id, 'no_show')}>
                          No-show
                        </button>
                        <button type="button" className={styles.actionBtn} onClick={() => setStatus(a.id, 'cancelled')}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className={styles.actionNote}>
                        {a.reminderSentAt ? 'Reminder sent' : ''}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarLabel}>No-shows, last 30 days</div>
          <div className={styles.statCard}>
            {noShowStat && noShowStat.currentRate !== null ? (
              <>
                <div className={styles.statValueRow}>
                  <span className={styles.statValue}>{noShowStat.currentRate.toFixed(1)}%</span>
                  {noShowStat.previousRate !== null && (
                    <span className={`${styles.statDelta} ${noShowStat.currentRate > noShowStat.previousRate ? styles.statDeltaUp : ''}`}>
                      {noShowStat.currentRate <= noShowStat.previousRate ? '▾' : '▴'} {noShowStat.previousRate.toFixed(1)}% previously
                    </span>
                  )}
                </div>
                <div className={styles.statNote}>Based on {noShowStat.sampleSize} completed/no-show appointments.</div>
              </>
            ) : (
              <div className={styles.statNote}>Not enough completed appointments yet to compute a rate.</div>
            )}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarLabel}>Needs attention</div>
          {attentionItems.length === 0 && <div className={styles.statNote}>All caught up.</div>}
          {attentionItems.map((item) => (
            <div key={item.id} className={styles.attentionCard}>
              <span className={styles.attentionTitle}>{item.title}</span>
              <span className={styles.attentionSubtitle}>{item.subtitle}</span>
            </div>
          ))}
        </div>
      </div>

      {modalAppointment && (
        <AppointmentModal
          appointment={modalAppointment === 'new' ? undefined : modalAppointment}
          onClose={() => setModalAppointment(null)}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}
