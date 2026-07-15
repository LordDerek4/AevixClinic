'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStaffApi } from '../../../../hooks/useStaffApi';
import { generateTimeOptions, REMINDER_HOUR_OPTIONS, WEEKDAY_ORDER, WEEKDAY_LABELS } from '../../../../lib/timeOptions';
import Toggle from '../../../../components/Toggle';
import styles from './Settings.module.css';

const TIME_OPTIONS = generateTimeOptions();

interface AvailabilityRow {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
}

interface PractitionerSettings {
  id: string;
  name: string;
  role: string;
  availability: AvailabilityRow[];
}

interface SettingsResponse {
  reminderSettings: { hoursBefore: number; sameDayNudge: boolean };
  practitioners: PractitionerSettings[];
}

interface DayDraft {
  weekday: number;
  open: boolean;
  startMinutes: number;
  endMinutes: number;
}

function previewMessage(hoursBefore: number): string {
  let timing: string;
  if (hoursBefore >= 24) timing = 'tomorrow, Thu Jul 16 at 10:15 am';
  else if (hoursBefore >= 6) timing = 'later today at 10:15 am';
  else timing = `in ${hoursBefore} hour${hoursBefore === 1 ? '' : 's'}, at 10:15 am`;
  return `Hi Margaret — reminder: your appointment at Cedar Grove Clinic is ${timing} with Dr. Rao. Need to cancel or reschedule? Call (555) 210-8842.`;
}

function buildDraft(availability: AvailabilityRow[]): DayDraft[] {
  return WEEKDAY_ORDER.map((weekday) => {
    const row = availability.find((a) => a.weekday === weekday);
    return {
      weekday,
      open: Boolean(row),
      startMinutes: row?.startMinutes ?? 8 * 60 + 30,
      endMinutes: row?.endMinutes ?? 17 * 60,
    };
  });
}

export default function SettingsPage() {
  const { request } = useStaffApi();

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string | null>(null);
  const [days, setDays] = useState<DayDraft[]>([]);
  const [hoursBefore, setHoursBefore] = useState(24);
  const [sameDayNudge, setSameDayNudge] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<SettingsResponse>('/api/settings')
      .then((res) => {
        setData(res);
        setHoursBefore(res.reminderSettings.hoursBefore);
        setSameDayNudge(res.reminderSettings.sameDayNudge);
        const first = res.practitioners[0];
        if (first) {
          setSelectedPractitionerId(first.id);
          setDays(buildDraft(first.availability));
        }
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPractitioner = useMemo(
    () => data?.practitioners.find((p) => p.id === selectedPractitionerId) ?? null,
    [data, selectedPractitionerId],
  );

  const handlePractitionerChange = (id: string) => {
    setSelectedPractitionerId(id);
    const p = data?.practitioners.find((pr) => pr.id === id);
    if (p) setDays(buildDraft(p.availability));
  };

  const toggleDay = (weekday: number) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, open: !d.open } : d)));
  };

  const updateDayTime = (weekday: number, field: 'startMinutes' | 'endMinutes', minutes: number) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, [field]: minutes } : d)));
  };

  const handleSave = async () => {
    if (!selectedPractitionerId) return;
    setSaving(true);
    setError(null);
    setSavedNote(false);
    try {
      await request('/api/settings/availability', {
        method: 'PUT',
        body: JSON.stringify({
          practitionerId: selectedPractitionerId,
          hours: days.map((d) => ({
            weekday: d.weekday,
            open: d.open,
            startMinutes: d.open ? d.startMinutes : undefined,
            endMinutes: d.open ? d.endMinutes : undefined,
            slotMinutes: 15,
          })),
        }),
      });
      await request('/api/settings/reminders', {
        method: 'PUT',
        body: JSON.stringify({ hoursBefore, sameDayNudge }),
      });
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) return <div className={styles.page}>{error}</div>;
  if (!data) return <div className={styles.page}><div className={styles.loading}>Loading…</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.title}>Clinic settings</div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>Opening hours</div>
            <select
              className={styles.practitionerSelect}
              value={selectedPractitionerId ?? ''}
              onChange={(e) => handlePractitionerChange(e.target.value)}
            >
              {data.practitioners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.hoursTable}>
            {days.map((day) => (
              <div key={day.weekday} className={styles.hoursRow}>
                <span className={`${styles.dayName} ${!day.open ? styles.dayNameClosed : ''}`}>
                  {WEEKDAY_LABELS[day.weekday]}
                </span>
                <Toggle checked={day.open} onChange={() => toggleDay(day.weekday)} label={`${WEEKDAY_LABELS[day.weekday]} open`} />
                {day.open ? (
                  <div className={styles.timeRange}>
                    <select
                      className={styles.timeSelect}
                      value={day.startMinutes}
                      onChange={(e) => updateDayTime(day.weekday, 'startMinutes', Number(e.target.value))}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.minutes} value={t.minutes}>{t.label}</option>
                      ))}
                    </select>
                    <span className={styles.toWord}>to</span>
                    <select
                      className={styles.timeSelect}
                      value={day.endMinutes}
                      onChange={(e) => updateDayTime(day.weekday, 'endMinutes', Number(e.target.value))}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t.minutes} value={t.minutes}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className={styles.closedLabel}>Closed</span>
                )}
              </div>
            ))}
          </div>
          {selectedPractitioner && (
            <div className={styles.reminderSubtitle}>Editing hours for {selectedPractitioner.name} ({selectedPractitioner.role}).</div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Appointment reminders</div>
          <div className={styles.remindersCard}>
            <div className={styles.reminderRow}>
              <div className={styles.reminderText}>
                <span className={styles.reminderTitle}>Reminder</span>
                <span className={styles.reminderSubtitle}>Sent automatically when the reminder job runs.</span>
              </div>
              <div className={styles.reminderControl}>
                <span>Send</span>
                <select
                  className={styles.reminderSelect}
                  value={hoursBefore}
                  onChange={(e) => setHoursBefore(Number(e.target.value))}
                >
                  {REMINDER_HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>
                  ))}
                </select>
                <span>before</span>
              </div>
            </div>
            <div className={`${styles.reminderRow} ${styles.reminderRowBordered}`}>
              <div className={styles.reminderText}>
                <span className={styles.reminderTitle}>Same-day nudge</span>
                <span className={styles.reminderSubtitle}>A second reminder 2 hours before, for morning bookings.</span>
              </div>
              <Toggle checked={sameDayNudge} onChange={setSameDayNudge} label="Same-day nudge" />
            </div>
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>Message preview</span>
              {previewMessage(hoursBefore)}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {savedNote && <span className={styles.savedNote}>Saved</span>}
          {error && <span className={styles.errorNote}>{error}</span>}
          <button type="button" className={styles.saveButton} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
