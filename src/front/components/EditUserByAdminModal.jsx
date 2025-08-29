import React, { useState, useEffect } from 'react';
import "../styles/formModal.css";

export const EditUserByAdminModal = ({ userToEdit, onClose, onUpdateSuccess }) => {
    // Inicializar estados con los datos del usuario a editar
    const [nombre_completo, setNombreCompleto] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [cargo, setCargo] = useState('');
    const [telefono_personal, setTelefonoPersonal] = useState('');
    const [rol, setRol] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (userToEdit) {
            setNombreCompleto(userToEdit.nombre_completo || '');
            setEmail(userToEdit.email || '');
            setCargo(userToEdit.cargo || '');
            setTelefonoPersonal(userToEdit.telefono_personal || '');
            setRol(userToEdit.rol || 'usuario_formulario'); // Establecer el rol por defecto
        }
    }, [userToEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('access_token');
        if (!token) {
            setError('No se encontró el token de autenticación.');
            setLoading(false);
            return;
        }

        const payload = {
            nombre_completo,
            email,
            cargo,
            telefono_personal,
            rol // El rol ahora es editable por el admin
        };

        if (password) {
            payload.password = password;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios/${userToEdit.id_usuario}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                onUpdateSuccess(data.usuario);
                onClose();
            } else {
                setError(data.error || 'Error al actualizar el perfil del usuario. Por favor, intenta de nuevo.');
            }
        } catch (err) {
            console.error('Error de conexión:', err);
            setError('Error de conexión. Por favor, revisa tu red.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h2>Editar Usuario: {userToEdit?.nombre_completo}</h2>
                <form onSubmit={handleSubmit}>
                    {error && <p className="error-message">{error}</p>}
                    <div className="form-group">
                        <label htmlFor="nombre_completo">Nombre Completo:</label>
                        <input
                            type="text"
                            id="nombre_completo"
                            name="nombre_completo"
                            value={nombre_completo}
                            onChange={(e) => setNombreCompleto(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="cargo">Cargo:</label>
                        <input
                            type="text"
                            id="cargo"
                            name="cargo"
                            value={cargo}
                            onChange={(e) => setCargo(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="telefono_personal">Teléfono Personal:</label>
                        <input
                            type="tel"
                            id="telefono_personal"
                            name="telefono_personal"
                            value={telefono_personal}
                            onChange={(e) => setTelefonoPersonal(e.target.value)}
                        />
                    </div>
                     <div className="form-group">
                        <label htmlFor="rol">Rol:</label>
                        <select
                            id="rol"
                            name="rol"
                            value={rol}
                            onChange={(e) => setRol(e.target.value)}
                            required
                        >
                            <option value="usuario_formulario">Usuario</option>
                            <option value="admin_empresa">Admin Empresa</option>
                        </select>
                    </div>
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