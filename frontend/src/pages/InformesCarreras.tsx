import { useEffect, useMemo, useState } from 'react';
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
} from 'recharts';
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

type InformeAnalysis = {
  percentileRows: Array<{ label: string; Masculino: string; Femenino: string }>;
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
  percentileRows: [],
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
  };
};

const emptySectionMessage = 'Este informe no contiene datos en esta sección.';

type InformeMetadataPanelProps = {
  metadata: InformeMetadata;
};

const InformeMetadataPanel = ({ metadata }: InformeMetadataPanelProps) => {
  if (!metadata) {
    return null;
  }

  const distanceText = formatDistance(metadata.distanceKm ?? null);

  const items: string[] = [];
  if (metadata.fileName) {
    items.push(`Archivo original: ${metadata.fileName}`);
  }
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
    <div className="contenedor-secundario mt-1">
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
};

const InformeAnalysisView = ({ analysis }: InformeAnalysisViewProps) => {
  const {
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

  return (
    <div className="contenedor-secundario mt-1 crear-informe__analizar">
      <h3 className="mt-1">2.1 Analisis General</h3>
      <div className="crear-informe__analizar-bloque">
        <h4>2.1.1 Distribucion de percentiles por Genero</h4>
        {percentileRows.length > 0 ? (
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
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>2.1.2 Distribucion de participantes por rangos de ritmo y genero</h4>
        {paceDistributionRows.length > 0 ? (
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
      <div className="crear-informe__analizar-bloque">
        <h4>2.1.3 Resumen de Tiempos y Ritmos</h4>
        {summaryStatsRows.length > 0 ? (
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
            {scatterData.length > 0 && (
              <div className="mt-2">
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
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>2.1.4 Distribucion por Splits general por genero</h4>
        {genderSummaryStatsRows.length > 0 ? (
          <>
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
            {(scatterDataGenero.dataM.length > 0 || scatterDataGenero.dataF.length > 0) && (
              <div className="mt-2">
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
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="crear-informe__analizar-bloque">
        <h3>2.2 Analisis Categorias</h3>
        <h4>2.2.1 Distribucion de Corredores y Ritmos Medios por categoria</h4>
        {categoryStatsRows.length > 0 ? (
          <>
            <table className="tabla-percentiles">
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
            <div className="mt-2">
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
          </>
        ) : (
          <p>{emptySectionMessage}</p>
        )}
      </div>
      <div className="crear-informe__analizar-bloque">
        <h3>2.2.2 Distribucion por Splits por categoria y genero</h3>
        {hasGenderByCategory ? (
          Object.entries(genderSummaryStatsByCategory).map(([category, rows]) => {
            const chartSeries = scatterDataByCategory[category] ?? { dataM: [], dataF: [] };
            const hasSeriesData =
              chartSeries.dataM.length > 0 || chartSeries.dataF.length > 0;

            return (
              <div key={category} className="mt-2">
                <h4>{category}</h4>
                {rows.length > 0 ? (
                  <>
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
                      <div className="mt-2">
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
        };

        setDetalle(normalizedDetail);
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

  return (
    <div className="contenedor-principal">
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: isActive ? 700 : 500 }}>
                          {informe.nombre}
                          {isDemo ? ' (ejemplo)' : ''}
                        </span>
                        <span className="muted fs-095">
                          {new Date(informe.fecha).toLocaleDateString()}
                        </span>
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
                          <InformeAnalysisView analysis={detalle.analysis} />
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
