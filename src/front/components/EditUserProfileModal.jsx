// src/components/EditUserProfileModal.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import "../styles/formModal.css"; // Asegúrate de que este archivo CSS exista y contenga los estilos necesarios

export const EditUserProfileModal = ({ currentUser, onClose, onUpdateSuccess }) => {
  // Estado para los datos del formulario de texto
  const [formData, setFormData] = useState({
    nombre_completo: currentUser.nombre_completo || '',
    email: currentUser.email || '',
    telefono_personal: currentUser.telefono_personal || '',
    cargo: currentUser.cargo || '',
  });

  // Estado para la imagen de perfil
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewProfileImage, setPreviewProfileImage] = useState(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");

  // Estado para la firma digital
  const [signatureFile, setSignatureFile] = useState(null);
  const [previewSignature, setPreviewSignature] = useState(currentUser.firma_digital_url || null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Efecto para inicializar formData y vistas previas cuando currentUser cambia o se reabre el modal
  useEffect(() => {
    setFormData({
      nombre_completo: currentUser.nombre_completo || '',
      email: currentUser.email || '',
      telefono_personal: currentUser.telefono_personal || '',
      cargo: currentUser.cargo || '',
    });
    // Si no hay un nuevo archivo seleccionado, restaurar la vista previa a la URL actual del usuario
    if (!profileImageFile) {
        setPreviewProfileImage(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");
    }
    if (!signatureFile) {
        setPreviewSignature(currentUser.firma_digital_url || null);
    }
    setSuccessMessage(null); // Limpiar mensajes al cambiar de usuario o reabrir
    setError(null);
  }, [currentUser, profileImageFile, signatureFile]);

  // Efecto para actualizar la vista previa de la imagen de perfil cuando cambia el archivo seleccionado
  useEffect(() => {
    if (profileImageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewProfileImage(reader.result);
      };
      reader.readAsDataURL(profileImageFile);
    } else {
      // Si no hay un archivo seleccionado, muestra la imagen actual del usuario o un placeholder
      setPreviewProfileImage(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");
    }
  }, [profileImageFile, currentUser.imagen_perfil_url]);

  // Efecto para actualizar la vista previa de la firma digital cuando cambia el archivo seleccionado
  useEffect(() => {
    if (signatureFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewSignature(reader.result);
      };
      reader.readAsDataURL(signatureFile);
    } else {
      setPreviewSignature(currentUser.firma_digital_url || null); // Display current signature or null
    }
  }, [signatureFile, currentUser.firma_digital_url]);


  // Manejadores de cambio para los inputs de texto
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Manejadores de cambio para los inputs de archivo
  const handleProfileImageFileChange = (e) => {
    setProfileImageFile(e.target.files[0] || null);
  };

  const handleSignatureFileChange = (e) => {
    setSignatureFile(e.target.files[0] || null);
  };

  // Función para enviar los datos de texto del perfil
  const updateProfileData = async (token) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json', // Ahora enviamos JSON
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData), // Enviamos formData como JSON
    });
    return response.json();
  };

  // Función para subir la imagen de perfil
  const uploadProfileImage = async (token) => {
    if (!profileImageFile) return { success: true }; // No hay archivo para subir

    const imageData = new FormData();
    imageData.append('imagen_perfil', profileImageFile);

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/imagen-perfil`, { // NUEVA RUTA
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: imageData,
    });
    return response.json();
  };

  // Función para subir la firma digital
  const uploadSignature = async (token) => {
    if (!signatureFile) return { success: true }; // No hay archivo para subir

    const signatureData = new FormData();
    signatureData.append('firma_digital', signatureFile); // El backend espera 'firma_digital' como archivo

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/firma`, { // RUTA EXISTENTE, AHORA MANEJA ARCHIVO
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: signatureData,
    });
    return response.json();
  };

  // Función para eliminar la imagen de perfil
  const handleClearProfileImage = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/imagen-perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' // Enviamos JSON para indicar que se borra
        },
        body: JSON.stringify({ clear_image: true }), // Bandera para que el backend borre
      });
      const result = await response.json();

      if (response.ok) {
        setProfileImageFile(null); // Limpiar el estado del input de archivo
        setPreviewProfileImage("https://placehold.co/130x130/1abc9c/ffffff?text=HV"); // Establecer placeholder
        setSuccessMessage(result.message);
        onUpdateSuccess({ ...currentUser, imagen_perfil_url: null }); // Actualizar estado padre
      } else {
        setError(result.error || "Error al eliminar la imagen de perfil.");
      }
    } catch (err) {
      console.error("Error al eliminar la imagen de perfil:", err);
      setError("Error de conexión o del servidor al eliminar la imagen de perfil.");
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar la firma digital
  const handleClearSignature = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/firma`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' // Enviamos JSON para indicar que se borra
        },
        body: JSON.stringify({ clear_signature: true }), // Bandera para que el backend borre
      });
      const result = await response.json();

      if (response.ok) {
        setSignatureFile(null); // Limpiar el estado del input de archivo
        setPreviewSignature(null); // Limpiar la vista previa
        setSuccessMessage(result.message);
        onUpdateSuccess({ ...currentUser, firma_digital_url: null }); // Actualizar estado padre
      } else {
        setError(result.error || "Error al eliminar la firma digital.");
      }
    } catch (err) {
      console.error("Error al eliminar la firma digital:", err);
      setError("Error de conexión o del servidor al eliminar la firma digital.");
    } finally {
      setLoading(false);
    }
  };


  // Función principal de envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación. Por favor, inicie sesión.");
      setLoading(false);
      return;
    }

    let updatedUser = { ...currentUser }; // Empezar con los datos actuales del usuario

    try {
      // 1. Actualizar datos de perfil (nombre, email, teléfono, cargo)
      const profileResult = await updateProfileData(token);
      if (!profileResult.error) {
        updatedUser = { ...updatedUser, ...profileResult.usuario }; // Fusionar datos de perfil actualizados
      } else {
        setError(profileResult.error);
        setLoading(false);
        return;
      }

      // 2. Subir imagen de perfil (si ha cambiado)
      // Solo intenta subir si hay un nuevo archivo seleccionado
      if (profileImageFile) {
        const imageResult = await uploadProfileImage(token);
        if (!imageResult.error) {
          if (imageResult.imagen_perfil_url !== undefined) { // Asegurarse de que el campo existe
            updatedUser.imagen_perfil_url = imageResult.imagen_perfil_url; // Actualizar URL de imagen
          }
        } else {
          setError(imageResult.error);
          setLoading(false);
          return;
        }
      }

      // 3. Subir firma digital (si ha cambiado)
      // Solo intenta subir si hay un nuevo archivo seleccionado
      if (signatureFile) {
        const signatureResult = await uploadSignature(token);
        if (!signatureResult.error) {
          if (signatureResult.firma_url !== undefined) { // Asegurarse de que el campo existe
            updatedUser.firma_digital_url = signatureResult.firma_url; // Actualizar URL de firma
          }
        } else {
          setError(signatureResult.error);
          setLoading(false);
          return;
        }
      }

      setSuccessMessage("Perfil actualizado exitosamente.");
      onUpdateSuccess(updatedUser); // Pasar el objeto de usuario completamente actualizado al padre
      // Reiniciar los inputs de archivo después de una subida exitosa
      setProfileImageFile(null);
      setSignatureFile(null);

    } catch (err) {
      console.error("Error en la solicitud de actualización de perfil:", err);
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

          {/* Sección de Imagen de Perfil */}
          <div className="form-group">
            <label htmlFor="imagen_perfil">Imagen de Perfil:</label>
            <input
              type="file"
              id="imagen_perfil"
              name="imagen_perfil"
              accept="image/*"
              onChange={handleProfileImageFileChange}
            />
            {previewProfileImage && (
              <img src={previewProfileImage} alt="Vista previa" className="profile-image-preview" style={{ maxWidth: '130px', maxHeight: '130px', marginTop: '10px', borderRadius: '50%', objectFit: 'cover' }} />
            )}
            {/* Mostrar botón de eliminar solo si hay una imagen actual y no se ha seleccionado una nueva */}
            {currentUser.imagen_perfil_url && !profileImageFile && (
                <button type="button" className="btn-remove-image" onClick={handleClearProfileImage} disabled={loading}>
                    Eliminar Imagen Actual
                </button>
            )}
          </div>

          {/* Sección de Firma Digital */}
          <div className="form-group">
            <label htmlFor="firma_digital">Firma Digital:</label>
            <input
              type="file"
              id="firma_digital"
              name="firma_digital"
              accept="image/*"
              onChange={handleSignatureFileChange}
            />
            {previewSignature && (
              <img src={previewSignature} alt="Vista previa Firma" className="signature-preview" style={{ maxWidth: '150px', maxHeight: '80px', marginTop: '10px', border: '1px solid #ccc', objectFit: 'contain' }} />
            )}
            {/* Mostrar botón de eliminar solo si hay una firma actual y no se ha seleccionado una nueva */}
            {currentUser.firma_digital_url && !signatureFile && (
                <button type="button" className="btn-remove-image" onClick={handleClearSignature} disabled={loading}>
                    Eliminar Firma Actual
                </button>
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

EditUserProfileModal.propTypes = {
  currentUser: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
};
