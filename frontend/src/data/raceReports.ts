export interface RaceReport {
  id: string;
  title: string;
  summary: string;
  eventDate?: string;
  location?: string;
  html?: string;
  pdfSrc?: string;
}

export const raceReports: RaceReport[] = [
  {
    id: 'maraton-berlin-2024',
    title: 'Maraton de Berlin 2024',
    summary: 'Datos de la poblacion finalista del Maraton de Berlin 2024.',
    eventDate: '29 septiembre 2024',
    location: 'Berlin, Alemania',
    pdfSrc: '/reports/maraton_2024_09_berlin.pdf',
  },{
    id: 'Elite maraton-berlin-2025',
    title: 'Elite Maraton de Berlin 2025',
    summary: 'Datos del top 5 del Maraton de Berlin 2025 vs Kipchoge 2022.',
    eventDate: '21 septiembre 2025',
    location: 'Berlin, Alemania',
    pdfSrc: '/reports/maraton_2025_09_berlin_Elite.pdf',
  },
];

export function getRaceReportById(id: string): RaceReport | undefined {
  return raceReports.find((report) => report.id === id);
}

