import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

import { EditUserProfileModal } from '../components/EditUserProfileModal.jsx';
import { EditCompanyProfileModal } from '../components/EditCompanyProfileModal.jsx';
// EditOwnerCompanyModal no es necesario para admin_empresa ni usuario_formulario
// import { EditOwnerCompanyModal } from '../components/EditOwnerCompanyModal.jsx';

export const UsersProfile = () => { // Este componente es para roles admin_empresa y usuario_formulario
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [currentDateHeader, setCurrentDateHeader] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Estado único para todos los usuarios de la empresa (activos e inactivos, de cualquier rol)
  const [allCompanyUsers, setAllCompanyUsers] = useState([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
  const [errorCompanyUsers, setErrorCompanyUsers] = useState(null); // Nuevo estado para errores de carga de usuarios

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditCompanyProfileModal, setShowEditCompanyProfileModal] = useState(false);
  const [showEditCompanyUserModal, setShowEditCompanyUserModal] = useState(false);
  
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null); // Inicializar a null

  const currentUser = store.user;
  const company = currentUser?.empresa;
  const allForms = store.formularios;

  // --- Cargar formularios si no están en el store ---
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    // Solo cargar formularios si el store está vacío o no es un array válido
    if (!Array.isArray(allForms) || allForms.length === 0) {
      const fetchForms = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok && data.formularios) {
            dispatch({ type: 'SET_FORMULARIOS', payload: data.formularios });
          } else {
            console.error('Error al cargar formularios para el perfil:', data.error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar formularios.' } });
          }
        } catch (error) {
          console.error('Error de conexión al cargar formularios:', error);
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar formularios.' } });
        }
      };
      fetchForms();
    }
  }, [allForms, dispatch, navigate]); // Dependencia allForms para re-ejecutar si cambia a no-array o vacío

  // --- Obtener detalles de formularios favoritos ---
  const favoriteFormsDetails = useMemo(() => {
    // Asegurarse de que currentUser exista y favoritos sea un array
    if (!currentUser || !Array.isArray(currentUser.favoritos)) {
      return [];
    }
    // Asegurarse de que allForms sea un array
    const forms = Array.isArray(allForms) ? allForms : [];

    if (forms.length === 0 || currentUser.favoritos.length === 0) {
      return [];
    }
    return forms.filter(form => currentUser.favoritos.includes(form.id_formulario));
  }, [currentUser, allForms]);


  // --- Función para cargar todos los usuarios de la empresa (para admin_empresa) ---
  const fetchAllCompanyUsers = useCallback(async () => {
    // Solo cargar usuarios si el rol es admin_empresa y tiene una empresa asociada
    if (currentUser && currentUser.rol === 'admin_empresa' && currentUser.empresa?.id_empresa) {
      setLoadingCompanyUsers(true);
      setErrorCompanyUsers(null); // Limpiar errores anteriores
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoadingCompanyUsers(false);
        dispatch({ type: 'LOGOUT' }); // Asegurarse de desloguear si no hay token
        navigate('/login');
        return;
      }
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok && data.usuarios) {
          // Filtrar para asegurar que solo se muestren usuarios de la empresa del admin logeado
          const usersInCurrentCompany = data.usuarios.filter(
            user => user.id_empresa === currentUser.empresa.id_empresa
          );
          setAllCompanyUsers(usersInCurrentCompany); // Almacenar todos los usuarios
        } else {
          console.error('Error al cargar usuarios de la empresa:', data.error);
          setErrorCompanyUsers(data.error); // Establecer el error
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar usuarios de la empresa.' } });
        }
      } catch (error) {
        console.error('Error de conexión al cargar usuarios de la empresa:', error);
        setErrorCompanyUsers('Error de conexión al cargar usuarios de la empresa.'); // Establecer el error de conexión
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar usuarios de la empresa.' } });
      } finally {
        setLoadingCompanyUsers(false);
      }
    } else {
      setAllCompanyUsers([]); // Limpiar si no es admin_empresa o no tiene empresa
      setLoadingCompanyUsers(false); // Asegurarse de que el loading se apague
      setErrorCompanyUsers(null); // Asegurarse de que no haya error
    }
  }, [currentUser, dispatch, navigate]); // Añadir navigate a las dependencias

  // Este useEffect se encargará de cargar los datos iniciales y reaccionar a cambios importantes
  useEffect(() => {
    // Si currentUser es null o undefined, significa que no se ha cargado el usuario aún
    // o que no está logueado. El componente padre (DashboardLayout o App.jsx) debería manejar la redirección.
    // Aquí solo mostramos un spinner mientras se carga.
    if (!currentUser) {
      return; 
    }

    // Cargar usuarios de la empresa si el rol es admin_empresa
    // La dependencia de currentUser asegura que se re-ejecute si el objeto currentUser cambia (ej. después de un login)
    if (currentUser.rol === 'admin_empresa') {
      fetchAllCompanyUsers();
    }

    // Configurar la fecha actual en el encabezado
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
    setCurrentDateHeader(formattedDate);

  }, [currentUser, fetchAllCompanyUsers]); // Dependencias: currentUser y la función de callback

  // --- Listas de usuarios derivadas con useMemo ---
  // Estas listas se recalcularán automáticamente cuando allCompanyUsers cambie
  const activeFormUsers = useMemo(() => {
    return allCompanyUsers.filter(user => user.activo && user.rol === 'usuario_formulario');
  }, [allCompanyUsers]);

  const inactiveFormUsers = useMemo(() => {
    return allCompanyUsers.filter(user => !user.activo && user.rol === 'usuario_formulario');
  }, [allCompanyUsers]);

  // Estas listas son para otros roles dentro de la empresa, si decides mostrarlos en el futuro
  // NOTA: La tarjeta "Usuarios Administradores" no se renderiza en este componente.
  const activeAdminUsersInCompany = useMemo(() => {
    return allCompanyUsers.filter(user => user.activo && user.rol === 'admin_empresa' && user.id_usuario !== currentUser.id_usuario);
  }, [allCompanyUsers, currentUser]);

  const inactiveAdminUsersInCompany = useMemo(() => {
    return allCompanyUsers.filter(user => !user.activo && user.rol === 'admin_empresa');
  }, [allCompanyUsers]);


  const handleOpenEditUserModal = () => {
    setShowEditUserModal(true);
  };
  const handleCloseEditUserModal = () => {
    setShowEditUserModal(false);
  };

  const handleOpenCompanyProfileModal = (companyData) => {
    setCompanyToEdit(companyData);
    setShowEditCompanyProfileModal(true);
  };
  const handleCloseCompanyProfileModal = () => {
    setShowEditCompanyProfileModal(false);
    setCompanyToEdit(null);
  };
  
  const handleOpenEditCompanyUserModal = (user) => {
    setUserToEdit(user);
    setShowEditCompanyUserModal(true);
  };

  const handleCloseEditCompanyUserModal = () => {
    setShowEditCompanyUserModal(false);
    setUserToEdit(null);
  };

  const handleUserUpdateSuccess = (updatedUserData) => {
    // Si el usuario actualizado es el usuario logeado, actualiza el store global
    if (currentUser && updatedUserData.id_usuario === currentUser.id_usuario) {
      dispatch({ type: 'SET_USER', payload: updatedUserData });
    }
    // Siempre re-fetch los usuarios de la empresa para asegurar que la lista esté actualizada
    // Esto es más robusto que intentar manipular el estado local directamente.
    if (currentUser.rol === 'admin_empresa') {
        fetchAllCompanyUsers();
    }
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Usuario ${updatedUserData.nombre_completo} actualizado con éxito.` } });
    handleCloseEditUserModal();
    handleCloseEditCompanyUserModal();
  };

  const handleCompanyUpdateSuccess = (updatedCompanyData) => {
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Empresa ${updatedCompanyData.nombre_empresa} actualizada con éxito.` } });

    // Si la empresa actualizada es la empresa principal del usuario logeado, actualiza el store global
    if (company && company.id_empresa === updatedCompanyData.id_empresa) {
        dispatch({
            type: 'SET_USER',
            payload: {
                ...store.user,
                empresa: updatedCompanyData
            }
        });
    }
    // En caso de que la empresa se haya actualizado (ej. logo, nombre),
    // es buena idea re-fetch los usuarios de la empresa para asegurar consistencia
    // si esta actualización pudiera afectar la visibilidad de los usuarios.
    if (currentUser.rol === 'admin_empresa') {
        fetchAllCompanyUsers();
    }
    handleCloseCompanyProfileModal();
  };

  // Manejar la desactivación de un usuario de la empresa
  const handleDeactivateCompanyUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de que quieres desactivar al usuario "${userName}"? No podrá iniciar sesión.`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    if (userId === currentUser.id_usuario) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No puedes desactivarte a ti mismo.' } });
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios/${userId}`, {
        method: 'DELETE', // Asumiendo que DELETE es para desactivación lógica
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario desactivado exitosamente.' } });
        // Después de desactivar, re-fetch para asegurar que la lista esté actualizada
        fetchAllCompanyUsers();
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al desactivar el usuario.' } });
      }
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al desactivar el usuario.' } });
    }
  };

  // Manejar la reactivación de un usuario de la empresa
  const handleReactivateCompanyUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de que quieres reactivar al usuario "${userName}"?`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const payload = { activo: true }; // Enviar 'true' para reactivar

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios/${userId}`, {
        method: 'PUT', // Usar PUT para actualizar el estado
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario reactivado exitosamente.' } });
        // Después de reactivar, re-fetch para asegurar que la lista esté actualizada
        fetchAllCompanyUsers(); 
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al reactivar el usuario.' } });
      }
    } catch (error) {
      console.error('Error al reactivar usuario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al reactivar el usuario.' } });
    }
  };


  if (!currentUser) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: '#2c3e50' /* primary-dark */ }}>
        Cargando perfil...
      </div>
    );
  }

  // canEditCompany se usará para el botón de editar información de la empresa
  const canEditCompany = currentUser.rol === 'admin_empresa'; // Solo admin_empresa puede editar la info de SU empresa aquí

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const generateCalendarDays = (year, month) => {
    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const prevMonthNumDays = daysInMonth(year, month - 1);
    const days = [];
    for (let i = firstDay; i > 0; i--) { days.push({ day: prevMonthNumDays - i + 1, currentMonth: false }); }
    for (let i = 1; i <= numDays; i++) { days.push({ day: i, currentMonth: true }); }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) { days.push({ day: i, currentMonth: false }); }
    return days;
  };

  const calendarDays = generateCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthIndex = today.getMonth();
  const currentYear = today.getFullYear();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const handlePrevMonth = () => {
    setCurrentMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1));
  };

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Mi Perfil</h1>
        <div className="header-right">
          <span className="current-date">{currentDateHeader}</span>
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Profile Card (Información del Usuario Logeado) - Común para todos */}
        <section className="card profile-card">
          <div className="profile-header">
            <img src={currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV"} alt="Imagen de Perfil" className="profile-picture" />
            <div className="profile-details">
              <h2>{currentUser.nombre_completo}</h2>
              <p><span>Rol:</span> {currentUser.rol === 'usuario_formulario' ? 'Usuario' : currentUser.rol}</p>
              <p><span>Cargo:</span> {currentUser.cargo || 'No especificado'}</p>
              <p><span>Email:</span> {currentUser.email}</p>
              <p><span>Teléfono:</span> {currentUser.telefono_personal || '(+0) No especificado'}</p>
              <p><span>Empresa:</span> {company ? company.nombre_empresa : 'N/A'}</p>
              <div className="social-links">
                <i className="fab fa-linkedin"></i>
                <i className="fab fa-facebook-f"></i>
                <i className="fab fa-twitter"></i>
              </div>
            </div>
          </div>
          <div className="profile-actions">
              <button className="edit-profile-btn" onClick={handleOpenEditUserModal}>
                  <i className="fas fa-edit"></i> Editar Perfil
              </button>
          </div>
        </section>

        {/* Calendar Card - Común para todos */}
        <section className="card calendar-card">
            <div className="card-header">
                <h3>Calendario</h3>
                <div className="calendar-nav">
                    <i className="fas fa-chevron-left" onClick={handlePrevMonth}></i>
                    <span>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                    <i className="fas fa-chevron-right" onClick={handleNextMonth}></i>
                </div>
            </div>
            <table className="calendar-table">
                <thead>
                    <tr>
                        <th>Dom</th><th>Lun</th><th>Mar</th><th>Mié</th><th>Jue</th><th>Vie</th><th>Sáb</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7).map((dayData, colIndex) => (
                                <td
                                    key={colIndex}
                                    className={`${!dayData.currentMonth ? 'inactive' : ''} ${
                                        dayData.currentMonth &&
                                        dayData.day === currentDay &&
                                        currentMonth.getMonth() === currentMonthIndex &&
                                        currentMonth.getFullYear() === currentYear
                                          ? 'current-day'
                                          : ''
                                    }`}
                                >
                                    {dayData.day}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>

        {/* Sección de Usuarios de Formulario Activos (para Admin_Empresa) */}
        {currentUser.rol === 'admin_empresa' && (
          <section className="card admin-users-card">
              <div className="card-header">
                  <h3>Usuarios</h3>
                  <button className="create-user-btn" onClick={() => navigate('/user-management?action=create-user')}>
                      <i className="fas fa-user-plus"></i> Nuevo Usuario
                  </button>
              </div>
              {loadingCompanyUsers ? (
                <p>Cargando usuarios...</p>
              ) : errorCompanyUsers ? ( // Mostrar error si existe
                <p className="error-message">Error al cargar usuarios: {errorCompanyUsers}</p>
              ) : activeFormUsers.length > 0 ? ( 
                  <div className="users-list">
                      {activeFormUsers.map(user => ( 
                          <div key={user.id_usuario} className="user-item">
                              <img
                                  src={user.imagen_perfil_url || "https://placehold.co/60x60/3498db/ffffff?text=USR"}
                                  alt={`Perfil de ${user.nombre_completo}`} 
                                  className="user-list-picture"
                              />
                              <div className="user-details">
                                  <h4>{user.nombre_completo}</h4>
                                  <p>{user.email}</p>
                                  <p className="user-role">{user.rol === 'usuario_formulario' ? 'Usuario' : user.rol}</p>
                              </div>
                              <div className="item-actions">
                                  <button
                                      className="manage-item-btn edit-btn"
                                      onClick={() => handleOpenEditCompanyUserModal(user)}
                                      disabled={user.id_usuario === currentUser.id_usuario}
                                  >
                                      Editar
                                  </button>
                                  <button
                                      className="manage-item-btn delete-btn"
                                      onClick={() => handleDeactivateCompanyUser(user.id_usuario, user.nombre_completo)}
                                      disabled={user.id_usuario === currentUser.id_usuario}
                                  >
                                      Desactivar
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <p>No hay usuarios de formulario activos registrados en esta empresa.</p>
              )}
          </section>
        )}

        {/* Sección de Usuarios de Formulario Inactivos (para Admin_Empresa) */}
        {currentUser.rol === 'admin_empresa' && inactiveFormUsers.length > 0 && ( 
          <section className="card admin-users-card">
              <div className="card-header">
                  <h3>Usuarios Inactivos</h3>
              </div>
              <div className="users-list">
                  {inactiveFormUsers.map(user => ( 
                      <div key={user.id_usuario} className="user-item inactive-item">
                          <img
                              src={user.imagen_perfil_url || "https://placehold.co/60x60/7f8c8d/ffffff?text=IN"}
                              alt={`Perfil de ${user.nombre_completo}`} 
                              className="user-list-picture"
                          />
                          <div className="user-details">
                              <h4>{user.nombre_completo}</h4>
                              <p>{user.email}</p>
                              <p className="user-role">{user.rol === 'usuario_formulario' ? 'Usuario' : user.rol}</p>
                              <p className="status-inactive-text">Inactivo</p>
                          </div>
                          <div className="item-actions">
                              <button
                                  className="manage-item-btn reactivate-btn"
                                  onClick={() => handleReactivateCompanyUser(user.id_usuario, user.nombre_completo)}
                              >
                                  Reactivar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
        )}


        {/* Sección de Próximos Eventos (para usuario_formulario) */}
        {currentUser.rol === 'usuario_formulario' && (
          <section className="card upcoming-events-card">
              <div className="card-header">
                  <h3>Próximos Eventos</h3>
                  <button className="view-all-btn">Ver Todos</button>
              </div>
              {/* Contenido de eventos (mantengo el placeholder de tu código original) */}
              <div className="event-item">
                  <div className="event-details">
                      <h4>Revisión de Diseño UX</h4>
                      <p>09:00 AM - 10:00 AM</p>
                  </div>
                  <div className="event-participants">
                      <img src="https://placehold.co/30x30/f00/ffffff?text=" alt="Participante" />
                      <img src="https://placehold.co/30x30/0f0/ffffff?text=" alt="Participante" />
                      <img src="https://placehold.co/30x30/00f/ffffff?text=" alt="Participante" />
                      <span>+8</span>
                  </div>
              </div>
              <div className="event-item">
                  <div className="event-details">
                      <h4>Capacitación SGSST</h4>
                      <p>11:00 AM - 12:30 PM</p>
                  </div>
                  <div className="event-participants">
                      <img src="https://placehold.co/30x30/f0f/ffffff?text=" alt="Participante" />
                      <img src="https://placehold.co/30x30/ff0/ffffff?text=" alt="Participante" />
                      <span>+5</span>
                  </div>
              </div>
              <div className="event-item">
                  <div className="event-details">
                      <h4>Reunión de Seguridad</h4>
                      <p>02:00 PM - 03:00 PM</p>
                  </div>
                  <div className="event-participants">
                      <img src="https://placehold.co/30x30/0ff/ffffff?text=" alt="Participante" />
                      <span>+3</span>
                  </div>
              </div>
          </section>
        )}

        {/* Información Básica (para admin_empresa y usuario_formulario) */}
        {(currentUser.rol === 'admin_empresa' || currentUser.rol === 'usuario_formulario') && (
           <section className="card basic-info-card">
               <div className="card-header">
                   <h3>Información Básica</h3>
               </div>
               <div className="info-group">
                   <div className="info-item">
                       <h4>Fecha Contratación</h4>
                       <p>{currentUser.fecha_contratacion || 'N/A'}</p>
                   </div>
                   <div className="info-item">
                       <h4>Antigüedad</h4>
                       <p>{currentUser.antiguedad || 'N/A'}</p>
                   </div>
                   <div className="info-item">
                       <h4>ID Empleado</h4>
                       <p>{currentUser.id_empleado || currentUser.id_usuario}</p>
                   </div>
                   <div className="info-item">
                       <h4>NSS</h4>
                       <p>{currentUser.nss || 'N/A'}</p>
                   </div>
               </div>
           </section>
        )}


        {/* Formularios a Diligenciar - Común para todos */}
        <section className="card forms-to-fill-card">
            <div className="card-header">
                <h3>Formularios a Diligenciar</h3>
                <Link to="/answer-forms" className="view-all-forms-btn">Ver Todos</Link>
            </div>
            {favoriteFormsDetails.length > 0 ? (
                <div className="favorite-forms-list">
                    {favoriteFormsDetails.map(form => (
                        <div key={form.id_formulario} className="favorite-form-item">
                            <div className="form-info">
                                <h4>{form.nombre_formulario}</h4>
                                <p>{form.descripcion || 'Sin descripción.'}</p>
                            </div>
                            <button
                                className="fill-form-btn"
                                onClick={() => navigate(`/answer-form/${form.id_formulario}`)}
                            >
                                <i className="fas fa-file-signature"></i> Diligenciar
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-favorites-message">No tienes formularios marcados como favoritos. <Link to="/answer-forms">Explora formularios</Link>.</p>
            )}
        </section>

        {/* INFORMACIÓN DE LA EMPRESA (Occupation Info Card) - Siempre la empresa del usuario logeado */}
        <section className="card occupation-info-card">
            <div className="card-header">
                <h3>Información Laboral</h3>
                {canEditCompany && company && (
                    <button className="edit-btn" onClick={() => handleOpenCompanyProfileModal(company)}>
                      Editar
                    </button>
                )}
            </div>
            {company ? (
                <div className="profile-header">
                  <img
                      src={company.logo_url || "https://placehold.co/100x100/2c3e50/ffffff?text=LOGO"}
                      alt="Logo de la Empresa"
                      className="company-logo-picture"
                  />
                  <div className="profile-details">
                      <h2>{company.nombre_empresa}</h2>
                      <p><span>Dirección:</span> {company.direccion || 'No especificada'}</p>
                      <p><span>Teléfono:</span> {company.telefono || 'No especificado'}</p>
                      <p><span>Email:</span> {company.email_contacto || 'No especificado'}</p>
                  </div>
                </div>
            ) : (
                <p>No hay información de empresa disponible.</p>
            )}
        </section>

        </div> {/* Cierre de dashboard-grid */}

      {/* Modales */}
      {showEditUserModal && currentUser && (
        <EditUserProfileModal
          currentUser={currentUser}
          onClose={handleCloseEditUserModal}
          onUpdateSuccess={handleUserUpdateSuccess}
        />
      )}

      {showEditCompanyProfileModal && companyToEdit && (
        <EditCompanyProfileModal
          currentCompany={companyToEdit}
          onClose={handleCloseCompanyProfileModal}
          onUpdateSuccess={handleCompanyUpdateSuccess}
        />
      )}

      {/* Modal para editar usuarios de la empresa */}
      {showEditCompanyUserModal && userToEdit && (
        <EditUserProfileModal
          currentUser={userToEdit}
          onClose={handleCloseEditCompanyUserModal}
          onUpdateSuccess={handleUserUpdateSuccess}
          isEditingOtherUser={true}
        />
      )}
    </>
  );
};

export default UsersProfile;