import React, { useState } from 'react';

export const UploadDocumentoModal = ({ onClose, onUpload, selectedCategoryId }) => {
    const [titulo, setTitulo] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validaciones del formulario
        if (!titulo.trim()) {
            setError('El título del documento es obligatorio.');
            return;
        }
        if (!file) {
            setError('Debes adjuntar un archivo PDF.');
            return;
        }
        if (file.type !== 'application/pdf') {
            setError('Solo se permiten archivos PDF.');
            return;
        }
        
        // Llamada a la función de subida usando la categoría que se pasó como prop
        setError('');
        onUpload(titulo, file, selectedCategoryId);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Subir Nuevo Documento</h2>
                <button className="close-button" onClick={onClose}>&times;</button>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="titulo">Título del Documento:</label>
                        <input
                            id="titulo"
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Escribe el título aquí"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="documento_pdf">Seleccionar Archivo PDF:</label>
                        <input
                            id="documento_pdf"
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setFile(e.target.files[0])}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary">Subir</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};