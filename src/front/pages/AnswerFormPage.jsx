import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

// Estilos
import "../styles/answer-form-page.css";

// Importa los componentes dedicados
import { ResourceSelectionQuestion } from '../components/ResourceSelectionQuestion';
import { DrawingQuestion } from '../components/DrawingQuestion';

export const AnswerFormPage = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { store, dispatch } = useGlobalReducer();

  const currentUser = store.user;
  const isLoggedIn = store.isLoggedIn;
  const allTiposRespuesta = store.tiposRespuesta;
  const storeEspacios = store.espacios;
  const storeSubEspacios = store.subEspacios;
  const storeObjetos = store.objetos;

  const [formDetails, setFormDetails] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [userSubmissionsInPeriod, setUserSubmissionsInPeriod] = useState(0);
  const [submissionLimitMessage, setSubmissionLimitMessage] = useState('');

  const canvasRefs = useRef({});
  const drawingContexts = useRef({});
  const isDrawingMap = useRef({});
  const latestAnswers = useRef(answers);
  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  // --- OPTIMIZATION: Create maps for quick resource lookups ---
  const espaciosMap = useMemo(() => {
    if (!Array.isArray(storeEspacios)) return {};
    return storeEspacios.reduce((acc, espacio) => {
      acc[espacio.id_espacio] = espacio;
      return acc;
    }, {});
  }, [storeEspacios]);

  const subEspaciosMap = useMemo(() => {
    if (!Array.isArray(storeSubEspacios)) return {};
    return storeSubEspacios.reduce((acc, subEspacio) => {
      acc[subEspacio.id_subespacio] = subEspacio;
      return acc;
    }, {});
  }, [storeSubEspacios]);

  const objetosMap = useMemo(() => {
    if (!Array.isArray(storeObjetos)) return {};
    return storeObjetos.reduce((acc, objeto) => {
      acc[objeto.id_objeto] = objeto;
      return acc;
    }, {});
  }, [storeObjetos]);
  // --- END OPTIMIZATION ---


  // --- MAIN EFFECT TO LOAD FORM DETAILS AND QUESTIONS ---
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tiposRespuestaRes, espaciosRes, subEspaciosRes, objetosRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tipos-respuesta`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const tiposRespuestaData = await tiposRespuestaRes.json();
        if (tiposRespuestaRes.ok && tiposRespuestaData.tipos_respuesta) {
            dispatch({ type: 'SET_TIPOS_RESPUESTA', payload: tiposRespuestaData.tipos_respuesta });
        }

        const espaciosData = await espaciosRes.json();
        if (espaciosRes.ok && espaciosData.espacios) {
            dispatch({ type: 'SET_ESPACIOS', payload: espaciosData.espacios });
            console.log("[DEPURACIÓN] Datos de Espacios cargados:", espaciosData.espacios);
        }

        const subEspaciosData = await subEspaciosRes.json();
        if (subEspaciosRes.ok && subEspaciosData.sub_espacios) {
            dispatch({ type: 'SET_SUBESPACIOS', payload: subEspaciosData.sub_espacios });
            console.log("[DEPURACIÓN] Datos de Sub-Espacios cargados:", subEspaciosData.sub_espacios);
        }

        const objetosData = await objetosRes.json();
        if (objetosRes.ok && objetosData.objetos) {
            dispatch({ type: 'SET_OBJETOS', payload: objetosData.objetos });
            console.log("[DEPURACIÓN] Datos de Objetos cargados:", objetosData.objetos);
        }

        const formDetailsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const formDetailsData = await formDetailsResponse.json();

        if (!formDetailsResponse.ok || !formDetailsData.formulario) {
          setError(formDetailsData.error || 'Error loading form details.');
          setFormDetails(null);
          setLoading(false);
          return;
        }

        const isTemplate = formDetailsData.formulario.es_plantilla;
        let questionsUrl = `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/preguntas`;
        
        if (isTemplate) {
          questionsUrl = `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/preguntas/plantilla`;
        }

        const questionsResponse = await fetch(questionsUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const questionsData = await questionsResponse.json();

        if (questionsResponse.ok && questionsData.preguntas) {
          const formularioConPreguntas = {
            ...formDetailsData.formulario,
            preguntas: questionsData.preguntas
          };
          setFormDetails(formularioConPreguntas);
          
          const initialAnswers = {};
          if (Array.isArray(questionsData.preguntas) && Array.isArray(tiposRespuestaData.tipos_respuesta)) {
            questionsData.preguntas.forEach(q => {
              const tipoRespuesta = tiposRespuestaData.tipos_respuesta.find(t => t.id_tipo_respuesta === q.tipo_respuesta_id);
              const tipoNombre = tipoRespuesta ? tipoRespuesta.nombre_tipo : null;
              switch (tipoNombre) {
                case 'texto': initialAnswers[q.id_pregunta] = ''; break;
                case 'booleano': initialAnswers[q.id_pregunta] = false; break;
                case 'numerico': initialAnswers[q.id_pregunta] = ''; break;
                case 'seleccion_unica': initialAnswers[q.id_pregunta] = ''; break;
                case 'seleccion_multiple':
                case 'seleccion_recursos': initialAnswers[q.id_pregunta] = []; break;
                case 'dibujo': initialAnswers[q.id_pregunta] = ''; break;
                default: initialAnswers[q.id_pregunta] = '';
              }
            });
          }
          setAnswers(initialAnswers);
        } else {
          setError(questionsData.error || 'Error loading form questions.');
          setFormDetails(null);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Connection error while loading necessary data.');
      } finally {
        setLoading(false);
      }
    };
    
    if (formId && currentUser) {
      fetchData();
    }
  }, [formId, isLoggedIn, currentUser, navigate, dispatch]);

  useEffect(() => {
    const fetchUserSubmissionCount = async () => {
      if (formDetails && currentUser) {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formDetails.id_formulario}/manual_submissions_count`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) {
            setUserSubmissionsInPeriod(data.count);
            if (formDetails.max_submissions_per_period > 0 && data.count >= formDetails.max_submissions_per_period) {
              setSubmissionLimitMessage(
                `You have already reached the limit of ${formDetails.max_submissions_per_period} submission(s) for this form in the last ${formDetails.submission_period_days} day(s).`
              );
            } else {
              setSubmissionLimitMessage('');
            }
          } else {
            console.error('Error getting user submission count:', data.error);
            setSubmissionLimitMessage(`Error verifying submission limit: ${data.error}`);
          }
        } catch (err) {
          console.error('Connection error getting user submission count:', err);
          setSubmissionLimitMessage('Connection error verifying submission limit.');
        }
      }
    };

    fetchUserSubmissionCount();
  }, [formDetails, currentUser]);

  const handleAnswerChange = useCallback((questionId, value, type) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (type === 'seleccion_multiple' || type === 'seleccion_recursos') {
        const currentValues = newAnswers[questionId] || [];
        const parsedValue = (type === 'seleccion_recursos') ? parseInt(value) : value;
        if (currentValues.includes(parsedValue)) {
          newAnswers[questionId] = currentValues.filter(item => item !== parsedValue);
        } else {
          newAnswers[questionId] = [...currentValues, parsedValue];
        }
      } else if (type === 'booleano') {
        newAnswers[questionId] = value === 'true';
      } else if (type === 'numerico') {
        newAnswers[questionId] = value;
      } else if (type === 'dibujo') {
        newAnswers[questionId] = value;
      } else {
        newAnswers[questionId] = value;
      }
      return newAnswers;
    });
  }, []);

  const handleSelectAllResources = useCallback((questionId, allResourceIds, isChecked) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (isChecked) {
        newAnswers[questionId] = [...allResourceIds];
      } else {
        newAnswers[questionId] = [];
      }
      return newAnswers;
    });
  }, []);

  const getTipoRespuestaNombre = useCallback((tipoId) => {
    if (!Array.isArray(allTiposRespuesta)) {
      return null;
    }
    return allTiposRespuesta.find(t => t.id_tipo_respuesta === tipoId)?.nombre_tipo;
  }, [allTiposRespuesta]);

  const getAvailableResourcesForQuestion = useCallback((question) => {
    const tipoRespuestaNombre = getTipoRespuestaNombre(question.tipo_respuesta_id);
    if (tipoRespuestaNombre !== 'seleccion_recursos') {
      return [];
    }
    
    const { recurso_asociado, opciones_respuesta_json } = question;
    const userCompanyId = currentUser?.id_empresa;
    
    if (!userCompanyId) {
      console.warn('ID de empresa del usuario no disponible. No se pueden cargar recursos.');
      return [];
    }
    
    let recursosFiltrados = [];
    
    if (recurso_asociado) {
      console.log(`[DEPURACIÓN] Procesando pregunta de plantilla para: ${recurso_asociado}`);
      switch (recurso_asociado) {
        case 'espacio':
          recursosFiltrados = (storeEspacios || [])
            .filter(e => e.id_empresa === userCompanyId)
            .map(r => ({ id: r.id_espacio, name: r.nombre_espacio, type: 'Espacio' }));
          break;
        case 'subespacio':
          recursosFiltrados = (storeSubEspacios || [])
            .filter(s => {
              const espacioPadre = espaciosMap[s.id_espacio];
              return espacioPadre && espacioPadre.id_empresa === userCompanyId;
            })
            .map(r => ({ id: r.id_subespacio, name: r.nombre_subespacio, type: 'Sub-Espacio' }));
          break;
        case 'objeto':
          recursosFiltrados = (storeObjetos || [])
            .filter(o => {
              const subespacioPadre = subEspaciosMap[o.id_subespacio];
              const espacioPadre = subespacioPadre ? espaciosMap[subespacioPadre.id_espacio] : null;
              return espacioPadre && espacioPadre.id_empresa === userCompanyId;
            })
            .map(r => ({ id: r.id_objeto, name: r.nombre_objeto, type: 'Objeto' }));
          break;
        default:
          recursosFiltrados = [];
      }
    }
    else if (opciones_respuesta_json) {
      console.log(`[DEPURACIÓN] Procesando pregunta con opciones específicas: ${JSON.stringify(opciones_respuesta_json)}`);
      const { espacios, subespacios, objetos } = opciones_respuesta_json;
      
      if (espacios && Array.isArray(espacios)) {
        const recursosDeEmpresa = (storeEspacios || []).filter(r => r.id_empresa === userCompanyId);
        recursosFiltrados = [...recursosFiltrados, ...recursosDeEmpresa.filter(r => espacios.includes(r.id_espacio)).map(r => ({ id: r.id_espacio, name: r.nombre_espacio, type: 'Espacio' }))];
      }
      if (subespacios && Array.isArray(subespacios)) {
        const recursosDeEmpresa = (storeSubEspacios || []).filter(s => {
          const espacioPadre = espaciosMap[s.id_espacio];
          return espacioPadre && espacioPadre.id_empresa === userCompanyId;
        });
        recursosFiltrados = [...recursosFiltrados, ...recursosDeEmpresa.filter(r => subespacios.includes(r.id_subespacio)).map(r => ({ id: r.id_subespacio, name: r.nombre_subespacio, type: 'Sub-Espacio' }))];
      }
      if (objetos && Array.isArray(objetos)) {
        const recursosDeEmpresa = (storeObjetos || []).filter(o => {
          const subespacioPadre = subEspaciosMap[o.id_subespacio];
          const espacioPadre = subespacioPadre ? espaciosMap[subespacioPadre.id_espacio] : null;
          return espacioPadre && espacioPadre.id_empresa === userCompanyId;
        });
        recursosFiltrados = [...recursosFiltrados, ...recursosDeEmpresa.filter(r => objetos.includes(r.id_objeto)).map(r => ({ id: r.id_objeto, name: r.nombre_objeto, type: 'Objeto' }))];
      }
    }
    
    console.log("[DEPURACIÓN] Recursos finales encontrados:", recursosFiltrados);
    return recursosFiltrados;
  }, [getTipoRespuestaNombre, currentUser, storeEspacios, storeSubEspacios, storeObjetos, espaciosMap, subEspaciosMap]);

  const getPointerPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }, []);

  const startDrawing = useCallback((e, questionId) => {
    e.preventDefault();
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    isDrawingMap.current[questionId] = true;
    const canvas = canvasRefs.current[questionId];
    const { x, y } = getPointerPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getPointerPos]);

  const draw = useCallback((e, questionId) => {
    if (!isDrawingMap.current[questionId]) return;
    e.preventDefault();
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    const canvas = canvasRefs.current[questionId];
    const { x, y } = getPointerPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [getPointerPos]);

  const stopDrawing = useCallback((questionId) => {
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    isDrawingMap.current[questionId] = false;
    ctx.closePath();
    const canvas = canvasRefs.current[questionId];
    const signatureData = canvas.toDataURL('image/png');
    handleAnswerChange(questionId, signatureData, 'dibujo');
  }, [handleAnswerChange]);

  const clearCanvas = useCallback((questionId) => {
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    const canvas = canvasRefs.current[questionId];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handleAnswerChange(questionId, '', 'dibujo');
  }, [handleAnswerChange]);
  
  useEffect(() => {
    if (!formDetails || !formDetails.preguntas || !Array.isArray(allTiposRespuesta) || allTiposRespuesta.length === 0) return;
    const drawingQuestions = formDetails.preguntas.filter(q => getTipoRespuestaNombre(q.tipo_respuesta_id) === 'dibujo');
    const cleanupFunctions = [];

    drawingQuestions.forEach(question => {
      const canvas = canvasRefs.current[question.id_pregunta];
      if (!canvas) return;
      const context = canvas.getContext('2d');
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.strokeStyle = '#000000';
      drawingContexts.current[question.id_pregunta] = context;

      const initialSignature = latestAnswers.current[question.id_pregunta];
      if (initialSignature && initialSignature !== '') {
        const img = new Image();
        img.onload = () => {
          const currentCanvasData = canvas.toDataURL('image/png');
          if (currentCanvasData !== initialSignature) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
        };
        img.src = initialSignature;
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      const start = (e) => startDrawing(e, question.id_pregunta);
      const move = (e) => draw(e, question.id_pregunta);
      const end = () => stopDrawing(question.id_pregunta);

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseup', end);
      canvas.addEventListener('mouseout', end);

      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      canvas.addEventListener('touchcancel', end);

      cleanupFunctions.push(() => {
        canvas.removeEventListener('mousedown', start);
        canvas.removeEventListener('mousemove', move);
        canvas.removeEventListener('mouseup', end);
        canvas.removeEventListener('mouseout', end);
        canvas.removeEventListener('touchstart', start);
        canvas.removeEventListener('touchmove', move);
        canvas.removeEventListener('touchend', end);
        canvas.removeEventListener('touchcancel', end);
      });
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [
    formDetails,
    allTiposRespuesta,
    getPointerPos,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas
  ]);

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmissionLimitMessage('');

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      setSubmitting(false);
      return;
    }

    if (!formDetails || !Array.isArray(formDetails.preguntas)) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Cannot submit answers: Form or questions not loaded.' } });
      setSubmitting(false);
      return;
    }

    const missingAnswers = formDetails.preguntas.filter(q => {
      const tipoNombre = getTipoRespuestaNombre(q.tipo_respuesta_id);
      const answer = answers[q.id_pregunta];
      if (tipoNombre === 'texto' || tipoNombre === 'dibujo') {
        return !answer || String(answer).trim() === '';
      } else if (tipoNombre === 'numerico') {
        return !answer || isNaN(parseFloat(answer));
      } else if (tipoNombre === 'booleano') {
        return answer === null || answer === undefined;
      } else if (tipoNombre === 'seleccion_unica' || tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') {
        return !answer || answer.length === 0;
      }
      return false;
    });

    if (missingAnswers.length > 0) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Please answer all questions.' } });
      setSubmitting(false);
      return;
    }

    const payloadRespuestas = formDetails.preguntas.map(q => {
      const tipoNombre = getTipoRespuestaNombre(q.tipo_respuesta_id);
      let valorRespuesta = answers[q.id_pregunta];

      if (tipoNombre === 'numerico') {
        valorRespuesta = parseFloat(valorRespuesta);
        if (isNaN(valorRespuesta)) valorRespuesta = null;
      } else if (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') {
        valorRespuesta = JSON.stringify(valorRespuesta || []);
      } else {
        valorRespuesta = String(valorRespuesta);
      }

      return {
        pregunta_id: q.id_pregunta,
        valor_texto: (tipoNombre === 'texto' || tipoNombre === 'dibujo' || tipoNombre === 'seleccion_unica') ? valorRespuesta : null,
        valor_booleano: (tipoNombre === 'booleano') ? valorRespuesta : null,
        valor_numerico: (tipoNombre === 'numerico') ? valorRespuesta : null,
        valores_multiples_json: (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') ? valorRespuesta : null,
      };
    });

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/envios-formulario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id_formulario: parseInt(formId),
          respuestas: payloadRespuestas,
          id_usuario: currentUser.id_usuario,
          espacios_cubiertos_ids: formDetails.preguntas
              .filter(q => getTipoRespuestaNombre(q.tipo_respuesta_id) === 'seleccion_recursos' && q.recurso_asociado === 'espacio')
              .flatMap(q => answers[q.id_pregunta] || []),
          subespacios_cubiertos_ids: formDetails.preguntas
              .filter(q => getTipoRespuestaNombre(q.tipo_respuesta_id) === 'seleccion_recursos' && q.recurso_asociado === 'subespacio')
              .flatMap(q => answers[q.id_pregunta] || []),
          objetos_cubiertos_ids: formDetails.preguntas
              .filter(q => getTipoRespuestaNombre(q.tipo_respuesta_id) === 'seleccion_recursos' && q.recurso_asociado === 'objeto')
              .flatMap(q => answers[q.id_pregunta] || []),
        })
      });

      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Form submitted successfully.' } });
        setUserSubmissionsInPeriod(prevCount => prevCount + 1);
        if (formDetails.max_submissions_per_period > 0 && (userSubmissionsInPeriod + 1) >= formDetails.max_submissions_per_period) {
          setSubmissionLimitMessage(`You have already reached the limit of ${formDetails.max_submissions_per_period} submission(s) for this form in the last ${formDetails.submission_period_days} day(s).`);
        }
        navigate('/Answerforms');
      } else {
        setError(data.error || 'Error submitting form.');
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error submitting form: ${data.error}` } });
        if (data.error && data.error.includes("limit of") && data.error.includes("submissions for this form")) {
          setSubmissionLimitMessage(data.error);
        }
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Connection error submitting form.');
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Connection error.' } });
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || (formDetails && formDetails.max_submissions_per_period > 0 && userSubmissionsInPeriod >= formDetails.max_submissions_per_period);

  if (loading) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--primary-dark)' }}>
        Loading form...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message-container" style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: 'var(--danger-color)' }}>
        <p>Error loading form: {error}</p>
        <button className="btn-secondary" onClick={() => navigate('/answer-forms')}>Back to Forms</button>
      </div>
    );
  }

  if (!formDetails) {
    return (
      <div className="no-form-found" style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: 'var(--text-color-medium)' }}>
        <p>Form not found or unavailable.</p>
        <button className="btn-secondary" onClick={() => navigate('/answer-forms')}>Back to Forms</button>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Answer Form: {formDetails?.nombre_formulario || 'Loading...'}</h1>
        <div className="header-right">
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="form-answer-container">
        <div className="form-details-card">
          <h2>{formDetails?.nombre_formulario || 'Loading...'}</h2>
          <p className="form-description">{formDetails?.descripcion || 'Loading description...'}</p>
          {formDetails.max_submissions_per_period > 0 && (
            <p className="form-frequency">
              Submission Limit: {formDetails.max_submissions_per_period} every {formDetails.submission_period_days} day(s).
              You have submitted {userSubmissionsInPeriod} time(s) in this period.
            </p>
          )}
          {submissionLimitMessage && (
            <p className="submission-limit-message error-message">{submissionLimitMessage}</p>
          )}
        </div>

        <form onSubmit={handleSubmitForm} className="question-answer-section">
          {formDetails?.preguntas && Array.isArray(formDetails.preguntas) && formDetails.preguntas.length > 0 ? (
            formDetails.preguntas
              .sort((a, b) => a.orden - b.orden)
              .map(question => {
                const tipoNombre = getTipoRespuestaNombre(question.tipo_respuesta_id);
                const currentAnswer = answers[question.id_pregunta];

                return (
                  <div key={question.id_pregunta} className="question-card">
                    <p className="question-text">{question.orden}. {question.texto_pregunta}</p>
                    <div className="answer-input-area">
                      {tipoNombre === 'texto' && (
                        <textarea
                          value={currentAnswer || ''}
                          onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                          placeholder="Write your answer here..."
                          className="text-input"
                        />
                      )}
                      {tipoNombre === 'booleano' && (
                        <div className="radio-group">
                          <label className="radio-item">
                            <input type="radio" name={`question-${question.id_pregunta}`} value="true" checked={currentAnswer === true} onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)} /> Yes
                          </label>
                          <label className="radio-item">
                            <input type="radio" name={`question-${question.id_pregunta}`} value="false" checked={currentAnswer === false} onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)} /> No
                          </label>
                        </div>
                      )}
                      {tipoNombre === 'numerico' && (
                        <input type="number" value={currentAnswer || ''} onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)} placeholder="Enter a number" className="number-input" />
                      )}
                      {(tipoNombre === 'seleccion_unica' || tipoNombre === 'seleccion_multiple') && (
                        <div className="options-group">
                          {question.opciones_respuesta_json && question.opciones_respuesta_json.length > 0 ? (
                            question.opciones_respuesta_json.map((option) => (
                              <label key={option} className="option-item">
                                <input type={tipoNombre === 'seleccion_unica' ? 'radio' : 'checkbox'} name={`question-${question.id_pregunta}`} value={option} checked={tipoNombre === 'seleccion_unica' ? currentAnswer === option : (currentAnswer || []).includes(option)} onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)} />
                                {option}
                              </label>
                            ))
                          ) : (
                            <p className="no-options-message">No options defined for this question.</p>
                          )}
                        </div>
                      )}
                      {tipoNombre === 'seleccion_recursos' && (
                        <ResourceSelectionQuestion 
                          question={question}
                          resourcesToDisplay={getAvailableResourcesForQuestion(question)}
                          currentAnswer={currentAnswer}
                          handleAnswerChange={handleAnswerChange}
                          handleSelectAllResources={handleSelectAllResources}
                        />
                      )}
                      {tipoNombre === 'dibujo' && (
                         <DrawingQuestion
                            questionId={question.id_pregunta}
                            currentAnswer={currentAnswer}
                            handleAnswerChange={handleAnswerChange}
                          />
                      )}
                    </div>
                  </div>
                );
              })
          ) : (
            <p className="no-questions-message">No questions defined for this form.</p>
          )}

          <button type="submit" className="submit-form-btn" disabled={isSubmitDisabled}>
            {submitting ? 'Submitting...' : 'Submit Form'}
          </button>
        </form>
      </div>
    </>
  );
};

export default AnswerFormPage;