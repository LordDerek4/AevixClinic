// Single-clinic MVP: static display info for the patient-facing pages (name/address/phone
// shown before a service is selected). The authoritative Clinic row lives in the database;
// this just avoids an extra API round-trip for static copy.
export const CLINIC = {
  name: 'Cedar Grove Clinic',
  address: '14 Alder St',
  fullAddress: '14 Alder St, Suite 2',
  phone: '(555) 210-8842',
};
