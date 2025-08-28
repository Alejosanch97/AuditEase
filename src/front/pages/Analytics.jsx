import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import "../styles/analytics.css";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

export const Analytics = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();
  const isLoggedIn = store.isLoggedIn;

  // Estados para la sección de gráficos
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [chartData, setChartData] = useState([]);
  const [chartType, setChartType] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para la nueva sección de tabla de respuestas
  const [formsForTable, setFormsForTable] = useState([]);
  const [selectedFormIdTable, setSelectedFormIdTable] = useState('');
  const [envios, setEnvios] = useState([]);
  const [selectedEnvioId, setSelectedEnvioId] = useState('');
  const [envioDetail, setEnvioDetail] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [errorTable, setErrorTable] = useState(null);

  // --- Fetch Forms for Dropdown (Gráficos) ---
  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      setLoading(false);
      return;
    }

    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/api/formularios/analytics`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const formattedForms = data.formularios.map(form => ({
          ...form,
          nombre_formulario: form.es_plantilla ? `(Plantilla) ${form.nombre_formulario}` : form.nombre_formulario
        }));
        setForms(formattedForms);
        setFormsForTable(formattedForms); // Llenamos también la lista para la segunda sección
      } else {
        setError(data.error || "Error al cargar formularios.");
      }
    } catch (err) {
      console.error("Error fetching forms:", err);
      setError("Error de conexión al cargar formularios.");
    } finally {
      setLoading(false);
    }
  }, [dispatch, navigate]);

  // --- Fetch Questions for Selected Form (Gráficos) ---
  const fetchQuestions = useCallback(async (formId) => {
    if (!formId) {
      setQuestions([]);
      setSelectedQuestionId('');
      setChartData([]);
      setChartType('none');
      setMessage("Selecciona un formulario.");
      return;
    }
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/preguntas/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setQuestions(data.preguntas);
        setSelectedQuestionId('');
        setChartData([]);
        setChartType('none');
        setMessage("Selecciona una pregunta para ver el gráfico.");
      } else {
        setError(data.error || "Error al cargar preguntas.");
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
      setError("Error de conexión al cargar preguntas.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Fetch Chart Data for Selected Question (Gráficos) ---
  const fetchChartData = useCallback(async () => {
    if (!selectedFormId || !selectedQuestionId) {
      setChartData([]);
      setChartType('none');
      setMessage("Selecciona un formulario y una pregunta para ver el gráfico.");
      return;
    }
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    let url = `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${selectedFormId}/respuestas/analytics?question_id=${selectedQuestionId}`;
    if (startDate) { url += `&start_date=${startDate}`; }
    if (endDate) { url += `&end_date=${endDate}`; }

    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) {
        setChartData(data.data);
        setChartType(data.chart_type);
        setMessage(data.message || "");
      } else {
        setError(data.error || "Error al cargar datos del gráfico.");
        setChartData([]);
        setChartType('none');
      }
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setError("Error de conexión al cargar datos del gráfico.");
      setChartData([]);
      setChartType('none');
    } finally {
      setLoading(false);
    }
  }, [selectedFormId, selectedQuestionId, startDate, endDate]);

  // --- NUEVA LÓGICA PARA LA TABLA DE RESPUESTAS ---

  // --- Fetch Envíos for Selected Form (Tabla) ---
  const fetchEnvios = useCallback(async (formId) => {
    if (!formId) {
      setEnvios([]);
      setSelectedEnvioId('');
      setEnvioDetail(null);
      setErrorTable(null);
      return;
    }
    setLoadingTable(true);
    setErrorTable(null);
    const token = localStorage.getItem('access_token');
    try {
      // Modificación aquí para agregar el parámetro de límite
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/envios?limit=9`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEnvios(data.envios);
        setSelectedEnvioId('');
        setEnvioDetail(null);
      } else {
        setErrorTable(data.error || "Error al cargar envíos.");
      }
    } catch (err) {
      console.error("Error fetching envios:", err);
      setErrorTable("Error de conexión al cargar envíos.");
    } finally {
      setLoadingTable(false);
    }
  }, []);

  // --- Fetch Envio Details for Selected Envio (Tabla) ---
  const fetchEnvioDetail = useCallback(async () => {
    if (!selectedEnvioId) {
      setEnvioDetail(null);
      return;
    }
    setLoadingTable(true);
    setErrorTable(null);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/envios-formulario/${selectedEnvioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEnvioDetail(data.envio_formulario);
      } else {
        setErrorTable(data.error || "Error al cargar los detalles del envío.");
        setEnvioDetail(null);
      }
    } catch (err) {
      console.error("Error fetching envio details:", err);
      setErrorTable("Error de conexión al cargar los detalles del envío.");
      setEnvioDetail(null);
    } finally {
      setLoadingTable(false);
    }
  }, [selectedEnvioId]);

  // --- Effects ---
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    fetchForms();
  }, [isLoggedIn, navigate, fetchForms]);

  useEffect(() => {
    fetchQuestions(selectedFormId);
  }, [selectedFormId, fetchQuestions]);

  useEffect(() => {
    fetchChartData();
  }, [selectedQuestionId, startDate, endDate, fetchChartData]);

  // Efecto para la nueva sección
  useEffect(() => {
    fetchEnvios(selectedFormIdTable);
  }, [selectedFormIdTable, fetchEnvios]);

  useEffect(() => {
    fetchEnvioDetail();
  }, [selectedEnvioId, fetchEnvioDetail]);

  // --- Render Functions ---
  const renderChart = () => {
    if (loading) { return <p className="analytics-loading-message">Cargando datos del gráfico...</p>; }
    if (error) { return <p className="analytics-error-message">Error: {error}</p>; }
    if (!chartData || chartData.length === 0) {
      if (message) { return <p className="analytics-info-message">{message}</p>; }
      return <p className="analytics-info-message">No hay datos para mostrar el gráfico.</p>;
    }

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartData.length > 5 ? 400 : 300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }} // Ajustamos el margen inferior para las etiquetas rotadas
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45} // Rotamos las etiquetas 45 grados
                textAnchor="end" // Anclamos el texto al final para que no se salga
                interval={0} // Mostramos todas las etiquetas
                height={80} // Damos más espacio al eje X
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'table_text':
        return (
          <div className="analytics-table-container">
            <h3>Respuestas de Texto</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={entry.id || index}>
                    <td>{index + 1}</td>
                    <td>{entry.value || 'Sin respuesta'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'table_image':
        return (
          <div className="analytics-table-container">
            <h3>Firmas y Dibujos</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Imagen</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={entry.id || index}>
                    <td>{index + 1}</td>
                    <td>
                      {entry.value ? (
                        <img src={entry.value} alt={`Respuesta ${entry.id}`} className="analytics-image-response" />
                      ) : (
                        <span>Sin imagen</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'none':
      default:
        return <p className="analytics-info-message">{message || "Selecciona un tipo de pregunta adecuado para ver el gráfico."}</p>;
    }
  };

  const renderEnvioDetail = () => {
    if (loadingTable) { return <p className="analytics-loading-message">Cargando detalles del envío...</p>; }
    if (errorTable) { return <p className="analytics-error-message">Error: {errorTable}</p>; }
    
    if (!envioDetail) {
      return <p className="analytics-info-message">Selecciona un formulario y un envío para ver sus respuestas.</p>;
    }

    return (
      <div className="analytics-table-container">
        <h3>Respuestas del Envío</h3>
        <p><strong>Enviado por:</strong> {envioDetail.usuario_info?.nombre_completo || 'N/A'}</p>
        <p><strong>Fecha/Hora:</strong> {new Date(envioDetail.fecha_hora_envio).toLocaleString()}</p>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Pregunta</th>
              <th>Respuesta</th>
            </tr>
          </thead>
          <tbody>
            {envioDetail.respuestas.map((res, index) => (
              <tr key={res.id_respuesta || index}>
                <td>{res.texto_pregunta}</td>
                <td>
                  {res.tipo_respuesta_nombre === 'firma' || res.tipo_respuesta_nombre === 'dibujo' ? (
                    res.valor_firma_url && res.valor_firma_url.length > 0 ? (
                      <img
                        src={res.valor_firma_url[0]}
                        alt={`Respuesta de imagen para ${res.texto_pregunta}`}
                        className="analytics-image-response"
                      />
                    ) : (
                      <span>Sin imagen</span>
                    )
                  ) : res.tipo_respuesta_nombre === 'seleccion_recursos' ? (
                    res.valor_recursos_nombres && res.valor_recursos_nombres.length > 0 ? res.valor_recursos_nombres.join(', ') : 'Sin recursos'
                  ) : res.tipo_respuesta_nombre === 'booleano' ? (
                    res.valor_booleano ? 'Sí' : 'No'
                  ) : (
                    res.valor_texto || res.valor_numerico || 'Sin respuesta'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          .analytics-table-container {
            width: 100%;
            overflow-x: auto;
          }
          .analytics-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .analytics-table th, .analytics-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            word-wrap: break-word;
            max-width: 300px;
          }
          .analytics-table th {
            background-color: #f2f2f2;
          }
          .analytics-image-response {
            max-width: 100%;
            height: auto;
            max-height: 150px;
            display: block;
            margin: auto;
            border: 1px solid #ccc;
            border-radius: 5px;
          }
        `}
      </style>
      <header className="main-header">
        <h1 className="headline">Análisis de Formularios</h1>
        <div className="header-right">
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="analytics-content-area">
        <section className="analytics-card analytics-full-width-card">
          <div className="analytics-card-header">
            <h3>Filtros de Análisis (Gráficos)</h3>
            <div className="analytics-filters-container">
              <div className="analytics-filter-group">
                <label htmlFor="formSelect">Formulario:</label>
                <select id="formSelect" value={selectedFormId} onChange={(e) => setSelectedFormId(e.target.value)} disabled={loading}>
                  <option value="">Selecciona un Formulario</option>
                  {forms.map(form => (<option key={form.id_formulario} value={form.id_formulario}>{form.nombre_formulario}</option>))}
                </select>
              </div>
              <div className="analytics-filter-group">
                <label htmlFor="questionSelect">Pregunta:</label>
                <select id="questionSelect" value={selectedQuestionId} onChange={(e) => setSelectedQuestionId(e.target.value)} disabled={!selectedFormId || loading}>
                  <option value="">Selecciona una Pregunta</option>
                  {questions.map(q => (<option key={q.id_pregunta} value={q.id_pregunta}>{q.texto_pregunta} ({q.tipo_respuesta})</option>))}
                </select>
              </div>
              <div className="analytics-filter-group">
                <label htmlFor="startDate">Desde:</label>
                <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
              </div>
              <div className="analytics-filter-group">
                <label htmlFor="endDate">Hasta:</label>
                <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
              </div>
              <button onClick={fetchChartData} className="analytics-btn-apply-filters" disabled={loading || !selectedFormId || !selectedQuestionId}>Aplicar Filtros</button>
            </div>
          </div>
          <div className="analytics-chart-area">
            {renderChart()}
          </div>
        </section>

        {/* --- NUEVA SECCIÓN PARA LA TABLA DE RESPUESTAS POR ID --- */}
        <section className="analytics-card analytics-full-width-card">
          <div className="analytics-card-header">
            <h3>Respuestas por ID de Envío</h3>
            <div className="analytics-filters-container">
              <div className="analytics-filter-group">
                <label htmlFor="formSelectTable">Formulario:</label>
                <select
                  id="formSelectTable"
                  value={selectedFormIdTable}
                  onChange={(e) => setSelectedFormIdTable(e.target.value)}
                  disabled={loadingTable}
                >
                  <option value="">Selecciona un Formulario</option>
                  {formsForTable.map(form => (<option key={form.id_formulario} value={form.id_formulario}>{form.nombre_formulario}</option>))}
                </select>
              </div>
              <div className="analytics-filter-group">
                <label htmlFor="envioSelectTable">Envío:</label>
                <select
                  id="envioSelectTable"
                  value={selectedEnvioId}
                  onChange={(e) => setSelectedEnvioId(e.target.value)}
                  disabled={!selectedFormIdTable || loadingTable || envios.length === 0}
                >
                  <option value="">Selecciona un Envío</option>
                  {envios.map(envio => (
                    <option key={envio.id_envio} value={envio.id_envio}>
                      {`ID: ${envio.id_envio} - Enviado por ${envio.nombre_usuario} el ${new Date(envio.fecha_hora_envio).toLocaleString()}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="analytics-chart-area">
            {renderEnvioDetail()}
          </div>
        </section>
      </div>
    </>
  );
};

export default Analytics;
