// src/components/InitialPasswordChange.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/login.css"; // Puedes reutilizar los estilos de login o crear uno nuevo

export const InitialPasswordChange = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nueva_password: '',
    confirmar_password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirigir si el usuario no necesita cambiar la contraseña o no está logeado
  // Opcional: si quieres forzar a cambiar la contraseña si el flag está en true
  // y el usuario llega aquí directamente.
  if (!store.isLoggedIn || !store.requiresPasswordChange) {
    // Si no está logeado o no necesita cambiar contraseña, redirige al login o a la página principal
    // Considera si quieres que un usuario logeado que *no* necesita cambiar la contraseña
    // pueda acceder a esta ruta. Por ahora, asumimos que no debería.
    navigate('/login');
    return null; // No renderizar nada mientras se redirige
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('una minúscula');
    }
    if (!/\d/.test(password)) {
      errors.push('un número');
    }
    return errors;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nueva_password) {
      newErrors.nueva_password = 'La nueva contraseña es requerida';
    } else {
      const passwordErrors = validatePassword(formData.nueva_password);
      if (passwordErrors.length > 0) {
        newErrors.nueva_password = `La contraseña debe contener: ${passwordErrors.join(', ')}`;
      }
    }

    if (!formData.confirmar_password) {
      newErrors.confirmar_password = 'Confirma tu nueva contraseña';
    } else if (formData.nueva_password !== formData.confirmar_password) {
      newErrors.confirmar_password = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({}); // Limpiar errores previos

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${backendUrl}/api/cambiar-password-inicial`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Envía el token del usuario logeado
        },
        body: JSON.stringify({
          nueva_password: formData.nueva_password,
          confirmar_password: formData.confirmar_password // Aunque el backend no lo pide explícitamente, es buena práctica validarlo aquí.
        }),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({
          type: 'SET_MESSAGE',
          payload: { type: 'success', text: 'Contraseña actualizada exitosamente. Por favor, inicia sesión con tu nueva contraseña.' }
        });
        // Actualiza el estado del store para que el flag de cambio de contraseña sea falso
        dispatch({ type: 'SET_PASSWORD_CHANGE_REQUIRED', payload: false });
        // Limpiamos el token viejo y redirigimos al login para que el usuario inicie sesión con la nueva contraseña
        localStorage.removeItem('access_token');
        dispatch({ type: 'LOGOUT' }); // Esto limpia el estado del usuario en el store
        navigate('/login');
      } else {
        setErrors({ general: data.error || 'Error al cambiar la contraseña inicial.' });
      }
    } catch (error) {
      console.error('Error al cambiar la contraseña inicial:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '', color: '' };
        
    const errors = validatePassword(password);
    const strength = ((4 - errors.length) / 4) * 100;
        
    if (strength <= 25) {
      return { strength, text: 'Muy Débil', color: 'sgsst-register-progress-bar-danger' };
    } else if (strength <= 50) {
      return { strength, text: 'Débil', color: 'sgsst-register-progress-bar-warning' };
    } else if (strength <= 75) {
      return { strength, text: 'Media', color: 'sgsst-register-progress-bar-info' };
    } else if (strength < 100) {
      return { strength, text: 'Fuerte', color: 'sgsst-register-progress-bar-info' };
    } else {
      return { strength, text: 'Muy Fuerte', color: 'sgsst-register-progress-bar-success' };
    }
  };
  const passwordStrength = getPasswordStrength(formData.nueva_password);


  return (
    <div className="sgsst-login-container"> {/* Reutilizamos la clase de estilo de login */}
        <div className="sgsst-login-left-panel">
            <img src="/logo.svg" alt="SGSST FLOW Logo" className="sgsst-login-logo-image" />
            <h1 className="sgsst-login-welcome-headline">Actualiza tu Contraseña</h1>
            <p className="sgsst-login-welcome-text">
                Para tu seguridad, por favor establece una nueva contraseña.
            </p>
        </div>
        <div className="sgsst-login-right-panel">
            <h2 className="sgsst-login-heading">Cambiar Contraseña Inicial</h2>
            
            {errors.general && (
              <div className="sgsst-login-alert-danger" role="alert">
                {errors.general}
                <button 
                  type="button" 
                  className="sgsst-login-close-alert-btn" 
                  onClick={() => setErrors(prev => ({ ...prev, general: '' }))}
                >
                  &times;
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="sgsst-login-input-group-wrapper sgsst-login-password-input-wrapper">
                    <label htmlFor="nueva_password" className="sgsst-login-form-label">Nueva Contraseña <span className="sgsst-login-required-star">*</span></label>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        className={`sgsst-login-input-field ${errors.nueva_password ? 'is-invalid' : ''}`}
                        id="nueva_password"
                        name="nueva_password"
                        value={formData.nueva_password}
                        onChange={handleChange}
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                        required
                    />
                    <button
                        type="button"
                        className="sgsst-login-toggle-password-visibility"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? '🙈' : '👁️'}
                    </button>
                    {formData.nueva_password && (
                        <div className="sgsst-register-password-strength-container"> {/* Reutiliza esta clase */}
                            <div className="sgsst-register-progress">
                                <div
                                    className={`sgsst-register-progress-bar ${passwordStrength.color}`}
                                    style={{ width: `${passwordStrength.strength}%` }}
                                ></div>
                            </div>
                            <small className="sgsst-register-text-muted">
                                Fortaleza: {passwordStrength.text}
                            </small>
                        </div>
                    )}
                    {errors.nueva_password && (
                        <div className="sgsst-login-invalid-feedback">{errors.nueva_password}</div>
                    )}
                </div>
                
                <div className="sgsst-login-input-group-wrapper sgsst-login-password-input-wrapper">
                    <label htmlFor="confirmar_password" className="sgsst-login-form-label">Confirmar Nueva Contraseña <span className="sgsst-login-required-star">*</span></label>
                    <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`sgsst-login-input-field ${errors.confirmar_password ? 'is-invalid' : ''}`}
                        id="confirmar_password"
                        name="confirmar_password"
                        value={formData.confirmar_password}
                        onChange={handleChange}
                        placeholder="Confirma la nueva contraseña"
                        autoComplete="new-password"
                        required
                    />
                    <button
                        type="button"
                        className="sgsst-login-toggle-password-visibility"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                    {errors.confirmar_password && (
                        <div className="sgsst-login-invalid-feedback">{errors.confirmar_password}</div>
                    )}
                </div>
                
                <button type="submit" className="sgsst-login-button" disabled={loading}>
                    {loading ? (
                        <>
                            <span className="sgsst-login-spinner"></span>
                            Actualizando...
                        </>
                    ) : (
                        'Cambiar Contraseña'
                    )}
                </button>
            </form>
        </div>
    </div>
  );
};