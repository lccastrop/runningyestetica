import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ComposedChart,
  Area,
  Line,
} from 'recharts';

const BAND_COLORS = ['#0d47a1', '#1976d2', '#42a5f5', '#90caf9', '#78909c', '#b0bec5'];
import { api } from '../api';

type Informe = {
  id: string;
  nombre: string;
  fecha: string;
};

type InformeMetadata = {
  fileName?: string | null;
  distanceKm?: number | null;
  rowCount?: number | null;
} | null;

type ScatterPoint = { x: number; y: number };

type Top5Row = {
  pos: number;
  nombre: string;
  bib: string;
  categoria: string;
  tiempoOficial: string;
  tiempoChip: string;
  ritmoMedio: string;
};

type KpiRow = { label: string; value: string };

type TopNRow = {
  pos: number;
  nombre: string;
  bib: string;
  categoria: string;
  tiempoChip: string;
};

type GenderBreakdownRow = {
  genero: string;
  corredores: number;
  pct: string;
  promedio: string;
  mejor: string;
  peor: string;
};

type CategoryBreakdownRow = {
  categoria: string;
  corredores: number;
  pct: string;
  promedio: string;
  mejor: string;
};

type SegmentPaceRow = {
  tramo: string;
  ritmo: string;
  distanciaKm: string;
  acumulado: string;
};

type Top100SegmentRow = {
  tramo: string;
  varonil: string;
  femenil: string;
  distanciaKm: string;
};

type PositionBandRow = {
  tramo: string;
  values: string[];
  distanciaKm: string;
  absVaronil: string;
  absFemenil: string;
};

type PositionBands = { bandLabels: string[]; rows: PositionBandRow[] };

type ElevationPoint = { km: number; alt: number };

type InformeAnalysis = {
  kpiRows: KpiRow[];
  genderBreakdownRows: GenderBreakdownRow[];
  categoryBreakdownRows: CategoryBreakdownRow[];
  segmentPaceRows: SegmentPaceRow[];
  halvesRows: KpiRow[];
  topByGender: { Masculino: TopNRow[]; Femenino: TopNRow[] };
  top100SegmentRows: Top100SegmentRow[];
  positionBands: PositionBands;
  elevationProfile: ElevationPoint[];
  percentileRows: Array<{ label: string; Masculino: string; Femenino: string }>;
  top5ByGender: { Masculino: Top5Row[]; Femenino: Top5Row[] };
  paceDistributionRows: Array<{ label: string; F: number; M: number; X: number }>;
  paceDistributionTotals: { label: string; F: number; M: number; X: number };
  summaryStatsRows: Array<{ label: string; count: number; avgPace: string }>;
  genderSummaryStatsRows: Array<{ label: string; countM: number; countF: number; avgPaceM: string; avgPaceF: string }>;
  categoryStatsRows: Array<{ categoria: string; countM: number; countF: number; avgPaceM: string; avgPaceF: string }>;
  genderSummaryStatsByCategory: Record<string, Array<{ label: string; countM: number; countF: number; avgPaceM: string; avgPaceF: string }>>;
  scatterDataByCategory: Record<string, { dataM: ScatterPoint[]; dataF: ScatterPoint[] }>;
  scatterData: ScatterPoint[];
  scatterDataGenero: { dataM: ScatterPoint[]; dataF: ScatterPoint[] };
};

type InformeDetalle = Informe & {
  metadata: InformeMetadata;
  analysis: InformeAnalysis;
  comments?: Record<string, string>;
};

const formatSecondsToHHMMSS = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatDistance = (distanceKm: number | null | undefined): string | null => {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }
  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${distanceKm.toFixed(3)} km`;
};

const createEmptyAnalysis = (): InformeAnalysis => ({
  kpiRows: [],
  genderBreakdownRows: [],
  categoryBreakdownRows: [],
  segmentPaceRows: [],
  halvesRows: [],
  topByGender: { Masculino: [], Femenino: [] },
  top100SegmentRows: [],
  positionBands: { bandLabels: [], rows: [] },
  elevationProfile: [],
  percentileRows: [],
  top5ByGender: { Masculino: [], Femenino: [] },
  paceDistributionRows: [],
  paceDistributionTotals: { label: 'Total', F: 0, M: 0, X: 0 },
  summaryStatsRows: [],
  genderSummaryStatsRows: [],
  categoryStatsRows: [],
  genderSummaryStatsByCategory: {},
  scatterDataByCategory: {},
  scatterData: [],
  scatterDataGenero: { dataM: [], dataF: [] },
});

const normalizeMetadata = (raw: any): InformeMetadata => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const fileName = typeof raw.fileName === 'string' ? raw.fileName : null;
  const distanceKm =
    typeof raw.distanceKm === 'number' && Number.isFinite(raw.distanceKm)
      ? raw.distanceKm
      : null;
  const rowCount =
    typeof raw.rowCount === 'number' && Number.isFinite(raw.rowCount)
      ? Math.trunc(raw.rowCount)
      : null;

  if (fileName === null && distanceKm === null && rowCount === null) {
    return null;
  }

  return { fileName, distanceKm, rowCount };
};

const normalizeAnalysis = (raw: any): InformeAnalysis => {
  const empty = createEmptyAnalysis();
  if (!raw || typeof raw !== 'object') {
    return empty;
  }

  const percentileRows = Array.isArray(raw.percentileRows)
    ? (raw.percentileRows as InformeAnalysis['percentileRows'])
    : empty.percentileRows;

  const top5Raw = raw.top5ByGender ?? {};
  const top5ByGender = {
    Masculino: Array.isArray(top5Raw.Masculino) ? (top5Raw.Masculino as Top5Row[]) : [],
    Femenino: Array.isArray(top5Raw.Femenino) ? (top5Raw.Femenino as Top5Row[]) : [],
  };

  const kpiRows = Array.isArray(raw.kpiRows) ? (raw.kpiRows as KpiRow[]) : [];
  const genderBreakdownRows = Array.isArray(raw.genderBreakdownRows)
    ? (raw.genderBreakdownRows as GenderBreakdownRow[])
    : [];
  const categoryBreakdownRows = Array.isArray(raw.categoryBreakdownRows)
    ? (raw.categoryBreakdownRows as CategoryBreakdownRow[])
    : [];
  const segmentPaceRows = Array.isArray(raw.segmentPaceRows)
    ? (raw.segmentPaceRows as SegmentPaceRow[])
    : [];
  const halvesRows = Array.isArray(raw.halvesRows) ? (raw.halvesRows as KpiRow[]) : [];
  const topRaw = raw.topByGender ?? {};
  const topFromTop5 = (rows: Top5Row[]): TopNRow[] =>
    rows.map((r) => ({
      pos: r.pos,
      nombre: r.nombre,
      bib: r.bib,
      categoria: r.categoria,
      tiempoChip: r.tiempoChip,
    }));
  const topByGender = {
    Masculino: Array.isArray(topRaw.Masculino)
      ? (topRaw.Masculino as TopNRow[])
      : topFromTop5(top5ByGender.Masculino),
    Femenino: Array.isArray(topRaw.Femenino)
      ? (topRaw.Femenino as TopNRow[])
      : topFromTop5(top5ByGender.Femenino),
  };
  const top100SegmentRows = Array.isArray(raw.top100SegmentRows)
    ? (raw.top100SegmentRows as Top100SegmentRow[])
    : [];
  const positionBands: PositionBands =
    raw.positionBands && typeof raw.positionBands === 'object'
      ? {
          bandLabels: Array.isArray(raw.positionBands.bandLabels)
            ? (raw.positionBands.bandLabels as string[])
            : [],
          rows: Array.isArray(raw.positionBands.rows)
            ? (raw.positionBands.rows as PositionBandRow[])
            : [],
        }
      : { bandLabels: [], rows: [] };
  const elevationProfile = Array.isArray(raw.elevationProfile)
    ? (raw.elevationProfile as ElevationPoint[]).filter(
        (p) => typeof p?.km === 'number' && typeof p?.alt === 'number',
      )
    : [];

  const paceDistributionRows = Array.isArray(raw.paceDistributionRows)
    ? (raw.paceDistributionRows as InformeAnalysis['paceDistributionRows'])
    : empty.paceDistributionRows;

  const paceDistributionTotals =
    raw.paceDistributionTotals && typeof raw.paceDistributionTotals === 'object'
      ? {
          label: String(raw.paceDistributionTotals.label ?? 'Total'),
          F: Number(raw.paceDistributionTotals.F ?? 0),
          M: Number(raw.paceDistributionTotals.M ?? 0),
          X: Number(raw.paceDistributionTotals.X ?? 0),
        }
      : empty.paceDistributionTotals;

  const summaryStatsRows = Array.isArray(raw.summaryStatsRows)
    ? (raw.summaryStatsRows as InformeAnalysis['summaryStatsRows'])
    : empty.summaryStatsRows;

  const genderSummaryStatsRows = Array.isArray(raw.genderSummaryStatsRows)
    ? (raw.genderSummaryStatsRows as InformeAnalysis['genderSummaryStatsRows'])
    : empty.genderSummaryStatsRows;

  const categoryStatsRows = Array.isArray(raw.categoryStatsRows)
    ? (raw.categoryStatsRows as InformeAnalysis['categoryStatsRows'])
    : empty.categoryStatsRows;

  const genderSummaryStatsByCategory =
    raw.genderSummaryStatsByCategory && typeof raw.genderSummaryStatsByCategory === 'object'
      ? Object.entries(raw.genderSummaryStatsByCategory).reduce<
          InformeAnalysis['genderSummaryStatsByCategory']
        >((acc, [key, value]) => {
          acc[key] = Array.isArray(value)
            ? (value as InformeAnalysis['genderSummaryStatsRows'])
            : [];
          return acc;
        }, {})
      : {};

  const scatterDataByCategory =
    raw.scatterDataByCategory && typeof raw.scatterDataByCategory === 'object'
      ? Object.entries(raw.scatterDataByCategory).reduce<
          InformeAnalysis['scatterDataByCategory']
        >((acc, [key, value]) => {
          const dataM = Array.isArray((value as any)?.dataM)
            ? ((value as any).dataM as ScatterPoint[])
            : [];
          const dataF = Array.isArray((value as any)?.dataF)
            ? ((value as any).dataF as ScatterPoint[])
            : [];
          acc[key] = { dataM, dataF };
          return acc;
        }, {})
      : {};

  const scatterData = Array.isArray(raw.scatterData)
    ? (raw.scatterData as ScatterPoint[])
    : empty.scatterData;

  const scatterGeneroRaw = raw.scatterDataGenero ?? {};
  const scatterDataGenero = {
    dataM: Array.isArray(scatterGeneroRaw.dataM)
      ? (scatterGeneroRaw.dataM as ScatterPoint[])
      : [],
    dataF: Array.isArray(scatterGeneroRaw.dataF)
      ? (scatterGeneroRaw.dataF as ScatterPoint[])
      : [],
  };

  return {
    kpiRows,
    genderBreakdownRows,
    categoryBreakdownRows,
    segmentPaceRows,
    halvesRows,
    topByGender,
    top100SegmentRows,
    positionBands,
    elevationProfile,
    percentileRows,
    top5ByGender,
    paceDistributionRows,
    paceDistributionTotals,
    summaryStatsRows,
    genderSummaryStatsRows,
    categoryStatsRows,
    genderSummaryStatsByCategory,
    scatterDataByCategory,
    scatterData,
    scatterDataGenero,
  };
};

const emptySectionMessage = 'Este informe no contiene datos en esta sección.';

type SectionNoteProps = {
  sectionKey: string;
  comments: Record<string, string>;
  setComments: (next: Record<string, string>) => void;
  canEdit: boolean;
  onSave: (next: Record<string, string>) => Promise<void>;
};

const SectionNote = ({ sectionKey, comments, setComments, canEdit, onSave }: SectionNoteProps) => {
  const [local, setLocal] = useState<string>(comments[sectionKey] || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(comments[sectionKey] || '');
  }, [comments, sectionKey]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const next = { ...comments, [sectionKey]: local.trim() };
    try {
      await onSave(next);
      setComments(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const hasText = Boolean((comments[sectionKey] || '').trim());

  if (!canEdit) {
    return hasText ? <p className="muted mt-05">{comments[sectionKey]}</p> : null;
  }

  return (
    <div className="mt-05">
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Agregar comentario o aclaración para esta sección (visible para todos)"
        rows={3}
        style={{ width: '100%' }}
      />
      <div className="mt-025">
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar comentario'}
        </button>
        {savedAt && !saving && !error && (
          <span className="muted" style={{ marginLeft: 8 }}>
            Guardado
          </span>
        )}
        {error && (
          <span className="muted" style={{ marginLeft: 8, color: 'red' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

type InformeMetadataPanelProps = {
  metadata: InformeMetadata;
};

const InformeMetadataPanel = ({ metadata }: InformeMetadataPanelProps) => {
  if (!metadata) {
    return null;
  }

  const distanceText = formatDistance(metadata.distanceKm ?? null);

  const items: string[] = [];
  if (distanceText) {
    items.push(`Distancia registrada: ${distanceText}`);
  }
  if (typeof metadata.rowCount === 'number') {
    items.push(`Registros analizados: ${metadata.rowCount}`);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h4>Resumen del archivo</h4>
      <ul className="mt-05">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
};

type InformeAnalysisViewProps = {
  analysis: InformeAnalysis;
  Note: ({ sectionKey }: { sectionKey: string }) => ReactElement | null;
};

const InformeAnalysisView = ({ analysis, Note }: InformeAnalysisViewProps) => {
  const {
    kpiRows,
    genderBreakdownRows,
    categoryBreakdownRows,
    segmentPaceRows,
    halvesRows,
    topByGender,
    top100SegmentRows,
    positionBands,
    elevationProfile,
    percentileRows,
    paceDistributionRows,
    paceDistributionTotals,
    summaryStatsRows,
    genderSummaryStatsRows,
    categoryStatsRows,
    genderSummaryStatsByCategory,
    scatterDataByCategory,
    scatterData,
    scatterDataGenero,
  } = analysis;

  const hasGenderByCategory = Object.keys(genderSummaryStatsByCategory).length > 0;

  const bandElevationData = useMemo(() => {
    if (positionBands.rows.length === 0 || elevationProfile.length === 0) {
      return [];
    }
    const parsePace = (v: string): number | null => {
      if (!v) return null;
      const parts = v.split(':').map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };
    let acc = 0;
    const bounds = positionBands.rows.map((row) => {
      const d = Number.parseFloat(row.distanciaKm);
      const start = acc;
      acc += Number.isFinite(d) ? d : 0;
      return { start, end: acc, row };
    });
    return elevationProfile.map((p) => {
      const seg = bounds.find((b) => p.km <= b.end + 1e-6) ?? bounds[bounds.length - 1];
      const rec: Record<string, number | null> = { km: p.km, alt: p.alt };
      positionBands.bandLabels.forEach((label, idx) => {
        rec[label] = parsePace(seg.row.values[idx] ?? '');
      });
      rec['Absolutos Varonil'] = parsePace(seg.row.absVaronil);
      rec['Absolutos Femenil'] = parsePace(seg.row.absFemenil);
      return rec;
    });
  }, [positionBands, elevationProfile]);

  return (
    <div>
      <h3 className="mt-1">1. Resumen General de la Carrera</h3>
      <Note sectionKey="sec_1" />
      <div className="mt-1">
        <h4>1.1 KPIs Generales</h4>
        <Note sectionKey="sec_1_1" />
        {kpiRows.length > 0 ? (
          <table className="table">
            <tbody>
              {kpiRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>1.2 Desglose por Género</h4>
        <Note sectionKey="sec_1_2" />
        {genderBreakdownRows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Género</th>
                <th>Corredores</th>
                <th>% del total</th>
                <th>Tiempo promedio</th>
                <th>Mejor tiempo</th>
                <th>Peor tiempo</th>
              </tr>
            </thead>
            <tbody>
              {genderBreakdownRows.map((row) => (
                <tr key={row.genero}>
                  <th scope="row">{row.genero}</th>
                  <td>{row.corredores}</td>
                  <td>{row.pct}</td>
                  <td>{row.promedio}</td>
                  <td>{row.mejor}</td>
                  <td>{row.peor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>1.3 Desglose por Categoría</h4>
        <Note sectionKey="sec_1_3" />
        {categoryBreakdownRows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Corredores</th>
                <th>% del total</th>
                <th>Tiempo promedio</th>
                <th>Mejor tiempo</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdownRows.map((row) => (
                <tr key={row.categoria}>
                  <th scope="row">{row.categoria}</th>
                  <td>{row.corredores}</td>
                  <td>{row.pct}</td>
                  <td>{row.promedio}</td>
                  <td>{row.mejor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <h3 className="mt-1">2.1 Analisis General</h3>
      <Note sectionKey="sec_2_1" />
      <div className="mt-1">
        <h4>2.1.1 Distribucion de percentiles por Genero</h4>
        <Note sectionKey="sec_2_1_1" />
        {percentileRows.length > 0 ? (
          <table className="table">
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
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>2.1.2 Distribucion de participantes por rangos de ritmo y genero</h4>
        <Note sectionKey="sec_2_1_2" />
        {paceDistributionRows.length > 0 ? (
          <>
              <table className="table">
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
              <div>
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
                    <Bar dataKey="F" name="Femenino" fill="magenta" isAnimationActive={false} />
                    <Bar dataKey="M" name="Masculino" fill="blue" isAnimationActive={false} />
                    <Bar dataKey="X" name="X" fill="#ffc658" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>2.1.3 Resumen de Tiempos y Ritmos</h4>
        <Note sectionKey="sec_2_1_3" />
        {summaryStatsRows.length > 0 ? (
          <>
            <div className="contenedor-principal mt-1">
              <table className="table">
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
              {scatterData.length > 0 && (
                <div>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="kilometro"
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
                        formatter={(value: number, name: string) =>
                          name === 'Ritmo Medio' ? formatSecondsToHHMMSS(value) : value
                        }
                      />
                      <Scatter
                        name="Ritmo Medio por Split"
                        data={scatterData}
                        fill="blue"
                        line
                        isAnimationActive={false}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>2.1.4 Distribucion por Splits general por genero</h4>
        <Note sectionKey="sec_2_1_4" />
        {genderSummaryStatsRows.length > 0 ? (
          <>
            <div className="contenedor-principal mt-1">
              <table className="table">
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
              {(scatterDataGenero.dataM.length > 0 || scatterDataGenero.dataF.length > 0) && (
                <div>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="kilometro"
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
                        formatter={(value: number, name: string) =>
                          name === 'Ritmo Medio' ? formatSecondsToHHMMSS(value) : value
                        }
                      />
                      <Legend />
                      <Scatter
                        name="Masculino"
                        data={scatterDataGenero.dataM}
                        fill="blue"
                        line
                        isAnimationActive={false}
                      />
                      <Scatter
                        name="Femenino"
                        data={scatterDataGenero.dataF}
                        fill="magenta"
                        line
                        isAnimationActive={false}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h4>2.1.5 Top 10 por Genero</h4>
        <Note sectionKey="sec_2_1_5" />
        {topByGender.Masculino.length > 0 || topByGender.Femenino.length > 0 ? (
          <>
            {(['Masculino', 'Femenino'] as const).map((genero) =>
              topByGender[genero].length > 0 ? (
                <div key={genero} className="mt-05">
                  <p className="fs-095"><strong>{genero}</strong></p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Nombre</th>
                        <th>BIB</th>
                        <th>Categoría</th>
                        <th>Tiempo chip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topByGender[genero].map((row) => (
                        <tr key={`${genero}-${row.pos}`}>
                          <th scope="row">{row.pos}</th>
                          <td>{row.nombre}</td>
                          <td>{row.bib}</td>
                          <td>{row.categoria}</td>
                          <td>{row.tiempoChip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null,
            )}
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h3>2.2 Analisis Categorias</h3>
        <h4>2.2.1 Distribucion de Corredores y Ritmos Medios por categoria</h4>
        <Note sectionKey="sec_2_2" />
        <Note sectionKey="sec_2_2_1" />
        {categoryStatsRows.length > 0 ? (
          <>
            <div className="contenedor-principal mt-1">
              <table className="table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Categoria</th>
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
                    {categoryStatsRows.map((row) => (
                      <tr key={row.categoria}>
                        <th scope="row">{row.categoria}</th>
                        <td>{row.countM}</td>
                        <td>{row.countF}</td>
                        <td>{row.avgPaceM}</td>
                        <td>{row.avgPaceF}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              <div>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={categoryStatsRows}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoria" angle={-45} textAnchor="end" interval={0} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="countF"
                      name="Femenino"
                      stackId="a"
                      fill="magenta"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="countM"
                      name="Masculino"
                      stackId="a"
                      fill="blue"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="mt-1">
        <h3>2.2.2 Distribucion por Splits por categoria y genero</h3>
        <Note sectionKey="sec_2_2_2" />
        {hasGenderByCategory ? (
          Object.entries(genderSummaryStatsByCategory).map(([category, rows]) => {
            const chartSeries = scatterDataByCategory[category] ?? { dataM: [], dataF: [] };
            const hasSeriesData =
              chartSeries.dataM.length > 0 || chartSeries.dataF.length > 0;

              return (
                <div key={category} className="mt-1">
                  <h4>{category}</h4>
                  <Note sectionKey={`sec_2_2_2__${category}`} />
                  {rows.length > 0 ? (
                  <>
                    <div className="contenedor-principal mt-1">
                      <table className="table">
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
                            {rows.map((row) => (
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
                      {hasSeriesData && (
                        <div>
                          <ResponsiveContainer width="100%" height={400}>
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid />
                              <XAxis
                                type="number"
                                dataKey="x"
                                name="kilometro"
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
                                formatter={(value: number, name: string) =>
                                  name === 'Ritmo Medio' ? formatSecondsToHHMMSS(value) : value
                                }
                              />
                              <Legend />
                              <Scatter
                                name="Masculino"
                                data={chartSeries.dataM}
                                fill="blue"
                                line
                                isAnimationActive={false}
                              />
                              <Scatter
                                name="Femenino"
                                data={chartSeries.dataF}
                                fill="magenta"
                                line
                                isAnimationActive={false}
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p>No hay suficientes datos en esta categoria para generar el informe.</p>
                )}
              </div>
            );
          })
        ) : (
          <p>No se encontraron datos de categorias para analizar.</p>
        )}
      </div>
      <div className="mt-1">
        <h3>2.3 Analisis por Tramos</h3>
        <Note sectionKey="sec_2_3" />
        <div className="mt-1">
          <h4>2.3.1 Ritmo Promedio por Tramo</h4>
          <Note sectionKey="sec_2_3_1" />
          {segmentPaceRows.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Tramo</th>
                  <th>Ritmo (min/km)</th>
                  <th>Distancia tramo (km)</th>
                  <th>Tiempo acumulado promedio</th>
                </tr>
              </thead>
              <tbody>
                {segmentPaceRows.map((row) => (
                  <tr key={row.tramo}>
                    <th scope="row">{row.tramo}</th>
                    <td>{row.ritmo}</td>
                    <td>{row.distanciaKm}</td>
                    <td>{row.acumulado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{emptySectionMessage}</p>
          )}
        </div>
        <div className="mt-1">
          <h4>2.3.2 Primera vs Segunda Mitad</h4>
          <Note sectionKey="sec_2_3_2" />
          {halvesRows.length > 0 ? (
            <table className="table">
              <tbody>
                {halvesRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{emptySectionMessage}</p>
          )}
        </div>
        <div className="mt-1">
          <h4>2.3.3 Ritmo por Tramo: Top 100 por Genero</h4>
          <Note sectionKey="sec_2_3_3" />
          {top100SegmentRows.length > 0 ? (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tramo</th>
                    <th>Top 100 Varonil (min/km)</th>
                    <th>Top 100 Femenil (min/km)</th>
                    <th>Distancia tramo (km)</th>
                  </tr>
                </thead>
                <tbody>
                  {top100SegmentRows.map((row) => (
                    <tr key={row.tramo}>
                      <th scope="row">{row.tramo}</th>
                      <td>{row.varonil}</td>
                      <td>{row.femenil}</td>
                      <td>{row.distanciaKm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted fs-095">
                Promedios sobre los 100 mejores tiempos chip de cada rama; splits
                faltantes excluidos.
              </p>
            </>
          ) : (
            <p>{emptySectionMessage}</p>
          )}
        </div>
        <div className="mt-1">
          <h4>2.3.4 Ritmo por Tramo según Posición General</h4>
          <Note sectionKey="sec_2_3_4" />
          {positionBands.rows.length > 0 ? (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tramo</th>
                    {positionBands.bandLabels.map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                    <th>Distancia (km)</th>
                    <th>Absolutos Varonil</th>
                    <th>Absolutos Femenil</th>
                  </tr>
                </thead>
                <tbody>
                  {positionBands.rows.map((row) => (
                    <tr key={row.tramo}>
                      <th scope="row">{row.tramo}</th>
                      {row.values.map((value, idx) => (
                        <td key={`${row.tramo}-${positionBands.bandLabels[idx]}`}>{value}</td>
                      ))}
                      <td>{row.distanciaKm}</td>
                      <td>{row.absVaronil}</td>
                      <td>{row.absFemenil}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted fs-095">
                Bandas por posición general (ordenado por tiempo chip); excluye
                silla de ruedas y débiles visuales.
              </p>
            </>
          ) : (
            <p>{emptySectionMessage}</p>
          )}
        </div>
        {bandElevationData.length > 0 && (
          <div className="mt-1">
            <h4>2.3.5 Ritmo por Banda de Posición y Absolutos vs Altimetría</h4>
            <Note sectionKey="sec_2_3_5" />
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart
                data={bandElevationData}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="km"
                  name="kilometro"
                  unit="km"
                  domain={[0, 'dataMax']}
                />
                <YAxis
                  yAxisId="pace"
                  type="number"
                  reversed
                  tickFormatter={(tick) => formatSecondsToHHMMSS(tick)}
                  domain={['dataMin - 30', 'dataMax + 30']}
                />
                <YAxis
                  yAxisId="alt"
                  orientation="right"
                  type="number"
                  unit=" m"
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'Altitud (m)' ? `${value} m` : formatSecondsToHHMMSS(value)
                  }
                  labelFormatter={(label) => `km ${label}`}
                />
                <Legend />
                <Area
                  yAxisId="alt"
                  dataKey="alt"
                  name="Altitud (m)"
                  fill="#e6e6e6"
                  stroke="#bfbfbf"
                  isAnimationActive={false}
                />
                {positionBands.bandLabels.map((label, idx) => (
                  <Line
                    key={label}
                    yAxisId="pace"
                    dataKey={label}
                    name={label}
                    stroke={BAND_COLORS[idx % BAND_COLORS.length]}
                    type="stepAfter"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
                <Line
                  yAxisId="pace"
                  dataKey="Absolutos Varonil"
                  stroke="#111111"
                  type="stepAfter"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  yAxisId="pace"
                  dataKey="Absolutos Femenil"
                  stroke="magenta"
                  type="stepAfter"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  isAnimationActive={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="muted fs-095">
              Ritmo por tramo (escala izquierda, invertida: más arriba = más rápido)
              sobre el perfil de la ruta (escala derecha, msnm).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const InformesCarreras = () => {
  const [informes, setInformes] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(true);
  const [detalle, setDetalle] = useState<InformeDetalle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const mockInforme: Informe = useMemo(
    () => ({
      id: 'demo-ejemplo',
      nombre: 'Carrera de Ejemplo',
      fecha: new Date().toISOString(),
    }),
    [],
  );

  useEffect(() => {
    setLoading(true);
    api
      .get('/informes')
      .then((res) => {
        const rawList = Array.isArray(res.data) ? res.data : [];
        const normalized: Informe[] = rawList
          .map((item) => ({
            id: String(item?.id ?? ''),
            nombre: typeof item?.nombre === 'string' ? item.nombre : 'Informe sin nombre',
            fecha: item?.fecha
              ? new Date(item.fecha).toISOString()
              : new Date().toISOString(),
          }))
          .filter((item) => item.id.trim().length > 0);

        normalized.sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        );

        const hasRealReports = normalized.length > 0;
        let list = normalized;

        if (!hasRealReports && showExample && !normalized.some((i) => i.id === mockInforme.id)) {
          list = [...normalized, mockInforme];
        }

        if (hasRealReports && showExample) {
          setShowExample(false);
        }

        setInformes(list);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching informes:', err);
        setError('No se pudieron cargar los informes.');
        setLoading(false);
      });
  }, [showExample, mockInforme]);

  // Selecciona un informe por defecto solo si no hay uno seleccionado aún
  useEffect(() => {
    if (!loading && !error && informes.length > 0 && !selectedId) {
      const preferred =
        informes.find((i) => i.id !== mockInforme.id) ?? informes[0];
      if (preferred) {
        setSelectedId(preferred.id);
      }
    }
  }, [loading, error, informes, selectedId, mockInforme.id]);

  const selectedInforme = useMemo(
    () => informes.find((i) => i.id === selectedId) ?? null,
    [informes, selectedId],
  );

  useEffect(() => {
    if (!selectedId || selectedId === mockInforme.id) {
      setDetalle(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    api
      .get(`/informes/${selectedId}`)
      .then((res) => {
        const data = res.data ?? {};
        const nombre =
          typeof data.nombre === 'string'
            ? data.nombre
            : selectedInforme?.nombre ?? 'Informe sin nombre';
        const fecha =
          typeof data.fecha === 'string'
            ? new Date(data.fecha).toISOString()
            : selectedInforme?.fecha ?? new Date().toISOString();

        const normalizedDetail: InformeDetalle = {
          id: typeof data.id === 'string' ? data.id : selectedId,
          nombre,
          fecha,
          metadata: normalizeMetadata(data.metadata),
          analysis: normalizeAnalysis(data.analysis),
          comments: (data.comments && typeof data.comments === 'object') ? data.comments : {},
        };

        setDetalle(normalizedDetail);
        setComments(normalizedDetail.comments || {});
        setDetailLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching informe detail:', err);
        setDetalle(null);
        setDetailError('No se pudo cargar el informe seleccionado.');
        setDetailLoading(false);
      });
  }, [selectedId, selectedInforme, mockInforme.id]);

  const removeExample = () => {
    const next = informes.filter((i) => i.id !== mockInforme.id);
    setInformes(next);
    setShowExample(false);
    if (selectedId === mockInforme.id) {
      setSelectedId(next.length > 0 ? next[0].id : null);
    }
  };

  const saveComments = async (next: Record<string, string>) => {
    if (!selectedId || selectedId === mockInforme.id) return;
    await api.put(`/informes/${selectedId}/comments`, { comments: next });
  };

  const Note = ({ sectionKey }: { sectionKey: string }) => (
    <SectionNote
      sectionKey={sectionKey}
      comments={comments}
      setComments={setComments}
      canEdit={false}
      onSave={saveComments}
    />
  );

  return (
    <div>
      <h2>Informes de Carreras</h2>
      {loading && <p>Cargando informes...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        informes.length > 0 ? (
          <div className="blog-layout">
            <aside className="blog-aside">
              <h3 className="text-center">Carreras</h3>
              <ul className="blog-list">
                {informes.map((informe) => {
                  const isActive = informe.id === selectedId;
                  const isDemo = informe.id === mockInforme.id;
                  return (
                    <li
                      key={informe.id}
                      className="blog-item clickable"
                      onClick={() => setSelectedId(informe.id)}
                      aria-selected={isActive}
                    >
                      <div>
                        <div>
                          <strong>{informe.nombre}{isDemo ? ' (ejemplo)' : ''}</strong>
                        </div>
                        <div className="muted fs-095">
                          {new Date(informe.fecha).toLocaleDateString()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="blog-main">
              {selectedInforme ? (
                <div>
                  <h3 className="text-center">{selectedInforme.nombre}</h3>
                  <p className="text-center muted mt-05">
                    Publicado el {new Date(selectedInforme.fecha).toLocaleDateString()}
                  </p>
                  {selectedInforme.id === mockInforme.id ? (
                    <div className="text-center mt-1">
                      <p className="muted">
                        Este es un informe de ejemplo (no tiene contenido).
                      </p>
                      <button onClick={removeExample} className="mt-05">
                        Quitar ejemplo
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1">
                      {detailLoading && <p>Cargando informe...</p>}
                      {detailError && <p>{detailError}</p>}
                      {!detailLoading && !detailError && detalle && (
                        <>
                          <InformeMetadataPanel metadata={detalle.metadata} />
                          <InformeAnalysisView analysis={detalle.analysis} Note={Note} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center">
                  Selecciona una carrera en la lista para ver su informe.
                </p>
              )}
            </section>
          </div>
        ) : (
          <p>No hay informes disponibles.</p>
        )
      )}
    </div>
  );
};

export default InformesCarreras;
