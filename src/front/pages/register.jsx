import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/register.css"; // Asegúrate de que esta ruta sea correcta para el nuevo CSS

export const Register = () => {
  const { dispatch } = useGlobalReducer();
  const navigate = useNavigate();
    
  const [formData, setFormData] = useState({
    // Datos del usuario (Usuario)
    nombre_completo: '',
    email: '',
    password: '',
    confirmar_password: '',
    telefono_personal: '', // <-- NUEVO CAMPO: Teléfono personal del usuario
    cargo: '',             // <-- NUEVO CAMPO: Cargo del usuario (texto libre)
    // Nota: El rol se asignará en el backend como 'owner' si es el primer registro

    // Datos de la empresa (Empresa)
    nombre_empresa: '',
    direccion: '',
    telefono: '',  // Teléfono de la empresa
    email_contacto: ''
  });
    
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // Para manejo de pasos

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
        
    // Limpiar errores cuando el usuario comience a escribir
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

  const validateStep1 = () => {
    const newErrors = {};
        
    if (!formData.nombre_completo.trim()) {
      newErrors.nombre_completo = 'El nombre completo es requerido';
    } else if (formData.nombre_completo.trim().length < 2) {
      newErrors.nombre_completo = 'El nombre debe tener al menos 2 caracteres';
    }
        
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }
        
    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else {
      const passwordErrors = validatePassword(formData.password);
      if (passwordErrors.length > 0) {
        newErrors.password = `La contraseña debe contener: ${passwordErrors.join(', ')}`;
      }
    }
        
    if (!formData.confirmar_password) {
      newErrors.confirmar_password = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmar_password) {
      newErrors.confirmar_password = 'Las contraseñas no coinciden';
    }
    
    // Validaciones para teléfono personal (opcional, pero si existe, puede tener formato)
    // No hay validación de formato aquí, ya que el backend lo acepta como texto libre.
    // Puedes añadirla si lo consideras necesario.

    // Validaciones para cargo (opcional, texto libre)
    // No hay validación aquí.

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
        
    if (!formData.nombre_empresa.trim()) {
      newErrors.nombre_empresa = 'El nombre de la empresa es requerido';
    } else if (formData.nombre_empresa.trim().length < 2) {
      newErrors.nombre_empresa = 'El nombre de la empresa debe tener al menos 2 caracteres';
    }
        
    // Email de contacto es opcional, pero si se proporciona debe ser válido
    if (formData.email_contacto.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_contacto)) {
      newErrors.email_contacto = 'El formato del email de contacto no es válido';
    }
        
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      setErrors({}); // Limpiar errores del paso anterior al avanzar
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setErrors({}); // Limpiar errores al retroceder
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
        
    // Validar ambos pasos antes de enviar
    if (!validateStep1() || !validateStep2()) {
      // Si falla la validación del paso 1, volvemos a él
      if (!validateStep1()) setCurrentStep(1);
      return;
    }
        
    setLoading(true);
        
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      const response = await fetch(`${backendUrl}/api/registro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Datos del usuario
          nombre_completo: formData.nombre_completo.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          telefono_personal: formData.telefono_personal.trim() || null, // <-- Incluye el nuevo campo
          cargo: formData.cargo.trim() || null,                     // <-- Incluye el nuevo campo
          // El rol no se envía desde aquí; el backend lo asignará.
          
          // Datos de la empresa
          nombre_empresa: formData.nombre_empresa.trim(),
          direccion: formData.direccion.trim() || null,
          telefono: formData.telefono.trim() || null, // Teléfono de la empresa
          email_contacto: formData.email_contacto.trim().toLowerCase() || null
        }),
      });
            
      const data = await response.json();
      
      console.log('Response status:', response.status);
      console.log('Response data:', data);
            
      if (response.ok) {
        dispatch({
          type: 'SET_MESSAGE',
          payload: {
            type: 'success',
            text: 'Usuario y empresa registrados exitosamente. Ahora puedes iniciar sesión.'
          }
        });
                
        navigate('/login');
      } else {
        setErrors({ general: data.error || 'Error en el registro' });
      }
    }
    catch (error) {
      console.error('Error completo:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '', color: '' };
        
    const errors = validatePassword(password);
    // Calcular la fuerza basada en el número de reglas cumplidas
    const strength = ((4 - errors.length) / 4) * 100; // 4 es el número total de reglas
        
    if (strength <= 25) {
      return { strength, text: 'Muy Débil', color: 'sgsst-register-progress-bar-danger' };
    } else if (strength <= 50) {
      return { strength, text: 'Débil', color: 'sgsst-register-progress-bar-warning' };
    } else if (strength <= 75) {
      return { strength, text: 'Media', color: 'sgsst-register-progress-bar-info' };
    } else if (strength < 100) { // Menos de 100 significa que alguna regla falta
      return { strength, text: 'Fuerte', color: 'sgsst-register-progress-bar-info' };
    } else { // strength === 100 (todas las reglas cumplidas)
      return { strength, text: 'Muy Fuerte', color: 'sgsst-register-progress-bar-success' };
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="sgsst-register-container">
        <div className="sgsst-register-left-panel">
            {/* Logo de SGSST FLOW */}
            <img src="/logo.svg" alt="SGSST FLOW Logo" className="sgsst-register-logo-image" />
            <h1 className="sgsst-register-welcome-headline">Únete a SGSST FLOW</h1>
            <p className="sgsst-register-welcome-text">
                Crea tu cuenta y la empresa principal para empezar a optimizar la gestión de seguridad y salud en el trabajo.
            </p>
            
            {/* Indicador de pasos */}
            <div className="sgsst-register-steps-indicator">
                <div className={`sgsst-register-step ${currentStep >= 1 ? 'active' : ''}`}>
                    <span>1</span>
                    <small>Datos Personales</small>
                </div>
                <div className="sgsst-register-step-line"></div> {/* Línea conectora */}
                <div className={`sgsst-register-step ${currentStep >= 2 ? 'active' : ''}`}>
                    <span>2</span>
                    <small>Datos Empresa</small>
                </div>
            </div>
        </div>
        
        <div className="sgsst-register-right-panel">
            <h2 className="sgsst-register-heading">
                {currentStep === 1 ? 'Crear Cuenta Principal' : 'Información de la Empresa Principal'}
            </h2>
            
            {errors.general && (
              <div className="sgsst-register-alert-danger" role="alert">
                {errors.general}
                <button 
                  type="button" 
                  className="sgsst-register-close-alert-btn" 
                  onClick={() => setErrors(prev => ({ ...prev, general: '' }))}
                >
                  &times;
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* PASO 1: Datos del Usuario */}
                {currentStep === 1 && (
                    <>
                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="nombre_completo" className="sgsst-register-form-label">
                                Nombre Completo <span className="sgsst-register-required-star">*</span>
                            </label>
                            <input
                                type="text"
                                className={`sgsst-register-input-field ${errors.nombre_completo ? 'is-invalid' : ''}`}
                                id="nombre_completo"
                                name="nombre_completo"
                                value={formData.nombre_completo}
                                onChange={handleChange}
                                placeholder="Tu nombre completo"
                                autoComplete="name"
                                required
                            />
                            {errors.nombre_completo && (
                                <div className="sgsst-register-invalid-feedback">{errors.nombre_completo}</div>
                            )}
                        </div>
                                        
                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="email" className="sgsst-register-form-label">
                                Correo Electrónico <span className="sgsst-register-required-star">*</span>
                            </label>
                            <input
                                type="email"
                                className={`sgsst-register-input-field ${errors.email ? 'is-invalid' : ''}`}
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="tu@email.com"
                                autoComplete="email"
                                required
                            />
                            {errors.email && (
                                <div className="sgsst-register-invalid-feedback">{errors.email}</div>
                            )}
                        </div>

                        {/* NUEVO CAMPO: Teléfono Personal */}
                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="telefono_personal" className="sgsst-register-form-label">
                                Teléfono Personal
                            </label>
                            <input
                                type="text"
                                className="sgsst-register-input-field"
                                id="telefono_personal"
                                name="telefono_personal"
                                value={formData.telefono_personal}
                                onChange={handleChange}
                                placeholder="Tu número de teléfono (opcional)"
                            />
                        </div>

                        {/* NUEVO CAMPO: Cargo */}
                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="cargo" className="sgsst-register-form-label">
                                Cargo
                            </label>
                            <input
                                type="text"
                                className="sgsst-register-input-field"
                                id="cargo"
                                name="cargo"
                                value={formData.cargo}
                                onChange={handleChange}
                                placeholder="Tu cargo en la empresa (opcional)"
                            />
                        </div>
                                        
                        <div className="sgsst-register-input-group-wrapper sgsst-register-password-input-wrapper">
                            <label htmlFor="password" className="sgsst-register-form-label">
                                Contraseña <span className="sgsst-register-required-star">*</span>
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`sgsst-register-input-field ${errors.password ? 'is-invalid' : ''}`}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Tu contraseña"
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="sgsst-register-toggle-password-visibility"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                                            
                            {formData.password && (
                                <div className="sgsst-register-password-strength-container">
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
                                            
                            {errors.password && (
                                <div className="sgsst-register-invalid-feedback">{errors.password}</div>
                            )}
                        </div>
                                        
                        <div className="sgsst-register-input-group-wrapper sgsst-register-password-input-wrapper">
                            <label htmlFor="confirmar_password" className="sgsst-register-form-label">
                                Confirmar Contraseña <span className="sgsst-register-required-star">*</span>
                            </label>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                className={`sgsst-register-input-field ${errors.confirmar_password ? 'is-invalid' : ''}`}
                                id="confirmar_password"
                                name="confirmar_password"
                                value={formData.confirmar_password}
                                onChange={handleChange}
                                placeholder="Confirma tu contraseña"
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="sgsst-register-toggle-password-visibility"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? '🙈' : '👁️'}
                            </button>
                            {errors.confirmar_password && (
                                <div className="sgsst-register-invalid-feedback">{errors.confirmar_password}</div>
                            )}
                        </div>
                        
                        <button type="button" className="sgsst-register-button" onClick={handleNextStep}>
                            Siguiente
                        </button>
                    </>
                )}

                {/* PASO 2: Datos de la Empresa */}
                {currentStep === 2 && (
                    <>
                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="nombre_empresa" className="sgsst-register-form-label">
                                Nombre de la Empresa Principal <span className="sgsst-register-required-star">*</span>
                            </label>
                            <input
                                type="text"
                                className={`sgsst-register-input-field ${errors.nombre_empresa ? 'is-invalid' : ''}`}
                                id="nombre_empresa"
                                name="nombre_empresa"
                                value={formData.nombre_empresa}
                                onChange={handleChange}
                                placeholder="Nombre de tu empresa (ej. SGSST FLOW)"
                                required
                            />
                            {errors.nombre_empresa && (
                                <div className="sgsst-register-invalid-feedback">{errors.nombre_empresa}</div>
                            )}
                        </div>

                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="direccion" className="sgsst-register-form-label">
                                Dirección de la Empresa
                            </label>
                            <input
                                type="text"
                                className="sgsst-register-input-field"
                                id="direccion"
                                name="direccion"
                                value={formData.direccion}
                                onChange={handleChange}
                                placeholder="Dirección de tu empresa (opcional)"
                            />
                        </div>

                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="telefono" className="sgsst-register-form-label">
                                Teléfono de la Empresa
                            </label>
                            <input
                                type="text"
                                className="sgsst-register-input-field"
                                id="telefono"
                                name="telefono"
                                value={formData.telefono}
                                onChange={handleChange}
                                placeholder="Teléfono de contacto (opcional)"
                            />
                        </div>

                        <div className="sgsst-register-input-group-wrapper">
                            <label htmlFor="email_contacto" className="sgsst-register-form-label">
                                Email de Contacto de la Empresa
                            </label>
                            <input
                                type="email"
                                className={`sgsst-register-input-field ${errors.email_contacto ? 'is-invalid' : ''}`}
                                id="email_contacto"
                                name="email_contacto"
                                value={formData.email_contacto}
                                onChange={handleChange}
                                placeholder="Email de contacto de la empresa (opcional)"
                            />
                            {errors.email_contacto && (
                                <div className="sgsst-register-invalid-feedback">{errors.email_contacto}</div>
                            )}
                        </div>

                        <div className="sgsst-register-navigation-buttons">
                            <button type="button" className="sgsst-register-button sgsst-register-button-secondary" onClick={handlePreviousStep}>
                                Atrás
                            </button>
                            <button type="submit" className="sgsst-register-button" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="sgsst-register-spinner"></span>
                                        Registrando...
                                    </>
                                ) : (
                                    'Crear Cuenta'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </form>
                            
            <p className="sgsst-register-signup-text">
                ¿Ya tienes una cuenta? <Link to="/login" className="sgsst-register-signup-link">Iniciar Sesión</Link>
            </p>
        </div>
    </div>
  );
};

export default Register;