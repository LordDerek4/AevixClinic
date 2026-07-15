import styles from './StatusBadge.module.css';

export type AppointmentStatus = 'booked' | 'completed' | 'no_show' | 'cancelled';

const LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{LABELS[status]}</span>;
}
