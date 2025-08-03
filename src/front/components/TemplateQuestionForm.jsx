// src/components/TemplateQuestionForm.jsx (Ejemplo)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer'; // Tu hook global
import axios from 'axios';

const TemplateQuestionForm = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { store, dispatch } = useGlobalReducer();
  const tiposRespuesta = store.tiposRespuesta;

  const [textoPregunta, setTextoPregunta] = useState('');
  const [orden, setOrden] = useState('');
  const [tipoRespuestaId, setTipoRespuestaId] = useState('');
  const [tipoRespuestaNombre, setTipoRespuestaNombre] = useState('');
  const [error, setError] = useState(null);
  
  // Opciones para seleccion_recursos
  const [selectedResources, setSelectedResources] = useState({
    espacios: false,
    subespacios: false,
    objetos: false,
  });

  useEffect(() => {
    // Asumo que tu useGlobalReducer ya carga los tipos de respuesta
    if (tiposRespuesta.length > 0) {
      setTipoRespuestaId(tiposRespuesta[0].id_tipo_respuesta);
      setTipoRespuestaNombre(tiposRespuesta[0].nombre_tipo);
    }
  }, [tiposRespuesta]);

  const handleTipoRespuestaChange = (e) => {
    const selectedId = e.target.value;
    const selectedName = tiposRespuesta.find(t => t.id_tipo_respuesta.toString() === selectedId)?.nombre_tipo;
    setTipoRespuestaId(selectedId);
    setTipoRespuestaNombre(selectedName);
  };

  const handleResourceCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setSelectedResources(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    let opcionesRespuestaJson = null;
    if (tipoRespuestaNombre === 'seleccion_recursos') {
      // >>> LÓGICA CORREGIDA PARA CONSTRUIR EL PAYLOAD DEL POST <<<
      opcionesRespuestaJson = {};
      if (selectedResources.espacios) {
        opcionesRespuestaJson.espacios = [];
      }
      if (selectedResources.subespacios) {
        opcionesRespuestaJson.subespacios = [];
      }
      if (selectedResources.objetos) {
        opcionesRespuestaJson.objetos = [];
      }

      if (Object.keys(opcionesRespuestaJson).length === 0) {
        setError("Debes seleccionar al menos un tipo de recurso.");
        return;
      }
    }

    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('No se encontró el token.');

      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formId}/preguntas`,
        {
          texto_pregunta: textoPregunta,
          tipo_respuesta_id: parseInt(tipoRespuestaId),
          orden: parseInt(orden),
          opciones_respuesta_json: opcionesRespuestaJson,
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Pregunta creada exitosamente.' } });
      navigate(`/formularios/${formId}/edit`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la pregunta.');
      console.error('Error al crear pregunta:', err);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Crear Pregunta de Plantilla</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Texto de la pregunta:</label>
          <input type="text" value={textoPregunta} onChange={(e) => setTextoPregunta(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Orden:</label>
          <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Tipo de Respuesta:</label>
          <select value={tipoRespuestaId} onChange={handleTipoRespuestaChange} required>
            {tiposRespuesta.map(tipo => (
              <option key={tipo.id_tipo_respuesta} value={tipo.id_tipo_respuesta}>
                {tipo.nombre_tipo}
              </option>
            ))}
          </select>
        </div>
        
        {tipoRespuestaNombre === 'seleccion_recursos' && (
          <div className="resource-options-group">
            <h3 className="options-title">Selecciona los tipos de recursos permitidos:</h3>
            <div className="checkbox-item">
              <input type="checkbox" name="espacios" checked={selectedResources.espacios} onChange={handleResourceCheckboxChange} />
              <label>Espacios</label>
            </div>
            <div className="checkbox-item">
              <input type="checkbox" name="subespacios" checked={selectedResources.subespacios} onChange={handleResourceCheckboxChange} />
              <label>Sub-Espacios</label>
            </div>
            <div className="checkbox-item">
              <input type="checkbox" name="objetos" checked={selectedResources.objetos} onChange={handleResourceCheckboxChange} />
              <label>Objetos</label>
            </div>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        <button type="submit" className="submit-btn">Crear Pregunta</button>
      </form>
    </div>
  );
};

export default TemplateQuestionForm;