import React, { useState } from 'react';

export const CreateCategoryModal = ({ onClose, onCreate }) => {
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (nombre.trim() === '') {
            setError('El nombre de la categoría es obligatorio.');
            return;
        }
        onCreate(nombre, descripcion);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Crear Nueva Categoría</h2>
                <button className="close-button" onClick={onClose}>&times;</button>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label htmlFor="nombre">Nombre de la Categoría:</label>
                        <input
                            type="text"
                            id="nombre"
                            value={nombre}
                            onChange={(e) => {
                                setNombre(e.target.value);
                                setError('');
                            }}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="descripcion">Descripción (opcional):</label>
                        <textarea
                            id="descripcion"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary">Crear</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};