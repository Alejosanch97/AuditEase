// src/components/UserCompanyManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/userCompanyManagement.css";

export const UserCompanyManagement = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  // Estados existentes para gestión y formularios
  const [companies, setCompanies] = useState([]); // Empresas activas (para select y listado)
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

  // ESTADOS AÑADIDOS para la visualización de listas
  const [allCompanyUsers, setAllCompanyUsers] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // ⭐ NUEVOS ESTADOS PARA GESTIÓN DE VISTAS COLAPSABLES
  const [isCompaniesListOpen, setIsCompaniesListOpen] = useState(true);
  const [isUsersListOpen, setIsUsersListOpen] = useState(true);

  // Estados de formulario existentes
  const [companyFormData, setCompanyFormData] = useState({
    nombre_empresa: '',
    direccion: '',
    telefono: '',
    email_contacto: ''
  });
  const [userFormData, setUserFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '',
    confirmar_password: '',
    telefono_personal: '',
    cargo: '',
    rol: 'admin_empresa'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ==========================================================
  // 1. FUNCIONES DE FETCH
  // ==========================================================

  const fetchCompanies = useCallback(async () => {
    setLoadingLists(true);
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
        const activeCompanies = (data.empresas || []).filter(comp => comp.activo);
        setCompanies(activeCompanies);
        if (activeCompanies.length > 0) {
          setSelectedCompanyId(activeCompanies[0].id_empresa);
        } else {
          setSelectedCompanyId('');
        }
      } else {
        setErrors({ fetch: data.error || 'Error al cargar empresas.' });
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      setErrors({ fetch: 'Error de conexión al cargar empresas.' });
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const fetchCompanyUsers = useCallback(async () => {
    if (store.user && store.user.rol === 'owner') {
      setLoadingUsers(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoadingUsers(false);
        return;
      }
      try {
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios`; 

        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok && data.usuarios) {
          const activeUsers = data.usuarios.filter(user => user.activo);
          setAllCompanyUsers(activeUsers); 
        } else {
          console.error('Error al cargar usuarios:', data.error);
        }
      } catch (error) {
        console.error('Error de conexión al cargar usuarios:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
  }, [store.user]);

  // ==========================================================
  // 2. EFECTO PARA CARGAR
  // ==========================================================
  
  useEffect(() => {
    if (store.user && store.user.rol === 'owner') {
      fetchCompanies();
      fetchCompanyUsers();
    } else if (!store.user || store.user.rol !== 'owner') {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Acceso no autorizado.' } });
      navigate('/profile');
    }
  }, [store.user, navigate, dispatch, fetchCompanies, fetchCompanyUsers]);

  // ==========================================================
  // 3. HANDLERS (Tu lógica se mantiene, solo se añade la recarga)
  // ==========================================================

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
        await fetchCompanies();
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
        await fetchCompanyUsers();
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

  // ==========================================================
  // 4. LÓGICA DE FILTRADO PARA LA TABLA
  // ==========================================================

  const activeDisplayUsers = useMemo(() => {
    return allCompanyUsers.filter(user => user.rol === 'admin_empresa' || user.rol === 'usuario_formulario');
  }, [allCompanyUsers]);


  // El spinner de carga se ajusta para el contenido principal
  if ((loading && companies.length === 0) || (loadingLists && allCompanyUsers.length === 0)) {
    return (
      <div className="ucm-loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', fontSize: '2em', color: 'var(--ucm-primary-dark)' }}>
        Cargando gestión...
      </div>
    );
  }

  if (!store.user || store.user.rol !== 'owner') {
    return null;
  }

  // ==========================================================
  // 5. RENDERIZADO (Con colapso y IDs)
  // ==========================================================

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Gestión de Empresas y Usuarios</h1>
        <div className="header-right">
          <button className="ucm-back-button" onClick={() => navigate('/profile')}>
            <i className="fas fa-arrow-left"></i> Volver a Mi Perfil
          </button>
        </div>
      </header>

      <div className="ucm-content-area">
        <div className="ucm-messages-container">
          {errors.general && (
            <div className="ucm-alert ucm-alert-danger">{errors.general}</div>
          )}
          {errors.fetch && (
            <div className="ucm-alert ucm-alert-danger">{errors.fetch}</div>
          )}
          {successMessage && (
            <div className="ucm-alert ucm-alert-success">{successMessage}</div>
          )}
        </div>

        {/* Sección de Creación de Empresa */}
        <section className="ucm-section ucm-company-section">
          <div className="ucm-section-header">
            <h2>Crear Nueva Empresa</h2>
            <button className="ucm-toggle-button" onClick={() => setShowCreateCompanyForm(!showCreateCompanyForm)}>
              {showCreateCompanyForm ? 'Ocultar Formulario' : 'Mostrar Formulario'}
            </button>
          </div>
          {showCreateCompanyForm && (
            <form onSubmit={handleCreateCompany} className="ucm-form">
              <div className="ucm-form-group">
                <label htmlFor="nombre_empresa">Nombre de la Empresa <span className="ucm-required-star">*</span></label>
                <input
                  type="text"
                  id="nombre_empresa"
                  name="nombre_empresa"
                  value={companyFormData.nombre_empresa}
                  onChange={handleCompanyChange}
                  className={errors.nombre_empresa ? 'ucm-is-invalid' : ''}
                  placeholder="Ej: Innova Solutions S.A.S."
                  required
                />
                {errors.nombre_empresa && <div className="ucm-invalid-feedback">{errors.nombre_empresa}</div>}
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
              <button type="submit" className="ucm-submit-button" disabled={loading}>
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
              <div className="ucm-form-group password-field-wrapper">
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
              <div className="ucm-form-group password-field-wrapper">
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

        <hr className="ucm-separator" />

        {/* ⭐ SECCIÓN COLAPSABLE: LISTADO DE EMPRESAS CREADAS */}
        <section className="ucm-section ucm-companies-list-section">
            {/* Header colapsable */}
            <div 
                className={`ucm-list-header ${isCompaniesListOpen ? 'open' : ''}`}
                onClick={() => setIsCompaniesListOpen(!isCompaniesListOpen)}
            >
                <h2>
                    Empresas Activas Creadas ({companies.length})
                </h2>
                <i className={`fas fa-chevron-${isCompaniesListOpen ? 'up' : 'down'}`}></i>
            </div>
            
            {/* Contenido colapsable */}
            <div className={`ucm-list-content ${isCompaniesListOpen ? 'open' : ''}`}>
                {loadingLists && companies.length === 0 ? (
                    <p>Cargando lista de empresas...</p>
                ) : companies.length === 0 ? (
                    <p className="ucm-alert ucm-alert-info">Aún no has creado ninguna empresa activa.</p>
                ) : (
                    <div className="ucm-list-container companies-list">
                        {companies.map(comp => (
                            <div key={comp.id_empresa} className="ucm-list-item company-item">
                                <div className="ucm-item-details">
                                    <h4>{comp.nombre_empresa}</h4>
                                    {/* ⭐ ID de la Empresa Añadido */}
                                    <p>ID Empresa: <strong>{comp.id_empresa}</strong> | Contacto: {comp.email_contacto || 'N/A'}</p>
                                </div>
                                <div className="ucm-item-actions">
                                    <button className="ucm-manage-btn edit-btn"><i className="fas fa-edit"></i> Editar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>

        {/* ⭐ SECCIÓN COLAPSABLE: LISTADO DE USUARIOS CREADOS */}
        <section className="ucm-section ucm-users-list-section">
            {/* Header colapsable */}
            <div 
                className={`ucm-list-header ${isUsersListOpen ? 'open' : ''}`}
                onClick={() => setIsUsersListOpen(!isUsersListOpen)}
            >
                <h2>
                    Usuarios Activos Creados ({activeDisplayUsers.length})
                </h2>
                <i className={`fas fa-chevron-${isUsersListOpen ? 'up' : 'down'}`}></i>
            </div>
            
            {/* Contenido colapsable */}
            <div className={`ucm-list-content ${isUsersListOpen ? 'open' : ''}`}>
                {loadingUsers && activeDisplayUsers.length === 0 ? (
                    <p>Cargando lista de usuarios...</p>
                ) : activeDisplayUsers.length === 0 ? (
                    <p className="ucm-alert ucm-alert-info">Aún no has creado ningún usuario (Administrador o Empleado).</p>
                ) : (
                    <div className="ucm-list-container users-list">
                        {activeDisplayUsers.map(user => (
                            <div key={user.id_usuario} className="ucm-list-item user-item">
                                <div className="ucm-item-details">
                                    <h4>{user.nombre_completo}</h4>
                                    {/* ⭐ ID del Usuario Añadido (usando id_empleado si existe) */}
                                    <p>ID Usuario: <strong>{user.id_empleado || user.id_usuario}</strong> | Rol: <strong>{user.rol}</strong></p>
                                    <p>Email: {user.email} | Empresa: {user.empresa?.nombre_empresa || 'N/A'}</p>
                                </div>
                                <div className="ucm-item-actions">
                                    <button className="ucm-manage-btn edit-btn"><i className="fas fa-edit"></i> Editar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
      </div>
    </>
  );
};