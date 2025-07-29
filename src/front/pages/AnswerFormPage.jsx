import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const allTiposRespuesta = store.tiposRespuesta; // From the store
  // Access arrays directly from the store for maps
  const storeEspacios = store.espacios;
  const storeSubEspacios = store.subEspacios;
  const storeObjetos = store.objetos;


  const [formDetails, setFormDetails] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // State: User submission count for this form in the current period
  const [userSubmissionsInPeriod, setUserSubmissionsInPeriod] = useState(0);
  // State: Submission limit message
  const [submissionLimitMessage, setSubmissionLimitMessage] = useState('');

  // REFERENCES FOR THE SIGNATURE CANVAS
  const canvasRefs = useRef({}); // Stores references to canvas elements by questionId
  const drawingContexts = useRef({}); // Stores the 2D contexts of each canvas
  const isDrawingMap = useRef({}); // Tracks if drawing is active on each canvas

  // NEW: Ref to hold the latest answers state without being a useEffect dependency
  const latestAnswers = useRef(answers);
  useEffect(() => {
      latestAnswers.current = answers;
  }, [answers]); // This effect only updates the ref when answers change


  // --- OPTIMIZATION: Create maps for quick resource lookups ---
  // Estos mapas ahora contendrán los recursos de la empresa del usuario actual,
  // asumiendo que las llamadas a la API de backend para /api/espacios, etc.,
  // ya devuelven datos filtrados por la empresa del usuario logeado.
  const espaciosMap = useMemo(() => {
    return storeEspacios.reduce((acc, espacio) => {
      acc[espacio.id_espacio] = espacio;
      return acc;
    }, {});
  }, [storeEspacios]);

  const subEspaciosMap = useMemo(() => {
    return storeSubEspacios.reduce((acc, subEspacio) => {
      acc[subEspacio.id_subespacio] = subEspacio;
      return acc;
    }, {});
  }, [storeSubEspacios]);

  const objetosMap = useMemo(() => {
    return storeObjetos.reduce((acc, objeto) => {
      acc[objeto.id_objeto] = objeto;
      return acc;
    }, {});
  }, [storeObjetos]);
  // --- END OPTIMIZATION ---


  // Effect to load form details and global resources
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
        // Always get form details and its questions
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
                  case 'dibujo': initialAnswers[q.id_pregunta] = ''; break; // 'dibujo' type for canvas
                  default: initialAnswers[q.id_pregunta] = '';
                }
              });
            } else {
              console.warn(`Form ${formId} does not have a 'preguntas' property that is an array or is empty.`);
              setError('This form has no questions defined or could not be loaded.');
            }
            setAnswers(initialAnswers);
        } else {
            setError(formData.error || 'Error loading form.');
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error loading form: ${formData.error}` } });
            setFormDetails(null);
        }

        // Always get all response types, spaces, sub-spaces, and objects
        // These API calls should ideally return resources scoped to the current user's company.
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
        } else {
            console.error('Error al cargar espacios:', espaciosData.error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar espacios.' } });
        }

        const subEspaciosData = await subEspaciosRes.json();
        if (subEspaciosRes.ok && subEspaciosData.sub_espacios) {
            dispatch({ type: 'SET_SUBESPACIOS', payload: subEspaciosData.sub_espacios });
        } else {
            console.error('Error al cargar sub-espacios:', subEspaciosData.error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar sub-espacios.' } });
        }

        const objetosData = await objetosRes.json();
        if (objetosRes.ok && objetosData.objetos) {
            dispatch({ type: 'SET_OBJETOS', payload: objetosData.objetos });
        } else {
            console.error('Error al cargar objetos:', objetosData.error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar objetos.' } });
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Connection error while loading necessary data.');
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Connection error.' } });
      } finally {
        setLoading(false);
      }
    };

    // Ensure currentUser is available before starting data loading
    // This is important because API calls depend on the user's authentication token.
    if (formId && currentUser) {
      fetchData();
    }
  }, [formId, isLoggedIn, currentUser, navigate, dispatch]);


  // NEW useEffect to get user submission count in the period
  useEffect(() => {
    const fetchUserSubmissionCount = async () => {
      if (formDetails && currentUser) {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
          // The backend route should already handle counting based on the form's defined period
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formDetails.id_formulario}/user_submissions_in_period_count`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) {
            setUserSubmissionsInPeriod(data.count);
            // Set message if limit is already reached
            if (formDetails.max_submissions_per_period > 0 && data.count >= formDetails.max_submissions_per_period) {
              setSubmissionLimitMessage(
                `You have already reached the limit of ${formDetails.max_submissions_per_period} submission(s) for this form in the last ${formDetails.submission_period_days} day(s).`
              );
            } else {
              setSubmissionLimitMessage(''); // Clear message if limit is not reached
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
  }, [formDetails, currentUser]); // Depends on formDetails and currentUser

  const handleAnswerChange = useCallback((questionId, value, type) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (type === 'seleccion_multiple' || type === 'seleccion_recursos') {
        const currentValues = newAnswers[questionId] || [];
        // Ensure value is a number (ID) for seleccion_recursos
        const parsedValue = (type === 'seleccion_recursos') ? parseInt(value) : value;

        if (currentValues.includes(parsedValue)) {
          newAnswers[questionId] = currentValues.filter(item => item !== parsedValue);
        } else {
          newAnswers[questionId] = [...currentValues, parsedValue];
        }
      } else if (type === 'booleano') {
        newAnswers[questionId] = value === 'true';
      } else if (type === 'numerico') { // Ensure numeric is also parsed
        newAnswers[questionId] = value; // Parsed to float in handleSubmitForm
      } else if (type === 'dibujo') { // 'dibujo' type for canvas
        newAnswers[questionId] = value; // Value will be the Base64 string of the drawing
      }
      else {
        newAnswers[questionId] = value;
      }
      return newAnswers;
    });
  }, []); // Empty dependency array for useCallback, as setAnswers is stable

  // Function: Handle select/deselect all resources
  const handleSelectAllResources = useCallback((questionId, allResourceIds, isChecked) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (isChecked) {
        newAnswers[questionId] = [...allResourceIds]; // Select all
      } else {
        newAnswers[questionId] = []; // Deselect all
      }
      return newAnswers;
    });
  }, []); // Empty dependency array for useCallback

  const getTipoRespuestaNombre = useCallback((tipoId) => {
    // Ensure allTiposRespuesta is an array before trying to find
    if (!Array.isArray(allTiposRespuesta)) {
        console.warn("allTiposRespuesta is not an array or is null/undefined.");
        return null; // Or handle as appropriate
    }
    return allTiposRespuesta.find(t => t.id_tipo_respuesta === tipoId)?.nombre_tipo;
  }, [allTiposRespuesta]); // Dependency is correct here

  // NEW: Helper function to get resources relevant to the current user's company
  const getAvailableResourcesForQuestion = useCallback((question) => {
    const availableResources = [];
    const opciones = question.opciones_respuesta_json;
    const currentCompanyId = currentUser?.empresa?.id_empresa;

    if (!currentCompanyId || !opciones || typeof opciones !== 'object') {
      return [];
    }

    // Determine which resource types are requested by the question
    // Prioritize 'resource_types' array if present (cleaner for templates)
    const requestedResourceTypes = Array.isArray(opciones.resource_types)
      ? opciones.resource_types
      : [];

    // Fallback: If 'resource_types' is not explicitly defined,
    // infer from presence of 'espacios', 'subespacios', 'objetos' keys
    // in opciones_respuesta_json (even if their values are empty arrays or specific IDs).
    // This makes it robust to different template structures.
    if (requestedResourceTypes.length === 0) {
        if (opciones.espacios !== undefined) requestedResourceTypes.push('espacios');
        if (opciones.subespacios !== undefined) requestedResourceTypes.push('subespacios');
        if (opciones.objetos !== undefined) requestedResourceTypes.push('objetos');
    }

    // Filter and add spaces that belong to the current user's company
    if (requestedResourceTypes.includes('espacios')) {
      storeEspacios.forEach(espacio => {
        if (espacio.id_empresa === currentCompanyId) {
          availableResources.push({
            id: espacio.id_espacio,
            name: espacio.nombre_espacio,
            type: 'Espacio' // Display type for clarity
          });
        }
      });
    }

    // Filter and add sub-spaces that belong to the current user's company
    if (requestedResourceTypes.includes('subespacios')) {
      storeSubEspacios.forEach(subEspacio => {
        // Find parent espacio to verify company ID
        const parentEspacio = storeEspacios.find(e => e.id_espacio === subEspacio.id_espacio_padre);
        if (parentEspacio && parentEspacio.id_empresa === currentCompanyId) {
          availableResources.push({
            id: subEspacio.id_subespacio,
            name: subEspacio.nombre_subespacio,
            type: 'Sub-Espacio'
          });
        }
      });
    }

    // Filter and add objects that belong to the current user's company
    if (requestedResourceTypes.includes('objetos')) {
      storeObjetos.forEach(objeto => {
        // Find parent subEspacio and then espacio to verify company ID
        const parentSubEspacio = storeSubEspacios.find(s => s.id_subespacio === objeto.id_subespacio_padre);
        if (parentSubEspacio) {
            const parentEspacio = storeEspacios.find(e => e.id_espacio === parentSubEspacio.id_espacio_padre);
            if (parentEspacio && parentEspacio.id_empresa === currentCompanyId) {
                availableResources.push({
                    id: objeto.id_objeto,
                    name: objeto.nombre_objeto,
                    type: 'Objeto'
                });
            }
        }
      });
    }
    return availableResources;
  }, [currentUser, storeEspacios, storeSubEspacios, storeObjetos]); // Dependencies for useCallback


  // --- Signature Canvas Logic (Directly in AnswerFormPage) ---

  // Helper to get pointer position (mouse or touch)
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

    // Calculate position relative to canvas and scale if canvas has a different visual size
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }, []);

  // Function to start drawing for a specific questionId
  const startDrawing = useCallback((e, questionId) => {
    e.preventDefault(); // Prevent scroll on touch devices
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    isDrawingMap.current[questionId] = true; // Update drawing state for this canvas
    const canvas = canvasRefs.current[questionId];
    const { x, y } = getPointerPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getPointerPos]);

  // Function to draw for a specific questionId
  const draw = useCallback((e, questionId) => {
    if (!isDrawingMap.current[questionId]) return; // Only draw if isDrawing is true for this canvas
    e.preventDefault(); // Prevent scroll on touch devices
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    const canvas = canvasRefs.current[questionId];
    const { x, y } = getPointerPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [getPointerPos]); // Removed isDrawingMap from dependencies, as isDrawingMap.current is stable

  // Function to stop drawing and save signature for a specific questionId
  const stopDrawing = useCallback((questionId) => {
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    isDrawingMap.current[questionId] = false; // Update drawing state
    ctx.closePath();
    const canvas = canvasRefs.current[questionId];
    // Get signature as Base64
    const signatureData = canvas.toDataURL('image/png');
    // Update form answers state
    handleAnswerChange(questionId, signatureData, 'dibujo'); // 'dibujo' type
  }, [handleAnswerChange]); // handleAnswerChange is a stable useCallback

  // Function to clear the canvas for a specific questionId
  const clearCanvas = useCallback((questionId) => {
    const ctx = drawingContexts.current[questionId];
    if (!ctx) return;
    const canvas = canvasRefs.current[questionId];
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    handleAnswerChange(questionId, '', 'dibujo'); // Clear the answer in state
  }, [handleAnswerChange]); // handleAnswerChange is a stable useCallback

  // Effect to initialize canvas contexts and add/remove listeners
  useEffect(() => {
    // Only if formDetails and allTiposRespuesta are loaded
    if (!formDetails || !formDetails.preguntas || !Array.isArray(allTiposRespuesta) || allTiposRespuesta.length === 0) return;

    // Filter only 'dibujo' type questions
    const drawingQuestions = formDetails.preguntas.filter(q => getTipoRespuestaNombre(q.tipo_respuesta_id) === 'dibujo');

    // Store cleanup functions for each canvas
    const cleanupFunctions = [];

    drawingQuestions.forEach(question => {
      const canvas = canvasRefs.current[question.id_pregunta];
      if (!canvas) return;

      const context = canvas.getContext('2d');
      context.lineWidth = 2; // Line thickness
      context.lineCap = 'round'; // Rounded line ends
      context.strokeStyle = '#000000'; // Line color (black)
      drawingContexts.current[question.id_pregunta] = context; // Store the context

      // Load initial signature using the ref
      // Access answers via ref to avoid answers in dependency array
      const initialSignature = latestAnswers.current[question.id_pregunta];
      if (initialSignature && initialSignature !== '') {
        const img = new Image();
        img.onload = () => {
          // Only clear and draw if the canvas is truly empty or needs update
          // This prevents re-drawing over existing content if not needed
          const currentCanvasData = canvas.toDataURL('image/png');
          if (currentCanvasData !== initialSignature) { // Only draw if different
            context.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
        };
        img.src = initialSignature;
      } else {
        // Ensure canvas is clean if no initial signature or it was cleared
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Wrap drawing functions to pass the questionId
      const start = (e) => startDrawing(e, question.id_pregunta);
      const move = (e) => draw(e, question.id_pregunta);
      const end = () => stopDrawing(question.id_pregunta);

      // Add mouse event listeners
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseup', end);
      canvas.addEventListener('mouseout', end); // Stop drawing if mouse leaves canvas

      // Add touch event listeners
      canvas.addEventListener('touchstart', start, { passive: false }); // passive: false to allow preventDefault
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      canvas.addEventListener('touchcancel', end);

      // Store the cleanup function for this canvas
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

    // The useEffect return function runs on unmount or before re-execution
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup()); // Execute all cleanup functions
    };
  }, [
    formDetails,
    allTiposRespuesta, // Still needed here because getTipoRespuestaNombre depends on it
    getPointerPos,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    // latestAnswers ref is used, not the state directly in dependencies
  ]);

  // --- END Signature Canvas Logic ---


  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmissionLimitMessage(''); // Clear limit message when attempting to submit

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

    // Proactive check before sending to backend
    // Only apply limit if max_submissions_per_period is greater than 0
    if (formDetails.max_submissions_per_period > 0 && userSubmissionsInPeriod >= formDetails.max_submissions_per_period) {
        setSubmissionLimitMessage(
          `You have already reached the limit of ${formDetails.max_submissions_per_period} submission(s) for this form in the last ${formDetails.submission_period_days} day(s).`
        );
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: submissionLimitMessage || `Submission limit reached (${formDetails.max_submissions_per_period}).` } });
        setSubmitting(false);
        return;
    }


    const missingAnswers = formDetails.preguntas.filter(q => {
      const tipoNombre = getTipoRespuestaNombre(q.tipo_respuesta_id);
      const answer = answers[q.id_pregunta];

      if (tipoNombre === 'texto' || tipoNombre === 'dibujo') { // 'dibujo' type
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
      } else if (tipoNombre === 'booleano') {
        // Already converted
      } else if (tipoNombre === 'seleccion_unica') {
        // Value is the selected string
      } else if (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') {
        // Convert array to JSON string
        valorRespuesta = JSON.stringify(valorRespuesta || []); 
      } else if (tipoNombre === 'dibujo') { // 'dibujo' type
        // For 'dibujo' type, valor_texto will contain the Base64 of the drawing
        valorRespuesta = valorRespuesta; // Already Base64
      }
      else {
        valorRespuesta = String(valorRespuesta);
      }

      return {
        pregunta_id: q.id_pregunta,
        valor_texto: (tipoNombre === 'texto' || tipoNombre === 'dibujo' || tipoNombre === 'seleccion_unica') ? valorRespuesta : null, // 'dibujo' type
        valor_booleano: (tipoNombre === 'booleano') ? valorRespuesta : null,
        valor_numerico: (tipoNombre === 'numerico') ? valorRespuesta : null,
        // Assign JSON string to valores_multiples_json
        valores_multiples_json: (tipoNombre === 'seleccion_multiple' || tipoNombre === 'seleccion_recursos') ? valorRespuesta : null,
      };
    });

    console.log("DEBUG FRONTEND: Payload of answers to send:", payloadRespuestas);

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
          // Estos campos se llenarán automáticamente en el backend si el formulario está asociado a recursos
          espacios_cubiertos_ids: [], 
          subespacios_cubiertos_ids: [],
          objetos_cubiertos_ids: [],
        })
      });

      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Form submitted successfully.' } });
        // On successful submission, update local count and limit message
        setUserSubmissionsInPeriod(prevCount => prevCount + 1);
        if (formDetails.max_submissions_per_period > 0 && (userSubmissionsInPeriod + 1) >= formDetails.max_submissions_per_period) {
            setSubmissionLimitMessage(
              `You have already reached the limit of ${formDetails.max_submissions_per_period} submission(s) for this form in the last ${formDetails.submission_period_days} day(s).`
            );
        }
        navigate('/Answerforms'); // Redirect to forms list after submitting
      } else {
        setError(data.error || 'Error submitting form.');
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error submitting form: ${data.error}` } });
        // If the error is due to the limit, update the limit message
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

  // Determine if the submit button should be disabled
  // Disabled if submitting OR if submission limit is > 0 and limit has been reached
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
          {/* Display max submission frequency as "max" for the user */}
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
                            <input
                              type="radio"
                              name={`question-${question.id_pregunta}`}
                              value="true"
                              checked={currentAnswer === true}
                              onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                            /> Yes
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
                          placeholder="Enter a number"
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
                            <p className="no-options-message">No options defined for this question.</p>
                          )}
                        </div>
                      )}

                      {/* Renderizado para 'seleccion_recursos' */}
                      {tipoNombre === 'seleccion_recursos' && (
                        <div className="options-group">
                          {(() => {
                            const resourcesToDisplay = getAvailableResourcesForQuestion(question);
                            if (resourcesToDisplay.length > 0) {
                              return (
                                <>
                                  <div className="select-all-resources-control">
                                    <label className="option-item">
                                      <input
                                        type="checkbox"
                                        checked={(currentAnswer || []).length === resourcesToDisplay.length && resourcesToDisplay.length > 0}
                                        onChange={(e) => handleSelectAllResources(question.id_pregunta, resourcesToDisplay.map(r => r.id), e.target.checked)}
                                      />
                                      Seleccionar/Deseleccionar Todos
                                    </label>
                                  </div>
                                  {resourcesToDisplay.map(resource => (
                                    <label key={resource.id} className="option-item">
                                      <input
                                        type="checkbox"
                                        name={`question-${question.id_pregunta}-resource-${resource.id}`}
                                        value={resource.id}
                                        checked={(currentAnswer || []).includes(resource.id)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, tipoNombre)}
                                      />
                                      {resource.name} ({resource.type})
                                    </label>
                                  ))}
                                </>
                              );
                            } else {
                              return <p className="no-options-message">No resources available for this question in your company.</p>;
                            }
                          })()}
                        </div>
                      )}

                      {/* Render Signature Canvas for 'dibujo' type */}
                      {tipoNombre === 'dibujo' && (
                        <div className="signature-area">
                          <canvas
                            ref={el => canvasRefs.current[question.id_pregunta] = el}
                            width={600} // Internal canvas resolution
                            height={300} // Internal canvas resolution (taller for more drawing space)
                            className="signature-canvas" // CSS class for styling
                          />
                          <button
                            type="button"
                            onClick={() => clearCanvas(question.id_pregunta)}
                            className="clear-canvas-btn"
                          >
                            Clear Signature
                          </button>
                        </div>
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