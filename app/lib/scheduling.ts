export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function parseDateOnly(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Invalid date: ${dateStr}`);
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function dateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function combineDateAndTime(date: Date, time: string): Date {
  const minutes = timeToMinutes(time);
  const result = new Date(date);
  result.setHours(0, minutes, 0, 0);
  return result;
}

export interface AvailabilityWindow {
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Candidate start times (minutes since midnight) for a single day, given the
 * practitioner's recurring availability windows, the service duration, and
 * appointments already occupying time on that day.
 */
export function computeAvailableStartMinutes(
  windows: AvailabilityWindow[],
  serviceDurationMinutes: number,
  busy: BusyInterval[],
  day: Date,
  now: Date,
): number[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);

  const busyRanges = busy.map((b) => ({
    start: Math.round((b.startsAt.getTime() - dayStart.getTime()) / 60_000),
    end: Math.round((b.endsAt.getTime() - dayStart.getTime()) / 60_000),
  }));

  const nowMinutes =
    dayStart.toDateString() === new Date(now).toDateString()
      ? Math.round((now.getTime() - dayStart.getTime()) / 60_000)
      : -Infinity;

  const results = new Set<number>();

  for (const w of windows) {
    for (let start = w.startMinutes; start + serviceDurationMinutes <= w.endMinutes; start += w.slotMinutes) {
      const end = start + serviceDurationMinutes;
      if (start <= nowMinutes) continue; // can't book in the past (or right now)

      const overlaps = busyRanges.some((b) => b.start < end && b.end > start);
      if (overlaps) continue;

      results.add(start);
    }
  }

  return Array.from(results).sort((a, b) => a - b);
}

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

export function isValidPhone(phone: string): boolean {
  const digitCount = phone.replace(/\D/g, '').length;
  return PHONE_REGEX.test(phone) && digitCount >= 7 && digitCount <= 15;
}
