import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Importa PropTypes
import "../styles/createcompany.css"; 

export const EditCompanyProfileModal = ({ currentCompany, onClose, onUpdateSuccess }) => {
  const [formData, setFormData] = useState({
    nombre_empresa: currentCompany.nombre_empresa || '',
    direccion: currentCompany.direccion || '',
    telefono: currentCompany.telefono || '',
    email_contacto: currentCompany.email_contacto || '',
  });
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [previewLogo, setPreviewLogo] = useState(currentCompany.logo_url || "https://via.placeholder.com/100x50/cccccc/000000?text=Logo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // UseEffect para asegurar que formData se actualice si currentCompany cambia
  useEffect(() => {
    setFormData({
      nombre_empresa: currentCompany.nombre_empresa || '',
      direccion: currentCompany.direccion || '',
      telefono: currentCompany.telefono || '',
      email_contacto: currentCompany.email_contacto || '',
    });
    // Si no hay un nuevo archivo seleccionado, restaurar la vista previa a la URL actual de la empresa
    if (!companyLogoFile) {
        setPreviewLogo(currentCompany.logo_url || "https://via.placeholder.com/100x50/cccccc/000000?text=Logo");
    }
    setSuccessMessage(null); // Limpiar mensajes al cambiar de empresa o reabrir
    setError(null);
  }, [currentCompany, companyLogoFile]); // companyLogoFile como dependencia para que se reevalúe si el usuario quita la selección de archivo


  // Actualizar la vista previa del logo cuando cambia el archivo seleccionado
  useEffect(() => {
    if (companyLogoFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result);
      };
      reader.readAsDataURL(companyLogoFile);
    } else {
      // Si no hay un archivo seleccionado, muestra la URL actual del logo o un placeholder
      setPreviewLogo(currentCompany.logo_url || "https://via.placeholder.com/100x50/cccccc/000000?text=Logo");
    }
  }, [companyLogoFile, currentCompany.logo_url]); // Dependencias: el archivo y la URL del logo actual de la empresa

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    // Si se selecciona un archivo, establece el archivo. Si se deselecciona, establece null.
    setCompanyLogoFile(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const data = new FormData();
    data.append('nombre_empresa', formData.nombre_empresa);
    data.append('direccion', formData.direccion);
    data.append('telefono', formData.telefono);
    data.append('email_contacto', formData.email_contacto); // Asegúrate de que email_contacto siempre se envía

    if (companyLogoFile) {
      data.append('logo_empresa', companyLogoFile);
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/mi-empresa`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // IMPORTANTE: NO AGREGUES 'Content-Type': 'multipart/form-data' aquí.
          // FormData lo establece automáticamente con el 'boundary' correcto.
        },
        body: data,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage("Datos de la empresa actualizados exitosamente.");
        onUpdateSuccess(result.empresa); // Pasa los datos actualizados al padre
        // Opcional: Si no quieres cerrar el modal inmediatamente, puedes limpiar el archivo seleccionado
        // setCompanyLogoFile(null); 
      } else {
        // El backend ahora debería devolver un objeto JSON con una propiedad 'error'
        setError(result.error || `Error: ${response.status} ${response.statusText}.`);
      }
    } catch (err) {
      console.error("Error en la solicitud PUT /api/mi-empresa:", err);
      setError("Error de conexión o del servidor. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button> {/* Botón de cerrar para mayor usabilidad */}
        <h2>Editar Datos de la Empresa</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre_empresa">Nombre de la Empresa:</label>
            <input
              type="text"
              id="nombre_empresa"
              name="nombre_empresa"
              value={formData.nombre_empresa}
              onChange={handleChange}
              required // Asegura que el nombre de la empresa sea requerido
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
              required // Asegura que el email de contacto sea requerido y válido
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
              <img src={previewLogo} alt="Vista previa del logo" className="company-logo-preview" style={{ maxWidth: '100px', maxHeight: '50px', marginTop: '10px' }} />
            )}
            {/* Opcional: Botón para eliminar el logo actual */}
            {currentCompany.logo_url && !companyLogoFile && (
                <button type="button" className="btn-remove-image" onClick={() => { 
                    // Similar al de usuario, esto requeriría una lógica de backend para eliminar el logo.
                    setPreviewLogo("https://via.placeholder.com/100x50/cccccc/000000?text=Logo");
                    console.log("Simulando eliminación del logo actual.");
                }}>Eliminar Logo Actual</button>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Definición de PropTypes para validar las props recibidas
EditCompanyProfileModal.propTypes = {
  currentCompany: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
};