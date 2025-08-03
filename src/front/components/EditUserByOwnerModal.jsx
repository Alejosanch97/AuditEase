
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import "../styles/formModal.css";

export const EditUserByOwnerModal = ({ userToEdit, onClose, onUpdateSuccess }) => {
  const [formData, setFormData] = useState({
    nombre_completo: userToEdit.nombre_completo || '',
    email: userToEdit.email || '',
    telefono_personal: userToEdit.telefono_personal || '',
    cargo: userToEdit.cargo || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    setFormData({
      nombre_completo: userToEdit.nombre_completo || '',
      email: userToEdit.email || '',
      telefono_personal: userToEdit.telefono_personal || '',
      cargo: userToEdit.cargo || '',
    });
    setSuccessMessage(null);
    setError(null);
  }, [userToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios/${userToEdit.id_usuario}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage(result.message);
        onUpdateSuccess(result.usuario);
      } else {
        setError(result.error || "Error al actualizar el usuario.");
      }
    } catch (err) {
      console.error("Error al actualizar usuario por owner:", err);
      setError("Error de conexión o del servidor. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Editar Usuario: {userToEdit.nombre_completo}</h2>
        <form onSubmit={handleSubmit}>
          {/* Campos de texto para la edición */}
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

EditUserByOwnerModal.propTypes = {
  userToEdit: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
};