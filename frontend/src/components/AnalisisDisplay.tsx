import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

// NOTE: The types for the analysis data are not strictly typed here.
// They are based on the data structures created in CrearInforme.tsx.

const formatSecondsToHHMMSS = (totalSeconds: number): string => {
    const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
    const hours = Math.floor(safe / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
    const seconds = (safe % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

const AnalisisDisplay = ({ analysisData }: { analysisData: any }) => {
  if (!analysisData) {
    return <p>Selecciona un informe para ver el análisis.</p>;
  }

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
  } = analysisData;

  return (
    <>
      <h3 className="mt-1">Análisis General</h3>
      <div className="crear-informe__analizar-bloque">
        <h4>Distribución de percentiles por Género</h4>
        <table className="tabla-percentiles">
          <thead>
            <tr>
              <th>Percentil</th>
              <th>Masculino</th>
              <th>Femenino</th>
            </tr>
          </thead>
          <tbody>
            {percentileRows.map((row: any) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.Masculino}</td>
                <td>{row.Femenino}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>Distribución de participantes por rangos de ritmo y género</h4>
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
              {paceDistributionRows.map((row: any) => (
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
                <Bar dataKey="F" name="Femenino" fill="magenta" />
                <Bar dataKey="M" name="Masculino" fill="blue" />
                <Bar dataKey="X" name="X" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>Resumen de Tiempos y Ritmos</h4>
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
              {summaryStatsRows.map((row: any) => (
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
                <Scatter name="Ritmo Medio por Split" data={scatterData} fill="blue" line />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>Distribución por Splits General por género</h4>
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
              {genderSummaryStatsRows.map((row: any) => (
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
                <Legend />
                <Scatter name="Masculino" data={scatterDataGenero.dataM} fill="blue" line />
                <Scatter name="Femenino" data={scatterDataGenero.dataF} fill="magenta" line />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      </div>
      <div className="crear-informe__analizar-bloque">
        <h3>Análisis por Categorías</h3>
        <h4>Distribución de Corredores y Ritmos Medios por categoría</h4>
        <>
          <table className="tabla-percentiles">
            <thead>
              <tr>
                <th rowSpan={2}>Categoría</th>
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
              {categoryStatsRows.map((row: any) => (
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
                <Bar dataKey="countF" name="Femenino" stackId="a" fill="magenta" />
                <Bar dataKey="countM" name="Masculino" stackId="a" fill="blue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      </div>
      <div className="crear-informe__analizar-bloque">
        <h4>Distribución por Splits por categoría y género</h4>
        {Object.entries(genderSummaryStatsByCategory).length > 0 ? (
          Object.entries(genderSummaryStatsByCategory).map(([category, rows]: [string, any]) => (
            <div key={category} className="mt-2">
              <h5>{category}</h5>
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
                      {rows.map((row: any) => (
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
                  <div className="mt-2">
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="x" name="kilómetro" unit="km" domain={['dataMin', 'dataMax']} />
                        <YAxis type="number" dataKey="y" name="Ritmo Medio" tickFormatter={(tick) => formatSecondsToHHMMSS(tick)} reversed={true} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => (name === 'Ritmo Medio' ? formatSecondsToHHMMSS(value) : value)} />
                        <Legend />
                        <Scatter name="Masculino" data={scatterDataByCategory[category]?.dataM} fill="blue" line />
                        <Scatter name="Femenino" data={scatterDataByCategory[category]?.dataF} fill="magenta" line />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p>No hay suficientes datos en esta categoría para generar el informe.</p>
              )}
            </div>
          ))
        ) : (
          <p>No se encontraron datos de categorías para analizar.</p>
        )}
      </div>
    </>
  );
};

export default AnalisisDisplay;
