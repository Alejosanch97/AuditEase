// src/components/CreateEditQuestionModal.jsx
import React, { useState, useEffect, useMemo } from 'react'; // Importa useMemo
import useGlobalReducer from '../hooks/useGlobalReducer';
import '../styles/modalquestioncreate.css'; // Importa el nuevo CSS

// --- Función auxiliar para deduplicar recursos por su ID específico ---
const deduplicateResources = (resources, type) => {
    if (!resources) return [];
    const unique = [];
    const seenIds = new Set();
    resources.forEach(res => {
        let id;
        if (type === 'espacios') id = res.id_espacio;
        else if (type === 'subespacios') id = res.id_subespacio;
        else if (type === 'objetos') id = res.id_objeto;

        // Solo añadir si el ID está definido y no ha sido visto antes
        if (id !== undefined && id !== null && !seenIds.has(id)) {
            seenIds.add(id);
            unique.push(res);
        } else if (id === undefined || id === null) {
            // Esto es una advertencia útil si algún recurso no tiene el ID esperado
            console.warn(`Recurso sin ID definido para tipo ${type}:`, res);
        }
    });
    return unique;
};


export const CreateEditQuestionModal = ({
  mode,
  form, // Ahora recibimos el objeto form completo
  question,
  onClose,
  onSuccess,
  tiposRespuesta, // ESTOS AHORA SON SOLO LOS TIPOS DISPONIBLES PARA ESTE FORMULARIO
  allEspacios, // Todos los espacios sin filtrar
  allSubEspacios, // Todos los sub-espacios sin filtrar
  allObjetos, // Todos los objetos sin filtrar
  currentUser, // Necesitamos el currentUser para verificar el rol
  allCompanies // Necesitamos allCompanies para mostrar el nombre de la empresa en los recursos
}) => {
  const { dispatch } = useGlobalReducer();
  const [textoPregunta, setTextoPregunta] = useState(question ? question.texto_pregunta : '');
  const [tipoRespuestaId, setTipoRespuestaId] = useState(question ? question.tipo_respuesta_id : '');
  const [orden, setOrden] = useState(question ? question.orden : 1); // Default to 1 for new questions

  // Para tipos de respuesta con opciones de texto (seleccion_unica, seleccion_multiple)
  const [opcionesRespuestaArray, setOpcionesRespuestaArray] = useState(['']); // Inicializa con un campo vacío

  // Para el nuevo tipo de respuesta de selección de recursos
  const [resourceCategory, setResourceCategory] = useState(''); // 'espacios', 'subespacios', 'objetos'
  // Estados separados para los IDs de recursos seleccionados
  const [selectedEspacios, setSelectedEspacios] = useState([]);
  const [selectedSubEspacios, setSelectedSubEspacios] = useState([]);
  const [selectedObjetos, setSelectedObjetos] = useState([]);

  const [loading, setLoading] = useState(false);
  
  const isEditMode = mode === 'edit';
  const formId = form?.id_formulario; // Obtener formId del objeto form
  const formCompanyId = form?.id_empresa; // Obtener id_empresa del formulario padre

  // Mover la declaración de tiposRespuestaDisponibles aquí, antes del useEffect
  const tiposRespuestaDisponibles = tiposRespuesta || [];

  // Encuentra el tipo de respuesta seleccionado por su ID
  const selectedTipoRespuesta = tiposRespuestaDisponibles.find(t => t.id_tipo_respuesta === parseInt(tipoRespuestaId));
  const tipoRespuestaNombre = selectedTipoRespuesta?.nombre_tipo;

  // Determina si el tipo de respuesta requiere opciones de texto o es de selección de recursos
  const requiresTextOptions = ['seleccion_multiple', 'seleccion_unica'].includes(tipoRespuestaNombre);
  const isResourceSelection = tipoRespuestaNombre === 'seleccion_recursos';
  const isSignatureOrDrawing = ['firma', 'dibujo'].includes(tipoRespuestaNombre);

  // Determinar si el formulario actual es una plantilla y el usuario es owner
  const isTemplateFormAndOwner = form?.es_plantilla && currentUser.rol === 'owner';

  // --- Deduplicar las listas de recursos globales al inicio del componente ---
  // Esto asegura que los datos base con los que trabajamos son únicos por ID.
  const uniqueAllEspacios = useMemo(() => deduplicateResources(allEspacios, 'espacios'), [allEspacios]);
  const uniqueAllSubEspacios = useMemo(() => deduplicateResources(allSubEspacios, 'subespacios'), [allSubEspacios]);
  const uniqueAllObjetos = useMemo(() => deduplicateResources(allObjetos, 'objetos'), [allObjetos]);

  // Efecto para inicializar estados en modo edición
  useEffect(() => {
    if (isEditMode && question) {
      setTextoPregunta(question.texto_pregunta);
      setTipoRespuestaId(question.tipo_respuesta_id);
      setOrden(question.orden);

      // Si hay opciones de respuesta en la pregunta existente
      if (question.opciones_respuesta_json) {
        if (question.tipo_respuesta_nombre === 'seleccion_recursos') {
          // Para seleccion_recursos, las opciones son un objeto con arrays de IDs o solo la categoría
          if (typeof question.opciones_respuesta_json === 'object' && question.opciones_respuesta_json !== null) {
            // Si es una pregunta de plantilla de recursos y el usuario es owner, limpiamos las selecciones
            if (isTemplateFormAndOwner) {
              setSelectedEspacios([]);
              setSelectedSubEspacios([]);
              setSelectedObjetos([]);
              // Pero sí cargamos la categoría si está definida en la plantilla
              setResourceCategory(question.opciones_respuesta_json.category || '');
            } else {
              // Si NO es una plantilla o NO es el owner, cargamos las selecciones específicas
              setSelectedEspacios(question.opciones_respuesta_json.espacios || []);
              setSelectedSubEspacios(question.opciones_respuesta_json.subespacios || []);
              setSelectedObjetos(question.opciones_respuesta_json.objetos || []);
              
              // Intentar preseleccionar la categoría si hay IDs o si la categoría está guardada
              if (question.opciones_respuesta_json.category) {
                setResourceCategory(question.opciones_respuesta_json.category);
              } else if (question.opciones_respuesta_json.espacios?.length > 0) {
                setResourceCategory('espacios');
              } else if (question.opciones_respuesta_json.subespacios?.length > 0) {
                setResourceCategory('subespacios');
              } else if (question.opciones_respuesta_json.objetos?.length > 0) {
                setResourceCategory('objetos');
              } else {
                setResourceCategory('');
              }
            }
          } else {
            // Manejar caso donde opciones_respuesta_json no es un objeto esperado
            console.warn("opciones_respuesta_json para seleccion_recursos no es un objeto:", question.opciones_respuesta_json);
            setSelectedEspacios([]);
            setSelectedSubEspacios([]);
            setSelectedObjetos([]);
            setResourceCategory('');
          }
          setOpcionesRespuestaArray(['']); // Asegurarse de que las opciones de texto estén limpias

        } else if (['seleccion_multiple', 'seleccion_unica'].includes(question.tipo_respuesta_nombre)) {
          // Para seleccion_multiple/unica, las opciones son strings
          setOpcionesRespuestaArray(Array.isArray(question.opciones_respuesta_json) ? question.opciones_respuesta_json : ['']);
          setResourceCategory(''); // Asegurarse de que la categoría de recurso esté limpia
          setSelectedEspacios([]); // Asegurarse de que los IDs de recurso estén limpios
          setSelectedSubEspacios([]);
          setSelectedObjetos([]);
        } else {
          // Para otros tipos, no hay opciones de texto ni de recurso
          setOpcionesRespuestaArray(['']);
          setResourceCategory('');
          setSelectedEspacios([]);
          setSelectedSubEspacios([]);
          setSelectedObjetos([]);
        }
      } else {
        // Si no hay opciones_respuesta_json en la pregunta, inicializar todo vacío
        setOpcionesRespuestaArray(['']);
        setResourceCategory('');
        setSelectedEspacios([]);
        setSelectedSubEspacios([]);
        setSelectedObjetos([]);
      }
    } else {
      // En modo creación, inicializar con un campo de opción vacío y sin selección de recursos
      setOpcionesRespuestaArray(['']);
      setResourceCategory('');
      setSelectedEspacios([]);
      setSelectedSubEspacios([]);
      setSelectedObjetos([]);
    }
  }, [isEditMode, question, tiposRespuestaDisponibles, uniqueAllEspacios, uniqueAllSubEspacios, uniqueAllObjetos, isTemplateFormAndOwner]); // Dependencias actualizadas


  // Función para obtener los recursos a mostrar en los checkboxes
  const getDisplayResources = (type) => {
    let resourcesToDisplay = [];

    if (isTemplateFormAndOwner) {
      // Usar las listas ya deduplicadas para las plantillas
      switch (type) {
        case 'espacios':
          resourcesToDisplay = uniqueAllEspacios; 
          break;
        case 'subespacios':
          resourcesToDisplay = uniqueAllSubEspacios;
          break;
        case 'objetos':
          resourcesToDisplay = uniqueAllObjetos;
          break;
        default:
          resourcesToDisplay = [];
      }
    } else {
      // Filtrar de las listas ya deduplicadas por la empresa del formulario
      if (!formCompanyId) return []; 

      switch (type) {
        case 'espacios':
          resourcesToDisplay = uniqueAllEspacios.filter(r => r.id_empresa === formCompanyId);
          break;
        case 'subespacios':
          const companyEspaciosIds = uniqueAllEspacios.filter(e => e.id_empresa === formCompanyId).map(e => e.id_espacio);
          resourcesToDisplay = uniqueAllSubEspacios.filter(r => companyEspaciosIds.includes(r.id_espacio));
          break;
        case 'objetos':
          const companySubEspaciosIds = uniqueAllSubEspacios.filter(s => 
            uniqueAllEspacios.filter(e => e.id_empresa === formCompanyId).map(e => e.id_espacio).includes(s.id_espacio)
          ).map(s => s.id_subespacio);
          resourcesToDisplay = uniqueAllObjetos.filter(r => companySubEspaciosIds.includes(r.id_subespacio));
          break;
        default:
          resourcesToDisplay = [];
      }
    }

    // El console.log aquí mostrará los recursos que se van a renderizar DESPUÉS de la deduplicación inicial y el filtrado.
    console.log(`DEBUG: getDisplayResources(${type}) - Recursos finales para mostrar:`, resourcesToDisplay);
    return resourcesToDisplay;
  };


  // Handlers para opciones de respuesta de texto (múltiples inputs)
  const handleOptionChange = (index, value) => {
    const newOptions = [...opcionesRespuestaArray];
    newOptions[index] = value;
    setOpcionesRespuestaArray(newOptions);
  };

  const handleAddOption = () => {
    setOpcionesRespuestaArray([...opcionesRespuestaArray, '']);
  };

  const handleRemoveOption = (index) => {
    const newOptions = opcionesRespuestaArray.filter((_, i) => i !== index);
    setOpcionesRespuestaArray(newOptions.length > 0 ? newOptions : ['']); // Asegura que siempre haya al menos un campo
  };

  // Handler para la selección de recursos (checkboxes)
  const handleResourceCheckboxChange = (e, resourceType) => {
    // Si es una pregunta de plantilla y el usuario es el owner, no permitimos la selección
    if (isTemplateFormAndOwner) {
      return;
    }

    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    // --- Lógica de TOGGLE corregida ---
    if (resourceType === 'espacios') {
      setSelectedEspacios(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])]; // Añadir si no existe, mantener único
        } else {
          // Si se deselecciona, también deseleccionar sub-recursos y objetos dependientes
          const subEspaciosToDeselect = uniqueAllSubEspacios.filter(sub => sub.id_espacio === id).map(s => s.id_subespacio);
          setSelectedSubEspacios(currentSub => currentSub.filter(subId => !subEspaciosToDeselect.includes(subId)));
          const objetosToDeselect = uniqueAllObjetos.filter(obj => subEspaciosToDeselect.includes(obj.id_subespacio)).map(o => o.id_objeto);
          setSelectedObjetos(currentObj => currentObj.filter(objId => !objetosToDeselect.includes(objId)));
          return prev.filter(resId => resId !== id); // Eliminar
        }
      });
    } else if (resourceType === 'subespacios') {
      setSelectedSubEspacios(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])]; // Añadir si no existe, mantener único
        } else {
          // Si se deselecciona, también deseleccionar objetos dependientes
          const objetosToDeselect = uniqueAllObjetos.filter(obj => obj.id_subespacio === id).map(o => o.id_objeto);
          setSelectedObjetos(currentObj => currentObj.filter(objId => !objetosToDeselect.includes(objId)));
          return prev.filter(resId => resId !== id); // Eliminar
        }
      });
    } else if (resourceType === 'objetos') {
      setSelectedObjetos(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])]; // Añadir si no existe, mantener único
        } else {
          return prev.filter(resId => resId !== id); // Eliminar
        }
      });
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('access_token');

    let payload = {
      texto_pregunta: textoPregunta,
      tipo_respuesta_id: parseInt(tipoRespuestaId),
      orden: parseInt(orden),
    };

    if (requiresTextOptions) {
      // Filtrar opciones vacías antes de enviar
      payload.opciones_respuesta_json = opcionesRespuestaArray.map(opt => opt.trim()).filter(opt => opt !== '');
      if (payload.opciones_respuesta_json.length === 0) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Las opciones de respuesta no pueden estar vacías para este tipo de pregunta.' } });
        setLoading(false);
        return;
      }
    } else if (isResourceSelection) {
      // Si es una plantilla Y el usuario es el owner, enviamos solo la categoría
      if (isTemplateFormAndOwner) {
        if (!resourceCategory) {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Debe seleccionar una categoría de recurso para la pregunta de plantilla.' } });
          setLoading(false);
          return;
        }
        payload.opciones_respuesta_json = {
          category: resourceCategory, // Solo enviamos la categoría para la plantilla
          espacios: [], // Las listas de IDs deben estar vacías para la plantilla
          subespacios: [],
          objetos: []
        };
      } else {
        // Si NO es una plantilla o NO es el owner, enviamos los IDs seleccionados
        payload.opciones_respuesta_json = {
          category: resourceCategory, // También enviar la categoría para formularios no plantilla
          espacios: selectedEspacios,
          subespacios: selectedSubEspacios,
          objetos: selectedObjetos
        };
        // Validación: Si NO es una plantilla, debe seleccionar al menos un recurso.
        if (selectedEspacios.length === 0 && selectedSubEspacios.length === 0 && selectedObjetos.length === 0) {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Debe seleccionar al menos un recurso para este tipo de pregunta.' } });
          setLoading(false);
          return;
        }
      }
    } else if (isSignatureOrDrawing) {
        // Para firma o dibujo, no se envían opciones_respuesta_json
        payload.opciones_respuesta_json = null;
    } else {
      payload.opciones_respuesta_json = null; // Asegurarse de que no se envíen opciones si no son necesarias
    }

    const url = isEditMode
      ? `${import.meta.env.VITE_BACKEND_URL}/api/preguntas/${question.id_pregunta}`
      : `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/preguntas`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        onSuccess(data.pregunta);
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al ${isEditMode ? 'actualizar' : 'crear'} pregunta: ${data.error}` } });
      }
    } catch (error) {
      console.error(`Error de conexión al ${isEditMode ? 'actualizar' : 'crear'} pregunta:`, error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setLoading(false);
    }
  };

  // --- DEBUGGING CONSOLE LOGS (Puedes eliminarlos una vez que funcione) ---
  console.log("DEBUG: Formulario es plantilla:", form?.es_plantilla);
  console.log("DEBUG: Usuario rol:", currentUser.rol);
  console.log("DEBUG: isTemplateFormAndOwner calculado:", isTemplateFormAndOwner);
  console.log("DEBUG: Tipo de respuesta seleccionado:", tipoRespuestaNombre);
  console.log("DEBUG: Categoría de recurso seleccionada:", resourceCategory);
  console.log("DEBUG: Espacios seleccionados:", selectedEspacios);
  console.log("DEBUG: SubEspacios seleccionados:", selectedSubEspacios);
  console.log("DEBUG: Objetos seleccionados:", selectedObjetos);
  // --- FIN DEBUGGING CONSOLE LOGS ---


  return (
    <div className="question-modal-overlay active">
      <div className="question-modal-content">
        <div className="question-modal-header">
          <h2>{isEditMode ? 'Editar Pregunta' : 'Añadir Nueva Pregunta'}</h2>
          <button className="question-modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="question-modal-form">
          <div className="question-modal-group">
            <label htmlFor="textoPregunta">Texto de la Pregunta:</label>
            <input
              type="text"
              id="textoPregunta"
              value={textoPregunta}
              onChange={(e) => setTextoPregunta(e.target.value)}
              required
            />
          </div>
          <div className="question-modal-group">
            <label htmlFor="tipoRespuesta">Tipo de Respuesta:</label>
            <select
              id="tipoRespuesta"
              value={tipoRespuestaId}
              onChange={(e) => {
                setTipoRespuestaId(e.target.value);
                // Resetear opciones al cambiar el tipo de respuesta
                setOpcionesRespuestaArray(['']); // Siempre un campo vacío por defecto
                setResourceCategory('');
                setSelectedEspacios([]); // Limpiar selecciones de recursos
                setSelectedSubEspacios([]);
                setSelectedObjetos([]);
              }}
              required
            >
              <option value="">Selecciona un tipo</option>
              {tiposRespuestaDisponibles && tiposRespuestaDisponibles.length > 0 ? (
                tiposRespuestaDisponibles.map(tipo => (
                  <option key={tipo.id_tipo_respuesta} value={tipo.id_tipo_respuesta}>
                    {tipo.nombre_tipo}
                  </option>
                ))
              ) : (
                <option disabled>No hay tipos de respuesta disponibles para este formulario.</option>
              )}
            </select>
          </div>

          {/* Campos de respuesta dinámicos según tipo */}
          {tipoRespuestaNombre === 'texto' && (
            <div className="question-modal-group">
              <small>La respuesta será un campo de texto libre.</small>
            </div>
          )}

          {tipoRespuestaNombre === 'booleano' && (
            <div className="question-modal-group">
              <small>La respuesta será "Sí" o "No".</small>
            </div>
          )}

          {tipoRespuestaNombre === 'numerico' && (
            <div className="question-modal-group">
              <small>La respuesta será un valor numérico.</small>
            </div>
          )}

          {/* Para seleccion_multiple y seleccion_unica */}
          {requiresTextOptions && (
            <div className="question-modal-group">
              <label>Opciones de Respuesta:</label>
              <div className="options-input-container">
                {opcionesRespuestaArray.map((option, index) => (
                  <div key={index} className="option-input-item">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65 + index)}`} 
                      required
                    />
                    {opcionesRespuestaArray.length > 1 && (
                      <button type="button" className="remove-option-btn" onClick={() => handleRemoveOption(index)}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-option-btn" onClick={handleAddOption}>
                  + Agregar Otra Opción
                </button>
              </div>
              <small>Define las opciones que el usuario podrá seleccionar.</small>
            </div>
          )}

          {/* Para firma y dibujo */}
          {isSignatureOrDrawing && (
            <div className="question-modal-group">
              <small>Este tipo de pregunta requiere una firma digital o un dibujo.</small>
            </div>
          )}

          {/* Para seleccion_recursos */}
          {isResourceSelection && (
            <>
              <div className="question-modal-group">
                <label htmlFor="resourceCategory">Categoría de Recurso:</label>
                <select
                  id="resourceCategory"
                  value={resourceCategory}
                  onChange={(e) => {
                    setResourceCategory(e.target.value);
                    // Limpiar selecciones de recursos al cambiar de categoría
                    setSelectedEspacios([]);
                    setSelectedSubEspacios([]);
                    setSelectedObjetos([]);
                  }}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  <option value="espacios">Espacios</option>
                  <option value="subespacios">Sub-Espacios</option>
                  <option value="objetos">Objetos</option>
                </select>
                <small>Selecciona la categoría de recursos para las opciones de esta pregunta.</small>
              </div>

              {resourceCategory && ( // Solo mostrar la lista si se ha seleccionado una categoría
                <div className="question-modal-group">
                  <label>Seleccionar {resourceCategory === 'espacios' ? 'Espacios' : resourceCategory === 'subespacios' ? 'Sub-Espacios' : 'Objetos'}:</label>
                  <div className="checkbox-list-container">
                    {isTemplateFormAndOwner ? (
                      <p className="template-resource-info">
                        Para preguntas de plantilla de recursos, las opciones se llenarán automáticamente con los recursos de la empresa que utilice este formulario.
                        <br/>
                        **No es necesario seleccionar recursos específicos aquí.**
                      </p>
                    ) : (
                      getDisplayResources(resourceCategory).length > 0 ? (
                        getDisplayResources(resourceCategory).map(res => (
                          <label 
                            // Clave única para cada elemento, combinando categoría y ID del recurso
                            key={`${resourceCategory}-${
                                resourceCategory === 'espacios' ? res.id_espacio :
                                resourceCategory === 'subespacios' ? res.id_subespacio :
                                res.id_objeto // Asume 'objetos'
                            }`} 
                            className="checkbox-item"
                          >
                            <input
                              type="checkbox"
                              value={
                                resourceCategory === 'espacios' ? res.id_espacio :
                                resourceCategory === 'subespacios' ? res.id_subespacio :
                                res.id_objeto // Asume 'objetos'
                              }
                              checked={
                                (resourceCategory === 'espacios' && selectedEspacios.includes(res.id_espacio)) ||
                                (resourceCategory === 'subespacios' && selectedSubEspacios.includes(res.id_subespacio)) ||
                                (resourceCategory === 'objetos' && selectedObjetos.includes(res.id_objeto))
                              }
                              onChange={(e) => handleResourceCheckboxChange(e, resourceCategory)}
                              // El atributo disabled solo se aplica si es una plantilla Y el owner
                              disabled={isTemplateFormAndOwner} 
                            />
                            {res.nombre_espacio || res.nombre_subespacio || res.nombre_objeto} 
                            {/* Mostrar el nombre de la empresa/espacio/subespacio si es relevante y no es plantilla */}
                            {!isTemplateFormAndOwner && resourceCategory === 'espacios' && allCompanies.find(c => c.id_empresa === res.id_empresa) && 
                              ` (${allCompanies.find(c => c.id_empresa === res.id_empresa).nombre_empresa})`}
                            {!isTemplateFormAndOwner && resourceCategory === 'subespacios' && uniqueAllEspacios.find(e => e.id_espacio === res.id_espacio) && 
                              ` (Espacio: ${uniqueAllEspacios.find(e => e.id_espacio === res.id_espacio).nombre_espacio})`}
                            {!isTemplateFormAndOwner && resourceCategory === 'objetos' && uniqueAllSubEspacios.find(s => s.id_subespacio === res.id_subespacio) && 
                              ` (Sub-Espacio: ${uniqueAllSubEspacios.find(s => s.id_subespacio === res.id_subespacio).nombre_subespacio})`}
                          </label>
                        ))
                      ) : (
                        <p>No hay recursos disponibles para la empresa del formulario en esta categoría.</p>
                      )
                    )}
                  </div>
                  {!isTemplateFormAndOwner && <small>Selecciona uno o más recursos como opciones de respuesta.</small>}
                </div>
              )}
            </>
          )}

          <div className="question-modal-group">
            <label htmlFor="orden">Orden:</label>
            <input
              type="number"
              id="orden"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              min="1"
              required
            />
          </div>
          <div className="question-modal-actions">
            <button type="submit" className="question-modal-btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : (isEditMode ? 'Actualizar Pregunta' : 'Añadir Pregunta')}
            </button>
            <button type="button" className="question-modal-btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
