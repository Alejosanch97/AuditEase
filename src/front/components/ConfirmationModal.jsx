// src/components/ConfirmationModal.jsx
import React from 'react';
import "../styles/confirmationModal.css"; // Importa el CSS específico para confirmación

export const ConfirmationModal = ({ message, onConfirm, onCancel }) => {
  return (
    // Usamos la nueva clase para el overlay de confirmación
    <div className="confirmation-modal-overlay active">
      {/* Usamos la nueva clase para el contenido del modal de confirmación */}
      <div className="confirmation-modal-content">
        <div className="confirmation-modal-header">
          <h2>Confirmar Acción</h2>
          {/* Usamos la nueva clase para el botón de cerrar */}
          <button className="confirmation-modal-close-btn" onClick={onCancel}>&times;</button>
        </div>
        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirmation-modal-actions">
          {/* Usamos las nuevas clases de botón específicas para confirmación */}
          <button className="btn-confirm" onClick={onConfirm}>Confirmar</button>
          <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};
