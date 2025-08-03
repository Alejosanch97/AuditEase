import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/createcompany.css";

export const EditOwnerCompanyModal = ({ currentCompany, onClose, onUpdateSuccess }) => {
  const { dispatch } = useGlobalReducer();

  const [formData, setFormData] = useState({
    nombre_empresa: '',
    direccion: '',
    telefono: '',
    email_contacto: ''
  });
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [previewLogo, setPreviewLogo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentCompany) {
      setFormData({
        nombre_empresa: currentCompany.nombre_empresa || '',
        direccion: currentCompany.direccion || '',
        telefono: currentCompany.telefono || '',
        email_contacto: currentCompany.email_contacto || ''
      });
      setPreviewLogo(currentCompany.logo_url || "[https://via.placeholder.com/100x50/cccccc/000000?text=Logo](https://via.placeholder.com/100x50/cccccc/000000?text=Logo)");
    }
    setError(null);
  }, [currentCompany]);

  useEffect(() => {
    if (companyLogoFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result);
      };
      reader.readAsDataURL(companyLogoFile);
    } else {
      setPreviewLogo(currentCompany.logo_url || "[https://via.placeholder.com/100x50/cccccc/000000?text=Logo](https://via.placeholder.com/100x50/cccccc/000000?text=Logo)");
    }
  }, [companyLogoFile, currentCompany.logo_url]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    setCompanyLogoFile(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    dispatch({ type: 'SET_MESSAGE', payload: null });

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No hay token de autenticación.' } });
      setLoading(false);
      return;
    }

    const data = new FormData();
    data.append('nombre_empresa', formData.nombre_empresa);
    data.append('direccion', formData.direccion);
    data.append('telefono', formData.telefono);
    data.append('email_contacto', formData.email_contacto);

    if (companyLogoFile) {
      data.append('logo_empresa', companyLogoFile);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/${currentCompany.id_empresa}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data,
      });

      const result = await response.json();

      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: result.message || 'Empresa actualizada exitosamente.' } });
        onUpdateSuccess(result.empresa);
      } else {
        setError(result.error || `Error: ${response.status} ${response.statusText}.`);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: result.error || 'Error al actualizar la empresa.' } });
      }
    } catch (err) {
      console.error('Error de conexión al actualizar empresa por owner:', err);
      setError('Error de conexión. Inténtalo de nuevo más tarde.');
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Editar Empresa (Owner)</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="nombre_empresa">Nombre de la Empresa:</label>
            <input
              type="text"
              id="nombre_empresa"
              name="nombre_empresa"
              value={formData.nombre_empresa}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="direccion">Dirección:</label>
            <input
              type="text"
              id="direccion"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="telefono">Teléfono:</label>
            <input
              type="text"
              id="telefono"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email_contacto">Email de Contacto:</label>
            <input
              type="email"
              id="email_contacto"
              name="email_contacto"
              value={formData.email_contacto}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="logo_empresa">Logo de la Empresa:</label>
            <input
              type="file"
              id="logo_empresa"
              name="logo_empresa"
              accept="image/*"
              onChange={handleFileChange}
            />
            {previewLogo && (
              <img src={previewLogo} alt="Vista previa del logo" className="company-logo-preview" style={{ maxWidth: '100px', maxHeight: '50px', marginTop: '10px', objectFit: 'contain' }} />
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

EditOwnerCompanyModal.propTypes = {
  currentCompany: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
};