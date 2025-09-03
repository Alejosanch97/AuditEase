import React, { useState } from 'react';

export const UploadDocumentoModal = ({ onClose, selectedCategoryId }) => {
    const [titulo, setTitulo] = useState('');
    const [file, setFile] = useState(null);
    const [url, setUrl] = useState('');
    const [uploadType, setUploadType] = useState('pdf'); // Estado para 'pdf' o 'link'
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const token = localStorage.getItem('access_token');

        if (!titulo.trim()) {
            setError('El título del documento es obligatorio.');
            setLoading(false);
            return;
        }

        let bodyData;
        let urlEndpoint;
        let headers = { 'Authorization': `Bearer ${token}` };

        if (uploadType === 'link') {
            if (!url.trim()) {
                setError('La URL del documento es obligatoria.');
                setLoading(false);
                return;
            }
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                setError('La URL debe ser un enlace válido.');
                setLoading(false);
                return;
            }

            urlEndpoint = `${import.meta.env.VITE_BACKEND_URL}/api/documentos-ministerio/upload-link`;
            bodyData = JSON.stringify({
                titulo,
                url_archivo: url,
                categoria_id: selectedCategoryId,
            });
            headers['Content-Type'] = 'application/json';

        } else { // uploadType === 'pdf'
            if (!file) {
                setError('Debes adjuntar un archivo PDF.');
                setLoading(false);
                return;
            }
            if (file.type !== 'application/pdf') {
                setError('Solo se permiten archivos PDF.');
                setLoading(false);
                return;
            }

            urlEndpoint = `${import.meta.env.VITE_BACKEND_URL}/api/documentos-ministerio/upload-pdf`;
            bodyData = new FormData();
            bodyData.append('titulo', titulo);
            bodyData.append('documento_pdf', file);
            bodyData.append('categoria_id', selectedCategoryId);
        }

        try {
            const response = await fetch(urlEndpoint, {
                method: 'POST',
                headers: headers,
                body: bodyData,
            });
            const data = await response.json();
            if (response.ok) {
                // Aquí podrías querer llamar a una función para actualizar el estado global
                // o simplemente refrescar los documentos después de una subida exitosa.
                // Como ya tenemos una prop onClose, podemos usarla para disparar la recarga en el padre.
                onClose(true); // Pasamos true para indicar que hubo éxito y recargar
            } else {
                throw new Error(data.error || "Error al subir el documento");
            }
        } catch (error) {
            console.error("Error uploading document:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Subir Nuevo Documento</h2>
                <button className="close-button" onClick={() => onClose(false)}>&times;</button>
                {error && <p className="error-message">{error}</p>}

                {/* Selector de tipo de subida */}
                <div className="upload-type-selector">
                    <button 
                        type="button"
                        className={`selector-button ${uploadType === 'pdf' ? 'active' : ''}`}
                        onClick={() => setUploadType('pdf')}
                    >
                        Subir Archivo PDF
                    </button>
                    <button
                        type="button"
                        className={`selector-button ${uploadType === 'link' ? 'active' : ''}`}
                        onClick={() => setUploadType('link')}
                    >
                        Subir con URL
                    </button>
                </div>

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

                    {/* Muestra el campo de entrada de archivo O el de URL de forma condicional */}
                    {uploadType === 'link' ? (
                        <div className="form-group">
                            <label htmlFor="documento_url">Ingresar URL:</label>
                            <input
                                id="documento_url"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://docs.google.com/..."
                                required
                            />
                        </div>
                    ) : (
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
                    )}

                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Subiendo...' : 'Subir'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => onClose(false)} disabled={loading}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};