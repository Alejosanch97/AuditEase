// src/components/CreateEditFormModal.jsx
import React, { useState, useEffect } from 'react';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/modalformcreate.css"; 

export const CreateEditFormModal = ({ mode, form, onClose, onSuccess, espacios, subEspacios, objetos, currentUser, allCompanies, tiposRespuesta: allTiposRespuestaGlobal }) => {
  const { dispatch } = useGlobalReducer();
  const [nombreFormulario, setNombreFormulario] = useState(form ? form.nombre_formulario : '');
  const [descripcion, setDescripcion] = useState(form ? form.descripcion : '');
  
  // NUEVOS ESTADOS para la frecuencia de llenado
  const [maxSubmissionsPerPeriod, setMaxSubmissionsPerPeriod] = useState(form ? form.max_submissions_per_period : 1);
  const [submissionPeriodDays, setSubmissionPeriodDays] = useState(form ? form.submission_period_days : 1);
  
  // Acceso defensivo a las propiedades del formulario para inicializar estados
  const [selectedEspacios, setSelectedEspacios] = useState(form?.espacios?.map(e => e.id_espacio) || []);
  const [selectedSubEspacios, setSelectedSubEspacios] = useState(form?.sub_espacios?.map(s => s.id_subespacio) || []);
  const [selectedObjetos, setSelectedObjetos] = useState(form?.objetos?.map(o => o.id_objeto) || []);
  
  // Estado para los tipos de respuesta seleccionados para este formulario
  const [selectedTiposRespuesta, setSelectedTiposRespuesta] = useState(form?.tipos_respuesta_disponibles?.map(t => t.id_tipo_respuesta) || []);
  
  // Estado para el nuevo tipo de respuesta a crear
  const [newTipoRespuestaNombre, setNewTipoRespuestaNombre] = useState('');
  const [newTipoRespuestaDescripcion, setNewTipoRespuestaDescripcion] = useState('');
  const [isCreatingNewTipo, setIsCreatingNewTipo] = useState(false); 

  // Estado para la empresa seleccionada en el modal
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    form ? form.id_empresa : (currentUser.rol === 'owner' && allCompanies.length > 0 ? allCompanies[0].id_empresa : currentUser.id_empresa)
  );

  // ESTADOS PARA PROPIEDADES DE PLANTILLA Y AUTOMATIZACIÓN
  const [esPlantilla, setEsPlantilla] = useState(form ? form.es_plantilla : false);
  const [esPlantillaGlobal, setEsPlantillaGlobal] = useState(form ? form.es_plantilla_global : false);
  const [compartirConEmpresasIds, setCompartirConEmpresasIds] = useState(form ? form.compartir_con_empresas_ids : []);
  const [notificacionesActivas, setNotificacionesActivas] = useState(form ? form.notificaciones_activas : true);
  const [automatizacionActiva, setAutomatizacionActiva] = useState(form ? form.automatizacion_activa : false);


  const [loading, setLoading] = useState(false);

  const isEditMode = mode === 'edit';

  // Efecto para inicializar selectedCompanyId y los nuevos campos en modo edición
  useEffect(() => {
    if (isEditMode && form) {
      setSelectedCompanyId(form.id_empresa);
      setMaxSubmissionsPerPeriod(form.max_submissions_per_period); // Inicializar nuevo campo
      setSubmissionPeriodDays(form.submission_period_days);       // Inicializar nuevo campo
      setEsPlantilla(form.es_plantilla);
      setEsPlantillaGlobal(form.es_plantilla_global);
      setCompartirConEmpresasIds(form.compartir_con_empresas_ids || []);
      setNotificacionesActivas(form.notificaciones_activas);
      setAutomatizacionActiva(form.automatizacion_activa);
      setSelectedEspacios(form.espacios?.map(e => e.id_espacio) || []);
      setSelectedSubEspacios(form.sub_espacios?.map(s => s.id_subespacio) || []);
      setSelectedObjetos(form.objetos?.map(o => o.id_objeto) || []);
      setSelectedTiposRespuesta(form.tipos_respuesta_disponibles?.map(t => t.id_tipo_respuesta) || []);
    } else if (!isEditMode && currentUser.rol === 'owner' && allCompanies.length > 0 && !selectedCompanyId) {
        // En modo creación para owner, si no hay empresa seleccionada, selecciona la primera
        setSelectedCompanyId(allCompanies[0].id_empresa);
    } else if (!isEditMode && currentUser.rol !== 'owner' && !selectedCompanyId) {
        // En modo creación para no-owner, selecciona la empresa del usuario
        setSelectedCompanyId(currentUser.id_empresa);
    }
  }, [isEditMode, form, currentUser, allCompanies, selectedCompanyId]);


  // --- Lógica de filtrado dinámico ---
  const spacesForSelectedCompany = (espacios || []).filter(esp => esp.id_empresa === selectedCompanyId);

  const subEspaciosForSelectedSpaces = (subEspacios || []).filter(sub =>
    selectedEspacios.includes(sub.id_espacio) &&
    spacesForSelectedCompany.some(esp => esp.id_espacio === sub.id_espacio)
  );

  const objetosForSelectedSubEspacios = (objetos || []).filter(obj =>
    selectedSubEspacios.includes(obj.id_subespacio) &&
    subEspaciosForSelectedSpaces.some(sub => sub.id_subespacio === obj.id_subespacio)
  );

  // --- Handlers para checkboxes (Espacios, Sub-espacios, Objetos) ---
  const handleEspacioChange = (e) => {
    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    let newSelectedEspacios;
    if (isChecked) {
      newSelectedEspacios = [...selectedEspacios, id];
    } else {
      newSelectedEspacios = selectedEspacios.filter(espId => espId !== id);
      // Deseleccionar sub-espacios y objetos que dependen del espacio deseleccionado
      const subEspaciosToDeselect = (subEspacios || []).filter(sub => sub.id_espacio === id).map(s => s.id_subespacio);
      setSelectedSubEspacios(prev => prev.filter(subId => !subEspaciosToDeselect.includes(subId)));

      const objetosToDeselect = (objetos || []).filter(obj => subEspaciosToDeselect.includes(obj.id_subespacio)).map(o => o.id_objeto);
      setSelectedObjetos(prev => prev.filter(objId => !objetosToDeselect.includes(objId)));
    }
    setSelectedEspacios(newSelectedEspacios);
  };

  const handleSubEspacioChange = (e) => {
    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    let newSelectedSubEspacios;
    if (isChecked) {
      newSelectedSubEspacios = [...selectedSubEspacios, id];
    } else {
      newSelectedSubEspacios = selectedSubEspacios.filter(subId => subId !== id);
      // Deseleccionar objetos que dependen del sub-espacio deseleccionado
      const objetosToDeselect = (objetos || []).filter(obj => obj.id_subespacio === id).map(o => o.id_objeto);
      setSelectedObjetos(prev => prev.filter(objId => !objetosToDeselect.includes(objId)));
    }
    setSelectedSubEspacios(newSelectedSubEspacios);
  };

  const handleObjetoChange = (e) => {
    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    let newSelectedObjetos;
    if (isChecked) {
      newSelectedObjetos = [...selectedObjetos, id];
    } else {
      newSelectedObjetos = selectedObjetos.filter(objId => objId !== id);
    }
    setSelectedObjetos(newSelectedObjetos);
  };

  // Handler para el cambio de empresa (solo para owner)
  const handleCompanySelectChange = (e) => {
    const newCompanyId = parseInt(e.target.value);
    setSelectedCompanyId(newCompanyId);
    // Limpiar todas las selecciones de espacios, sub-espacios y objetos al cambiar de empresa
    setSelectedEspacios([]);
    setSelectedSubEspacios([]);
    setSelectedObjetos([]);
    setSelectedTiposRespuesta([]); // También limpiar tipos de respuesta al cambiar de empresa
    // Resetear estados de plantilla si se cambia la empresa en modo creación
    if (!isEditMode) {
      setEsPlantilla(false);
      setEsPlantillaGlobal(false);
      setCompartirConEmpresasIds([]);
    }
  };

  // --- Handlers para Tipos de Respuesta ---
  const handleTipoRespuestaChange = (e) => {
    const id = parseInt(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      setSelectedTiposRespuesta(prev => [...prev, id]);
    } else {
      setSelectedTiposRespuesta(prev => prev.filter(tipoId => tipoId !== id));
    }
  };

  const handleCreateNewTipoRespuesta = async () => {
    if (!newTipoRespuestaNombre.trim()) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'El nombre del nuevo tipo de respuesta no puede estar vacío.' } });
      return;
    }

    setIsCreatingNewTipo(true);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tipos-respuesta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_tipo: newTipoRespuestaNombre.trim(),
          descripcion: newTipoRespuestaDescripcion.trim()
        })
      });

      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
        // Añadir el nuevo tipo al store global y seleccionarlo automáticamente
        dispatch({ type: 'SET_TIPOS_RESPUESTA', payload: [...(allTiposRespuestaGlobal || []), data.tipo_respuesta] });
        setSelectedTiposRespuesta(prev => [...prev, data.tipo_respuesta.id_tipo_respuesta]);
        
        // Limpiar campos del nuevo tipo
        setNewTipoRespuestaNombre('');
        setNewTipoRespuestaDescripcion('');
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al crear tipo de respuesta: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error de conexión al crear tipo de respuesta:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setIsCreatingNewTipo(false);
    }
  };

  // Handler para el multi-select de compartir con empresas
  const handleCompartirConEmpresasChange = (e) => {
    const options = Array.from(e.target.options);
    const selectedValues = options.filter(option => option.selected).map(option => parseInt(option.value));
    setCompartirConEmpresasIds(selectedValues);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const url = isEditMode
      ? `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${form.id_formulario}`
      : `${import.meta.env.VITE_BACKEND_URL}/api/formularios`;
    const method = isEditMode ? 'PUT' : 'POST';

    // Determinar id_empresa a enviar al backend
    let finalIdEmpresa = selectedCompanyId;
    if (!finalIdEmpresa && currentUser.rol !== 'owner') {
        finalIdEmpresa = currentUser.id_empresa;
    }
    if (!finalIdEmpresa) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Debe seleccionar una empresa para el formulario.' } });
        setLoading(false);
        return;
    }

    // Validaciones frontend para plantillas
    if (esPlantilla) {
        // La condición para crear plantillas es que sea owner y la empresa seleccionada sea SU empresa registrada.
        if (currentUser.rol === 'owner' && selectedCompanyId !== currentUser.id_empresa) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Las plantillas de formularios solo pueden ser creadas por el owner para su propia empresa registrada.' } });
            setLoading(false);
            return;
        }
        if (!esPlantillaGlobal && compartirConEmpresasIds.length === 0) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Si es una plantilla y no es global, debe especificar con qué empresas se comparte.' } });
            setLoading(false);
            return;
        }
        if (esPlantillaGlobal && compartirConEmpresasIds.length > 0) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Si es una plantilla global, no debe especificar empresas para compartir.' } });
            setLoading(false);
            return;
        }
    }

    // Validaciones para los nuevos campos de frecuencia
    if (isNaN(parseInt(maxSubmissionsPerPeriod)) || parseInt(maxSubmissionsPerPeriod) <= 0) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'El número máximo de diligencias debe ser un entero positivo.' } });
      setLoading(false);
      return;
    }
    if (isNaN(parseInt(submissionPeriodDays)) || parseInt(submissionPeriodDays) <= 0) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'El período de días debe ser un entero positivo.' } });
      setLoading(false);
      return;
    }


    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_formulario: nombreFormulario,
          descripcion: descripcion,
          // ACTUALIZADO: Nuevos campos para la frecuencia de llenado
          max_submissions_per_period: parseInt(maxSubmissionsPerPeriod),
          submission_period_days: parseInt(submissionPeriodDays),
          espacios_ids: selectedEspacios,
          subespacios_ids: selectedSubEspacios,
          objetos_ids: selectedObjetos,
          id_empresa: finalIdEmpresa,
          tipos_respuesta_ids: selectedTiposRespuesta,
          es_plantilla: esPlantilla,
          es_plantilla_global: esPlantillaGlobal,
          compartir_con_empresas_ids: esPlantillaGlobal ? [] : compartirConEmpresasIds,
          notificaciones_activas: notificacionesActivas,
          automatizacion_activa: automatizacionActiva,
        })
      });

      const data = await response.json();
      if (response.ok) {
        onSuccess(data.formulario);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || `Formulario ${isEditMode ? 'actualizado' : 'creado'} exitosamente.` } });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al ${isEditMode ? 'actualizar' : 'crear'} formulario: ${data.error}` } });
      }
    } catch (error) {
      console.error(`Error de conexión al ${isEditMode ? 'actualizar' : 'crear'} formulario:`, error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setLoading(false);
    }
  };

  // Determinar si la sección de plantillas debe ser visible
  // Condición: el usuario es 'owner' Y la empresa seleccionada es la empresa del propio usuario.
  const isTemplateSectionVisible = currentUser.rol === 'owner' && selectedCompanyId === currentUser.id_empresa;

  return (
    <div className="form-modal-overlay active">
      <div className="form-modal-content">
        <div className="form-modal-header">
          <h2>{isEditMode ? 'Editar Formulario' : 'Crear Nuevo Formulario'}</h2>
          <button className="form-modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="form-modal-form">
          {/* Selector de Empresa (solo para Owner) */}
          {currentUser.rol === 'owner' && (
            <div className="form-modal-group">
              <label htmlFor="selectCompany">Seleccionar Empresa:</label>
              <select
                id="selectCompany"
                value={selectedCompanyId || ''}
                onChange={handleCompanySelectChange}
                required
              >
                <option value="">-- Selecciona una empresa --</option>
                {(allCompanies || []).map(comp => (
                  <option key={comp.id_empresa} value={comp.id_empresa}>
                    {comp.nombre_empresa}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-modal-group">
            <label htmlFor="nombreFormulario">Nombre del Formulario:</label>
            <input
              type="text"
              id="nombreFormulario"
              value={nombreFormulario}
              onChange={(e) => setNombreFormulario(e.target.value)}
              required
            />
          </div>
          <div className="form-modal-group">
            <label htmlFor="descripcion">Descripción:</label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            ></textarea>
          </div>
          
          {/* NUEVOS CAMPOS DE FRECUENCIA DE LLENADO */}
          <div className="form-modal-group">
            <label htmlFor="maxSubmissionsPerPeriod">Máximo de Diligencias por Período:</label>
            <input
              type="number"
              id="maxSubmissionsPerPeriod"
              value={maxSubmissionsPerPeriod}
              onChange={(e) => setMaxSubmissionsPerPeriod(e.target.value)}
              min="1"
              required
            />
            <small>Número máximo de veces que este formulario puede ser diligenciado por un usuario en el período definido.</small>
          </div>
          <div className="form-modal-group">
            <label htmlFor="submissionPeriodDays">Período de Días para Diligencias:</label>
            <input
              type="number"
              id="submissionPeriodDays"
              value={submissionPeriodDays}
              onChange={(e) => setSubmissionPeriodDays(e.target.value)}
              min="1"
              required
            />
            <small>Número de días en los que se aplica el límite de diligencias (ej. 1 para diario, 7 para semanal).</small>
          </div>

          {/* CAMPOS DE PLANTILLA: Solo visibles para owner y si la empresa seleccionada es la del owner */}
          {isTemplateSectionVisible && (
            <div className="form-modal-group">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={esPlantilla}
                  onChange={(e) => {
                    setEsPlantilla(e.target.checked);
                    if (!e.target.checked) { 
                      setEsPlantillaGlobal(false);
                      setCompartirConEmpresasIds([]);
                    }
                  }}
                />
                Es Plantilla
              </label>
            </div>
          )}

          {esPlantilla && isTemplateSectionVisible && ( 
            <>
              <div className="form-modal-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={esPlantillaGlobal}
                    onChange={(e) => {
                      setEsPlantillaGlobal(e.target.checked);
                      if (e.target.checked) { 
                        setCompartirConEmpresasIds([]);
                      }
                    }}
                  />
                  Plantilla Global (Disponible para todas las empresas activas)
                </label>
              </div>

              {!esPlantillaGlobal && ( 
                <div className="form-modal-group">
                  <label htmlFor="compartirConEmpresas">Compartir con Empresas Específicas:</label>
                  <select
                    id="compartirConEmpresas"
                    multiple
                    value={compartirConEmpresasIds}
                    onChange={handleCompartirConEmpresasChange}
                    className="multi-select"
                  >
                    {(allCompanies || []).filter(comp => comp.id_empresa !== selectedCompanyId && comp.activo).map(comp => ( 
                      <option key={comp.id_empresa} value={comp.id_empresa}>
                        {comp.nombre_empresa}
                      </option>
                    ))}
                  </select>
                  <small>Selecciona las empresas con las que deseas compartir esta plantilla.</small>
                </div>
              )}
            </>
          )}

          {/* CAMPOS DE NOTIFICACIONES Y AUTOMATIZACIÓN (siempre visibles para admin/owner) */}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
            <>
              <div className="form-modal-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={notificacionesActivas}
                    onChange={(e) => setNotificacionesActivas(e.target.checked)}
                  />
                  Notificaciones Activas
                </label>
                <small>Activar/desactivar notificaciones para este formulario.</small>
              </div>

              <div className="form-modal-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={automatizacionActiva}
                    onChange={(e) => setAutomatizacionActiva(e.target.checked)}
                  />
                  Automatización Activa
                </label>
                <small>Activar/desactivar el llenado automático de este formulario.</small>
              </div>
            </>
          )}

          {/* Selección de Espacios (ahora con checkboxes) */}
          <div className="form-modal-group">
            <label>Seleccionar Espacios:</label>
            <div className="checkbox-list-container">
              {spacesForSelectedCompany.length > 0 ? (
                spacesForSelectedCompany.map(esp => (
                  <label key={esp.id_espacio} className="checkbox-item">
                    <input
                      type="checkbox"
                      value={esp.id_espacio}
                      checked={selectedEspacios.includes(esp.id_espacio)}
                      onChange={handleEspacioChange}
                    />
                    {esp.nombre_espacio}
                  </label>
                ))
              ) : (
                <p>No hay espacios disponibles para la empresa seleccionada.</p>
              )}
            </div>
          </div>

          {/* Selección de Sub-Espacios (ahora con checkboxes, filtrados por espacios seleccionados) */}
          <div className="form-modal-group">
            <label>Seleccionar Sub-Espacios:</label>
            <div className="checkbox-list-container">
              {selectedEspacios.length > 0 && subEspaciosForSelectedSpaces.length > 0 ? (
                subEspaciosForSelectedSpaces.map(sub => (
                  <label key={sub.id_subespacio} className="checkbox-item">
                    <input
                      type="checkbox"
                      value={sub.id_subespacio}
                      checked={selectedSubEspacios.includes(sub.id_subespacio)}
                      onChange={handleSubEspacioChange}
                    />
                    {sub.nombre_subespacio} (Espacio: {espacios.find(e => e.id_espacio === sub.id_espacio)?.nombre_espacio})
                  </label>
                ))
              ) : (
                <p>Selecciona espacios primero para ver los sub-espacios disponibles.</p>
              )}
            </div>
          </div>

          {/* Selección de Objetos (ahora con checkboxes, filtrados por SUBESPACIOS SELECCIONADOS) */}
          <div className="form-modal-group">
            <label>Seleccionar Objetos:</label>
            <div className="checkbox-list-container">
              {selectedSubEspacios.length > 0 && objetosForSelectedSubEspacios.length > 0 ? (
                objetosForSelectedSubEspacios.map(obj => (
                  <label key={obj.id_objeto} className="checkbox-item">
                    <input
                      type="checkbox"
                      value={obj.id_objeto}
                      checked={selectedObjetos.includes(obj.id_objeto)}
                      onChange={handleObjetoChange}
                    />
                    {obj.nombre_objeto} (Sub-Espacio: {subEspacios.find(s => s.id_subespacio === obj.id_subespacio)?.nombre_subespacio})
                  </label>
                ))
              ) : (
                <p>Selecciona sub-espacios primero para ver los objetos disponibles.</p>
              )}
            </div>
          </div>

          {/* Sección para seleccionar y crear Tipos de Respuesta */}
          <div className="form-modal-group">
            <label>Tipos de Respuesta Disponibles para este Formulario:</label>
            <div className="checkbox-list-container">
              {(allTiposRespuestaGlobal || []).length > 0 ? (
                (allTiposRespuestaGlobal || []).map(tipo => (
                  <label key={tipo.id_tipo_respuesta} className="checkbox-item">
                    <input
                      type="checkbox"
                      value={tipo.id_tipo_respuesta}
                      checked={selectedTiposRespuesta.includes(tipo.id_tipo_respuesta)}
                      onChange={handleTipoRespuestaChange}
                    />
                    {tipo.nombre_tipo}
                  </label>
                ))
              ) : (
                <p>No hay tipos de respuesta globales disponibles. Puedes crear uno nuevo a continuación.</p>
              )}
            </div>
            <small>Selecciona los tipos de respuesta que estarán disponibles para las preguntas de este formulario.</small>
          </div>

          {/* Sección para crear un nuevo Tipo de Respuesta */}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_general') && ( 
            <div className="form-modal-group new-tipo-respuesta-section">
              <label>Crear Nuevo Tipo de Respuesta Global:</label>
              <input
                type="text"
                placeholder="Nombre del nuevo tipo (ej: 'Dibujo')"
                value={newTipoRespuestaNombre}
                onChange={(e) => setNewTipoRespuestaNombre(e.target.value)}
                disabled={isCreatingNewTipo}
              />
              <textarea
                placeholder="Descripción (opcional)"
                value={newTipoRespuestaDescripcion}
                onChange={(e) => setNewTipoRespuestaDescripcion(e.target.value)}
                disabled={isCreatingNewTipo}
              ></textarea>
              <button
                type="button"
                className="btn-primary add-new-tipo-btn"
                onClick={handleCreateNewTipoRespuesta}
                disabled={isCreatingNewTipo || !newTipoRespuestaNombre.trim()}
              >
                {isCreatingNewTipo ? 'Creando...' : 'Crear Tipo de Respuesta'}
              </button>
              <small>Este tipo de respuesta se añadirá globalmente y estará disponible para todos los formularios.</small>
            </div>
          )}

          <div className="form-modal-actions">
            <button type="submit" className="form-modal-btn-primary" disabled={loading || !selectedCompanyId || selectedTiposRespuesta.length === 0 || (esPlantilla && !esPlantillaGlobal && compartirConEmpresasIds.length === 0)}>
              {loading ? 'Guardando...' : (isEditMode ? 'Actualizar Formulario' : 'Crear Formulario')}
            </button>
            <button type="button" className="form-modal-btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
