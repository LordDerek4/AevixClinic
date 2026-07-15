'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchServices, fetchPractitioners } from '../../lib/publicApi';
import type { Service, PractitionerSummary } from '../../lib/types';
import { useBooking } from '../../context/BookingContext';
import Button from '../../components/Button';
import { PatientPage, ClinicHeader, Body, StepLabel, StepTitle, Loading, ErrorBanner } from './PatientLayout';
import styles from './ServiceSelect.module.css';

const FIRST_AVAILABLE = { id: 'first-available', name: 'First available', role: '' };

export default function ServiceSelectPage() {
  const router = useRouter();
  const { state, setService, setPractitionerChoice } = useBooking();

  const [services, setServices] = useState<Service[] | null>(null);
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch((err) => setError(err.message));
  }, []);

  const selectedServiceId = state.serviceId ?? services?.[0]?.id ?? null;

  useEffect(() => {
    if (!selectedServiceId) return;
    fetchPractitioners(selectedServiceId)
      .then(setPractitioners)
      .catch((err) => setError(err.message));
  }, [selectedServiceId]);

  useEffect(() => {
    if (!state.serviceId && services && services.length > 0) {
      setService(services[0].id, services[0].name, services[0].durationMinutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  if (error) return <PatientPage><ErrorBanner>{error}</ErrorBanner></PatientPage>;
  if (!services) return <PatientPage><Loading /></PatientPage>;

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? services[0];
  const allPractitionerOptions = [FIRST_AVAILABLE, ...practitioners];
  const selectedPractitionerId = state.practitionerChoice ?? 'first-available';

  const handleSelectService = (service: Service) => {
    setService(service.id, service.name, service.durationMinutes);
  };

  const handleContinue = () => {
    if (!selectedService) return;
    if (!state.serviceId) setService(selectedService.id, selectedService.name, selectedService.durationMinutes);
    if (!state.practitionerChoice) setPractitionerChoice('first-available', 'First available');
    router.push('/book/time');
  };

  return (
    <PatientPage>
      <ClinicHeader />
      <Body>
        <div>
          <StepLabel step="Step 1 of 3" />
          <StepTitle>What do you need?</StepTitle>
        </div>

        <div className={styles.list}>
          {services.map((service) => {
            const isSelected = service.id === selectedServiceId;
            return (
              <button
                key={service.id}
                type="button"
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => handleSelectService(service)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionName}>{service.name}</span>
                  <span className={styles.optionDuration}>{service.durationMinutes} minutes</span>
                </span>
                {isSelected && <span className={styles.check}>✓</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={styles.practitionerLabel}>With whom?</div>
          <div className={styles.pillRow}>
            {allPractitionerOptions.map((p) => {
              const isSelected = p.id === selectedPractitionerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.pill} ${isSelected ? styles.pillSelected : ''}`}
                  onClick={() => setPractitionerChoice(p.id, p.name)}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <Button size="large" onClick={handleContinue}>
          Continue
        </Button>
      </Body>
    </PatientPage>
  );
}
