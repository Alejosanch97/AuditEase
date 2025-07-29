// src/pages/Profile.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

import { EditUserProfileModal } from '../components/EditUserProfileModal.jsx';
import { EditCompanyProfileModal } from '../components/EditCompanyProfileModal.jsx';
import { EditOwnerCompanyModal } from '../components/EditOwnerCompanyModal.jsx';

export const Profile = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [currentDateHeader, setCurrentDateHeader] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [ownerCompanies, setOwnerCompanies] = useState([]); // Empresas activas del owner
  const [inactiveCompanies, setInactiveCompanies] = useState([]); // Empresas inactivas del owner
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditUserCompanyModal, setShowEditUserCompanyModal] = useState(false);
  const [showEditOwnerCompanyModal, setShowEditOwnerCompanyModal] = useState(false);
  const [showEditAdminUserModal, setShowEditAdminUserModal] = useState(false);
  
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);

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

    if (allForms.length === 0) {
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
  }, [allForms.length, dispatch, navigate]);

  // --- Obtener detalles de formularios favoritos ---
  const favoriteFormsDetails = useMemo(() => {
    if (!currentUser || !currentUser.favoritos || allForms.length === 0) {
      return [];
    }
    return allForms.filter(form => currentUser.favoritos.includes(form.id_formulario));
  }, [currentUser, allForms]);


  // Cargar empresas del owner (separando activas e inactivas)
  const fetchOwnerCompanies = useCallback(async (token, ownerCompanyIdToExclude) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresas`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        const allFetchedCompanies = data.empresas || [];
        // Filtra las empresas activas (excluyendo la del owner logeado para la lista "Mis Empresas")
        const activeComps = allFetchedCompanies.filter(comp => comp.activo && comp.id_empresa !== ownerCompanyIdToExclude);
        // Filtra las empresas inactivas (todas las inactivas, sin exclusión del owner logeado)
        const inactiveComps = allFetchedCompanies.filter(comp => !comp.activo);
        
        setOwnerCompanies(activeComps);
        setInactiveCompanies(inactiveComps);
      } else {
        console.error('Error al cargar empresas del owner:', data.error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar tus empresas.' } });
      }
    } catch (error) {
      console.error('Error de conexión al cargar empresas del owner:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    }
  }, [dispatch]);

  // Función para cargar usuarios administradores (solo para owner)
  const fetchAdminUsers = useCallback(async () => {
    if (currentUser && currentUser.rol === 'owner') {
      setLoadingAdminUsers(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoadingAdminUsers(false);
        return;
      }
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok && data.usuarios) {
          // Filtrar solo los usuarios con rol 'admin_empresa' y que estén ACTIVO
          const admins = data.usuarios.filter(user => user.rol === 'admin_empresa' && user.activo);
          setAdminUsers(admins);
        } else {
          console.error('Error al cargar usuarios administradores:', data.error);
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar usuarios administradores.' } });
        }
      } catch (error) {
        console.error('Error de conexión al cargar usuarios administradores:', error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar usuarios administradores.' } });
      } finally {
        setLoadingAdminUsers(false);
      }
    }
  }, [currentUser, dispatch]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.rol === 'owner') {
        const token = localStorage.getItem('access_token');
        if (token && currentUser.empresa) {
          fetchOwnerCompanies(token, currentUser.empresa.id_empresa);
        }
        fetchAdminUsers();
      }
    }

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
    setCurrentDateHeader(formattedDate);

  }, [currentUser, fetchOwnerCompanies, fetchAdminUsers]);

  const handleOpenEditUserModal = () => {
    setShowEditUserModal(true);
  };
  const handleCloseEditUserModal = () => {
    setShowEditUserModal(false);
  };

  const handleOpenUserCompanyModal = (companyData) => {
    setCompanyToEdit(companyData);
    setShowEditUserCompanyModal(true);
  };
  const handleCloseUserCompanyModal = () => {
    setShowEditUserCompanyModal(false);
    setCompanyToEdit(null);
  };

  const handleOpenOwnerCompanyModal = (companyData) => {
    setCompanyToEdit(companyData);
    setShowEditOwnerCompanyModal(true);
  };
  const handleCloseOwnerCompanyModal = () => {
    setShowEditOwnerCompanyModal(false);
    setCompanyToEdit(null);
  };

  // Abrir modal para editar usuario administrador
  const handleOpenEditAdminUserModal = (user) => {
    setUserToEdit(user);
    setShowEditAdminUserModal(true);
  };

  // Cerrar modal para editar usuario administrador
  const handleCloseEditAdminUserModal = () => {
    setShowEditAdminUserModal(false);
    setUserToEdit(null);
  };

  const handleUserUpdateSuccess = (updatedUserData) => {
    if (currentUser && updatedUserData.id_usuario === currentUser.id_usuario) {
      dispatch({ type: 'SET_USER', payload: updatedUserData });
    } else {
      // Si es un admin user, actualizamos la lista de adminUsers
      setAdminUsers(prevUsers => {
        const updatedList = prevUsers.map(user =>
          user.id_usuario === updatedUserData.id_usuario ? updatedUserData : user
        );
        // Si el usuario se desactivó, lo filtramos de la lista de activos
        return updatedList.filter(user => user.activo);
      });
    }
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Usuario ${updatedUserData.nombre_completo} actualizado con éxito.` } });
    handleCloseEditUserModal();
    handleCloseEditAdminUserModal();
  };

  const handleCompanyUpdateSuccess = (updatedCompanyData) => {
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Empresa ${updatedCompanyData.nombre_empresa} actualizada con éxito.` } });

    // Lógica para mover la empresa entre listas si su estado 'activo' cambió
    if (updatedCompanyData.activo) { // Si la empresa se activó
      setInactiveCompanies(prev => prev.filter(comp => comp.id_empresa !== updatedCompanyData.id_empresa));
      setOwnerCompanies(prev => {
        if (!prev.some(comp => comp.id_empresa === updatedCompanyData.id_empresa) && updatedCompanyData.id_empresa !== currentUser.empresa.id_empresa) {
          return [...prev, updatedCompanyData];
        }
        return prev.map(comp => comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp);
      });
    } else { // Si la empresa se desactivó
      setOwnerCompanies(prev => prev.filter(comp => comp.id_empresa !== updatedCompanyData.id_empresa));
      setInactiveCompanies(prev => {
        if (!prev.some(comp => comp.id_empresa === updatedCompanyData.id_empresa)) {
          return [...prev, updatedCompanyData];
        }
        return prev.map(comp => comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp);
      });
    }

    // Si la empresa actualizada es la empresa principal del usuario logeado
    if (company && company.id_empresa === updatedCompanyData.id_empresa) {
        dispatch({
            type: 'SET_USER',
            payload: {
                ...store.user,
                empresa: updatedCompanyData
            }
        });
    }
    handleCloseUserCompanyModal();
    handleCloseOwnerCompanyModal();
  };

  // Manejar la eliminación (desactivación) de una empresa
  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(`¿Estás seguro de que quieres desactivar la empresa "${companyName}"? Esto también desactivará a todos sus usuarios.`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Empresa desactivada exitosamente.' } });
        // Mover la empresa a la lista de inactivas
        const deactivatedCompany = ownerCompanies.find(comp => comp.id_empresa === companyId) || inactiveCompanies.find(comp => comp.id_empresa === companyId);
        if (deactivatedCompany) {
            setOwnerCompanies(prevCompanies => prevCompanies.filter(comp => comp.id_empresa !== companyId));
            setInactiveCompanies(prevInactive => {
                if (!prevInactive.some(comp => comp.id_empresa === companyId)) {
                    return [...prevInactive, { ...deactivatedCompany, activo: false }];
                }
                return prevInactive.map(comp => comp.id_empresa === companyId ? { ...comp, activo: false } : comp);
            });
        }
        
        // También actualizar la lista de admin users si alguno se desactivó
        fetchAdminUsers(); // Re-fetch para asegurar que los admin users inactivos se oculten

        if (currentUser.empresa && currentUser.empresa.id_empresa === companyId) {
            dispatch({
                type: 'SET_USER',
                payload: {
                    ...store.user,
                    empresa: { ...store.user.empresa, activo: false }
                }
            });
        }
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al desactivar la empresa.' } });
      }
    } catch (error) {
      console.error('Error al desactivar empresa:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al desactivar la empresa.' } });
    }
  };

  // Manejar la reactivación de una empresa
  const handleReactivateCompany = async (companyId, companyName) => {
    if (!window.confirm(`¿Estás seguro de que quieres reactivar la empresa "${companyName}"? Esto también reactivará a sus usuarios asociados.`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('activo', 'true'); // Enviar 'true' para reactivar

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/${companyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Empresa reactivada exitosamente.' } });
        // Mover la empresa a la lista de activas
        const reactivatedCompany = inactiveCompanies.find(comp => comp.id_empresa === companyId) || ownerCompanies.find(comp => comp.id_empresa === companyId);
        if (reactivatedCompany) {
            setInactiveCompanies(prevInactive => prevInactive.filter(comp => comp.id_empresa !== companyId));
            // Solo añadir a ownerCompanies si no es la empresa principal del owner (ya está en store global)
            if (reactivatedCompany.id_empresa !== currentUser.empresa.id_empresa) {
                setOwnerCompanies(prevActive => {
                    if (!prevActive.some(comp => comp.id_empresa === companyId)) {
                        return [...prevActive, { ...reactivatedCompany, activo: true }];
                    }
                    return prevActive;
                });
            }
        }
        // También actualizar la lista de admin users (el backend ya los reactivó)
        fetchAdminUsers(); // Re-fetch para asegurar que los admin users reactivados se muestren

        if (currentUser.empresa && currentUser.empresa.id_empresa === companyId) {
            dispatch({
                type: 'SET_USER',
                payload: {
                    ...store.user,
                    empresa: { ...store.user.empresa, activo: true }
                }
            });
        }

      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al reactivar la empresa.' } });
      }
    } catch (error) {
      console.error('Error al reactivar empresa:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al reactivar la empresa.' } });
    }
  };

  // NUEVO: Manejar la eliminación PERMANENTE de una empresa
  const handleHardDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(
      `¡ADVERTENCIA! Estás a punto de eliminar PERMANENTEMENTE la empresa "${companyName}" y TODOS sus datos relacionados (usuarios, formularios, respuestas, etc.). Esta acción es IRREVERSIBLE. ¿Estás absolutamente seguro?`
    )) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/permanently/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Empresa eliminada permanentemente.' } });
        // Eliminar la empresa de la lista de inactivas
        setInactiveCompanies(prevInactive => prevInactive.filter(comp => comp.id_empresa !== companyId));
        // Re-fetch admin users por si algún admin de esa empresa fue eliminado
        fetchAdminUsers();
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al eliminar la empresa permanentemente.' } });
      }
    } catch (error) {
      console.error('Error al eliminar empresa permanentemente:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al eliminar la empresa permanentemente.' } });
    }
  };


  // Manejar la eliminación (desactivación) de un usuario administrador
  const handleDeleteAdminUser = async (userId, userName) => {
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario desactivado exitosamente.' } });
        // Actualizar el estado para reflejar la desactivación (filtrando al usuario inactivo)
        setAdminUsers(prevUsers => prevUsers.filter(user => user.id_usuario !== userId));
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al desactivar el usuario.' } });
      }
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al desactivar el usuario.' } });
    }
  };

  if (!currentUser) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: '#2c3e50' /* primary-dark */ }}>
        Cargando perfil...
      </div>
    );
  }

  const canEditCompany = currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa';

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
        {/* Profile Card */}
        <section className="card profile-card">
          <div className="profile-header">
            <img src={currentUser.imagen_perfil_url || "https://placehold.co/130x130/1abc9c/ffffff?text=HV"} alt="Imagen de Perfil" className="profile-picture" />
            <div className="profile-details">
              <h2>{currentUser.nombre_completo}</h2>
              <p><span>Rol:</span> {currentUser.rol}</p>
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

        {/* Calendar Card */}
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

        {/* Sección de Usuarios Administradores (para Owner y Admin_Empresa) o Próximos Eventos (para otros) */}
        {(currentUser.rol === 'owner') ? (
          <section className="card admin-users-card">
              <div className="card-header">
                  <h3>Usuarios Administradores</h3>
                  {currentUser.rol === 'owner' && (
                    <Link to="" className="view-all-btn">Ver Todos</Link>
                  )}
              </div>
              {loadingAdminUsers ? (
                <p>Cargando usuarios administradores...</p>
              ) : currentUser.rol === 'owner' ? (
                adminUsers.length > 0 ? (
                    <div className="users-list">
                        {adminUsers.map(adminUser => (
                            <div key={adminUser.id_usuario} className={`user-item ${!adminUser.activo ? 'inactive-item' : ''}`}>
                                <img
                                    src={adminUser.imagen_perfil_url || "https://placehold.co/60x60/1abc9c/ffffff?text=AD"}
                                    alt={`Perfil de ${adminUser.nombre_completo}`}
                                    className="user-list-picture"
                                />
                                <div className="user-details">
                                    <h4>{adminUser.nombre_completo}</h4>
                                    <p>{adminUser.email}</p>
                                    <p className="user-role">{adminUser.rol}</p>
                                    {!adminUser.activo && <p className="status-inactive-text">Inactivo</p>}
                                </div>
                                {currentUser.rol === 'owner' && (
                                  <div className="item-actions">
                                      <button
                                          className="manage-item-btn edit-btn"
                                          onClick={() => handleOpenEditAdminUserModal(adminUser)}
                                          disabled={!adminUser.activo}
                                      >
                                          Editar
                                      </button>
                                      <button
                                          className="manage-item-btn delete-btn"
                                          onClick={() => handleDeleteAdminUser(adminUser.id_usuario, adminUser.nombre_completo)}
                                          disabled={!adminUser.activo}
                                      >
                                          Eliminar
                                      </button>
                                  </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No hay usuarios administradores activos registrados en el sistema.</p>
                )
              ) : ( // currentUser.rol === 'admin_empresa'
                <p className="info-message">
                  Como administrador de empresa, esta sección mostraría los administradores de tu empresa.
                  Actualmente, esta funcionalidad requiere una ruta de backend específica.
                  Por favor, contacta al propietario del sistema si necesitas esta característica.
                </p>
              )}
          </section>
        ) : (
          // Sección de Próximos Eventos para otros roles (ej. usuario_formulario)
          <section className="card upcoming-events-card">
              <div className="card-header">
                  <h3>Próximos Eventos</h3>
                  <button className="view-all-btn">Ver Todos</button>
              </div>
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

        {/* MIS EMPRESAS (Solo para Owner - Ahora solo activas) */}
        {currentUser.rol === 'owner' && (
          <section className="card owner-companies-card">
              <div className="card-header">
                  <h3>Mis Empresas</h3>
                  <button className="create-company-btn" onClick={() => navigate('/user-company-management?action=create-company')}>
                      <i className="fas fa-plus-circle"></i> Nueva Empresa
                  </button>
              </div>
              {ownerCompanies.length > 0 ? (
                  <div className="companies-list">
                      {ownerCompanies.map(comp => (
                          <div key={comp.id_empresa} className={`company-item ${!comp.activo ? 'inactive-item' : ''}`}>
                              <img
                                  src={comp.logo_url || "https://placehold.co/60x60/2c3e50/ffffff?text=LOGO"}
                                  alt={`Logo de ${comp.nombre_empresa}`}
                                  className="company-list-logo"
                              />
                              <div className="company-details">
                                  <h4>{comp.nombre_empresa}</h4>
                                  <p className={`company-status ${comp.activo ? 'active' : 'inactive'}`}>
                                      Estado: {comp.activo ? 'Activa' : 'Inactiva'}
                                  </p>
                              </div>
                              <div className="item-actions">
                                  <button
                                      className="manage-item-btn"
                                      onClick={() => handleOpenOwnerCompanyModal(comp)}
                                  >
                                      Editar
                                  </button>
                                  <button
                                      className="manage-item-btn delete-btn"
                                      onClick={() => handleDeleteCompany(comp.id_empresa, comp.nombre_empresa)}
                                      disabled={!comp.activo}
                                  >
                                      Eliminar
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <p>No tienes empresas activas adicionales. <Link to="/user-company-management?action=create-company">Crea una ahora</Link>.</p>
              )}
          </section>
        )}

        {/* NUEVA SECCIÓN: EMPRESAS INACTIVAS (Solo para Owner) */}
        {currentUser.rol === 'owner' && inactiveCompanies.length > 0 && (
          <section className="card inactive-companies-card">
              <div className="card-header">
                  <h3>Empresas Inactivas</h3>
              </div>
              <div className="companies-list">
                  {inactiveCompanies.map(comp => (
                      <div key={comp.id_empresa} className="company-item inactive-item">
                          <img
                              src={comp.logo_url || "https://placehold.co/60x60/7f8c8d/ffffff?text=LOGO"}
                              alt={`Logo de ${comp.nombre_empresa}`}
                              className="company-list-logo"
                          />
                          <div className="company-details">
                              <h4>{comp.nombre_empresa}</h4>
                              <p className="company-status inactive">Estado: Inactiva</p>
                          </div>
                          <div className="item-actions">
                              <button
                                  className="manage-item-btn reactivate-btn"
                                  onClick={() => handleReactivateCompany(comp.id_empresa, comp.nombre_empresa)}
                              >
                                  Reactivar
                              </button>
                              <button
                                  className="manage-item-btn delete-btn"
                                  onClick={() => handleHardDeleteCompany(comp.id_empresa, comp.nombre_empresa)}
                              >
                                  Eliminar Permanentemente
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
        )}


        {/* Placeholder para Información Básica (si no es owner) */}
        {currentUser.rol !== 'owner' && (
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


        {/* Formularios a Diligenciar */}
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
                    <button className="edit-btn" onClick={() => handleOpenUserCompanyModal(company)}>
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

        </div>
      {showEditUserModal && currentUser && (
        <EditUserProfileModal
          currentUser={currentUser}
          onClose={handleCloseEditUserModal}
          onUpdateSuccess={handleUserUpdateSuccess}
        />
      )}

      {showEditUserCompanyModal && companyToEdit && (
        <EditCompanyProfileModal
          currentCompany={companyToEdit}
          onClose={handleCloseUserCompanyModal}
          onUpdateSuccess={handleCompanyUpdateSuccess}
        />
      )}

      {showEditOwnerCompanyModal && companyToEdit && (
        <EditOwnerCompanyModal
          currentCompany={companyToEdit}
          onClose={handleCloseOwnerCompanyModal}
          onUpdateSuccess={handleCompanyUpdateSuccess}
        />
      )}

      {/* Modal para editar usuarios administradores */}
      {showEditAdminUserModal && userToEdit && (
        <EditUserProfileModal
          currentUser={userToEdit}
          onClose={handleCloseEditAdminUserModal}
          onUpdateSuccess={handleUserUpdateSuccess}
          isEditingOtherUser={true}
        />
      )}
    </>
  );
};

export default Profile;
