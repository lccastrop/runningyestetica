import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Papa from 'papaparse';
import type { ChangeEvent } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

const sections = [
  { id: 'normalizar', title: 'Normalizar CSV' },
  { id: 'analizar', title: 'Analizar CSV' },
  { id: 'guardar', title: 'Guardar Informe' },
] as const;

const desiredColumns = [
  'bib',
  'nombre',
  'distancia',
  'genero',
  'categoria',
  'equipo',
  'tiempo_oficial',
  'Ritmo Medio',
  'tiempo_chip',
  'RM_5km',
  'split_5km',
  'RM_10km',
  'split_10km',
  'RM_15km',
  'split_15km',
  'RM_20km',
  'split_20km',
  'RM_21km',
  'split_21km',
  'RM_25km',
  'split_25km',
  'RM_30km',
  'split_30km',
  'RM_35km',
  'split_35km',
  'RM_40km',
  'split_40km',
  'RM_42km',
  'split_42km',
  'lugar_general',
  'total_general',
  'lugar_genero',
  'total_genero',
  'lugar_categoria',
  'total_categoria',
  'Rango',
  'nacionalidad',
] as const;

type DesiredColumn = (typeof desiredColumns)[number];
type NormalizedRecord = Record<DesiredColumn, string>;

const zeroFillHHMMSSColumns: ReadonlySet<DesiredColumn> = new Set([
  'tiempo_oficial',
  'tiempo_chip',
  'split_5km',
  'split_10km',
  'split_15km',
  'split_20km',
  'split_21km',
  'split_25km',
  'split_30km',
  'split_35km',
  'split_40km',
  'split_42km',
  'Ritmo Medio',
  'RM_5km',
  'RM_10km',
  'RM_15km',
  'RM_20km',
  'RM_21km',
  'RM_25km',
  'RM_30km',
  'RM_35km',
  'RM_40km',
  'RM_42km',
]);
const zeroFillMMSSColumns: ReadonlySet<DesiredColumn> = new Set([]);
const ZERO_TIME = '00:00:00';
const ZERO_PACE = '00:00:00';

function parseDurationToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.every(part => /^\d+$/.test(part))) {
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(part => Number.parseInt(part, 10));
      if ([hours, minutes, seconds].some(n => Number.isNaN(n))) return null;
      return hours * 3600 + minutes * 60 + seconds;
    }
    if (parts.length === 2) {
      const [minutes, seconds] = parts.map(part => Number.parseInt(part, 10));
      if ([minutes, seconds].some(n => Number.isNaN(n))) return null;
      return minutes * 60 + seconds;
    }
    if (parts.length === 1) {
      const seconds = Number.parseInt(parts[0], 10);
      return Number.isNaN(seconds) ? null : seconds;
    }
  }
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isNaN(seconds) ? null : seconds;
  }
  return null;
}

function formatSecondsToHHMMSS(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatSecondsToMMSS(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function sanitizeHHMMSS(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return ZERO_TIME;
  const seconds = parseDurationToSeconds(trimmed);
  if (seconds === null) return ZERO_TIME;
  return formatSecondsToHHMMSS(seconds);
}

function sanitizeMMSS(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return ZERO_PACE;
  const seconds = parseDurationToSeconds(trimmed);
  if (seconds === null) return ZERO_PACE;
  return formatSecondsToMMSS(seconds);
}


type GenderKey = 'Masculino' | 'Femenino';

type PercentileRow = {
  label: string;
  Masculino: string;
  Femenino: string;
};

const percentileSpecs: ReadonlyArray<{ label: string; percentile: number }> = [
  { label: 'Min', percentile: 0 },
  { label: '1%', percentile: 0.01 },
  { label: '5%', percentile: 0.05 },
  { label: '10%', percentile: 0.1 },
  { label: '30%', percentile: 0.3 },
  { label: '50%', percentile: 0.5 },
  { label: '80%', percentile: 0.8 },
  { label: 'Max', percentile: 1 },
];

function pickPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile <= 0) return values[0];
  if (percentile >= 1) return values[values.length - 1];
  const index = Math.ceil(percentile * values.length) - 1;
  const safeIndex = Math.min(values.length - 1, Math.max(0, index));
  return values[safeIndex];
}

function computePercentilesByGender(data: NormalizedRecord[]): PercentileRow[] {
  const genders: GenderKey[] = ['Masculino', 'Femenino'];
  const paceByGender: Record<GenderKey, number[]> = {
    Masculino: [],
    Femenino: [],
  };

  data.forEach((row) => {
    const genero = row.genero as GenderKey;
    if (genero === 'Masculino' || genero === 'Femenino') {
      const sanitized = sanitizeHHMMSS(row['Ritmo Medio']);
      const seconds = parseDurationToSeconds(sanitized);
      if (seconds !== null && seconds > 0) {
        paceByGender[genero].push(seconds);
      }
    }
  });

  genders.forEach((gender) => paceByGender[gender].sort((a, b) => a - b));

  return percentileSpecs.map(({ label, percentile }) => {
    const result: PercentileRow = { label, Masculino: '-', Femenino: '-' };
    genders.forEach((gender) => {
      const values = paceByGender[gender];
      if (values.length > 0) {
        const seconds = pickPercentile(values, percentile);
        result[gender] = formatSecondsToHHMMSS(seconds);
      }
    });
    return result;
  });
}

type PaceDistributionRow = {
  label: string;
  F: number;
  M: number;
  X: number;
};

const paceRanges = [
  { label: '≤ 03:30', min: 0, max: 3 * 60 + 30 },
  { label: '03:31–03:45', min: 3 * 60 + 31, max: 3 * 60 + 45 },
  { label: '03:46–04:00', min: 3 * 60 + 46, max: 4 * 60 + 0 },
  { label: '04:01–04:15', min: 4 * 60 + 1, max: 4 * 60 + 15 },
  { label: '04:16–04:46', min: 4 * 60 + 16, max: 4 * 60 + 46 },
  { label: '04:47–05:14', min: 4 * 60 + 47, max: 5 * 60 + 14 },
  { label: '05:15–05:55', min: 5 * 60 + 15, max: 5 * 60 + 55 },
  { label: '05:56–06:30', min: 5 * 60 + 56, max: 6 * 60 + 30 },
  { label: '06:31–07:37', min: 6 * 60 + 31, max: 7 * 60 + 37 },
  { label: '07:38–08:28', min: 7 * 60 + 38, max: 8 * 60 + 28 },
  { label: '≥ 08:29', min: 8 * 60 + 29, max: Infinity },
];

function computePaceDistribution(data: NormalizedRecord[]): PaceDistributionRow[] {
  const distribution: PaceDistributionRow[] = paceRanges.map(({ label }) => ({
    label,
    F: 0,
    M: 0,
    X: 0,
  }));

  data.forEach(row => {
    const paceSeconds = parseDurationToSeconds(row['Ritmo Medio']);
    if (paceSeconds === null || paceSeconds <= 0) return;

    const gender = row.genero;
    const genderKey = gender === 'Femenino' ? 'F' : gender === 'Masculino' ? 'M' : 'X';

    for (let i = 0; i < paceRanges.length; i++) {
      if (paceSeconds >= paceRanges[i].min && paceSeconds <= paceRanges[i].max) {
        distribution[i][genderKey]++;
        break;
      }
    }
  });

  return distribution;
}

type SummaryStatRow = {
  label: string;
  count: number;
  avgPace: string;
};

function computeSummaryStats(data: NormalizedRecord[]): SummaryStatRow[] {
  const results: SummaryStatRow[] = [];

  const calculateStatsFor = (label: string, subset: NormalizedRecord[], paceColumn: DesiredColumn): SummaryStatRow => {
    if (subset.length === 0) {
      return { label, count: 0, avgPace: ZERO_PACE };
    }
    const totalPaceSeconds = subset.reduce((sum, row) => {
      const paceSeconds = parseDurationToSeconds(row[paceColumn]);
      return sum + (paceSeconds ?? 0);
    }, 0);
    const avgPaceSeconds = totalPaceSeconds / subset.length;
    return {
      label,
      count: subset.length,
      avgPace: formatSecondsToHHMMSS(avgPaceSeconds),
    };
  };

  const withChipTime = data.filter(row => (parseDurationToSeconds(row['tiempo_chip']) ?? 0) > 0);
  results.push(calculateStatsFor('Con Tiempo Chip dif 0', withChipTime, 'Ritmo Medio'));

  const allRmCols: DesiredColumn[] = ['RM_5km', 'RM_10km', 'RM_15km', 'RM_20km', 'RM_21km', 'RM_25km', 'RM_30km', 'RM_35km', 'RM_40km', 'RM_42km'];
  const withAllRmsAndTc = data.filter(row => {
    const hasValidTc = (parseDurationToSeconds(row['tiempo_chip']) ?? 0) > 0;
    if (!hasValidTc) return false;
    return allRmCols.every(col => (parseDurationToSeconds(row[col]) ?? 0) > 0);
  });
  results.push(calculateStatsFor('Con todos los Split y TC', withAllRmsAndTc, 'Ritmo Medio'));

  const rmColsInOrder: DesiredColumn[] = ['RM_5km', 'RM_10km', 'RM_15km', 'RM_20km', 'RM_21km', 'RM_25km', 'RM_30km', 'RM_35km', 'RM_40km', 'RM_42km'];
  const splitLabelsInOrder = ['split 5K', 'split 10K', 'split 15K', 'split 20K', 'split 21K', 'split 25K', 'split 30K', 'split 35K', 'split 40K', 'split 42K'];

  for (let i = 0; i < rmColsInOrder.length; i++) {
      const colsToCheck = rmColsInOrder.slice(0, i + 1);
      const paceColToAverage = rmColsInOrder[i];
      const subset = data.filter(row => {
          return colsToCheck.every(col => (parseDurationToSeconds(row[col]) ?? 0) > 0);
      });
      results.push(calculateStatsFor(splitLabelsInOrder[i], subset, paceColToAverage));
  }

  return results;
}

type GenderSummaryStatRow = {
  label: string;
  countM: number;
  countF: number;
  avgPaceM: string;
  avgPaceF: string;
};

function computeGenderSummaryStats(data: NormalizedRecord[]): GenderSummaryStatRow[] {
  const results: GenderSummaryStatRow[] = [];

  const calculateGenderStatsFor = (label: string, subset: NormalizedRecord[], paceColumn: DesiredColumn): GenderSummaryStatRow => {
    const maleSubset = subset.filter(r => r.genero === 'Masculino');
    const femaleSubset = subset.filter(r => r.genero === 'Femenino');

    const calculateAvgPace = (genderSubset: NormalizedRecord[]): string => {
      if (genderSubset.length === 0) return ZERO_PACE;
      const totalSeconds = genderSubset.reduce((sum, row) => sum + (parseDurationToSeconds(row[paceColumn]) ?? 0), 0);
      return formatSecondsToHHMMSS(totalSeconds / genderSubset.length);
    };

    return {
      label,
      countM: maleSubset.length,
      countF: femaleSubset.length,
      avgPaceM: calculateAvgPace(maleSubset),
      avgPaceF: calculateAvgPace(femaleSubset),
    };
  };

  const withChipTime = data.filter(row => (parseDurationToSeconds(row['tiempo_chip']) ?? 0) > 0);
  results.push(calculateGenderStatsFor('Con Tiempo Chip dif 0', withChipTime, 'Ritmo Medio'));

  const allRmCols: DesiredColumn[] = ['RM_5km', 'RM_10km', 'RM_15km', 'RM_20km', 'RM_21km', 'RM_25km', 'RM_30km', 'RM_35km', 'RM_40km', 'RM_42km'];
  const withAllRmsAndTc = data.filter(row => {
    const hasValidTc = (parseDurationToSeconds(row['tiempo_chip']) ?? 0) > 0;
    if (!hasValidTc) return false;
    return allRmCols.every(col => (parseDurationToSeconds(row[col]) ?? 0) > 0);
  });
  results.push(calculateGenderStatsFor('Con todos los Split y TC', withAllRmsAndTc, 'Ritmo Medio'));

  const rmColsInOrder: DesiredColumn[] = ['RM_5km', 'RM_10km', 'RM_15km', 'RM_20km', 'RM_21km', 'RM_25km', 'RM_30km', 'RM_35km', 'RM_40km', 'RM_42km'];
  const splitLabelsInOrder = ['split 5K', 'split 10K', 'split 15K', 'split 20K', 'split 21K', 'split 25K', 'split 30K', 'split 35K', 'split 40K', 'split 42K'];

  for (let i = 0; i < rmColsInOrder.length; i++) {
      const colsToCheck = rmColsInOrder.slice(0, i + 1);
      const paceColToAverage = rmColsInOrder[i];
      const subset = data.filter(row => {
          return colsToCheck.every(col => (parseDurationToSeconds(row[col]) ?? 0) > 0);
      });
      results.push(calculateGenderStatsFor(splitLabelsInOrder[i], subset, paceColToAverage));
  }

  return results;
}


function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const feminineGenderSynonyms = new Set(
  [
    'f',
    'femenino',
    'fem',
    'femenina',
    'female',
    'w',
    'woman',
    'women',
    'mujer',
    'mujeres',
    'dama',
    'damas',
    'lady',
    'ladies',
    'girl',
    'girls',
    'femenil',
    'masculina',
  ].map(normalizeHeader),
);

const masculineGenderSynonyms = new Set(
  [
    'm',
    'masculino',
    'masc',
    'male',
    'man',
    'men',
    'hombre',
    'hombres',
    'caballero',
    'caballeros',
    'boy',
    'boys',
    'varon',
    'varones',
    'varonil',
  ].map(normalizeHeader),
);

const neutralGenderSynonyms = new Set(
  ['x', 'nb', 'nonbinary', 'nonbinario', 'nobinario', 'otro', 'otra', 'neutral', 'mixto', 'open'].map(
    normalizeHeader,
  ),
);

const columnSynonyms: Record<DesiredColumn, string[]> = {
  bib: ['dorsal', 'numero', 'num', 'no', 'bib number', 'bib_number', 'startnummer', 'id', 'ident'],
  nombre: ['nombre completo', 'name', 'full name', 'vorname', 'nachname'],
  distancia: ['distance', 'dist'],
  genero: ['gender', 'sexo', 'sex', 'rama', 'gender category'],
  categoria: ['category', 'cat', 'division', 'ak'],
  equipo: ['team', 'club', 'equipo/club', 'asociacion', 'verein'],
  tiempo_oficial: ['tiempo oficial', 'official time', 'gun time', 'tiempo_general', 'brutto'],
  'Ritmo Medio': ['ritmo medio', 'ritmo_promedio', 'pace', 'average pace', 'pace promedio', 'ritmo promedio'],
  tiempo_chip: ['tiempo chip', 'chip time', 'net time', 'tiempo neto', 'netto'],
  RM_5km: ['rm 5km', 'ritmo medio 5k', 'pace 5k', 'rm5k', 'z5pace'],
  split_5km: ['split 5km', '5km split', 'split 5k', '5k split', 'z5'],
  RM_10km: ['rm 10km', 'ritmo medio 10k', 'pace 10k', 'rm10k', 'z10pace'],
  split_10km: ['split 10km', '10km split', 'split 10k', '10k split', 'z10'],
  RM_15km: ['rm 15km', 'ritmo medio 15k', 'pace 15k', 'rm15k', 'z15pace'],
  split_15km: ['split 15km', '15km split', 'split 15k', '15k split', 'z15'],
  RM_20km: ['rm 20km', 'ritmo medio 20k', 'pace 20k', 'rm20k', 'z20pace'],
  split_20km: ['split 20km', '20km split', 'split 20km2', '20k split', 'split20km', 'split20km2', 'split_20km2', 'z20'],
  RM_21km: ['rm 21km', 'ritmo medio 21k', 'pace 21k', 'rm21k', 'ritmo medio media maraton', 'hm1pace'],
  split_21km: ['split 21km', '21km split', 'split 21k', '21k split', 'media maraton split', 'halbmarathon'],
  RM_25km: ['rm 25km', 'ritmo medio 25k', 'pace 25k', 'rm25k', 'z25pace'],
  split_25km: ['split 25km', '25km split', 'split 25k', '25k split', 'z25'],
  RM_30km: ['rm 30km', 'ritmo medio 30k', 'pace 30k', 'rm30k', 'z30pace'],
  split_30km: ['split 30km', '30km split', 'split 30k', '30k split', 'z30'],
  RM_35km: ['rm 35km', 'ritmo medio 35k', 'pace 35k', 'rm35k', 'z35pace'],
  split_35km: ['split 35km', '35km split', 'split 35k', '35k split', 'z35'],
  RM_40km: ['rm 40km', 'ritmo medio 40k', 'pace 40k', 'rm40k', 'z40pace'],
  split_40km: ['split 40km', '40km split', 'split 40k', '40k split', 'z40'],
  RM_42km: ['rm 42km', 'ritmo medio 42k', 'pace 42k', 'rm42k', 'ritmo medio maraton', 'z42pace'],
  split_42km: ['split 42km', '42km split', 'split 42k', '42k split', 'split marathon', 'z42'],
  lugar_general: ['overall place', 'posicion general', 'general place', 'platz'],
  total_general: ['overall total', 'total general', 'participantes generales'],
  lugar_genero: ['gender place', 'posicion genero', 'rama lugar', 'gender rank', 'sex_platz'],
  total_genero: ['gender total', 'total genero', 'participantes genero'],
  lugar_categoria: ['category place', 'posicion categoria', 'cat place', 'ak_platz'],
  total_categoria: ['category total', 'total categoria', 'participantes categoria'],
  Rango: ['range', 'rank', 'ranking', 'rango edad', 'division rank'],
  nacionalidad: ['nationality', 'country', 'pais', 'nac', 'nation'],
};

const synonymLookup = new Map<string, DesiredColumn>();
(Object.entries(columnSynonyms) as [DesiredColumn, string[]][]).forEach(([canonical, synonyms]) => {
  const variants = new Set<string>([canonical, ...synonyms]);
  variants.forEach((variant) => {
    synonymLookup.set(normalizeHeader(variant), canonical);
  });
});

type CsvRow = Record<string, unknown>;

function buildHeaderMatches(fields: string[] | undefined): Map<DesiredColumn, string> {
  const matches = new Map<DesiredColumn, string>();
  if (!fields) return matches;

  fields.forEach((field) => {
    const canonical = synonymLookup.get(normalizeHeader(field));
    if (canonical && !matches.has(canonical)) {
      matches.set(canonical, field);
    }
  });

  return matches;
}

function normalizeGenero(value: unknown): 'Masculino' | 'Femenino' | 'X' {
  if (typeof value !== 'string') return 'X';
  const trimmed = value.trim();
  if (!trimmed) return 'X';

  const normalized = normalizeHeader(trimmed);
  if (feminineGenderSynonyms.has(normalized)) return 'Femenino';
  if (masculineGenderSynonyms.has(normalized)) return 'Masculino';
  if (neutralGenderSynonyms.has(normalized)) return 'X';

  return 'X';
}

function normalizeRow(
  row: CsvRow,
  headerMatches: Map<DesiredColumn, string>,
  distanceKm: number,
): string[] {
  const getRawValue = (column: DesiredColumn): string => {
    const originalHeader = headerMatches.get(column);
    if (!originalHeader) return '';
    const rawValue = row[originalHeader];
    if (typeof rawValue === 'string') return rawValue.trim();
    if (rawValue === null || rawValue === undefined) return '';
    return String(rawValue).trim();
  };

  const MARATHON_DISTANCE_KM = 42.195;
  const isMarathon = distanceKm === MARATHON_DISTANCE_KM;

  const chipSanitized = sanitizeHHMMSS(getRawValue('tiempo_chip'));
  const chipSeconds = parseDurationToSeconds(chipSanitized);

  // 1. Ritmo Medio calculation
  let ritmoMedioValue = ZERO_PACE;
  if (chipSeconds !== null && distanceKm > 0) {
    const paceSeconds = chipSeconds / distanceKm;
    ritmoMedioValue = formatSecondsToHHMMSS(paceSeconds);
  }

  // 2. split_42km calculation
  let split42kmValue = sanitizeHHMMSS(getRawValue('split_42km')); // Default value
  if (isMarathon) {
    split42kmValue = chipSanitized;
  }

  // 3. RM_42km calculation
  let rm42kmValue = sanitizeHHMMSS(getRawValue('RM_42km')); // Default value
  if (isMarathon) {
    const split42Seconds = parseDurationToSeconds(split42kmValue);
    const split40Seconds = parseDurationToSeconds(sanitizeHHMMSS(getRawValue('split_40km')));
    if (split42Seconds !== null && split40Seconds !== null && split40Seconds > 0) {
      const diffSeconds = split42Seconds - split40Seconds;
      const lastPaceSeconds = diffSeconds / (MARATHON_DISTANCE_KM - 40);
      rm42kmValue = formatSecondsToHHMMSS(lastPaceSeconds);
    }
  }

  let rangoValue = '-';
  const ritmoMedioSeconds = parseDurationToSeconds(ritmoMedioValue);
  if (ritmoMedioSeconds !== null) {
    for (const range of paceRanges) {
      if (ritmoMedioSeconds >= range.min && ritmoMedioSeconds <= range.max) {
        rangoValue = range.label;
        break;
      }
    }
  }

  const result: string[] = [];

  desiredColumns.forEach((column) => {
    const value = getRawValue(column);

    if (column === 'Ritmo Medio') {
      result.push(ritmoMedioValue);
      return;
    }
    if (column === 'split_42km') {
      result.push(split42kmValue);
      return;
    }
    if (column === 'RM_42km') {
      result.push(rm42kmValue);
      return;
    }
    if (column === 'Rango') {
      result.push(rangoValue);
      return;
    }

    if (column === 'genero') {
      result.push(normalizeGenero(value));
      return;
    }

    if (zeroFillHHMMSSColumns.has(column)) {
      result.push(sanitizeHHMMSS(value));
      return;
    }
    if (zeroFillMMSSColumns.has(column)) {
      result.push(sanitizeMMSS(value));
      return;
    }

    result.push(value);
  });

  return result;
}

function filterMeaningfulRows(rows: CsvRow[]): CsvRow[] {
  return rows.filter((row) =>
    Object.values(row).some((value) => {
      if (value === null || value === undefined) return false;
      const text = typeof value === 'string' ? value.trim() : String(value).trim();
      return text !== '';
    }),
  );
}

const columnsForAnalysisValidation: ReadonlyArray<DesiredColumn> = [
  'tiempo_chip',
  'split_5km',
  'split_10km',
  'split_15km',
  'split_20km',
  'split_21km',
  'split_25km',
  'split_30km',
  'split_35km',
  'split_40km',
  'split_42km',
];

function isValidForAnalysis(record: NormalizedRecord): boolean {
  // This filter assumes a full marathon. For shorter races, it might incorrectly
  // filter out runners if their longer splits are empty (e.g. split_42km for a 10k runner).
  for (const column of columnsForAnalysisValidation) {
    const value = record[column];
    const seconds = parseDurationToSeconds(value);
    if (seconds === null || seconds <= 0) {
      return false;
    }
  }
  return true;
}

const CrearInforme = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [normalizedCsv, setNormalizedCsv] = useState<string | null>(null);
  const [normalizedData, setNormalizedData] = useState<NormalizedRecord[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceInput, setDistanceInput] = useState('');
  const [showDistancePrompt, setShowDistancePrompt] = useState(false);

  const percentileRows = useMemo(() => computePercentilesByGender(normalizedData), [normalizedData]);

  const { paceDistributionRows, paceDistributionTotals } = useMemo(() => {
    const analysisRecords = normalizedData.filter(isValidForAnalysis);
    const rows = computePaceDistribution(analysisRecords);
    const totals: PaceDistributionRow = {
        label: 'Total',
        F: rows.reduce((sum, row) => sum + row.F, 0),
        M: rows.reduce((sum, row) => sum + row.M, 0),
        X: rows.reduce((sum, row) => sum + row.X, 0),
    };
    return { paceDistributionRows: rows, paceDistributionTotals: totals };
  }, [normalizedData]);

  const summaryStatsRows = useMemo(() => computeSummaryStats(normalizedData), [normalizedData]);

  const genderSummaryStatsRows = useMemo(() => computeGenderSummaryStats(normalizedData), [normalizedData]);

  const scatterData = useMemo(() => {
    const dataPoints: { x: number; y: number }[] = [];
    const labelToKm: Record<string, number> = {
      'split 5K': 5,
      'split 10K': 10,
      'split 15K': 15,
      'split 20K': 20,
      'split 21K': 21,
      'split 25K': 25,
      'split 30K': 30,
      'split 35K': 35,
      'split 40K': 40,
      'split 42K': 42.195,
    };

    let yForKm5: number | null = null;

    summaryStatsRows.forEach(row => {
      const km = labelToKm[row.label];
      if (km) {
        const paceSeconds = parseDurationToSeconds(row.avgPace);
        if (paceSeconds !== null) {
          dataPoints.push({ x: km, y: paceSeconds });
          if (km === 5) {
            yForKm5 = paceSeconds;
          }
        }
      }
    });

    if (yForKm5 !== null) {
      dataPoints.push({ x: 0, y: yForKm5 });
    }

    return dataPoints.sort((a, b) => a.x - b.x);
  }, [summaryStatsRows]);

  const hasAnalysisData = normalizedData.length > 0;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setNormalizedCsv(null);
    setNormalizedData([]);
    setDistanceKm(0);
    setDistanceInput('');
    setShowDistancePrompt(!!file);
    setStatusMessage(file ? `Archivo listo: ${file.name}` : '');
  };

  const handleDistanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDistanceInput(value);
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setDistanceKm(parsed);
      setShowDistancePrompt(false);
    } else {
      setDistanceKm(0);
      if (selectedFile) {
        setShowDistancePrompt(true);
      }
    }
  };

  const handleNormalize = async () => {
    if (!selectedFile) {
      setStatusMessage('Selecciona un archivo CSV antes de normalizar.');
      return;
    }
    if (!distanceKm || Number.isNaN(distanceKm) || distanceKm <= 0) {
      setStatusMessage('Ingresa la distancia de la carrera antes de normalizar.');
      setShowDistancePrompt(true);
      return;
    }

    setProcessing(true);
    setStatusMessage('Normalizando datos...');
    setNormalizedCsv(null);
    setNormalizedData([]);

    try {
      const text = await selectedFile.text();
      const parsed = Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
      });

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0]?.message ?? 'Error al leer el CSV.');
      }

      if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
        throw new Error('No se encontraron encabezados en el CSV.');
      }

      const headerMatches = buildHeaderMatches(parsed.meta.fields);
      const rows = filterMeaningfulRows(parsed.data);
      const normalizedRows = rows.map((row) =>
        normalizeRow(row, headerMatches, distanceKm),
      );
      const normalizedRecords: NormalizedRecord[] = normalizedRows.map((values) => {
        const record: Partial<NormalizedRecord> = {};
        desiredColumns.forEach((column, idx) => {
          record[column] = values[idx] ?? '';
        });
        return record as NormalizedRecord;
      });

      const csv = Papa.unparse({
        fields: [...desiredColumns],
        data: normalizedRows,
      });

      setNormalizedData(normalizedRecords);
      setNormalizedCsv(csv);
      setStatusMessage(`CSV normalizado correctamente (${normalizedRows.length} filas procesadas).`);
    } catch (error) {
      console.error('Error al normalizar el CSV:', error);
      setNormalizedData([]);
      setStatusMessage('No se pudo normalizar el CSV. Revisa el archivo.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!normalizedCsv) return;

    const blob = new Blob([normalizedCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'informe-normalizado.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="crear-informe">
      {sections.map((section) => (
        <div key={section.id} className="contenedor-secundario crear-informe__contenedor">
          <h2>{section.title}</h2>
          {section.id === 'normalizar' && (
            <div className="crear-informe__normalizar">
              <label className="mt-1">
                <span>Distancia de la carrera (km)</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={distanceInput}
                  onChange={handleDistanceChange}
                  placeholder="Ej: 5, 21.097, 42.195"
                />
              </label>
              {showDistancePrompt && (
                <p className="mt-05">Ingresa una distancia v?lida en kil?metros.</p>
              )}
              <label className="mt-1">
                <span>Selecciona un archivo CSV</span>
                <input type="file" accept=".csv" onChange={handleFileChange} className="mt-05" />
              </label>
              <div className="mt-1">
                <button type="button" onClick={handleNormalize} disabled={processing}>
                  {processing ? 'Normalizando...' : 'Normalizar CSV'}
                </button>{' '}
                <button type="button" onClick={handleDownload} disabled={!normalizedCsv}>
                  Descargar CSV normalizado
                </button>
              </div>
              {statusMessage && <p className="mt-05">{statusMessage}</p>}
            </div>
          )}
          {section.id === 'analizar' && (
            <div className="crear-informe__analizar">
              <h3>2.1 Analisis General</h3>
              <div className="crear-informe__analizar-bloque">
                <h4>2.1.1 Distribucion de percentiles por Genero</h4>
                {hasAnalysisData ? (
                  <table className="tabla-percentiles">
                    <thead>
                      <tr>
                        <th>Percentil</th>
                        <th>Masculino</th>
                        <th>Femenino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {percentileRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.Masculino}</td>
                          <td>{row.Femenino}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Normaliza un CSV para ver esta informacion.</p>
                )}
              </div>
              <div className="crear-informe__analizar-bloque">
                <h4>2.1.2 Distribución de participantes por rangos de ritmo y género</h4>
                {hasAnalysisData ? (
                  <>
                    <table className="tabla-percentiles">
                      <thead>
                        <tr>
                          <th>RangoRitmo</th>
                          <th>F</th>
                          <th>M</th>
                          <th>X</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paceDistributionRows.map((row) => (
                          <tr key={row.label}>
                            <th scope="row">{row.label}</th>
                            <td>{row.F}</td>
                            <td>{row.M}</td>
                            <td>{row.X}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">{paceDistributionTotals.label}</th>
                          <td>{paceDistributionTotals.F}</td>
                          <td>{paceDistributionTotals.M}</td>
                          <td>{paceDistributionTotals.X}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="mt-2">
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={paceDistributionRows}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" angle={-45} textAnchor="end" interval={0} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="F" name="Femenino" fill="#8884d8" />
                          <Bar dataKey="M" name="Masculino" fill="#82ca9d" />
                          <Bar dataKey="X" name="X" fill="#ffc658" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <p>Normaliza un CSV para ver esta informacion.</p>
                )}
              </div>
              <div className="crear-informe__analizar-bloque">
                <h4>2.1.3 Resumen de Tiempos y Ritmos</h4>
                {hasAnalysisData ? (
                  <>
                    <table className="tabla-percentiles">
                      <thead>
                        <tr>
                          <th>Criterio</th>
                          <th>Total Corredores/as</th>
                          <th>Ritmo Medio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryStatsRows.map((row) => (
                          <tr key={row.label}>
                            <th scope="row">{row.label}</th>
                            <td>{row.count}</td>
                            <td>{row.avgPace}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2">
                      <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart
                          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid />
                          <XAxis
                            type="number"
                            dataKey="x"
                            name="kilómetro"
                            unit="km"
                            domain={['dataMin', 'dataMax']}
                          />
                          <YAxis
                            type="number"
                            dataKey="y"
                            name="Ritmo Medio"
                            tickFormatter={(tick) => formatSecondsToHHMMSS(tick)}
                            reversed={true}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value: number, name: string) => (name === 'Ritmo Medio' ? formatSecondsToHHMMSS(value) : value)}
                          />
                          <Scatter name="Ritmo Medio por Split" data={scatterData} fill="#8884d8" line />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <p>Normaliza un CSV para ver esta informacion.</p>
                )}
              </div>
              <div className="crear-informe__analizar-bloque">
                <h4>2.1.4 Distribución por Splits General por género</h4>
                {hasAnalysisData ? (
                  <table className="tabla-percentiles">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Criterio</th>
                        <th colSpan={2}>Total corredores/as</th>
                        <th colSpan={2}>Ritmo Medio</th>
                      </tr>
                      <tr>
                        <th>Masculino</th>
                        <th>Femenino</th>
                        <th>Masculino</th>
                        <th>Femenino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genderSummaryStatsRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.countM}</td>
                          <td>{row.countF}</td>
                          <td>{row.avgPaceM}</td>
                          <td>{row.avgPaceF}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Normaliza un CSV para ver esta informacion.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CrearInforme;