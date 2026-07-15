export function generateTimeOptions(): { label: string; minutes: number }[] {
  const options: { label: string; minutes: number }[] = [];
  for (let totalMinutes = 6 * 60; totalMinutes <= 21 * 60; totalMinutes += 30) {
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour24 < 12 ? 'am' : 'pm';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    options.push({ label: `${hour12}:${String(minute).padStart(2, '0')} ${period}`, minutes: totalMinutes });
  }
  return options;
}

export const REMINDER_HOUR_OPTIONS = [1, 2, 4, 12, 24, 48];

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday .. Sunday
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
