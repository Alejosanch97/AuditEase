import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

import { EditUserProfileModal } from '../components/EditUserProfileModal.jsx';
import { EditUserByAdminModal } from '../components/EditUserByAdminModal.jsx';
import { EditCompanyProfileModal } from '../components/EditCompanyProfileModal.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx'; 

export const UsersProfile = () => {
    const { store, dispatch } = useGlobalReducer();
    const navigate = useNavigate();

    const [currentDateHeader, setCurrentDateHeader] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const [allCompanyUsers, setAllCompanyUsers] = useState([]);
    const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
    const [errorCompanyUsers, setErrorCompanyUsers] = useState(null);

    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [showEditCompanyProfileModal, setShowEditCompanyProfileModal] = useState(false);
    const [showEditCompanyUserModal, setShowEditCompanyUserModal] = useState(false);

    const [companyToEdit, setCompanyToEdit] = useState(null);
    const [userToEdit, setUserToEdit] = useState(null);

    // --- ESTADOS PARA EL MODAL DE CONFIRMACIÓN ---
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationModalData, setConfirmationModalData] = useState({});

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
    }, [allForms, dispatch, navigate]);

    const favoriteFormsDetails = useMemo(() => {
        if (!currentUser || !Array.isArray(currentUser.favoritos)) {
            return [];
        }
        const forms = Array.isArray(allForms) ? allForms : [];
        if (forms.length === 0 || currentUser.favoritos.length === 0) {
            return [];
        }
        return forms.filter(form => currentUser.favoritos.includes(form.id_formulario));
    }, [currentUser, allForms]);

    const fetchAllCompanyUsers = useCallback(async () => {
        if (currentUser && currentUser.rol === 'admin_empresa' && currentUser.empresa?.id_empresa) {
            setLoadingCompanyUsers(true);
            setErrorCompanyUsers(null);
            const token = localStorage.getItem('access_token');
            if (!token) {
                setLoadingCompanyUsers(false);
                dispatch({ type: 'LOGOUT' });
                navigate('/login');
                return;
            }
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok && data.usuarios) {
                    const usersInCurrentCompany = data.usuarios.filter(
                        user => user.id_empresa === currentUser.empresa.id_empresa
                    );
                    setAllCompanyUsers(usersInCurrentCompany);
                } else {
                    console.error('Error al cargar usuarios de la empresa:', data.error);
                    setErrorCompanyUsers(data.error);
                    dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar usuarios de la empresa.' } });
                }
            } catch (error) {
                console.error('Error de conexión al cargar usuarios de la empresa:', error);
                setErrorCompanyUsers('Error de conexión al cargar usuarios de la empresa.');
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar usuarios de la empresa.' } });
            } finally {
                setLoadingCompanyUsers(false);
            }
        } else {
            setAllCompanyUsers([]);
            setLoadingCompanyUsers(false);
            setErrorCompanyUsers(null);
        }
    }, [currentUser, dispatch, navigate]);

    useEffect(() => {
        if (!currentUser) {
            return;
        }

        if (currentUser.rol === 'admin_empresa') {
            fetchAllCompanyUsers();
        }

        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
        setCurrentDateHeader(formattedDate);
    }, [currentUser, fetchAllCompanyUsers]);

    const activeFormUsers = useMemo(() => {
        return allCompanyUsers.filter(user => user.activo && user.rol === 'usuario_formulario');
    }, [allCompanyUsers]);

    const inactiveFormUsers = useMemo(() => {
        return allCompanyUsers.filter(user => !user.activo && user.rol === 'usuario_formulario');
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
        if (currentUser && updatedUserData.id_usuario === currentUser.id_usuario) {
            dispatch({ type: 'SET_USER', payload: updatedUserData });
        }
        if (currentUser.rol === 'admin_empresa') {
            fetchAllCompanyUsers();
        }
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Usuario ${updatedUserData.nombre_completo} actualizado con éxito.` } });
        handleCloseEditUserModal();
        handleCloseEditCompanyUserModal();
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
        if (currentUser.rol === 'admin_empresa') {
            fetchAllCompanyUsers();
        }
        handleCloseCompanyProfileModal();
    };

    // --- LÓGICA DE ACTIVACIÓN/DESACTIVACIÓN (PUT) Y ELIMINACIÓN (DELETE) ---

    // Función para manejar la acción de desactivar/reactivar
    const handleToggleUserActiveStatus = async (userId, userName, isActive) => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
            return;
        }

        try {
            const payload = { activo: isActive };
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || `Usuario ${userName} ${isActive ? 'reactivado' : 'desactivado'} exitosamente.` } });
                fetchAllCompanyUsers();
            } else {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || `Error al ${isActive ? 'reactivar' : 'desactivar'} el usuario.` } });
            }
        } catch (error) {
            console.error(`Error al ${isActive ? 'reactivar' : 'desactivar'} usuario:`, error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error de conexión al ${isActive ? 'reactivar' : 'desactivar'} el usuario.` } });
        }
        setShowConfirmationModal(false); // Cierra el modal después de la acción
    };

    // Función que dispara el modal para DESACTIVAR
    const handleDeactivateClick = (userId, userName) => {
        if (userId === currentUser.id_usuario) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'No puedes desactivarte a ti mismo.' } });
            return;
        }
        setConfirmationModalData({
            title: 'Desactivar Usuario',
            message: `¿Estás seguro de que quieres desactivar al usuario "${userName}"? No podrá iniciar sesión.`,
            onConfirm: () => handleToggleUserActiveStatus(userId, userName, false)
        });
        setShowConfirmationModal(true);
    };

    // Función que dispara el modal para REACTIVAR
    const handleReactivateClick = (userId, userName) => {
        setConfirmationModalData({
            title: 'Reactivar Usuario',
            message: `¿Estás seguro de que quieres reactivar al usuario "${userName}"? Volverá a tener acceso.`,
            onConfirm: () => handleToggleUserActiveStatus(userId, userName, true)
        });
        setShowConfirmationModal(true);
    };

    // Función para manejar la eliminación permanente (DELETE)
    const handlePermanentDeleteUser = async (userId, userName) => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresa/usuarios/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message || `Usuario ${userName} eliminado permanentemente.` } });
                fetchAllCompanyUsers();
            } else {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: data.error || 'Error al eliminar el usuario permanentemente.' } });
            }
        } catch (error) {
            console.error('Error al eliminar usuario permanentemente:', error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al eliminar el usuario.' } });
        }
        setShowConfirmationModal(false);
    };

    // Función que dispara el modal para ELIMINAR PERMANENTEMENTE
    const handlePermanentDeleteClick = (userId, userName) => {
        setConfirmationModalData({
            title: 'Eliminar Usuario Permanentemente',
            message: `¡ADVERTENCIA! ¿Estás seguro de que quieres ELIMINAR PERMANENTEMENTE al usuario "${userName}"? Esta acción no se puede deshacer.`,
            onConfirm: () => handlePermanentDeleteUser(userId, userName)
        });
        setShowConfirmationModal(true);
    };
    
    // --- FIN DE LA LÓGICA DE ACTIVACIÓN/DESACTIVACIÓN Y ELIMINACIÓN ---


    if (!currentUser) {
        return (
            <div className="loading-spinner-container">
                Cargando perfil...
            </div>
        );
    }

    const canEditCompany = currentUser.rol === 'admin_empresa';

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

                {/* HE MODIFICADO ESTA CARD PARA QUE CONTENGA AMBAS LISTAS */}
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
                        ) : errorCompanyUsers ? (
                            <p className="error-message">Error al cargar usuarios: {errorCompanyUsers}</p>
                        ) : (
                            <>
                                {/* Sub-sección para USUARIOS ACTIVOS */}
                                {activeFormUsers.length > 0 ? (
                                    <div className="users-list active-users-list">
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
                                                        onClick={() => handleDeactivateClick(user.id_usuario, user.nombre_completo)}
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

                                {/* Sub-sección para USUARIOS INACTIVOS (solo se muestra si hay alguno) */}
                                {inactiveFormUsers.length > 0 && (
                                    <div className="users-list inactive-users-list">
                                        <h4>Usuarios Inactivos</h4>
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
                                                        onClick={() => handleReactivateClick(user.id_usuario, user.nombre_completo)}
                                                    >
                                                        Reactivar
                                                    </button>
                                                    <button
                                                        className="manage-item-btn permanent-delete-btn"
                                                        onClick={() => handlePermanentDeleteClick(user.id_usuario, user.nombre_completo)}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                )}

                {currentUser.rol === 'usuario_formulario' && (
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
            </div>

            {/* Modales existentes */}
            {showEditUserModal && currentUser && (
                <EditUserProfileModal
                    currentUser={currentUser}
                    onClose={handleCloseEditUserModal}
                    onUpdateSuccess={handleUserUpdateSuccess}
                />
            )}
            
            {showEditCompanyUserModal && userToEdit && (
                <EditUserByAdminModal
                    userToEdit={userToEdit}
                    onClose={handleCloseEditCompanyUserModal}
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

            {showConfirmationModal && (
                <ConfirmationModal
                    title={confirmationModalData.title}
                    message={confirmationModalData.message}
                    onConfirm={confirmationModalData.onConfirm}
                    onCancel={() => setShowConfirmationModal(false)}
                />
            )}
        </>
    );
};

export default UsersProfile;