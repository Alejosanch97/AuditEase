// src/components/UserCompanyManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/userCompanyManagement.css"; // Este CSS ahora será exclusivo para este componente
// Asegúrate de tener Font Awesome configurado en tu proyecto (por CDN en index.html o como paquete npm)
// Ejemplo de CDN en index.html: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

export const UserCompanyManagement = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]); // Estado para almacenar las empresas del owner
  const [selectedCompanyId, setSelectedCompanyId] = useState(''); // Para la creación de usuarios
  const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

  const [companyFormData, setCompanyFormData] = useState({
    nombre_empresa: '',
    direccion: '',
    telefono: '',
    email_contacto: ''
  });
  const [userFormData, setUserFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '', // Contraseña inicial para el nuevo usuario
    confirmar_password: '',
    telefono_personal: '',
    cargo: '',
    rol: 'admin_empresa' // Rol por defecto, el owner solo crearía admin_empresa o usuario_formulario
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Nuevos estados para la visibilidad de las contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Efecto para cargar las empresas del owner al inicio
  useEffect(() => {
    if (store.isLoggedIn && store.user && store.user.rol === 'owner') {
      fetchCompanies();
    } else if (!store.isLoggedIn || !store.user || store.user.rol !== 'owner') {
      // Si no es owner o no está logeado, redirige
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Acceso no autorizado.' } });
      navigate('/profile'); // O a donde corresponda
    }
  }, [store.isLoggedIn, store.user, navigate, dispatch]);

  const fetchCompanies = async () => {
    setLoading(true);
    setErrors({});
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresas`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(data.empresas || []);
        if (data.empresas && data.empresas.length > 0) {
          setSelectedCompanyId(data.empresas[0].id_empresa); // Selecciona la primera empresa por defecto
        }
      } else {
        setErrors({ fetch: data.error || 'Error al cargar empresas.' });
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      setErrors({ fetch: 'Error de conexión al cargar empresas.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Función para alternar la visibilidad de la contraseña
  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else if (field === 'confirmPassword') {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  const validateCompanyForm = () => {
    const newErrors = {};
    if (!companyFormData.nombre_empresa.trim()) {
      newErrors.nombre_empresa = 'El nombre de la empresa es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateUserForm = () => {
    const newErrors = {};
    if (!userFormData.nombre_completo.trim()) {
      newErrors.nombre_completo = 'El nombre completo es requerido.';
    }
    if (!userFormData.email.trim()) {
      newErrors.email = 'El email es requerido.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userFormData.email)) {
      newErrors.email = 'El formato del email no es válido.';
    }
    if (!userFormData.password) {
      newErrors.password = 'La contraseña es requerida.';
    } else if (userFormData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (userFormData.password !== userFormData.confirmar_password) {
      newErrors.confirmar_password = 'Las contraseñas no coinciden.';
    }
    if (!selectedCompanyId) {
        newErrors.selectedCompany = 'Debes seleccionar una empresa para el usuario.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!validateCompanyForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(companyFormData)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Empresa creada exitosamente.');
        setCompanyFormData({ nombre_empresa: '', direccion: '', telefono: '', email_contacto: '' });
        setShowCreateCompanyForm(false);
        fetchCompanies(); // Refrescar la lista de empresas
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Empresa creada con éxito.' } });
      } else {
        setErrors({ general: data.error || 'Error al crear la empresa.' });
      }
    } catch (error) {
      console.error('Error creating company:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!validateUserForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
          ...userFormData,
          id_empresa: selectedCompanyId,
          rol: userFormData.rol,
      };
      delete payload.confirmar_password;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(`Usuario ${payload.nombre_completo} creado exitosamente con rol ${payload.rol}.`);
        setUserFormData({
          nombre_completo: '', email: '', password: '', confirmar_password: '',
          telefono_personal: '', cargo: '', rol: 'admin_empresa'
        });
        setShowCreateUserForm(false);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Usuario creado con éxito.' } });
      } else {
        setErrors({ general: data.error || 'Error al crear el usuario.' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="ucm-loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--ucm-primary-dark)' }}>
        Cargando gestión...
      </div>
    );
  }

  return (
    <div className="ucm-wrapper"> {/* Renombrado a ucm-wrapper */}
      <div className="ucm-header-container"> {/* Renombrado a ucm-header-container */}
        <h1>Gestión de Empresas y Usuarios</h1>
        <button className="ucm-back-button" onClick={() => navigate('/profile')}> {/* Renombrado a ucm-back-button */}
          <i className="fas fa-arrow-left"></i> Volver a Mi Perfil
        </button>
      </div>

      <div className="ucm-messages-container"> {/* Renombrado a ucm-messages-container */}
        {errors.general && (
          <div className="ucm-alert ucm-alert-danger">{errors.general}</div> /* Renombrado a ucm-alert */
        )}
        {errors.fetch && (
          <div className="ucm-alert ucm-alert-danger">{errors.fetch}</div>
        )}
        {successMessage && (
          <div className="ucm-alert ucm-alert-success">{successMessage}</div>
        )}
      </div>

      {/* Sección de Creación de Empresa */}
      <section className="ucm-section ucm-company-section"> {/* Renombrado a ucm-section */}
        <div className="ucm-section-header"> {/* Renombrado a ucm-section-header */}
          <h2>Crear Nueva Empresa</h2>
          <button className="ucm-toggle-button" onClick={() => setShowCreateCompanyForm(!showCreateCompanyForm)}> {/* Renombrado a ucm-toggle-button */}
            {showCreateCompanyForm ? 'Ocultar Formulario' : 'Mostrar Formulario'}
          </button>
        </div>
        {showCreateCompanyForm && (
          <form onSubmit={handleCreateCompany} className="ucm-form"> {/* Renombrado a ucm-form */}
            <div className="ucm-form-group"> {/* Renombrado a ucm-form-group */}
              <label htmlFor="nombre_empresa">Nombre de la Empresa <span className="ucm-required-star">*</span></label> {/* Renombrado a ucm-required-star */}
              <input
                type="text"
                id="nombre_empresa"
                name="nombre_empresa"
                value={companyFormData.nombre_empresa}
                onChange={handleCompanyChange}
                className={errors.nombre_empresa ? 'ucm-is-invalid' : ''} // Renombrado a ucm-is-invalid
                placeholder="Ej: Innova Solutions S.A.S."
                required
              />
              {errors.nombre_empresa && <div className="ucm-invalid-feedback">{errors.nombre_empresa}</div>} {/* Renombrado a ucm-invalid-feedback */}
            </div>
            <div className="ucm-form-group">
              <label htmlFor="direccion">Dirección</label>
              <input
                type="text"
                id="direccion"
                name="direccion"
                value={companyFormData.direccion}
                onChange={handleCompanyChange}
                placeholder="Ej: Calle 100 #20-30"
              />
            </div>
            <div className="ucm-form-group">
              <label htmlFor="telefono">Teléfono</label>
              <input
                type="text"
                id="telefono"
                name="telefono"
                value={companyFormData.telefono}
                onChange={handleCompanyChange}
                placeholder="Ej: +57 3101234567"
              />
            </div>
            <div className="ucm-form-group">
              <label htmlFor="email_contacto">Email de Contacto</label>
              <input
                type="email"
                id="email_contacto"
                name="email_contacto"
                value={companyFormData.email_contacto}
                onChange={handleCompanyChange}
                className={errors.email_contacto ? 'ucm-is-invalid' : ''}
                placeholder="Ej: contacto@innovasolutions.com"
              />
              {errors.email_contacto && <div className="ucm-invalid-feedback">{errors.email_contacto}</div>}
            </div>
            <button type="submit" className="ucm-submit-button" disabled={loading}> {/* Renombrado a ucm-submit-button */}
              {loading ? 'Creando...' : 'Crear Empresa'}
            </button>
          </form>
        )}
      </section>

      {/* Sección de Creación de Usuario */}
      <section className="ucm-section ucm-user-section">
        <div className="ucm-section-header">
          <h2>Crear Nuevo Usuario (Admin o Empleado)</h2>
          <button className="ucm-toggle-button" onClick={() => setShowCreateUserForm(!showCreateUserForm)}>
            {showCreateUserForm ? 'Ocultar Formulario' : 'Mostrar Formulario'}
          </button>
        </div>
        {showCreateUserForm && (
          <form onSubmit={handleCreateUser} className="ucm-form">
            <div className="ucm-form-group">
                <label htmlFor="company_select">Asignar a Empresa <span className="ucm-required-star">*</span></label>
                <select
                    id="company_select"
                    name="selectedCompanyId"
                    value={selectedCompanyId}
                    onChange={(e) => { setSelectedCompanyId(e.target.value); setErrors(prev => ({ ...prev, selectedCompany: '' })); }}
                    className={errors.selectedCompany ? 'ucm-is-invalid' : ''}
                    required
                >
                    <option value="">Selecciona una empresa</option>
                    {companies.map(company => (
                        <option key={company.id_empresa} value={company.id_empresa}>
                            {company.nombre_empresa}
                        </option>
                    ))}
                </select>
                {errors.selectedCompany && <div className="ucm-invalid-feedback">{errors.selectedCompany}</div>}
            </div>

            <div className="ucm-form-group">
              <label htmlFor="rol">Rol del Usuario <span className="ucm-required-star">*</span></label>
              <select
                id="rol"
                name="rol"
                value={userFormData.rol}
                onChange={handleUserChange}
                required
              >
                <option value="admin_empresa">Administrador de Empresa</option>
                <option value="usuario_formulario">Usuario de Formulario</option>
              </select>
            </div>

            <div className="ucm-form-group">
              <label htmlFor="nombre_completo_user">Nombre Completo <span className="ucm-required-star">*</span></label>
              <input
                type="text"
                id="nombre_completo_user"
                name="nombre_completo"
                value={userFormData.nombre_completo}
                onChange={handleUserChange}
                className={errors.nombre_completo ? 'ucm-is-invalid' : ''}
                placeholder="Nombre completo del usuario"
                required
              />
              {errors.nombre_completo && <div className="ucm-invalid-feedback">{errors.nombre_completo}</div>}
            </div>

            <div className="ucm-form-group">
              <label htmlFor="email_user">Correo Electrónico <span className="ucm-required-star">*</span></label>
              <input
                type="email"
                id="email_user"
                name="email"
                value={userFormData.email}
                onChange={handleUserChange}
                className={errors.email ? 'ucm-is-invalid' : ''}
                placeholder="Email del usuario"
                required
              />
              {errors.email && <div className="ucm-invalid-feedback">{errors.email}</div>}
            </div>

            {/* CAMPO DE CONTRASEÑA CON TOGGLE */}
            <div className="ucm-form-group password-field-wrapper"> {/* Agrega una clase wrapper para posicionamiento */}
              <label htmlFor="password_user">Contraseña Inicial <span className="ucm-required-star">*</span></label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password_user"
                name="password"
                value={userFormData.password}
                onChange={handleUserChange}
                className={errors.password ? 'ucm-is-invalid' : ''}
                placeholder="Contraseña temporal"
                required
              />
              <span className="password-toggle-icon" onClick={() => togglePasswordVisibility('password')}>
                <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
              </span>
              {errors.password && <div className="ucm-invalid-feedback">{errors.password}</div>}
            </div>

            {/* CAMPO DE CONFIRMAR CONTRASEÑA CON TOGGLE */}
            <div className="ucm-form-group password-field-wrapper"> {/* Agrega una clase wrapper para posicionamiento */}
              <label htmlFor="confirmar_password_user">Confirmar Contraseña <span className="ucm-required-star">*</span></label>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmar_password_user"
                name="confirmar_password"
                value={userFormData.confirmar_password}
                onChange={handleUserChange}
                className={errors.confirmar_password ? 'ucm-is-invalid' : ''}
                placeholder="Confirma la contraseña"
                required
              />
              <span className="password-toggle-icon" onClick={() => togglePasswordVisibility('confirmPassword')}>
                <i className={showConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
              </span>
              {errors.confirmar_password && <div className="ucm-invalid-feedback">{errors.confirmar_password}</div>}
            </div>

            <div className="ucm-form-group">
              <label htmlFor="telefono_personal_user">Teléfono Personal</label>
              <input
                type="text"
                id="telefono_personal_user"
                name="telefono_personal"
                value={userFormData.telefono_personal}
                onChange={handleUserChange}
                placeholder="Teléfono personal del usuario (opcional)"
              />
            </div>

            <div className="ucm-form-group">
              <label htmlFor="cargo_user">Cargo</label>
              <input
                type="text"
                id="cargo_user"
                name="cargo"
                value={userFormData.cargo}
                onChange={handleUserChange}
                placeholder="Cargo del usuario (opcional)"
              />
            </div>

            <button type="submit" className="ucm-submit-button" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};