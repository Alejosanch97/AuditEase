// src/components/EditUserProfileModal.jsx (Corregido)
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import "../styles/formModal.css";

export const EditUserProfileModal = ({ currentUser, onClose, onUpdateSuccess }) => {
  const [formData, setFormData] = useState({
    nombre_completo: currentUser.nombre_completo || '',
    email: currentUser.email || '',
    telefono_personal: currentUser.telefono_personal || '',
    cargo: currentUser.cargo || '',
  });

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewProfileImage, setPreviewProfileImage] = useState(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");
  const [signatureFile, setSignatureFile] = useState(null);
  const [previewSignature, setPreviewSignature] = useState(currentUser.firma_digital_url || null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    setFormData({
      nombre_completo: currentUser.nombre_completo || '',
      email: currentUser.email || '',
      telefono_personal: currentUser.telefono_personal || '',
      cargo: currentUser.cargo || '',
    });
    setPreviewProfileImage(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");
    setPreviewSignature(currentUser.firma_digital_url || null);
    setProfileImageFile(null);
    setSignatureFile(null);
    setSuccessMessage(null);
    setError(null);
  }, [currentUser]);

  useEffect(() => {
    if (profileImageFile) {
      const reader = new FileReader();
      reader.onloadend = () => { setPreviewProfileImage(reader.result); };
      reader.readAsDataURL(profileImageFile);
    } else {
      setPreviewProfileImage(currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV");
    }
  }, [profileImageFile, currentUser.imagen_perfil_url]);

  useEffect(() => {
    if (signatureFile) {
      const reader = new FileReader();
      reader.onloadend = () => { setPreviewSignature(reader.result); };
      reader.readAsDataURL(signatureFile);
    } else {
      setPreviewSignature(currentUser.firma_digital_url || null);
    }
  }, [signatureFile, currentUser.firma_digital_url]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileImageFileChange = (e) => {
    setProfileImageFile(e.target.files[0] || null);
  };

  const handleSignatureFileChange = (e) => {
    setSignatureFile(e.target.files[0] || null);
  };

  const handleClearProfileImage = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/imagen-perfil`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_image: true }),
      });
      const result = await response.json();
      if (response.ok) {
        setProfileImageFile(null);
        setPreviewProfileImage("https://placehold.co/130x130/1abc9c/ffffff?text=HV");
        setSuccessMessage(result.message);
        onUpdateSuccess({ ...currentUser, imagen_perfil_url: null });
      } else {
        setError(result.error || "Error al eliminar la imagen de perfil.");
      }
    } catch (err) {
      console.error("Error al eliminar la imagen de perfil:", err);
      setError("Error de conexión o del servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/firma`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_signature: true }),
      });
      const result = await response.json();
      if (response.ok) {
        setSignatureFile(null);
        setPreviewSignature(null);
        setSuccessMessage(result.message);
        onUpdateSuccess({ ...currentUser, firma_digital_url: null });
      } else {
        setError(result.error || "Error al eliminar la firma digital.");
      }
    } catch (err) {
      console.error("Error al eliminar la firma digital:", err);
      setError("Error de conexión o del servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("No hay token de autenticación.");
      setLoading(false);
      return;
    }

    let updatedUser = { ...currentUser };

    try {
      // 1. Actualizar datos de perfil de texto
      const textResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      const textResult = await textResponse.json();
      if (textResponse.ok) {
        updatedUser = { ...updatedUser, ...textResult.usuario };
      } else {
        setError(textResult.error);
        setLoading(false);
        return;
      }

      // 2. Subir imagen de perfil
      if (profileImageFile) {
        const imageData = new FormData();
        imageData.append('imagen_perfil', profileImageFile);
        const imageResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/imagen-perfil`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
          body: imageData,
        });
        const imageResult = await imageResponse.json();
        if (imageResponse.ok) {
          updatedUser.imagen_perfil_url = imageResult.imagen_perfil_url;
        } else {
          setError(imageResult.error);
          setLoading(false);
          return;
        }
      }

      // 3. Subir firma digital
      if (signatureFile) {
        const signatureData = new FormData();
        signatureData.append('firma_digital', signatureFile);
        const signatureResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/perfil/firma`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
          body: signatureData,
        });
        const signatureResult = await signatureResponse.json();
        if (signatureResponse.ok) {
          updatedUser.firma_digital_url = signatureResult.firma_url;
        } else {
          setError(signatureResult.error);
          setLoading(false);
          return;
        }
      }

      setSuccessMessage("Perfil actualizado exitosamente.");
      onUpdateSuccess(updatedUser);
      setProfileImageFile(null);
      setSignatureFile(null);

    } catch (err) {
      console.error("Error en la solicitud de actualización:", err);
      setError("Error de conexión o del servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Editar Perfil</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre_completo">Nombre Completo:</label>
            <input type="text" id="nombre_completo" name="nombre_completo" value={formData.nombre_completo} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="telefono_personal">Teléfono Personal:</label>
            <input type="text" id="telefono_personal" name="telefono_personal" value={formData.telefono_personal} onChange={handleChange} placeholder="Ej. +XX XXXXXXXXX" />
          </div>
          <div className="form-group">
            <label htmlFor="cargo">Cargo:</label>
            <input type="text" id="cargo" name="cargo" value={formData.cargo} onChange={handleChange} placeholder="Ej. Gerente, Analista SST" />
          </div>
          <div className="form-group">
            <label htmlFor="imagen_perfil">Imagen de Perfil:</label>
            <input type="file" id="imagen_perfil" name="imagen_perfil" accept="image/*" onChange={handleProfileImageFileChange} />
            {previewProfileImage && (<img src={previewProfileImage} alt="Vista previa" className="profile-image-preview" style={{ maxWidth: '130px', maxHeight: '130px', marginTop: '10px', borderRadius: '50%', objectFit: 'cover' }} />)}
            {currentUser.imagen_perfil_url && !profileImageFile && (<button type="button" className="btn-remove-image" onClick={handleClearProfileImage} disabled={loading}>Eliminar Imagen Actual</button>)}
          </div>
          <div className="form-group">
            <label htmlFor="firma_digital">Firma Digital:</label>
            <input type="file" id="firma_digital" name="firma_digital" accept="image/*" onChange={handleSignatureFileChange} />
            {previewSignature && (<img src={previewSignature} alt="Vista previa Firma" className="signature-preview" style={{ maxWidth: '150px', maxHeight: '80px', marginTop: '10px', border: '1px solid #ccc', objectFit: 'contain' }} />)}
            {currentUser.firma_digital_url && !signatureFile && (<button type="button" className="btn-remove-image" onClick={handleClearSignature} disabled={loading}>Eliminar Firma Actual</button>)}
          </div>
          {error && <p className="error-message">{error}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
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