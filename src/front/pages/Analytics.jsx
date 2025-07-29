// src/pages/Analytics.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'; // Importa componentes de recharts

import "../styles/analytics.css"; // Nuevo archivo CSS para esta página

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

export const Analytics = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();
  const currentUser = store.user;
  const isLoggedIn = store.isLoggedIn;

  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [chartData, setChartData] = useState([]);
  const [chartType, setChartType] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  // Estados para el filtro de fechas
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- Fetch Forms for Dropdown ---
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setForms(data.formularios);
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

  // --- Fetch Questions for Selected Form ---
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
        // Reset selected question and chart data when form changes
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

  // --- Fetch Chart Data for Selected Question ---
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
    if (startDate) {
      url += `&start_date=${startDate}`;
    }
    if (endDate) {
      url += `&end_date=${endDate}`;
    }

    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
  }, [selectedQuestionId, startDate, endDate, fetchChartData]); // Re-fetch when filters change

  // --- Render Chart based on Type ---
  const renderChart = () => {
    if (loading) {
      return <p className="analytics-loading-message">Cargando datos del gráfico...</p>;
    }
    if (error) {
      return <p className="analytics-error-message">Error: {error}</p>;
    }
    if (!chartData || chartData.length === 0) {
      return <p className="analytics-info-message">{message || "No hay datos para mostrar el gráfico."}</p>;
    }

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label
              >
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
        // Determinar la clave del eje X dinámicamente (puede ser 'name' o 'range')
        const xAxisKey = chartData[0] && chartData[0].range ? 'range' : 'name';
        const yAxisKey = chartData[0] && chartData[0].count ? 'count' : 'value';

        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxisKey} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'none':
      default:
        return <p className="analytics-info-message">{message || "Selecciona un tipo de pregunta adecuado para ver el gráfico."}</p>;
    }
  };

  return (
    <>
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
            <h3>Filtros de Análisis</h3>
            <div className="analytics-filters-container">
              <div className="analytics-filter-group">
                <label htmlFor="formSelect">Formulario:</label>
                <select
                  id="formSelect"
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Selecciona un Formulario</option>
                  {forms.map(form => (
                    <option key={form.id_formulario} value={form.id_formulario}>
                      {form.nombre_formulario}
                    </option>
                  ))}
                </select>
              </div>

              <div className="analytics-filter-group">
                <label htmlFor="questionSelect">Pregunta:</label>
                <select
                  id="questionSelect"
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                  disabled={!selectedFormId || loading}
                >
                  <option value="">Selecciona una Pregunta</option>
                  {questions.map(q => (
                    <option key={q.id_pregunta} value={q.id_pregunta}>
                      {q.texto_pregunta} ({q.tipo_respuesta})
                    </option>
                  ))}
                </select>
              </div>

              <div className="analytics-filter-group">
                <label htmlFor="startDate">Desde:</label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="analytics-filter-group">
                <label htmlFor="endDate">Hasta:</label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button onClick={fetchChartData} className="analytics-btn-apply-filters" disabled={loading || !selectedFormId || !selectedQuestionId}>
                Aplicar Filtros
              </button>
            </div>
          </div>

          <div className="analytics-chart-area">
            {renderChart()}
          </div>
        </section>
      </div>
    </>
  );
};

export default Analytics;