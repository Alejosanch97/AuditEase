import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import { ConfirmationModal } from '../components/ConfirmationModal'; // Importa el nuevo componente

import { EditUserProfileModal } from '../components/EditUserProfileModal.jsx';
import { EditCompanyProfileModal } from '../components/EditCompanyProfileModal.jsx'; 
import { EditOwnerCompanyModal } from '../components/EditOwnerCompanyModal.jsx';
import { EditUserByOwnerModal } from '../components/EditUserByOwnerModal.jsx';

export const Profile = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [currentDateHeader, setCurrentDateHeader] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [ownerCompanies, setOwnerCompanies] = useState([]);
  const [inactiveCompanies, setInactiveCompanies] = useState([]);
  const [allCompanyUsers, setAllCompanyUsers] = useState([]);
  const [inactiveCompanyUsers, setInactiveCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditUserCompanyModal, setShowEditUserCompanyModal] = useState(false);
  const [showEditOwnerCompanyModal, setShowEditOwnerCompanyModal] = useState(false);
  const [showEditUserByOwnerModal, setShowEditUserByOwnerModal] = useState(false);

  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);
  
  // NUEVO: Estado para el modal de confirmación
  const [confirmationModal, setConfirmationModal] = useState({
    isVisible: false,
    message: '',
    onConfirm: () => {},
  });

  const currentUser = store.user;
  const company = currentUser?.empresa;
  const allForms = store.formularios;

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
  

  const favoriteFormsDetails = useMemo(() => {
    if (!currentUser || !currentUser.favoritos || allForms.length === 0) {
      return [];
    }
    return allForms.filter(form => currentUser.favoritos.includes(form.id_formulario));
  }, [currentUser, allForms]);

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
        const activeComps = allFetchedCompanies.filter(comp => comp.activo && comp.id_empresa !== ownerCompanyIdToExclude);
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

  const fetchCompanyUsers = useCallback(async () => {
    if (currentUser && (currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa')) {
      setLoadingUsers(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoadingUsers(false);
        return;
      }
      try {
        let url;
        if (currentUser.rol === 'owner') {
          url = `${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios`;
        } else { // admin_empresa
          url = `${import.meta.env.VITE_BACKEND_URL}/api/admin_empresa/usuarios`;
        }

        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok && data.usuarios) {
          const activeUsers = data.usuarios.filter(user => user.activo);
          const inactiveUsers = data.usuarios.filter(user => !user.activo);
          setAllCompanyUsers(activeUsers);
          setInactiveCompanyUsers(inactiveUsers);
        } else {
          console.error('Error al cargar usuarios:', data.error);
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar usuarios.' } });
        }
      } catch (error) {
        console.error('Error de conexión al cargar usuarios:', error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar usuarios.' } });
      } finally {
        setLoadingUsers(false);
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
      }
      if (currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') {
        fetchCompanyUsers();
      }
    }

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
    setCurrentDateHeader(formattedDate);
  }, [currentUser, fetchOwnerCompanies, fetchCompanyUsers]);

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

  const handleOpenEditUserByOwnerModal = (user) => {
    setUserToEdit(user);
    setShowEditUserByOwnerModal(true);
  };

  const handleCloseEditUserByOwnerModal = () => {
    setShowEditUserByOwnerModal(false);
    setUserToEdit(null);
  };

  const handleUserUpdateSuccess = (updatedUserData) => {
    if (currentUser && updatedUserData.id_usuario === currentUser.id_usuario) {
      dispatch({ type: 'SET_USER', payload: updatedUserData });
    } else {
      setAllCompanyUsers(prevUsers => {
        const updatedList = prevUsers.map(user =>
          user.id_usuario === updatedUserData.id_usuario ? updatedUserData : user
        );
        return updatedList.filter(user => user.activo);
      });
      setInactiveCompanyUsers(prevUsers => {
        const updatedList = prevUsers.map(user =>
          user.id_usuario === updatedUserData.id_usuario ? updatedUserData : user
        );
        return updatedList.filter(user => !user.activo);
      });
    }
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Usuario ${updatedUserData.nombre_completo} actualizado con éxito.` } });
    handleCloseEditUserModal();
    handleCloseEditUserByOwnerModal();
  };

  const handleCompanyUpdateSuccess = (updatedCompanyData) => {
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Empresa ${updatedCompanyData.nombre_empresa} actualizada con éxito.` } });

    if (company && company.id_empresa === updatedCompanyData.id_empresa) {
      dispatch({
        type: 'SET_USER',
        payload: {
          ...store.user,
          empresa: updatedCompanyData
        }
      });
    }

    setOwnerCompanies(prev => prev.map(comp => comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp));
    setInactiveCompanies(prev => prev.map(comp => comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp));

    handleCloseUserCompanyModal();
    handleCloseOwnerCompanyModal();
  };
  
  // NUEVO: Función para abrir el modal de confirmación
  const openConfirmationModal = (message, onConfirmAction) => {
    setConfirmationModal({
      isVisible: true,
      message: message,
      onConfirm: onConfirmAction,
    });
  };

  // NUEVO: Función para cerrar el modal de confirmación
  const closeConfirmationModal = () => {
    setConfirmationModal({
      isVisible: false,
      message: '',
      onConfirm: () => {},
    });
  };

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleDeleteCompany = (companyId, companyName) => {
    openConfirmationModal(
      `¿Estás seguro de que quieres desactivar la empresa "${companyName}"? Esto también desactivará a todos sus usuarios.`,
      () => performDeleteCompany(companyId, companyName)
    );
  };

  const performDeleteCompany = async (companyId, companyName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/${companyId}/desactivar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Empresa desactivada exitosamente.' } });

        const deactivatedCompany = ownerCompanies.find(comp => comp.id_empresa === companyId);
        if (deactivatedCompany) {
          setOwnerCompanies(prevCompanies => prevCompanies.filter(comp => comp.id_empresa !== companyId));
          setInactiveCompanies(prevInactive => [...prevInactive, { ...deactivatedCompany, activo: false }]);
        }
        fetchCompanyUsers();
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

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleReactivateCompany = (companyId, companyName) => {
    openConfirmationModal(
      `¿Estás seguro de que quieres reactivar la empresa "${companyName}"? Esto también reactivará a sus usuarios asociados.`,
      () => performReactivateCompany(companyId, companyName)
    );
  };

  const performReactivateCompany = async (companyId, companyName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/owner/empresas/${companyId}/reactivar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Empresa reactivada exitosamente.' } });

        const reactivatedCompany = inactiveCompanies.find(comp => comp.id_empresa === companyId);
        if (reactivatedCompany) {
          setInactiveCompanies(prevInactive => prevInactive.filter(comp => comp.id_empresa !== companyId));
          if (reactivatedCompany.id_empresa !== currentUser.empresa.id_empresa) {
            setOwnerCompanies(prevActive => [...prevActive, { ...reactivatedCompany, activo: true }]);
          }
        }
        fetchCompanyUsers();
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

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleHardDeleteCompany = (companyId, companyName) => {
    openConfirmationModal(
      `¡ADVERTENCIA! Estás a punto de eliminar PERMANENTEMENTE la empresa "${companyName}" y TODOS sus datos relacionados (usuarios, formularios, respuestas, etc.). Esta acción es IRREVERSIBLE. ¿Estás absolutamente seguro?`,
      () => performHardDeleteCompany(companyId, companyName)
    );
  };

  const performHardDeleteCompany = async (companyId, companyName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

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
        setInactiveCompanies(prevInactive => prevInactive.filter(comp => comp.id_empresa !== companyId));
        fetchCompanyUsers();
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al eliminar la empresa permanentemente.' } });
      }
    } catch (error) {
      console.error('Error al eliminar empresa permanentemente:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al eliminar la empresa permanentemente.' } });
    }
  };

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleDeactivateUser = (userId, userName) => {
    if (userId === currentUser.id_usuario) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No puedes desactivarte a ti mismo.' } });
      return;
    }
    openConfirmationModal(
      `¿Estás seguro de que quieres desactivar al usuario "${userName}"? No podrá iniciar sesión.`,
      () => performDeactivateUser(userId, userName)
    );
  };

  const performDeactivateUser = async (userId, userName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const url = currentUser.rol === 'owner' ?
        `${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios/${userId}` :
        `${import.meta.env.VITE_BACKEND_URL}/api/admin_empresa/usuarios/${userId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario desactivado exitosamente.' } });
        const deactivatedUser = allCompanyUsers.find(user => user.id_usuario === userId);
        if (deactivatedUser) {
          setAllCompanyUsers(prevUsers => prevUsers.filter(user => user.id_usuario !== userId));
          setInactiveCompanyUsers(prevInactive => [...prevInactive, { ...deactivatedUser, activo: false }]);
        }
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al desactivar el usuario.' } });
      }
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al desactivar el usuario.' } });
    }
  };

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleReactivateUser = (userId, userName) => {
    openConfirmationModal(
      `¿Estás seguro de que quieres reactivar al usuario "${userName}"?`,
      () => performReactivateUser(userId, userName)
    );
  };

  const performReactivateUser = async (userId, userName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const url = currentUser.rol === 'owner' ?
        `${import.meta.env.VITE_BACKEND_URL}/api/owner/usuarios/reactivate/${userId}` :
        `${import.meta.env.VITE_BACKEND_URL}/api/admin_empresa/usuarios/reactivate/${userId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario reactivado exitosamente.' } });
        const reactivatedUser = inactiveCompanyUsers.find(user => user.id_usuario === userId);
        if (reactivatedUser) {
          setInactiveCompanyUsers(prevInactive => prevInactive.filter(user => user.id_usuario !== userId));
          setAllCompanyUsers(prevActive => [...prevActive, { ...reactivatedUser, activo: true }]);
        }
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al reactivar el usuario.' } });
      }
    } catch (error) {
      console.error('Error al reactivar usuario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al reactivar el usuario.' } });
    }
  };

  // REFRACTORIZADO: Llama a openConfirmationModal en lugar de window.confirm
  const handleHardDeleteUser = (userId, userName) => {
    openConfirmationModal(
      `¡ADVERTENCIA! Estás a punto de eliminar PERMANENTEMENTE al usuario "${userName}". Esto es IRREVERSIBLE. ¿Estás absolutamente seguro?`,
      () => performHardDeleteUser(userId, userName)
    );
  };
  
  const performHardDeleteUser = async (userId, userName) => {
    closeConfirmationModal(); // Cierra el modal antes de la acción

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/usuarios/permanently/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || 'Usuario eliminado permanentemente.' } });
        setInactiveCompanyUsers(prevUsers => prevUsers.filter(user => user.id_usuario !== userId));
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al eliminar el usuario permanentemente.' } });
      }
    } catch (error) {
      console.error('Error al eliminar usuario permanentemente:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al eliminar el usuario permanentemente.' } });
    }
  };


  if (!currentUser) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: '#2c3e50' }}>
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

  const activeDisplayUsers = useMemo(() => {
    if (currentUser.rol === 'owner') {
      return allCompanyUsers.filter(user => user.rol === 'admin_empresa');
    } else if (currentUser.rol === 'admin_empresa') {
      return allCompanyUsers.filter(user => user.rol === 'usuario_formulario');
    }
    return [];
  }, [currentUser, allCompanyUsers]);

  const inactiveDisplayUsers = useMemo(() => {
    if (currentUser.rol === 'owner') {
      return inactiveCompanyUsers.filter(user => user.rol === 'admin_empresa');
    } else if (currentUser.rol === 'admin_empresa') {
      return inactiveCompanyUsers.filter(user => user.rol === 'usuario_formulario');
    }
    return [];
  }, [currentUser, inactiveCompanyUsers]);


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

        {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
          <section className="card admin-users-card">
            <div className="card-header">
              <h3>{currentUser.rol === 'owner' ? 'Usuarios Administradores' : 'Usuarios de la Empresa'}</h3>
              <Link to="/user-company-management?action=manage-users" className="view-all-btn">Ver Todos</Link>
            </div>
            {loadingUsers ? (
              <p>Cargando usuarios...</p>
            ) : activeDisplayUsers.length > 0 ? (
              <div className="users-list">
                {activeDisplayUsers.map(user => (
                  <div key={user.id_usuario} className="user-item">
                    <img
                      src={user.imagen_perfil_url || "https://placehold.co/60x60/1abc9c/ffffff?text=AD"}
                      alt={`Perfil de ${user.nombre_completo}`}
                      className="user-list-picture"
                    />
                    <div className="user-details">
                      <h4>{user.nombre_completo}</h4>
                      <p>{user.email}</p>
                      <p className="user-role">{user.rol}</p>
                    </div>
                    <div className="item-actions">
                      <button
                        className="manage-item-btn edit-btn"
                        onClick={() => handleOpenEditUserByOwnerModal(user)}
                      >
                        Editar
                      </button>
                      <button
                        className="manage-item-btn delete-btn"
                        onClick={() => handleDeactivateUser(user.id_usuario, user.nombre_completo)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="info-message">No hay usuarios activos registrados.</p>
            )}
          </section>
        )}

        {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && inactiveDisplayUsers.length > 0 && (
          <section className="card inactive-users-card">
            <div className="card-header">
              <h3>Usuarios Inactivos</h3>
            </div>
            <div className="users-list">
              {inactiveDisplayUsers.map(user => (
                <div key={user.id_usuario} className="user-item inactive-item">
                  <img
                    src={user.imagen_perfil_url || "https://placehold.co/60x60/7f8c8d/ffffff?text=AD"}
                    alt={`Perfil de ${user.nombre_completo}`}
                    className="user-list-picture"
                  />
                  <div className="user-details">
                    <h4>{user.nombre_completo}</h4>
                    <p>{user.email}</p>
                    <p className="user-role">{user.rol}</p>
                  </div>
                  <div className="item-actions">
                    <button
                      className="manage-item-btn reactivate-btn"
                      onClick={() => handleReactivateUser(user.id_usuario, user.nombre_completo)}
                    >
                      Reactivar
                    </button>
                    <button
                      className="manage-item-btn hard-delete-btn"
                      onClick={() => handleHardDeleteUser(user.id_usuario, user.nombre_completo)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                  <div key={comp.id_empresa} className="company-item">
                    <img
                      src={comp.logo_url || "https://placehold.co/60x60/2c3e50/ffffff?text=LOGO"}
                      alt={`Logo de ${comp.nombre_empresa}`}
                      className="company-list-logo"
                    />
                    <div className="company-details">
                      <h4>{comp.nombre_empresa}</h4>
                      <p className="company-status active">
                        Estado: Activa
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
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="info-message">No tienes empresas activas adicionales. <Link to="/user-company-management?action=create-company">Crea una ahora</Link>.</p>
            )}
          </section>
        )}

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
                      className="manage-item-btn hard-delete-btn"
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

      {showEditUserByOwnerModal && userToEdit && (
        <EditUserByOwnerModal
          userToEdit={userToEdit}
          onClose={handleCloseEditUserByOwnerModal}
          onUpdateSuccess={handleUserUpdateSuccess}
        />
      )}

      {/* NUEVO: Renderiza el modal de confirmación si está visible */}
      {confirmationModal.isVisible && (
        <ConfirmationModal
          message={confirmationModal.message}
          onConfirm={confirmationModal.onConfirm}
          onCancel={closeConfirmationModal}
        />
      )}
    </>
  );
};

export default Profile;