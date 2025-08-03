import React, { useState, useEffect, useMemo } from 'react';
import useGlobalReducer from '../hooks/useGlobalReducer';
import '../styles/modalquestioncreate.css'; 

// --- Función auxiliar para deduplicar recursos por su ID específico ---
const deduplicateResources = (resources, type) => {
    if (!resources) return [];
    const unique = new Map();
    resources.forEach(res => {
        let id;
        if (type === 'espacios') id = res.id_espacio;
        else if (type === 'subespacios') id = res.id_subespacio;
        else if (type === 'objetos') id = res.id_objeto;

        if (id !== undefined && id !== null && !unique.has(id)) {
            unique.set(id, res);
        } else if (id === undefined || id === null) {
            console.warn(`Recurso sin ID definido para tipo ${type}:`, res);
        }
    });
    return Array.from(unique.values());
};

export const CreateEditQuestionModal = ({
  mode,
  form,
  question,
  onClose,
  onSuccess,
  tiposRespuesta,
  allEspacios,
  allSubEspacios,
  allObjetos,
  currentUser,
  allCompanies
}) => {
  const { dispatch } = useGlobalReducer();
  
  // --- INICIALIZACIÓN SEGURA DE ESTADOS ---
  const [textoPregunta, setTextoPregunta] = useState(question?.texto_pregunta || '');
  const [tipoRespuestaId, setTipoRespuestaId] = useState(question?.tipo_respuesta_id || '');
  const [orden, setOrden] = useState(question?.orden || 1);

  const [opcionesRespuestaArray, setOpcionesRespuestaArray] = useState(['']);

  const [resourceCategory, setResourceCategory] = useState(''); 
  const [selectedEspacios, setSelectedEspacios] = useState([]);
  const [selectedSubEspacios, setSelectedSubEspacios] = useState([]);
  const [selectedObjetos, setSelectedObjetos] = useState([]);

  const [loading, setLoading] = useState(false);
  
  const isEditMode = mode === 'edit';
  const formId = form?.id_formulario;
  const formCompanyId = form?.id_empresa;

  const tiposRespuestaDisponibles = tiposRespuesta || [];

  const selectedTipoRespuesta = tiposRespuestaDisponibles.find(t => t.id_tipo_respuesta === parseInt(tipoRespuestaId));
  const tipoRespuestaNombre = selectedTipoRespuesta?.nombre_tipo;

  const requiresTextOptions = ['seleccion_multiple', 'seleccion_unica'].includes(tipoRespuestaNombre);
  const isResourceSelection = tipoRespuestaNombre === 'seleccion_recursos';
  const isSignatureOrDrawing = ['firma', 'dibujo'].includes(tipoRespuestaNombre);

  const isTemplateForm = form?.es_plantilla;

  const uniqueAllEspacios = useMemo(() => deduplicateResources(allEspacios, 'espacios'), [allEspacios]);
  const uniqueAllSubEspacios = useMemo(() => deduplicateResources(allSubEspacios, 'subespacios'), [allSubEspacios]);
  const uniqueAllObjetos = useMemo(() => deduplicateResources(allObjetos, 'objetos'), [allObjetos]);

  useEffect(() => {
    if (isEditMode && question) {
      setTextoPregunta(question.texto_pregunta);
      setTipoRespuestaId(question.tipo_respuesta_id);
      setOrden(question.orden);

      if (question.opciones_respuesta_json || question.recurso_asociado) {
        if (question.tipo_respuesta_nombre === 'seleccion_recursos') {
          if (isTemplateForm) {
            setResourceCategory(question.recurso_asociado || '');
            setSelectedEspacios([]);
            setSelectedSubEspacios([]);
            setSelectedObjetos([]);
          } else {
            const opciones = question.opciones_respuesta_json || {};
            setSelectedEspacios(opciones.espacios || []);
            setSelectedSubEspacios(opciones.subespacios || []);
            setSelectedObjetos(opciones.objetos || []);
            
            // Si el backend envía 'recurso_asociado', úsalo directamente.
            // De lo contrario, se deduce de las opciones
            if (question.recurso_asociado) {
              setResourceCategory(question.recurso_asociado);
            } else if (opciones.espacios?.length > 0) {
              setResourceCategory('espacio');
            } else if (opciones.subespacios?.length > 0) {
              setResourceCategory('subespacio');
            } else if (opciones.objetos?.length > 0) {
              setResourceCategory('objeto');
            } else {
              setResourceCategory('');
            }
          }
          setOpcionesRespuestaArray(['']);

        } else if (['seleccion_multiple', 'seleccion_unica'].includes(question.tipo_respuesta_nombre)) {
          setOpcionesRespuestaArray(Array.isArray(question.opciones_respuesta_json) ? question.opciones_respuesta_json : ['']);
          setResourceCategory('');
          setSelectedEspacios([]);
          setSelectedSubEspacios([]);
          setSelectedObjetos([]);
        } else {
          setOpcionesRespuestaArray(['']);
          setResourceCategory('');
          setSelectedEspacios([]);
          setSelectedSubEspacios([]);
          setSelectedObjetos([]);
        }
      } else {
        setOpcionesRespuestaArray(['']);
        setResourceCategory('');
        setSelectedEspacios([]);
        setSelectedSubEspacios([]);
        setSelectedObjetos([]);
      }
    } else {
      setOpcionesRespuestaArray(['']);
      setResourceCategory('');
      setSelectedEspacios([]);
      setSelectedSubEspacios([]);
      setSelectedObjetos([]);
    }
  }, [isEditMode, question, tiposRespuestaDisponibles, uniqueAllEspacios, uniqueAllSubEspacios, uniqueAllObjetos, isTemplateForm]);


  const getDisplayResources = (type) => {
    let resourcesToDisplay = [];

    if (isTemplateForm) {
      switch (type) {
        case 'espacio':
          resourcesToDisplay = uniqueAllEspacios;
          break;
        case 'subespacio':
          resourcesToDisplay = uniqueAllSubEspacios;
          break;
        case 'objeto':
          resourcesToDisplay = uniqueAllObjetos;
          break;
        default:
          resourcesToDisplay = [];
      }
    } else {
      if (!formCompanyId) return [];

      switch (type) {
        case 'espacio':
          resourcesToDisplay = uniqueAllEspacios.filter(r => r.id_empresa === formCompanyId);
          break;
        case 'subespacio':
          const companyEspaciosIds = uniqueAllEspacios.filter(e => e.id_empresa === formCompanyId).map(e => e.id_espacio);
          resourcesToDisplay = uniqueAllSubEspacios.filter(r => companyEspaciosIds.includes(r.id_espacio));
          break;
        case 'objeto':
          const companySubEspaciosIds = uniqueAllSubEspacios.filter(s =>
            uniqueAllEspacios.filter(e => e.id_empresa === formCompanyId).map(e => e.id_espacio).includes(s.id_espacio)
          ).map(s => s.id_subespacio);
          resourcesToDisplay = uniqueAllObjetos.filter(r => companySubEspaciosIds.includes(r.id_subespacio));
          break;
        default:
          resourcesToDisplay = [];
      }
    }
    return resourcesToDisplay;
  };

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
    setOpcionesRespuestaArray(newOptions.length > 0 ? newOptions : ['']);
  };

  const handleResourceCheckboxChange = (e, resourceType) => {
    if (isTemplateForm) {
      return;
    }

    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    if (resourceType === 'espacio') {
      setSelectedEspacios(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])];
        } else {
          const subEspaciosToDeselect = uniqueAllSubEspacios.filter(sub => sub.id_espacio === id).map(s => s.id_subespacio);
          setSelectedSubEspacios(currentSub => currentSub.filter(subId => !subEspaciosToDeselect.includes(subId)));
          const objetosToDeselect = uniqueAllObjetos.filter(obj => subEspaciosToDeselect.includes(obj.id_subespacio)).map(o => o.id_objeto);
          setSelectedObjetos(currentObj => currentObj.filter(objId => !objetosToDeselect.includes(objId)));
          return prev.filter(resId => resId !== id);
        }
      });
    } else if (resourceType === 'subespacio') {
      setSelectedSubEspacios(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])];
        } else {
          const objetosToDeselect = uniqueAllObjetos.filter(obj => obj.id_subespacio === id).map(o => o.id_objeto);
          setSelectedObjetos(currentObj => currentObj.filter(objId => !objetosToDeselect.includes(objId)));
          return prev.filter(resId => resId !== id);
        }
      });
    } else if (resourceType === 'objeto') {
      setSelectedObjetos(prev => {
        if (isChecked) {
          return [...new Set([...prev, id])];
        } else {
          return prev.filter(resId => resId !== id);
        }
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No estás autenticado.' } });
      return;
    }

    let payload;

    if (requiresTextOptions) {
      const opciones = opcionesRespuestaArray.map(opt => opt.trim()).filter(opt => opt !== '');
      if (opciones.length === 0) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Las opciones de respuesta no pueden estar vacías para este tipo de pregunta.' } });
        setLoading(false);
        return;
      }
      payload = {
        texto_pregunta: textoPregunta,
        tipo_respuesta_id: parseInt(tipoRespuestaId),
        orden: parseInt(orden),
        opciones_respuesta_json: opciones,
      };
    } else if (isResourceSelection) {
      if (!resourceCategory) {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Debe seleccionar una categoría de recurso para este tipo de pregunta.' } });
          setLoading(false);
          return;
      }
      if (isTemplateForm) {
        payload = {
          texto_pregunta: textoPregunta,
          tipo_respuesta_id: parseInt(tipoRespuestaId),
          orden: parseInt(orden),
          recurso_asociado: resourceCategory,
        };
      } else {
        const opciones = {
          espacios: selectedEspacios,
          subespacios: selectedSubEspacios,
          objetos: selectedObjetos
        };
        if (opciones[resourceCategory]?.length === 0) {
             dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Debe seleccionar al menos un ${resourceCategory} para este tipo de pregunta.` } });
             setLoading(false);
             return;
        }
        payload = {
          texto_pregunta: textoPregunta,
          tipo_respuesta_id: parseInt(tipoRespuestaId),
          orden: parseInt(orden),
          recurso_asociado: resourceCategory, // <--- CAMBIO CLAVE
          opciones_respuesta_json: opciones,
        };
      }
    } else {
      payload = {
        texto_pregunta: textoPregunta,
        tipo_respuesta_id: parseInt(tipoRespuestaId),
        orden: parseInt(orden),
      };
    }
        
    const baseUrl = import.meta.env.VITE_BACKEND_URL;
    let url;
    let method;

    if (isEditMode) {
      const rolePrefix = currentUser.rol === 'owner' ? 'owner' : 'admin_empresa';
      url = `${baseUrl}/api/${rolePrefix}/preguntas/${question.id_pregunta}`;
      method = 'PUT';
    } else {
      if (isTemplateForm) {
        url = `${baseUrl}/api/formularios/plantillas/${formId}/preguntas`;
      } else {
        url = `${baseUrl}/api/formularios/${formId}/preguntas`;
      }
      method = 'POST';
    }

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
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || `Pregunta ${isEditMode ? 'actualizada' : 'creada'} exitosamente.` } });
            onClose();
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
                setOpcionesRespuestaArray(['']);
                setResourceCategory('');
                setSelectedEspacios([]);
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

          {isSignatureOrDrawing && (
            <div className="question-modal-group">
              <small>Este tipo de pregunta requiere una firma digital o un dibujo.</small>
            </div>
          )}

          {isResourceSelection && (
            <>
              <div className="question-modal-group">
                <label htmlFor="resourceCategory">Categoría de Recurso:</label>
                <select
                  id="resourceCategory"
                  value={resourceCategory}
                  onChange={(e) => {
                    setResourceCategory(e.target.value);
                    setSelectedEspacios([]);
                    setSelectedSubEspacios([]);
                    setSelectedObjetos([]);
                  }}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  <option value="espacio">Espacios</option>
                  <option value="subespacio">Sub-Espacios</option>
                  <option value="objeto">Objetos</option>
                </select>
                <small>Selecciona la categoría de recursos para las opciones de esta pregunta.</small>
              </div>

              {resourceCategory && (
                <div className="question-modal-group">
                  <label>Seleccionar {resourceCategory === 'espacio' ? 'Espacios' : resourceCategory === 'subespacio' ? 'Sub-Espacios' : 'Objetos'}:</label>
                  <div className="checkbox-list-container">
                    {isTemplateForm ? (
                      <p className="template-resource-info">
                        Para preguntas de plantilla de recursos, las opciones se llenarán automáticamente con los recursos de la empresa que utilice este formulario.
                      </p>
                    ) : (
                      getDisplayResources(resourceCategory).length > 0 ? (
                        getDisplayResources(resourceCategory).map(res => (
                          <label
                            key={`${resourceCategory}-${
                                resourceCategory === 'espacio' ? res.id_espacio :
                                resourceCategory === 'subespacio' ? res.id_subespacio :
                                res.id_objeto
                            }`}
                            className="checkbox-item"
                          >
                            <input
                              type="checkbox"
                              value={
                                resourceCategory === 'espacio' ? res.id_espacio :
                                resourceCategory === 'subespacio' ? res.id_subespacio :
                                res.id_objeto
                              }
                              checked={
                                (resourceCategory === 'espacio' && selectedEspacios.includes(res.id_espacio)) ||
                                (resourceCategory === 'subespacio' && selectedSubEspacios.includes(res.id_subespacio)) ||
                                (resourceCategory === 'objeto' && selectedObjetos.includes(res.id_objeto))
                              }
                              onChange={(e) => handleResourceCheckboxChange(e, resourceCategory)}
                              disabled={isTemplateForm}
                            />
                            {res.nombre_espacio || res.nombre_subespacio || res.nombre_objeto}
                            {!isTemplateForm && resourceCategory === 'espacio' && allCompanies.find(c => c.id_empresa === res.id_empresa) &&
                              ` (${allCompanies.find(c => c.id_empresa === res.id_empresa).nombre_empresa})`}
                            {!isTemplateForm && resourceCategory === 'subespacio' && uniqueAllEspacios.find(e => e.id_espacio === res.id_espacio) &&
                              ` (Espacio: ${uniqueAllEspacios.find(e => e.id_espacio === res.id_espacio).nombre_espacio})`}
                            {!isTemplateForm && resourceCategory === 'objeto' && uniqueAllSubEspacios.find(s => s.id_subespacio === res.id_subespacio) &&
                              ` (Sub-Espacio: ${uniqueAllSubEspacios.find(s => s.id_subespacio === res.id_subespacio).nombre_subespacio})`}
                          </label>
                        ))
                      ) : (
                        <p>No hay recursos disponibles para la empresa del formulario en esta categoría.</p>
                      )
                    )}
                  </div>
                  {!isTemplateForm && <small>Selecciona uno o más recursos como opciones de respuesta.</small>}
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