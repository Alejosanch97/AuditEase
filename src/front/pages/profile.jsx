// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/dashboard.css";
import "../styles/modal.css";

import { EditUserProfileModal } from '../components/EditUserProfileModal.jsx';
import { EditCompanyProfileModal } from '../components/EditCompanyProfileModal.jsx';
import { EditOwnerCompanyModal } from '../components/EditOwnerCompanyModal.jsx'; // NUEVO: Importa el nuevo modal

export const Profile = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [currentDateHeader, setCurrentDateHeader] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [ownerCompanies, setOwnerCompanies] = useState([]);

  const [showEditUserModal, setShowEditUserModal] = useState(false); // Este es el que controla el modal de usuario
  // Estados para el modal de edición de la empresa del USUARIO (Información Laboral)
  const [showEditUserCompanyModal, setShowEditUserCompanyModal] = useState(false);
  // Estados para el modal de edición de EMPRESAS CREADAS POR EL OWNER (Mis Empresas)
  const [showEditOwnerCompanyModal, setShowEditOwnerCompanyModal] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null); // Usado por ambos modales para la empresa actual

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!store.isLoggedIn && !store.user && token) {
      const verifyToken = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/verificar-token`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          });
          const data = await response.json();

          if (response.ok && data.valid) {
            dispatch({ type: 'SET_USER', payload: data.usuario });
            if (data.usuario.rol === 'owner' && data.usuario.empresa) { // Asegúrate de que `empresa` exista
              fetchOwnerCompanies(token, data.usuario.empresa.id_empresa); // Pasa el ID de la empresa base del owner
            }
          } else {
            localStorage.removeItem('access_token');
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
          }
        } catch (error) {
          console.error('Error verificando token:', error);
          localStorage.removeItem('access_token');
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
        }
      };
      verifyToken();
    } else if (!store.isLoggedIn || !store.user) {
      navigate('/login');
    } else if (store.user.rol === 'owner' && store.isLoggedIn && store.user && !ownerCompanies.length) {
      // Aseguramos que la empresa del usuario ya esté cargada para evitar doble llamada o problemas de ID
      if (store.user.empresa) {
        fetchOwnerCompanies(localStorage.getItem('access_token'), store.user.empresa.id_empresa);
      }
    }


    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
    setCurrentDateHeader(formattedDate);

  }, [store.isLoggedIn, store.user, navigate, dispatch, ownerCompanies.length]);

  // MODIFICADO: Ahora recibe ownerCompanyIdToExclude
  const fetchOwnerCompanies = async (token, ownerCompanyIdToExclude) => {
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
        // FILTRADO: Excluir la empresa del usuario logeado (ej. "SGSST Flow")
        const filteredCompanies = data.empresas.filter(
            comp => comp.id_empresa !== ownerCompanyIdToExclude
        );
        setOwnerCompanies(filteredCompanies || []);
      } else {
        console.error('Error al cargar empresas del owner:', data.error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error al cargar tus empresas.' } });
      }
    } catch (error) {
      console.error('Error de conexión al cargar empresas del owner:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    }
  };

  const currentUser = store.user;
  const company = currentUser?.empresa; // La empresa a la que pertenece el usuario (SGSST Flow)

  // Handlers para el modal de edición de perfil de usuario
  const handleOpenEditUserModal = () => setShowEditUserModal(true);
  const handleCloseEditUserModal = () => setShowEditUserModal(false);

  // Handlers para el modal de edición de la EMPRESA DEL USUARIO (Información Laboral)
  const handleOpenUserCompanyModal = (companyData) => {
    setCompanyToEdit(companyData);
    setShowEditUserCompanyModal(true);
  };
  const handleCloseUserCompanyModal = () => {
    setShowEditUserCompanyModal(false);
    setCompanyToEdit(null);
  };

  // Handlers para el modal de edición de EMPRESAS CREADAS POR EL OWNER (Mis Empresas)
  const handleOpenOwnerCompanyModal = (companyData) => {
    setCompanyToEdit(companyData);
    setShowEditOwnerCompanyModal(true);
  };
  const handleCloseOwnerCompanyModal = () => {
    setShowEditOwnerCompanyModal(false);
    setCompanyToEdit(null);
  };

  const handleUserUpdateSuccess = (updatedUserData) => {
    dispatch({ type: 'SET_USER', payload: updatedUserData });
    handleCloseEditUserModal();
  };

  // MODIFICADO: Manejo de actualización de la empresa
  const handleCompanyUpdateSuccess = (updatedCompanyData) => {
    // Si la empresa actualizada es la empresa asociada directamente al usuario logeado
    if (company && company.id_empresa === updatedCompanyData.id_empresa) {
        dispatch({
            type: 'SET_USER',
            payload: {
                ...store.user,
                empresa: updatedCompanyData
            }
        });
        handleCloseUserCompanyModal(); // Cierra el modal de la empresa del usuario
    } else {
        // Si no es la empresa del usuario, debe ser una de las empresas creadas por el owner
        setOwnerCompanies(prevCompanies =>
            prevCompanies.map(comp =>
                comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp
            )
        );
        handleCloseOwnerCompanyModal(); // Cierra el modal de la empresa del owner
    }
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Empresa ${updatedCompanyData.nombre_empresa} actualizada con éxito.` } });
  };


  const handleLogout = () => {
    localStorage.removeItem('access_token');
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  if (!currentUser) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--primary-dark)' }}>
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
    <div className="dashboard-container">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-avatar">
            <img src={currentUser.imagen_perfil_url || "https://via.placeholder.com/40/1abc9c/ffffff?text=HV"} alt="Avatar de Usuario" />
          </div>
          <div className="user-info">
            <h3>{currentUser.nombre_completo}</h3>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className="active"><Link to="/profile"><i className="fas fa-user"></i> Mi Perfil</Link></li>
            {/* NUEVO LINK para Gestión de Usuarios/Empresas (solo si es owner) */}
            {currentUser.rol === 'owner' && (
              <li><Link to="/user-company-management"><i className="fas fa-users"></i> Gestión de Empresas y Usuarios</Link></li>
            )}
            <li><Link to="/create-forms"><i className="fas fa-file-alt"></i> Crear Formularios</Link></li>
            <li><Link to="/form-templates"><i className="fas fa-clipboard-list"></i> Plantillas de Formularios</Link></li>
            <li><Link to="/generate-reports"><i className="fas fa-chart-line"></i> Generar Reportes</Link></li>
            <li><Link to="/agenda"><i className="fas fa-calendar-alt"></i> Agenda y Citas</Link></li>
            <li><Link to="/notifications"><i className="fas fa-bell"></i> Notificaciones</Link></li>
            <li><Link to="/settings"><i className="fas fa-cogs"></i> Configuraciones</Link></li>
            <li><Link to="/help-support"><i className="fas fa-question-circle"></i> Ayuda y Soporte</Link></li>
            <li><Link to="#" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Cerrar Sesión</Link></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <p>&copy; 2025 SGSST FLOW. Todos los derechos reservados.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
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
              <img src={currentUser.imagen_perfil_url || "https://via.placeholder.com/130/1abc9c/ffffff?text=HV"} alt="Imagen de Perfil" className="profile-picture" />
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

          {/* Calendar Card - Se mantiene igual */}
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

          {/* Upcoming Events Card - Se mantiene igual */}
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
                      <img src="https://via.placeholder.com/30/f00" alt="Participante" />
                      <img src="https://via.placeholder.com/30/0f0" alt="Participante" />
                      <img src="https://via.placeholder.com/30/00f" alt="Participante" />
                      <span>+8</span>
                  </div>
              </div>
              <div className="event-item">
                  <div className="event-details">
                      <h4>Capacitación SGSST</h4>
                      <p>11:00 AM - 12:30 PM</p>
                  </div>
                  <div className="event-participants">
                      <img src="https://via.placeholder.com/30/f0f" alt="Participante" />
                      <img src="https://via.placeholder.com/30/ff0" alt="Participante" />
                      <span>+5</span>
                  </div>
              </div>
              <div className="event-item">
                  <div className="event-details">
                      <h4>Reunión de Seguridad</h4>
                      <p>02:00 PM - 03:00 PM</p>
                  </div>
                  <div className="event-participants">
                      <img src="https://via.placeholder.com/30/0ff" alt="Participante" />
                      <span>+3</span>
                  </div>
              </div>
          </section>

          {/* NUEVA SECCIÓN: MIS EMPRESAS (Solo para Owner) */}
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
                                    src={comp.logo_url || "https://via.placeholder.com/60/2c3e50/ffffff?text=LOGO"}
                                    alt={`Logo de ${comp.nombre_empresa}`}
                                    className="company-list-logo"
                                />
                                <div className="company-details">
                                    <h4>{comp.nombre_empresa}</h4>
                                    {/* Muestra el estado activo/inactivo */}
                                    <p className={`company-status ${comp.activo ? 'active' : 'inactive'}`}>
                                        Estado: {comp.activo ? 'Activa' : 'Inactiva'}
                                    </p>
                                </div>
                                <button
                                    className="manage-company-btn"
                                    onClick={() => handleOpenOwnerCompanyModal(comp)}
                                >
                                    Editar
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No has creado ninguna empresa adicional todavía. <Link to="/user-company-management?action=create-company">Crea una ahora</Link>.</p>
                )}
            </section>
          )}

          {/* Placeholder para Información Básica (si no es owner, o si quieres moverla a otro lado) */}
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


          {/* Personal Information Card - Se mantiene igual */}
          <section className="card personal-info-card">
              <div className="card-header">
                  <h3>Información Personal</h3>
              </div>
              <div className="info-group">
                  <div className="info-item">
                      <h4>Fecha Nacimiento</h4>
                      <p>{currentUser.fecha_nacimiento || 'N/A'}</p>
                  </div>
                  <div className="info-item">
                      <h4>Dirección</h4>
                      <p>{currentUser.direccion_personal || 'N/A'}</p>
                  </div>
                  <div className="info-item">
                      <h4>Ciudad</h4>
                      <p>{currentUser.ciudad || 'N/A'}</p>
                  </div>
                  <div className="info-item">
                      <h4>País</h4>
                      <p>{currentUser.pais || 'N/A'}</p>
                  </div>
              </div>
          </section>

          {/* INFORMACIÓN DE LA EMPRESA (Occupation Info Card) - Siempre la empresa del usuario logeado */}
          <section className="card occupation-info-card">
              <div className="card-header">
                  <h3>Información Laboral</h3>
                  {canEditCompany && company && ( // Asegurarse de que haya una empresa para editar
                      <button className="edit-btn" onClick={() => handleOpenUserCompanyModal(company)}> {/* Usa el handler específico */}
                        Editar
                      </button>
                  )}
              </div>
              {company ? (
                  <div className="profile-header">
                    <img
                        src={company.logo_url || "https://via.placeholder.com/100/2c3e50/ffffff?text=LOGO"}
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

          {/* Las otras tarjetas (Onboarding, Charts, Data Table, Progress) se mantienen igual */}
          {/* ... (código de otras secciones) ... */}
          <section className="card onboarding-card">
            <div className="card-header">
              <h3>Proceso de Inducción</h3>
              <span>1/5 completado</span>
            </div>
            <div className="onboarding-task-list">
              <div className="task-item completed">
                  <i className="fas fa-check-circle"></i>
                  <div className="task-details">
                      <h4>Preparar espacio de trabajo</h4>
                      <p>software, accesos</p>
                  </div>
                  <span className="assigned-to"></span>
                  <span className="due-date"></span>
                  <div className="task-actions">
                      <i className="fas fa-paperclip"></i>
                      <i className="fas fa-ellipsis-h"></i>
                  </div>
              </div>
              <div className="task-item">
                  <i className="far fa-circle"></i>
                  <div className="task-details">
                      <h4>Reunión con gerente de RRHH</h4>
                  </div>
                  <span className="assigned-to">Juan Pérez</span>
                  <span className="due-date">Jul 26, 2025</span>
                  <div className="task-actions">
                      <i className="fas fa-paperclip"></i>
                      <i className="fas fa-ellipsis-h"></i>
                  </div>
              </div>
              <div className="task-item">
                  <i className="far fa-circle"></i>
                  <div className="task-details">
                      <h4>Tour de la oficina para empleado</h4>
                  </div>
                  <span className="assigned-to">María Gómez</span>
                  <span className="due-date">Jul 26, 2025</span>
                  <div className="task-actions">
                      <i className="fas fa-paperclip"></i>
                      <i className="fas fa-ellipsis-h"></i>
                  </div>
              </div>
              <div className="task-item">
                  <i className="far fa-circle"></i>
                  <div className="task-details">
                      <h4>Visión de la empresa</h4>
                  </div>
                  <span className="assigned-to">Carlos Ruiz</span>
                  <span className="due-date">Jul 28, 2025</span>
                  <div className="task-actions">
                      <i className="fas fa-paperclip"></i>
                      <i className="fas fa-ellipsis-h"></i>
                  </div>
              </div>
            </div>
          </section>

          <section className="card chart-card-1">
            <div className="card-header">
              <h3>Métricas de Rendimiento</h3>
              <select>
                <option>Mensual</option>
                <option>Trimestral</option>
                <option>Anual</option>
              </select>
            </div>
            <div className="chart-area">
              <img src="https://quickchart.io/chart?c={type:%27bar%27,data:{labels:[%27Ene%27,%27Feb%27,%27Mar%27,%27Abr%27,%27May%27,%27Jun%27],datasets:[{label:%27Tareas Completadas%27,data:[18,25,15,22,19,28],backgroundColor:%27%231abc9c%27},{label:%27Tareas Pendientes%27,data:[5,8,7,3,6,4],backgroundColor:%27%23f39c12%27}]}}" alt="Bar Chart" style={{ width: '100%', height: 'auto' }} />
            </div>
          </section>

          <section className="card data-table-card">
            <div className="card-header">
              <h3>Registro de Actividad Reciente</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Actualizó Perfil</td>
                  <td>2025-07-22</td>
                  <td className="status-success">Completado</td>
                </tr>
                <tr>
                  <td>Envió Reporte Q2</td>
                  <td>2025-07-20</td>
                  <td className="status-pending">Pendiente Revisión</td>
                </tr>
                <tr>
                  <td>Revisó Formulario SST-001</td>
                  <td>2025-07-19</td>
                  <td className="status-success">Completado</td>
                </tr>
                <tr>
                  <td>Asignó nueva tarea a equipo</td>
                  <td>2025-07-18</td>
                  <td className="status-success">Completado</td>
                </tr>
                <tr>
                  <td>Reunión con Proveedor</td>
                  <td>2025-07-17</td>
                  <td className="status-success">Completado</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="card progress-overview-card">
            <div className="card-header">
              <h3>Resumen de Cumplimiento</h3>
            </div>
            <div className="progress-item">
              <p>Capacitación Anual</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: '75%', backgroundColor: 'var(--secondary-accent)' }}></div>
              </div>
              <span>75%</span>
            </div>
            <div className="progress-item">
              <p>Revisión Documental</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: '90%', backgroundColor: 'var(--info-color)' }}></div>
              </div>
              <span>90%</span>
            </div>
            <div className="progress-item">
              <p>Reporte de Incidentes</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: '50%', backgroundColor: 'var(--error-color)' }}></div>
              </div>
              <span>50%</span>
            </div>
             <div className="progress-item">
                <p>Auditoría Interna</p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: '30%', backgroundColor: 'var(--warning-color)' }}></div>
                </div>
                <span>30%</span>
            </div>
          </section>

        </div>
      </main>

      {/* AQUÍ ESTÁ LA CORRECCIÓN: Agregar el modal de edición de perfil de usuario */}
      {showEditUserModal && currentUser && (
        <EditUserProfileModal
          currentUser={currentUser}
          onClose={handleCloseEditUserModal}
          onUpdateSuccess={handleUserUpdateSuccess}
        />
      )}

      {/* Modal para editar la EMPRESA DEL USUARIO (Información Laboral) */}
      {showEditUserCompanyModal && companyToEdit && (
        <EditCompanyProfileModal
          currentCompany={companyToEdit}
          onClose={handleCloseUserCompanyModal}
          onUpdateSuccess={handleCompanyUpdateSuccess}
        />
      )}

      {/* Modal para editar EMPRESAS CREADAS POR EL OWNER (Mis Empresas) */}
      {showEditOwnerCompanyModal && companyToEdit && (
        <EditOwnerCompanyModal
          currentCompany={companyToEdit}
          onClose={handleCloseOwnerCompanyModal}
          onUpdateSuccess={handleCompanyUpdateSuccess}
        />
      )}
    </div>
  );
};

export default Profile;