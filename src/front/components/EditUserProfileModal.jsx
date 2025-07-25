import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Importa PropTypes
import "../styles/createcompany.css"; 

export const EditUserProfileModal = ({ currentUser, onClose, onUpdateSuccess }) => {
  // Inicializa formData con los datos actuales del currentUser.
  const [formData, setFormData] = useState({
    nombre_completo: currentUser.nombre_completo || '',
    email: currentUser.email || '',
    telefono_personal: currentUser.telefono_personal || '', // <-- NUEVO CAMPO
    cargo: currentUser.cargo || '',                       // <-- NUEVO CAMPO
  });

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(currentUser.imagen_perfil_url || "https://via.placeholder.com/130/1abc9c/ffffff?text=HV");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // UseEffect para asegurar que formData se actualice si currentUser cambia (ej: después de una actualización exitosa)
  useEffect(() => {
    setFormData({
      nombre_completo: currentUser.nombre_completo || '',
      email: currentUser.email || '',
      telefono_personal: currentUser.telefono_personal || '', // <-- Asegura que se actualice
      cargo: currentUser.cargo || '',                       // <-- Asegura que se actualice
    });
    // Si no hay un nuevo archivo seleccionado, restaurar la vista previa a la URL actual del usuario
    if (!profileImageFile) {
        setPreviewImage(currentUser.imagen_perfil_url || "https://via.placeholder.com/130/1abc9c/ffffff?text=HV");
    }
    setSuccessMessage(null); // Limpiar mensajes al cambiar de usuario o reabrir
    setError(null);
  }, [currentUser, profileImageFile]); // profileImageFile como dependencia para que se reevalúe si el usuario quita la selección de archivo

  // Actualizar la vista previa de la imagen cuando cambia el archivo seleccionado
  useEffect(() => {
    if (profileImageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(profileImageFile);
    } else {
      // Si no hay un archivo seleccionado, muestra la imagen actual del usuario o un placeholder
      setPreviewImage(currentUser.imagen_perfil_url || "https://via.placeholder.com/130/1abc9c/ffffff?text=HV");
    }
  }, [profileImageFile, currentUser.imagen_perfil_url]); // Dependencias: el archivo y la URL de la imagen actual del usuario

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    // Si se selecciona un archivo, establece el archivo. Si se deselecciona, establece null.
    setProfileImageFile(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const data = new FormData();
    data.append('nombre_completo', formData.nombre_completo);
    data.append('email', formData.email); 
    data.append('telefono_personal', formData.telefono_personal); // <-- NUEVO CAMPO enviado
    data.append('cargo', formData.cargo);                       // <-- NUEVO CAMPO enviado

    if (profileImageFile) {
      data.append('imagen_perfil', profileImageFile);
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage("Perfil actualizado exitosamente.");
        onUpdateSuccess(result.usuario); // Pasa los datos actualizados al padre
      } else {
        setError(result.error || `Error: ${response.status} ${response.statusText}.`);
      }
    } catch (err) {
      console.error("Error en la solicitud PUT /api/perfil:", err);
      setError("Error de conexión o del servidor. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Editar Perfil de Usuario</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre_completo">Nombre Completo:</label>
            <input
              type="text"
              id="nombre_completo"
              name="nombre_completo"
              value={formData.nombre_completo}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* NUEVO CAMPO: Teléfono Personal */}
          <div className="form-group">
            <label htmlFor="telefono_personal">Teléfono Personal:</label>
            <input
              type="text"
              id="telefono_personal"
              name="telefono_personal"
              value={formData.telefono_personal}
              onChange={handleChange}
              placeholder="Ej. +XX XXXXXXXXX"
            />
          </div>

          {/* NUEVO CAMPO: Cargo */}
          <div className="form-group">
            <label htmlFor="cargo">Cargo:</label>
            <input
              type="text"
              id="cargo"
              name="cargo"
              value={formData.cargo}
              onChange={handleChange}
              placeholder="Ej. Gerente, Analista SST"
            />
          </div>

          <div className="form-group">
            <label htmlFor="imagen_perfil">Imagen de Perfil:</label>
            <input
              type="file"
              id="imagen_perfil"
              name="imagen_perfil"
              accept="image/*"
              onChange={handleFileChange}
            />
            {previewImage && (
              <img src={previewImage} alt="Vista previa" className="profile-image-preview" style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '10px', borderRadius: '50%' }} />
            )}
            {currentUser.imagen_perfil_url && !profileImageFile && (
                <button type="button" className="btn-remove-image" onClick={() => { 
                    // Para que esto funcione, necesitarías una forma de indicarle al backend que el campo de la imagen debe ser nulificado.
                    // Esto usualmente se hace enviando un valor especial o una ruta DELETE separada.
                    // Por ahora, solo simula el cambio visualmente y no afectará el backend si no hay un manejo explícito.
                    setPreviewImage("https://via.placeholder.com/130/1abc9c/ffffff?text=HV");
                    // Opcional: Establecer profileImageFile a un valor que indique eliminación al backend (ej. una cadena especial)
                    // setProfileImageFile("CLEAR_IMAGE"); // Esto requeriría lógica extra en handleSubmit
                }}>Eliminar Imagen Actual</button>
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
EditUserProfileModal.propTypes = {
  currentUser: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
};