// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/login.css";

export const ForgotPassword = () => {
  const { dispatch, store } = useGlobalReducer();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Por favor, ingresa tu correo electrónico.' } });
      setLoading(false);
      return;
    }

    try {
      // Limpiamos los mensajes anteriores
      dispatch({ type: 'SET_MESSAGE', payload: null });

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/solicitar-recuperacion-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      // El backend siempre devuelve 200 y un mensaje informativo, incluso si el email no existe
      dispatch({
        type: 'SET_MESSAGE',
        payload: { type: 'success', text: data.message }
      });
      setEmail('');
    } catch (error) {
      console.error('Error al solicitar recuperación:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión. Intenta nuevamente.' } });
    } finally {
      setLoading(false);
    }
  };

  const currentMessage = store.message;

  return (
    <div className="sgsst-login-container">
        <div className="sgsst-login-left-panel">
            <img src="/logo.svg" alt="SGSST FLOW Logo" className="sgsst-login-logo-image" />
            <h1 className="sgsst-login-welcome-headline">¿Olvidaste tu Contraseña?</h1>
            <p className="sgsst-login-welcome-text">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
            </p>
        </div>
        <div className="sgsst-login-right-panel">
            <h2 className="sgsst-login-heading">Recuperar Contraseña</h2>
            
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
                    <label htmlFor="email" className="sgsst-login-form-label">Correo Electrónico</label>
                    <input
                        type="email"
                        className="sgsst-login-input-field"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Tu correo electrónico"
                        required
                    />
                </div>
                
                <button type="submit" className="sgsst-login-button" disabled={loading}>
                    {loading ? (
                        <>
                            <span className="sgsst-login-spinner"></span>
                            Enviando...
                        </>
                    ) : (
                        'Enviar Enlace de Recuperación'
                    )}
                </button>
            </form>
        </div>
    </div>
  );
};