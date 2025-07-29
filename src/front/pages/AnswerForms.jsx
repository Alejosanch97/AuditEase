// src/pages/AnswerForms.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

import "../styles/answer-forms.css";

export const AnswerForms = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = store.user;
  const userRole = currentUser?.rol;
  const isLoggedIn = store.isLoggedIn;

  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [errorForms, setErrorForms] = useState(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState(''); 
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [favoriteForms, setFavoriteForms] = useState(new Set());

  const [allCompanies, setAllCompanies] = useState([]);

  const [manualSubmissionsCounts, setManualSubmissionsCounts] = useState({});
  const [scheduledAutomationTimes, setScheduledAutomationTimes] = useState({});
  const [userSubmissionsInPeriodCounts, setUserSubmissionsInPeriodCounts] = useState({});
  const [lastAutomationRunDates, setLastAutomationRunDates] = useState({});


  const updateLocalFavoriteState = useCallback(() => {
    if (currentUser && currentUser.favoritos) {
      setFavoriteForms(new Set(currentUser.favoritos.map(String)));
      console.log("Local favorite state updated from currentUser:", currentUser.favoritos);
    } else {
      setFavoriteForms(new Set());
      console.log("currentUser.favoritos is not available or empty for local state update.");
    }
  }, [currentUser]);

  const toggleFavorite = async (formId, isFavorite) => {
    console.log(`Attempting to ${isFavorite ? 'add' : 'remove'} favorite for formId: ${formId}`);
    
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No autenticado para guardar favoritos.' } });
      return;
    }

    const url = `${import.meta.env.VITE_BACKEND_URL}/api/usuarios/favoritos/${formId}`;
    const method = isFavorite ? 'POST' : 'DELETE';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: method === 'POST' ? JSON.stringify({}) : undefined, 
      });

      const data = await response.json();

      if (response.ok) {
        if (data.favoritos) {
          dispatch({
            type: 'SET_USER',
            payload: {
              ...store.user,
              favoritos: data.favoritos
            }
          });
        }
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
        console.log(`Favorite operation successful for formId: ${formId}. New favorites:`, data.favoritos);
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al actualizar favoritos: ${data.error}` } });
        console.error(`Error toggling favorite for formId: ${formId}:`, data.error);
      }
    } catch (e) {
      console.error("Error de conexión al actualizar favoritos: ", e);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al actualizar favoritos.' } });
    }
  };

  const handleSetAutomationTime = async (formId, timeString) => {
    const token = localStorage.getItem('access_token');
    if (!token || !userRole || (userRole !== 'owner' && userRole !== 'admin_empresa')) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No tienes permisos para programar la automatización.' } });
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/set_automation_schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scheduled_time: timeString })
      });

      const data = await response.json();
      if (response.ok) {
        setScheduledAutomationTimes(prev => ({ ...prev, [formId]: timeString }));
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al programar automatización: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error de conexión al programar automatización:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al programar automatización.' } });
    }
  };


  const fetchData = useCallback(async () => {
    setLoadingForms(true);
    setErrorForms(null);
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      setLoadingForms(false);
      return;
    }

    try {
      const formsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const formsData = await formsResponse.json();

      if (formsResponse.ok) {
        const initialManualCounts = {};
        const initialUserSubmissionsInPeriodCounts = {};
        const initialScheduledTimes = {};
        const initialLastRunDates = {};

        const formsWithExtraData = await Promise.all(formsData.formularios.map(async (form) => {
          let manualCount = 0;
          try {
            const manualCountRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${form.id_formulario}/manual_submissions_count`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const manualCountData = await manualCountRes.json();
            if (manualCountRes.ok) {
              manualCount = manualCountData.count || 0;
            } else {
              console.warn(`Could not fetch manual submissions for form ${form.id_formulario}: ${manualCountData.error}`);
            }
          } catch (err) {
            console.error(`Error fetching manual submissions for form ${form.id_formulario}:`, err);
          }
          initialManualCounts[form.id_formulario] = manualCount;

          let userSubmissionsInPeriod = 0;
          try {
            const userSubmissionsRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${form.id_formulario}/user_submissions_in_period_count`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const userSubmissionsData = await userSubmissionsRes.json();
            if (userSubmissionsRes.ok) {
              userSubmissionsInPeriod = userSubmissionsData.count || 0;
            } else {
              console.warn(`Could not fetch user submissions in period for form ${form.id_formulario}: ${userSubmissionsData.error}`);
            }
          } catch (err) {
            console.error(`Error fetching user submissions in period for form ${form.id_formulario}:`, err);
          }
          initialUserSubmissionsInPeriodCounts[form.id_formulario] = userSubmissionsInPeriod;

          initialScheduledTimes[form.id_formulario] = form.scheduled_automation_time ? form.scheduled_automation_time.substring(0, 5) : '15:00';
          initialLastRunDates[form.id_formulario] = form.last_automated_run_date;

          return {
            ...form,
            manual_submissions_count: manualCount,
            user_submissions_in_period_count: userSubmissionsInPeriod,
          };
        }));
        
        setForms(formsWithExtraData);
        setManualSubmissionsCounts(initialManualCounts);
        setUserSubmissionsInPeriodCounts(initialUserSubmissionsInPeriodCounts);
        setScheduledAutomationTimes(initialScheduledTimes);
        setLastAutomationRunDates(initialLastRunDates);


      } else {
        setErrorForms(formsData.error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar formularios: ${formsData.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar formularios o datos adicionales:', error);
      setErrorForms('Error de conexión al cargar formularios y datos adicionales.');
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar formularios.' } });
    } finally {
      setLoadingForms(false);
    }

    if (userRole === 'owner') {
      try {
        const companiesResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresas`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const companiesData = await companiesResponse.json();
        if (companiesResponse.ok) {
          setAllCompanies(companiesData.empresas);
        } else {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar todas las empresas: ${companiesData.error}` } });
        }
      } catch (error) {
        console.error('Error al cargar todas las empresas:', error);
      }
    }
  }, [isLoggedIn, navigate, dispatch, userRole]);


  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    if (currentUser) {
      fetchData();
    }
  }, [isLoggedIn, currentUser, fetchData]);

  useEffect(() => {
    updateLocalFavoriteState();
  }, [updateLocalFavoriteState]);

  const filteredForms = forms.filter(form => {
    if (selectedCompanyId) {
      if (selectedCompanyId === 'template') {
        if (!form.es_plantilla) {
          return false;
        }
      } else {
        if (form.id_empresa !== parseInt(selectedCompanyId)) {
          return false;
        }
      }
    }
    
    if (showFavoritesOnly && !favoriteForms.has(String(form.id_formulario))) {
      return false;
    }
    return true;
  });

  const getAutomationHoverMessage = useCallback((form) => {
    const manualCount = manualSubmissionsCounts[form.id_formulario] || 0;
    const currentSubmissionsInPeriod = userSubmissionsInPeriodCounts[form.id_formulario] || 0;
    const maxSubmissions = form.max_submissions_per_period;
    const scheduledTime = scheduledAutomationTimes[form.id_formulario];
    const lastRunDate = lastAutomationRunDates[form.id_formulario];

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const lastRunDateObj = lastRunDate ? new Date(lastRunDate + 'T00:00:00Z') : null;
    const lastRunDateString = lastRunDateObj ? lastRunDateObj.toISOString().split('T')[0] : null;

    if (!form.automatizacion_activa) {
      return "Automatización inactiva para este formulario.";
    }

    if (manualCount < 5) {
      return `Aún no tienes ${5 - manualCount} respuestas manuales para habilitar la automatización inteligente.`;
    }

    if (maxSubmissions > 0 && currentSubmissionsInPeriod >= maxSubmissions) {
        return `Límite de diligencias alcanzado (${maxSubmissions} cada ${form.submission_period_days} día(s)). Automatización completada para este período.`;
    }

    const [hours, minutes] = (scheduledTime || '15:00').split(':').map(Number);
    const scheduledDateTime = new Date();
    scheduledDateTime.setHours(hours, minutes, 0, 0);
    const nowLocal = new Date();

    if (nowLocal.getTime() >= scheduledDateTime.getTime() && lastRunDateString !== todayDateString) {
      return `Automatización Live: Se ejecutará pronto o ya se ejecutó hoy a las ${scheduledTime}.`;
    } else if (lastRunDateString === todayDateString) {
        return `Automatización ejecutada hoy a las ${scheduledTime}.`;
    } else {
      return `Automatización Live: Programada para las ${scheduledTime}.`;
    }
    
  }, [manualSubmissionsCounts, userSubmissionsInPeriodCounts, scheduledAutomationTimes, lastAutomationRunDates]);

  const getAutomationStatusClass = useCallback((form, manualCount, currentSubmissionsInPeriod, scheduledTime, lastRunDate) => {
    const maxSubmissions = form.max_submissions_per_period;
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const lastRunDateObj = lastRunDate ? new Date(lastRunDate + 'T00:00:00Z') : null;
    const lastRunDateString = lastRunDateObj ? lastRunDateObj.toISOString().split('T')[0] : null;

    if (!form.automatizacion_activa) {
      return '';
    }

    if (manualCount < 5) {
      return 'af-automation-pending';
    }

    if (maxSubmissions > 0 && currentSubmissionsInPeriod >= maxSubmissions) {
      return 'af-automation-completed';
    }

    const [hours, minutes] = (scheduledTime || '15:00').split(':').map(Number);
    const scheduledDateTime = new Date();
    scheduledDateTime.setHours(hours, minutes, 0, 0);
    const nowLocal = new Date();

    if (nowLocal.getTime() >= scheduledDateTime.getTime() && lastRunDateString !== todayDateString) {
      return 'af-automation-live';
    } else if (lastRunDateString === todayDateString) {
      return 'af-automation-completed';
    } else {
      return 'af-automation-live';
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--primary-dark)' }}>
        Cargando...
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Contestar Formularios</h1>
        <div className="header-right">
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="af-content-area">
        <section className="af-card af-full-width-card">
            <div className="af-card-header af-filters-header">
              <h3>Formularios Disponibles</h3>
              <div className="af-filters-container">
                {userRole === 'owner' && (
                  <div className="af-filter-group">
                    <label htmlFor="companyFilter" className="af-filter-label">Filtrar por Empresa:</label>
                    <select
                      id="companyFilter"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="af-filter-select"
                    >
                      <option value="">Todas las Empresas</option>
                      <option value="template">Solo Plantillas</option>
                      {(allCompanies || []).map(comp => (
                        <option key={comp.id_empresa} value={comp.id_empresa}>
                          {comp.nombre_empresa}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="af-filter-group af-checkbox-filter">
                  <input
                    type="checkbox"
                    id="favoritesFilter"
                    checked={showFavoritesOnly}
                    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                    className="af-filter-checkbox"
                  />
                  <label htmlFor="favoritesFilter" className="af-filter-label">Mostrar solo Favoritos</label>
                </div>
              </div>
            </div>

            {loadingForms ? (
              <p className="af-loading-message">Cargando formularios...</p>
            ) : errorForms ? (
              <p className="af-error-message">Error: {errorForms}</p>
            ) : filteredForms.length > 0 ? (
              <div className="af-forms-grid">
                {filteredForms.map(form => (
                  <div key={form.id_formulario} className="af-form-card">
                    <div className="af-form-card-header">
                      <h4 className="af-form-card-title">{form.nombre_formulario}</h4>
                      <div className="af-card-header-actions">
                        <button
                          className={`af-favorite-btn ${favoriteForms.has(String(form.id_formulario)) ? 'favorited' : ''}`}
                          onClick={() => toggleFavorite(form.id_formulario, !favoriteForms.has(String(form.id_formulario)))}
                          disabled={!isLoggedIn} 
                          title={favoriteForms.has(String(form.id_formulario)) ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}
                        >
                          <i className={`fas fa-star ${favoriteForms.has(String(form.id_formulario)) ? 'af-favorited-icon' : ''}`}></i>
                        </button>
                      </div>
                    </div>
                    <p className="af-form-card-description">{form.descripcion || 'Sin descripción.'}</p>
                    <div className="af-form-card-details">
                      <p><strong>Frecuencia:</strong> {form.max_submissions_per_period} cada {form.submission_period_days} día(s)</p>
                      <p><strong>Empresa:</strong> {allCompanies.find(c => c.id_empresa === form.id_empresa)?.nombre_empresa || 'N/A'}</p>
                      {form.espacios_nombres && form.espacios_nombres.length > 0 && (
                        <p><strong>Espacios:</strong> {form.espacios_nombres.join(', ')}</p>
                      )}
                      {form.sub_espacios_nombres && form.sub_espacios_nombres.length > 0 && (
                        <p><strong>Sub-Espacios:</strong> {form.sub_espacios_nombres.join(', ')}</p>
                      )}
                      {form.objetos_nombres && form.objetos_nombres.length > 0 && (
                        <p><strong>Objetos:</strong> {form.objetos_nombres.join(', ')}</p>
                      )}
                    </div>
                    <div className="af-form-card-actions">
                      <button className="af-btn-answer-form" onClick={() => navigate(`/answer-form/${form.id_formulario}`)}>
                        <i className="fas fa-file-signature"></i> Responder Formulario
                      </button>
                    </div>

                    {/* Sección de Automatización */}
                    {(userRole === 'owner' || userRole === 'admin_empresa') && (
                        <div className="af-automation-section">
                            {form.automatizacion_activa ? (
                                <>
                                    <div className="af-automation-status-display">
                                        <button
                                            className={`af-automation-status-btn ${getAutomationStatusClass(form, manualSubmissionsCounts[form.id_formulario] || 0, userSubmissionsInPeriodCounts[form.id_formulario] || 0, scheduledAutomationTimes[form.id_formulario], lastAutomationRunDates[form.id_formulario])}`}
                                            title={getAutomationHoverMessage(form)}
                                        >
                                            <i className="fas fa-robot"></i>
                                        </button>
                                        {/* ELIMINADO: span.af-automation-status-text */}
                                    </div>
                                    <div className="af-automation-schedule-control">
                                        <input
                                            type="time"
                                            className="af-automation-time-input"
                                            value={scheduledAutomationTimes[form.id_formulario] || '15:00'}
                                            onChange={(e) => setScheduledAutomationTimes(prev => ({ ...prev, [form.id_formulario]: e.target.value }))}
                                        />
                                        <button
                                            className="af-btn af-btn-set-schedule"
                                            onClick={() => handleSetAutomationTime(form.id_formulario, scheduledAutomationTimes[form.id_formulario] || '15:00')}
                                            title="Establecer hora de automatización"
                                        >
                                            <i className="fas fa-clock"></i>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <span className="af-automation-inactive-label" title="Automatización inactiva para este formulario.">
                                    <i className="fas fa-robot"></i> Automatización Inactiva
                                </span>
                            )}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="af-no-forms-message">No hay formularios disponibles que coincidan con los filtros.</p>
            )}
          </section>
        </div>
    </>
  );
};

export default AnswerForms;