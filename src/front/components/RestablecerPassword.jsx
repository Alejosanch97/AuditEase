// src/components/RestablecerPassword.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/login.css";

export const RestablecerPassword = () => {
    const { dispatch, store } = useGlobalReducer();
    const { token } = useParams();
    const navigate = useNavigate();
    const [nuevaPassword, setNuevaPassword] = useState('');
    const [confirmarPassword, setConfirmarPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        dispatch({ type: 'SET_MESSAGE', payload: null });

        if (nuevaPassword !== confirmarPassword) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Las contraseñas no coinciden.' } });
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/restablecer-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, nueva_password: nuevaPassword, confirmar_password: confirmarPassword })
            });

            const data = await response.json();
            
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
                
                // Redirigimos al login después de un breve retraso
                setTimeout(() => {
                    navigate("/login");
                }, 3000); 

            } else {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || data.message || 'El token de recuperación es inválido o ha expirado.' } });
            }
        } catch (error) {
            console.error('Error al restablecer la contraseña:', error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión. Intenta nuevamente.' } });
        } finally {
            setLoading(false);
        }
    };

    // Opcional: limpiar el mensaje cuando se carga el componente
    useEffect(() => {
        dispatch({ type: 'SET_MESSAGE', payload: null });
    }, [dispatch]);
    
    // Opcional: mostrar un mensaje si no hay token
    useEffect(() => {
        if (!token) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Token no encontrado. El enlace de recuperación es inválido.' } });
        }
    }, [token, dispatch]);

    const currentMessage = store.message;

    return (
        <div className="sgsst-login-container">
            <div className="sgsst-login-left-panel">
                <img src="/logo.svg" alt="SGSST FLOW Logo" className="sgsst-login-logo-image" />
                <h1 className="sgsst-login-welcome-headline">Restablecer Contraseña</h1>
                <p className="sgsst-login-welcome-text">
                    Ingresa tu nueva contraseña para acceder a tu cuenta.
                </p>
            </div>
            <div className="sgsst-login-right-panel">
                <h2 className="sgsst-login-heading">Nueva Contraseña</h2>

                {currentMessage && (
                    <div className={`sgsst-login-alert-${currentMessage.type === 'error' ? 'danger' : 'success'}`} role="alert">
                        {currentMessage.text}
                        <button 
                            type="button" 
                            className="sgsst-login-close-alert-btn" 
                            onClick={() => dispatch({ type: 'SET_MESSAGE', payload: null })}
                        >
                            &times;
                        </button>
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div className="sgsst-login-input-group-wrapper">
                        <label htmlFor="nuevaPassword">Nueva Contraseña</label>
                        <input
                            type="password"
                            className="sgsst-login-input-field"
                            id="nuevaPassword"
                            value={nuevaPassword}
                            onChange={(e) => setNuevaPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
                            required
                        />
                    </div>
                    <div className="sgsst-login-input-group-wrapper">
                        <label htmlFor="confirmarPassword">Confirmar Contraseña</label>
                        <input
                            type="password"
                            className="sgsst-login-input-field"
                            id="confirmarPassword"
                            value={confirmarPassword}
                            onChange={(e) => setConfirmarPassword(e.target.value)}
                            placeholder="Repite tu nueva contraseña"
                            required
                        />
                    </div>
                    <button type="submit" className="sgsst-login-button" disabled={loading || !token}>
                        {loading ? (
                            <>
                                <span className="sgsst-login-spinner"></span>
                                Restableciendo...
                            </>
                        ) : (
                            'Restablecer Contraseña'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};