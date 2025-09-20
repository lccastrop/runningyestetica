import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { raceReports, getRaceReportById, type RaceReport } from '../data/raceReports';

function Informes() {
  const hasReports = raceReports.length > 0;
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (!hasReports) return '';
    const idFromQuery = searchParams.get('id');
    const match = idFromQuery ? getRaceReportById(idFromQuery) : undefined;
    return match?.id ?? raceReports[0].id;
  });

  const idParam = searchParams.get('id');

  useEffect(() => {
    if (!hasReports) return;
    if (idParam) {
      const match = getRaceReportById(idParam);
      if (match) {
        if (match.id !== selectedId) {
          setSelectedId(match.id);
        }
        return;
      }
      const fallback = raceReports[0];
      if (fallback && fallback.id !== selectedId) {
        setSelectedId(fallback.id);
      }
      if (fallback && idParam !== fallback.id) {
        setSearchParams({ id: fallback.id }, { replace: true });
      }
    } else if (!selectedId && raceReports[0]) {
      setSelectedId(raceReports[0].id);
    }
  }, [hasReports, idParam, selectedId, setSearchParams]);

  const handleSelectChange = (value: string) => {
    setSelectedId(value);
    if (value) {
      setSearchParams({ id: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const selectedReport: RaceReport | null = useMemo(() => {
    if (!selectedId) return null;
    return getRaceReportById(selectedId) ?? null;
  }, [selectedId]);

  const renderReportContent = () => {
    if (!selectedReport) {
      return (
        <div className="report-content report-content--placeholder">
          <p>Selecciona un informe para visualizar su contenido.</p>
        </div>
      );
    }

    if (selectedReport.pdfSrc) {
      return (
        <div className="report-content report-content--pdf">
          <iframe
            src={selectedReport.pdfSrc}
            title={`Informe ${selectedReport.title}`}
            className="report-frame"
          />
        </div>
      );
    }

    if (selectedReport.html) {
      return (
        <div
          className="report-content"
          dangerouslySetInnerHTML={{ __html: selectedReport.html }}
        />
      );
    }

    return (
      <div className="report-content report-content--placeholder">
        <p>Este informe no tiene contenido disponible.</p>
      </div>
    );
  };

  return (
    <div className="contenedor-principal informes-page">
      <div className="contenedor-secundario informes-panel">
        <h2>Informes de Carreras</h2>
        <p className="muted">
          Selecciona un informe para visualizarlo. Edita <code>src/data/raceReports.ts</code>
          {' '}para agregar o actualizar informes y enlazar archivos PDF.
        </p>

        {hasReports ? (
          <label className="form-field informes-select">
            <span className="form-label">Informe disponible</span>
            <select
              className="form-input"
              value={selectedId}
              onChange={(event) => handleSelectChange(event.target.value)}
            >
              {raceReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="informes-empty">
            <p>No hay informes de carreras cargados todavia.</p>
            <p className="muted">Agrega registros en <code>src/data/raceReports.ts</code>.</p>
          </div>
        )}

        {selectedReport && (
          <ul className="informes-meta">
            {selectedReport.eventDate && (
              <li>
                <strong>Fecha:</strong> {selectedReport.eventDate}
              </li>
            )}
            {selectedReport.location && (
              <li>
                <strong>Ubicacion:</strong> {selectedReport.location}
              </li>
            )}
            {selectedReport.summary && (
              <li>
                <strong>Resumen:</strong> {selectedReport.summary}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="contenedor-principal informes-display">
        {renderReportContent()}
      </div>
    </div>
  );
}

export default Informes;