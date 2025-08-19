import React from "react";
// Importa tu archivo CSS para aplicar los estilos del modal
import "../styles/modal.css"; 

export const ViewPdfModal = ({ url, onClose }) => {
  // Usamos el visor de Google para una solución simple y confiable
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    url
  )}&embedded=true`;

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        {/* Usamos un h2 con la clase 'modal-title' para coincidir con el CSS */}
        <h2 className="modal-title">Visualizar Documento</h2>
        {/* Cambiamos la clase del botón a 'close-button' para coincidir con el CSS */}
        <button className="close-button" onClick={onClose}>
          &times;
        </button>
        <div className="modal-body pdf-viewer">
          {/* El iframe para la visualización del PDF */}
          <iframe
            src={googleViewerUrl}
            title="Visualizador de PDF"
            width="100%"
            height="100%"
            frameBorder="0"
          ></iframe>
        </div>
      </div>
    </div>
  );
};