// src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Importa useLocation
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/userCompanyManagement.css"; // Reutilizamos el mismo CSS para consistencia

export const UserManagement = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();
  const location = useLocation(); // Para leer parámetros de la URL

  // No necesitamos 'companies' ni 'selectedCompanyId' para admin_empresa,
  // ya que el usuario se creará automáticamente en su empresa.
  // const [companies, setCompanies] = useState([]); 
  // const [selectedCompanyId, setSelectedCompanyId] = useState(''); 

  // No necesitamos showCreateCompanyForm
  // const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);
  
  const [showCreateUserForm, setShowCreateUserForm] = useState(true); // Mostrar formulario de usuario por defecto

  // companyFormData no es necesario aquí
  // const [companyFormData, setCompanyFormData] = useState({
  //   nombre_empresa: '',
  //   direccion: '',
  //   telefono: '',
  //   email_contacto: ''
  // });

  const [userFormData, setUserFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '', // Contraseña inicial para el nuevo usuario
    confirmar_password: '',
    telefono_personal: '',
    cargo: '',
    rol: 'usuario_formulario' // Rol por defecto para admin_empresa
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Nuevos estados para la visibilidad de las contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Efecto para verificar el rol del usuario al cargar el componente
  useEffect(() => {
    if (!store.user) {
      // Si el usuario no está cargado, redirige al login
      navigate('/login');
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Por favor, inicia sesión.' } });
      return;
    }

    // Solo 'owner' y 'admin_empresa' tienen acceso a esta página
    if (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa') {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Acceso no autorizado.' } });
      navigate('/profile'); // Redirige a su perfil normal si no tiene permisos
    }

    // Si la URL tiene '?action=create-user', muestra el formulario de creación de usuario
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create-user') {
        setShowCreateUserForm(true);
    }

  }, [store.user, navigate, dispatch, location.search]);

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
    
    // No necesitamos validar selectedCompanyId aquí, ya que se asigna automáticamente

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
          // id_empresa no se envía desde el frontend para admin_empresa,
          // el backend lo asignará automáticamente a la empresa del admin logeado.
          // Si es owner, el backend lo manejará según la ruta.
          rol: userFormData.rol,
      };
      delete payload.confirmar_password;

      // Determinar el endpoint basado en el rol del usuario logeado
      const endpoint = store.user.rol === 'owner' ? 
                       `${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios` : 
                       `${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios`; // Nueva ruta para admin_empresa

      // Si es owner, necesita enviar id_empresa en el payload
      if (store.user.rol === 'owner') {
          // Si el owner está en esta página, es porque quiere crear usuarios para CUALQUIER empresa
          // En este caso, el owner DEBE seleccionar la empresa.
          // Si no hay empresas cargadas o seleccionadas, esto es un problema.
          // Para simplificar, asumiremos que el owner usará la página de gestión de empresas
          // para crear usuarios para empresas específicas, y que esta página es más para admin_empresa.
          // Si un owner llega aquí, se le puede permitir crear usuarios en su propia empresa por defecto
          // O redirigirlo a la otra página. Por ahora, si es owner, le pedimos id_empresa.
          // Sin embargo, para este componente, el enfoque es admin_empresa.
          // Si un owner usa esta ruta, el backend de /owner/usuarios espera id_empresa.
          // Para esta página, si un owner la usa, se le asigna a su propia empresa por defecto.
          payload.id_empresa = store.user.empresa?.id_empresa;
          if (!payload.id_empresa) {
              setErrors({ general: "Error: El owner debe estar asociado a una empresa para crear usuarios desde aquí." });
              setLoading(false);
              return;
          }
      }


      const response = await fetch(endpoint, {
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
          telefono_personal: '', cargo: '', rol: 'usuario_formulario'
        });
        // No necesitamos refrescar lista de empresas, solo de usuarios si la tuviéramos aquí
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

  // El spinner de carga se ajusta para el contenido principal
  if (loading && (!store.user || (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa'))) {
    return (
      <div className="ucm-loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', fontSize: '2em', color: 'var(--primary-dark)' }}>
        Cargando gestión...
      </div>
    );
  }

  // Si no es owner o admin_empresa, el useEffect ya redirige, así que no deberíamos llegar aquí si la lógica es correcta.
  if (!store.user || (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa')) {
    return null; // O un mensaje de "Acceso denegado" si lo deseas
  }

  const isOwner = store.user.rol === 'owner';

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Gestión de Usuarios</h1> {/* Título más específico */}
        <div className="header-right">
          <button className="ucm-back-button" onClick={() => navigate(isOwner ? '/profile' : '/usersprofile')}>
            <i className="fas fa-arrow-left"></i> Volver a Mi Perfil
          </button>
        </div>
      </header>

      <div className="ucm-content-area">
        <div className="ucm-messages-container">
          {errors.general && (
            <div className="ucm-alert ucm-alert-danger">{errors.general}</div>
          )}
          {successMessage && (
            <div className="ucm-alert ucm-alert-success">{successMessage}</div>
          )}
        </div>

        {/* Sección de Creación de Usuario */}
        <section className="ucm-section ucm-user-section">
          <div className="ucm-section-header">
            <h2>Crear Nuevo Usuario</h2> {/* Título más simple */}
            <button className="ucm-toggle-button" onClick={() => setShowCreateUserForm(!showCreateUserForm)}>
              {showCreateUserForm ? 'Ocultar Formulario' : 'Mostrar Formulario'}
            </button>
          </div>
          {showCreateUserForm && (
            <form onSubmit={handleCreateUser} className="ucm-form">
              {/* Si es owner, se le permite seleccionar la empresa */}
              {isOwner && (
                <div className="ucm-form-group">
                    <label htmlFor="company_select">Asignar a Empresa <span className="ucm-required-star">*</span></label>
                    <select
                        id="company_select"
                        name="selectedCompanyId"
                        value={userFormData.id_empresa || ''} // Usamos userFormData.id_empresa para el owner
                        onChange={(e) => setUserFormData(prev => ({ ...prev, id_empresa: e.target.value ? parseInt(e.target.value) : '' }))}
                        className={errors.selectedCompany ? 'ucm-is-invalid' : ''}
                        required
                    >
                        <option value="">Selecciona una empresa</option>
                        {store.empresas.map(company => ( // Asumo que las empresas del owner están en store.empresas
                            <option key={company.id_empresa} value={company.id_empresa}>
                                {company.nombre_empresa}
                            </option>
                        ))}
                    </select>
                    {errors.selectedCompany && <div className="ucm-invalid-feedback">{errors.selectedCompany}</div>}
                </div>
              )}

              <div className="ucm-form-group">
                <label htmlFor="rol">Rol del Usuario <span className="ucm-required-star">*</span></label>
                <select
                  id="rol"
                  name="rol"
                  value={userFormData.rol}
                  onChange={handleUserChange}
                  required
                >
                  {/* El owner puede crear owner, admin_empresa, usuario_formulario */}
                  {isOwner && <option value="owner">Owner</option>}
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
      </div>
    </>
  );
};

export default UserManagement;