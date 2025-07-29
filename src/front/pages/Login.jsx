// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/login.css"; // Asegúrate de que esta ruta sea correcta

export const Login = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Función de redirección centralizada
  const handleRedirect = (user) => {
    if (user.cambio_password_requerido) {
      navigate('/cambiar-contrasena-inicial');
    } else if (user.rol === 'owner') {
      navigate('/profile'); // La página actual para el owner
    } else if (user.rol === 'admin_empresa' || user.rol === 'usuario_formulario') {
      navigate('/usersprofile'); // La nueva página para admins/usuarios de empresa
    }
  };

  // Verificar si ya está autenticado y determinar a dónde redirigir
  useEffect(() => {
    // Si ya estamos logeados y tenemos los datos del usuario en el store, redirigimos
    if (store.isLoggedIn && store.user) {
      handleRedirect(store.user);
      return; // Salir para evitar doble ejecución
    }

    // Si no estamos logeados pero hay un token en localStorage, intentamos verificarlo
    const token = localStorage.getItem('access_token');
    if (token && !store.user) {
      const fetchUserProfile = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/verificar-token`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();

          if (response.ok && data.valid) {
            dispatch({
              type: 'SET_USER',
              payload: data.usuario
            });
            // Una vez el usuario se ha establecido en el store, redirigimos
            handleRedirect(data.usuario);
          } else {
            // Token inválido o usuario inactivo
            localStorage.removeItem('access_token');
            dispatch({ type: 'LOGOUT' });
            // Opcional: mostrar un mensaje de error si el usuario estaba inactivo
            if (data.error) {
              dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error } });
            }
          }
        } catch (error) {
          console.error('Error al verificar el token:', error);
          localStorage.removeItem('access_token');
          dispatch({ type: 'LOGOUT' });
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Sesión expirada o error de conexión.' } });
        }
      };
      fetchUserProfile();
    }
  }, [store.isLoggedIn, store.user, navigate, dispatch]); // Dependencias del useEffect

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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);

        dispatch({
          type: 'SET_USER',
          payload: data.usuario // data.usuario contendrá el flag 'cambio_password_requerido'
        });

        // Redirigir basado en el nuevo estado del usuario
        handleRedirect(data.usuario);

      } else {
        // En caso de error de login, data.error contendrá el mensaje del backend
        setErrors({ general: data.error || 'Error en el login' });
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sgsst-login-container">
        <div className="sgsst-login-left-panel">
            <img src="/logo.svg" alt="SGSST FLOW Logo" className="sgsst-login-logo-image" />
            <h1 className="sgsst-login-welcome-headline">Bienvenido a SGSST FLOW</h1>
            <p className="sgsst-login-welcome-text">Tu solución integral para la gestión de seguridad y salud en el trabajo.</p>
        </div>
        <div className="sgsst-login-right-panel">
            <h2 className="sgsst-login-heading">Iniciar Sesión</h2>

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
                <div className="sgsst-login-input-group-wrapper">
                    <input
                        type="email"
                        placeholder="Correo Electrónico"
                        className={`sgsst-login-input-field ${errors.email ? 'is-invalid' : ''}`}
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                    />
                    {errors.email && (
                        <div className="sgsst-login-invalid-feedback">{errors.email}</div>
                    )}
                </div>

                <div className="sgsst-login-input-group-wrapper sgsst-login-password-input-wrapper">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Contraseña"
                        className={`sgsst-login-input-field ${errors.password ? 'is-invalid' : ''}`}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="current-password"
                        required
                    />
                    <button
                        type="button"
                        className="sgsst-login-toggle-password-visibility"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? '🙈' : '👁️'}
                    </button>
                    {errors.password && (
                        <div className="sgsst-login-invalid-feedback">{errors.password}</div>
                    )}
                </div>

                <div className="sgsst-login-forgot-password-link-container">
                    <Link to="/recuperar-password" className="sgsst-login-forgot-password-link">
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>

                <button type="submit" className="sgsst-login-button" disabled={loading}>
                    {loading ? (
                        <>
                            <span className="sgsst-login-spinner"></span>
                            Iniciando sesión...
                        </>
                    ) : (
                        'Entrar'
                    )}
                </button>
            </form>

            <p className="sgsst-login-signup-text">
                ¿No tienes una cuenta? <Link to="/register" className="sgsst-login-signup-link">Regístrate ahora</Link>
            </p>
        </div>
    </div>
  );
};

export default Login;