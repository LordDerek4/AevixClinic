import type { AvailabilityResponse, Service, PractitionerSummary, Appointment } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchServices() {
  return request<{ services: Service[] }>('/api/services').then((r) => r.services);
}

export function fetchPractitioners(serviceId?: string) {
  const qs = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : '';
  return request<{ practitioners: PractitionerSummary[] }>(`/api/practitioners${qs}`).then((r) => r.practitioners);
}

export function fetchAvailability(params: {
  serviceId: string;
  date: string;
  practitionerId?: string;
  excludeAppointmentId?: string;
}) {
  const qs = new URLSearchParams({ serviceId: params.serviceId, date: params.date });
  if (params.practitionerId) qs.set('practitionerId', params.practitionerId);
  if (params.excludeAppointmentId) qs.set('excludeAppointmentId', params.excludeAppointmentId);
  return request<AvailabilityResponse>(`/api/availability?${qs.toString()}`);
}

export interface CreateAppointmentInput {
  serviceId: string;
  practitionerId?: string;
  date: string;
  time: string;
  notes?: string;
  patient: { name: string; phone: string; email?: string };
}

export function createAppointment(input: CreateAppointmentInput) {
  return request<{ appointment: Appointment }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.appointment);
}
