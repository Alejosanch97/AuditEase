// src/pages/AnswerForms.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

// Estilos
import "../styles/answer-form-page.css"; // Estilos específicos de esta página

export const AnswerFormPage = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { store, dispatch } = useGlobalReducer();

  const currentUser = store.user;
  const isLoggedIn = store.isLoggedIn;
  const allTiposRespuesta = store.tiposRespuesta; // Del store
  // Acceder directamente a los arrays del store para los mapas
  const storeEspacios = store.espacios;
  const storeSubEspacios = store.subEspacios;
  const storeObjetos = store.objetos;


  const [formDetails, setFormDetails] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Estado: Conteo de envíos del usuario para este formulario en el período actual
  const [userSubmissionsInPeriod, setUserSubmissionsInPeriod] = useState(0);
  // Estado: Mensaje de límite de envíos
  const [submissionLimitMessage, setSubmissionLimitMessage] = useState('');


  // --- OPTIMIZACIÓN: Crear mapas para búsquedas rápidas de recursos ---
  const espaciosMap = useMemo(() => {
    return storeEspacios.reduce((acc, espacio) => {
      acc[espacio.id_espacio] = espacio.nombre_espacio;
      return acc;
    }, {});
  }, [storeEspacios]); // Dependencia: storeEspacios

  const subEspaciosMap = useMemo(() => {
    return storeSubEspacios.reduce((acc, subEspacio) => {
      acc[subEspacio.id_subespacio] = subEspacio.nombre_subespacio;
      return acc;
    }, {});
  }, [storeSubEspacios]); // Dependencia: storeSubEspacios

  const objetosMap = useMemo(() => {
    return storeObjetos.reduce((acc, objeto) => {
      acc[objeto.id_objeto] = objeto.nombre_objeto;
      return acc;
    }, {});
  }, [storeObjetos]); // Dependencia: storeObjetos
  // --- FIN OPTIMIZACIÓN ---


  // Efecto para cargar los detalles del formulario y los recursos globales
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
        // Siempre obtener los detalles del formulario y sus preguntas
        const formResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const formData = await formResponse.json();

        if (formResponse.ok && formData.formulario) {
            setFormDetails(formData.formulario);
            const initialAnswers = {};
            if (Array.isArray(formData.formulario.preguntas)) {
              formData.formulario.preguntas.forEach(q => {
                const tipoNombre = allTiposRespuesta.find(t => t.id_tipo_respuesta === q.tipo_respuesta_id)?.nombre_tipo;
                switch (tipoNombre) {
                  case 'texto': initialAnswers[q.id_pregunta] = ''; break;
                  case 'booleano': initialAnswers[q.id_pregunta] = false; break;
                  case 'numerico': initialAnswers[q.id_pregunta] = ''; break;
                  case 'seleccion_unica': initialAnswers[q.id_pregunta] = ''; break;
                  case 'seleccion_multiple':
                  case 'seleccion_recursos': initialAnswers[q.id_pregunta] = []; break;
                  case 'firma': initialAnswers[q.id_pregunta] = ''; break;
                  default: initialAnswers[q.id_pregunta] = '';
                }
              });
            } else {
              console.warn(`Formulario ${formId} no tiene una propiedad 'preguntas' que sea un array o está vacía.`);
              setError('Este formulario no tiene preguntas definidas o no se pudieron cargar.');
            }
            setAnswers(initialAnswers);
        } else {
            setError(formData.error || 'Error al cargar el formulario.');
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar formulario: ${formData.error}` } });
            setFormDetails(null);
        }

        // Siempre obtener todos los tipos de respuesta, espacios, sub-espacios y objetos
        // Esto asegura que los mapas (espaciosMap, subEspaciosMap, objetosMap)
        // estén siempre actualizados con los recursos de la empresa del usuario actual.
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
        }

        const subEspaciosData = await subEspaciosRes.json();
        if (subEspaciosRes.ok && subEspaciosData.sub_espacios) {
            dispatch({ type: 'SET_SUBESPACIOS', payload: subEspaciosData.sub_espacios });
        }

        const objetosData = await objetosRes.json();
        if (objetosRes.ok && objetosData.objetos) {
            dispatch({ type: 'SET_OBJETOS', payload: objetosData.objetos });
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error de conexión al cargar los datos necesarios.');
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
      } finally {
        setLoading(false);
      }
    };

    // Asegurarse de que currentUser esté disponible antes de iniciar la carga de datos
    // Esto es importante porque las llamadas a la API dependen del token de autenticación del usuario.
    if (formId && currentUser) {
      fetchData();
    }
  }, [formId, isLoggedIn, currentUser, navigate, dispatch]); // Dependencias del useEffect

  // NUEVO useEffect para obtener el conteo de envíos del usuario en el período
  useEffect(() => {
    const fetchUserSubmissionCount = async () => {
      if (formDetails && currentUser) {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
          // La ruta del backend ya debe manejar el conteo según el período definido en el formulario
          // CORREGIDO: URL para que coincida con la ruta del backend
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formDetails.id_formulario}/user_submissions_in_period_count`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) {
            setUserSubmissionsInPeriod(data.count);
            // Establecer mensaje si el límite ya está alcanzado
            if (formDetails.max_submissions_per_period > 0 && data.count >= formDetails.max_submissions_per_period) {
              setSubmissionLimitMessage(
                `Ya has alcanzado el límite de ${formDetails.max_submissions_per_period} diligencia(s) para este formulario en los últimos ${formDetails.submission_period_days} día(s).`
              );
            } else {
              setSubmissionLimitMessage(''); // Limpiar mensaje si no se ha alcanzado el límite
            }
          } else {
            console.error('Error al obtener el conteo de envíos del usuario:', data.error);
            setSubmissionLimitMessage(`Error al verificar el límite de envíos: ${data.error}`);
          }
        } catch (err) {
          console.error('Error de conexión al obtener el conteo de envíos del usuario:', err);
          setSubmissionLimitMessage('Error de conexión al verificar el límite de envíos.');
        }
      }
    };

    fetchUserSubmissionCount();
  }, [formDetails, currentUser]); // Depende de formDetails y currentUser

  const handleAnswerChange = (questionId, value, type) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (type === 'seleccion_multiple' || type === 'seleccion_recursos') {
        const currentValues = newAnswers[questionId] || [];
        const parsedValue = type === 'seleccion_recursos' ? parseInt(value) : value;

        if (currentValues.includes(parsedValue)) {
          newAnswers[questionId] = currentValues.filter(item => item !== parsedValue);
        } else {
          newAnswers[questionId] = [...currentValues, parsedValue];
        }
      } else if (type === 'booleano') {
        newAnswers[questionId] = value === 'true';
      } else {
        newAnswers[questionId] = value;
      }
      return newAnswers;
    });
  };

  // Función: Manejar la selección/deselección de todos los recursos
  const handleSelectAllResources = (questionId, allResourceIds, isChecked) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (isChecked) {
        newAnswers[questionId] = [...allResourceIds]; // Seleccionar todos
      } else {
        newAnswers[questionId] = []; // Deseleccionar todos
      }
      return newAnswers;
    });
  };

  const getTipoRespuestaNombre = (tipoId) => {
    return allTiposRespuesta.find(t => t.id_tipo_respuesta === tipoId)?.nombre_tipo;
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmissionLimitMessage(''); // Limpiar el mensaje de límite al intentar enviar

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      setSubmitting(false);
      return;
    }

    if (!formDetails || !Array.isArray(formDetails.preguntas)) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No se pueden enviar respuestas: Formulario o preguntas no cargadas.' } });
      setSubmitting(false);
      return;
    }

    // Verificación proactiva antes de enviar al backend
    // Solo aplica el límite si max_submissions_per_period es mayor que 0
    if (formDetails.max_submissions_per_period > 0 && userSubmissionsInPeriod >= formDetails.max_submissions_per_period) {
        setSubmissionLimitMessage(
          `Ya has alcanzado el límite de ${formDetails.max_submissions_per_period} diligencia(s) para este formulario en los últimos ${formDetails.submission_period_days} día(s).`
        );
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: submissionLimitMessage || `Límite de envíos alcanzado (${formDetails.max_submissions_per_period}).` } });
        setSubmitting(false);
        return;
    }


    const missingAnswers = formDetails.preguntas.filter(q => {
      const tipoNombre = getTipoRespuestaNombre(q.tipo_respuesta_id);
      const answer = answers[q.id_pregunta];

      if (tipoNombre === 'texto' || tipoNombre === 'firma') {
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
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Por favor, responde todas las preguntas.' } });
      setSubmitting(false);
      return;
    }

    const payloadRespuestas = formDetails.preguntas.map(q => {
      const tipoNombre = getTipoRespuestaNombre(q.tipo_respuesta_id);
      let valorRespuesta = answers[q.id_pregunta];

      if (tipoNombre === 'numerico') {
        valorRespuesta = parseFloat(valorRespuesta);
        if (isNaN(valorRespuesta)) valorRespuesta = null;
      } else if (tipoNombre === 'booleano') {
        // Ya convertido
      } else if (tipoNombre === 'seleccion_unica') {
        // El valor es el string seleccionado
      } else if (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') {
        valorRespuesta = valorRespuesta || [];
      } else {
        valorRespuesta = String(valorRespuesta);
      }

      return {
        pregunta_id: q.id_pregunta,
        valor_texto: (tipoNombre === 'texto' || tipoNombre === 'firma' || tipoNombre === 'seleccion_unica') ? valorRespuesta : null,
        valor_booleano: (tipoNombre === 'booleano') ? valorRespuesta : null,
        valor_numerico: (tipoNombre === 'numerico') ? valorRespuesta : null,
        valores_multiples_json: (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') ? valorRespuesta : null,
        // firma_base64: ... si tuvieras una forma de capturar la firma como base64
      };
    });

    console.log("DEBUG FRONTEND: Payload de respuestas a enviar:", payloadRespuestas);

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
          espacios_cubiertos_ids: [], // Estos se llenarán en el backend si es necesario
          subespacios_cubiertos_ids: [],
          objetos_cubiertos_ids: [],
        })
      });

      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Formulario respondido exitosamente.' } });
        // Al enviar exitosamente, actualiza el conteo local y el mensaje de límite
        setUserSubmissionsInPeriod(prevCount => prevCount + 1);
        if ((userSubmissionsInPeriod + 1) >= formDetails.max_submissions_per_period) {
            setSubmissionLimitMessage(
              `Ya has alcanzado el límite de ${formDetails.max_submissions_per_period} diligencia(s) para este formulario en los últimos ${formDetails.submission_period_days} día(s).`
            );
        }
        navigate('/Answerforms'); // Redirigir a la lista de formularios después de enviar
      } else {
        setError(data.error || 'Error al enviar el formulario.');
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al enviar formulario: ${data.error}` } });
        // Si el error es por el límite, actualiza el mensaje de límite
        if (data.error && data.error.includes("límite de") && data.error.includes("diligencias para este formulario")) {
            setSubmissionLimitMessage(data.error);
        }
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Error de conexión al enviar el formulario.');
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setSubmitting(false);
    }
  };

  // Determinar si el botón de envío debe estar deshabilitado
  // Se deshabilita si se está enviando O si el límite de llenado es > 0 y se ha alcanzado el límite
  const isSubmitDisabled = submitting || (formDetails && formDetails.max_submissions_per_period > 0 && userSubmissionsInPeriod >= formDetails.max_submissions_per_period);

  if (loading) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--primary-dark)' }}>
        Cargando formulario...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message-container" style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: 'var(--danger-color)' }}>
        <p>Error al cargar el formulario: {error}</p>
        <button className="btn-secondary" onClick={() => navigate('/answer-forms')}>Volver a Formularios</button>
      </div>
    );
  }

  if (!formDetails) {
    return (
      <div className="no-form-found" style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: 'var(--text-color-medium)' }}>
        <p>Formulario no encontrado o no disponible.</p>
        <button className="btn-secondary" onClick={() => navigate('/answer-forms')}>Volver a Formularios</button>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Responder Formulario: {formDetails?.nombre_formulario || 'Cargando...'}</h1>
        <div className="header-right">
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="form-answer-container">
        <div className="form-details-card">
          <h2>{formDetails?.nombre_formulario || 'Cargando...'}</h2>
          <p className="form-description">{formDetails?.descripcion || 'Cargando descripción...'}</p>
          {/* Mostrar la frecuencia máxima de llenado como "máxima" para el usuario */}
          {formDetails.max_submissions_per_period > 0 && (
            <p className="form-frequency">
              Límite de diligencias: {formDetails.max_submissions_per_period} cada {formDetails.submission_period_days} día(s).
              Has diligenciado {userSubmissionsInPeriod} vez(es) en este período.
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

                // Obtener todos los IDs de recursos disponibles para la pregunta actual
                // NO USAR useMemo AQUÍ, YA QUE ESTÁ DENTRO DE UN BUCLE DE RENDERIZADO
                const allResourceIdsForQuestion = (question.tipo_respuesta_nombre === 'seleccion_recursos' && question.opciones_respuesta_json && typeof question.opciones_respuesta_json === 'object')
                  ? [
                      ...(question.opciones_respuesta_json.espacios || []),
                      ...(question.opciones_respuesta_json.subespacios || []),
                      ...(question.opciones_respuesta_json.objetos || [])
                    ]
                  : [];

                return (
                  <div key={question.id_pregunta} className="question-card">
                    <p className="question-text">{question.orden}. {question.texto_pregunta}</p>
                    <div className="answer-input-area">
                      {tipoNombre === 'texto' && (
                        <textarea
                          value={currentAnswer || ''}
                          onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                          placeholder="Escribe tu respuesta aquí..."
                          className="text-input"
                        />
                      )}

                      {tipoNombre === 'booleano' && (
                        <div className="radio-group">
                          <label className="radio-item">
                            <input
                              type="radio"
                              name={`question-${question.id_pregunta}`}
                              value="true"
                              checked={currentAnswer === true}
                              onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                            /> Sí
                          </label>
                          <label className="radio-item">
                            <input
                              type="radio"
                              name={`question-${question.id_pregunta}`}
                              value="false"
                              checked={currentAnswer === false}
                              onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                            /> No
                          </label>
                        </div>
                      )}

                      {tipoNombre === 'numerico' && (
                        <input
                          type="number"
                          value={currentAnswer || ''}
                          onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                          placeholder="Introduce un número"
                          className="number-input"
                        />
                      )}

                      {(tipoNombre === 'seleccion_unica' || tipoNombre === 'seleccion_multiple') && (
                        <div className="options-group">
                          {question.opciones_respuesta_json && question.opciones_respuesta_json.length > 0 ? (
                            question.opciones_respuesta_json.map((option) => (
                              <label key={option} className="option-item">
                                <input
                                  type={tipoNombre === 'seleccion_unica' ? 'radio' : 'checkbox'}
                                  name={`question-${question.id_pregunta}`}
                                  value={option}
                                  checked={tipoNombre === 'seleccion_unica' ? currentAnswer === option : (currentAnswer || []).includes(option)}
                                  onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                                />
                                {option}
                              </label>
                            ))
                          ) : (
                            <p className="no-options-message">No hay opciones definidas para esta pregunta.</p>
                          )}
                        </div>
                      )}

                      {tipoNombre === 'firma' && (
                        <div className="signature-area">
                          <input
                            type="text"
                            value={currentAnswer || ''}
                            onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                            placeholder="Escribe tu nombre para firmar o 'FIRMADO'"
                            className="text-input"
                          />
                          <small>En un entorno real, aquí iría un componente de captura de firma.</small>
                        </div>
                      )}

                      {tipoNombre === 'seleccion_recursos' && (
                        <div className="options-group resource-selection-group">
                          {/* El bloque de opciones_respuesta_json debe existir y ser un objeto para mostrar el select-all y las categorías */}
                          {question.opciones_respuesta_json && typeof question.opciones_respuesta_json === 'object' && (
                            <>
                              {/* Checkbox "Seleccionar Todo" */}
                              {allResourceIdsForQuestion.length > 0 && (
                                <div className="resource-select-all-container"> {/* Nuevo contenedor */}
                                  <label className="select-all-item">
                                    <input
                                      type="checkbox"
                                      // Marcar si todas las opciones disponibles están en las respuestas actuales
                                      checked={
                                        allResourceIdsForQuestion.length > 0 &&
                                        allResourceIdsForQuestion.every(id => (currentAnswer || []).includes(id))
                                      }
                                      onChange={(e) => {
                                        handleSelectAllResources(question.id_pregunta, allResourceIdsForQuestion, e.target.checked);
                                      }}
                                    />
                                    Seleccionar Todo
                                  </label>
                                </div>
                              )}
                              {/* Eliminamos el hr aquí */}
                            </>
                          )}

                          {/* Renderizar Espacios */}
                          {question.opciones_respuesta_json?.espacios?.length > 0 && (
                            <div className="resource-category resource-category-espacios"> {/* Nueva clase específica */}
                              <h4 className="resource-category-title">Espacios</h4> {/* Nueva clase para el h4 */}
                              <div className="resource-options-list"> {/* Nuevo contenedor para la lista de opciones */}
                                {question.opciones_respuesta_json.espacios.map((resourceId) => {
                                  const resourceName = espaciosMap[resourceId] || `Espacio ${resourceId}`;
                                  return (
                                    <label key={`espacio-${resourceId}`} className="option-item resource-option-item"> {/* Nueva clase específica */}
                                      <input
                                        type="checkbox"
                                        value={resourceId}
                                        checked={(currentAnswer || []).includes(resourceId)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, parseInt(e.target.value), tipoNombre)}
                                      />
                                      {resourceName}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Renderizar Sub-Espacios */}
                          {question.opciones_respuesta_json?.subespacios?.length > 0 && (
                            <div className="resource-category resource-category-subespacios"> {/* Nueva clase específica */}
                              <h4 className="resource-category-title">Sub-Espacios</h4> {/* Nueva clase para el h4 */}
                              <div className="resource-options-list"> {/* Nuevo contenedor para la lista de opciones */}
                                {question.opciones_respuesta_json.subespacios.map((resourceId) => {
                                  const resourceName = subEspaciosMap[resourceId] || `Sub-Espacio ${resourceId}`;
                                  return (
                                    <label key={`subespacio-${resourceId}`} className="option-item resource-option-item"> {/* Nueva clase específica */}
                                      <input
                                        type="checkbox"
                                        value={resourceId}
                                        checked={(currentAnswer || []).includes(resourceId)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, parseInt(e.target.value), tipoNombre)}
                                      />
                                      {resourceName}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Renderizar Objetos */}
                          {question.opciones_respuesta_json?.objetos?.length > 0 && (
                            <div className="resource-category resource-category-objetos"> {/* Nueva clase específica */}
                              <h4 className="resource-category-title">Objetos</h4> {/* Nueva clase para el h4 */}
                              <div className="resource-options-list"> {/* Nuevo contenedor para la lista de opciones */}
                                {question.opciones_respuesta_json.objetos.map((resourceId) => {
                                  const resourceName = objetosMap[resourceId] || `Objeto ${resourceId}`;
                                  return (
                                    <label key={`objeto-${resourceId}`} className="option-item resource-option-item"> {/* Nueva clase específica */}
                                      <input
                                        type="checkbox"
                                        value={resourceId}
                                        checked={(currentAnswer || []).includes(resourceId)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, parseInt(e.target.value), tipoNombre)}
                                      />
                                      {resourceName}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Mensaje si no hay recursos disponibles */}
                          {allResourceIdsForQuestion.length === 0 && (
                            <p className="no-options-message">No hay recursos disponibles para esta pregunta en tu empresa.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          ) : (
            <p className="no-questions-message">Este formulario no tiene preguntas definidas.</p>
          )}

          <div className="form-submit-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitDisabled}>
              {submitting ? 'Enviando...' : 'Enviar Formulario'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/Answerforms')} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AnswerFormPage;