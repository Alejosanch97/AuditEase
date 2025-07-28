// src/pages/Profile.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  const [ownerCompanies, setOwnerCompanies] = useState([]);

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditUserCompanyModal, setShowEditUserCompanyModal] = useState(false);
  const [showEditOwnerCompanyModal, setShowEditOwnerCompanyModal] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null);

  const currentUser = store.user;
  const company = currentUser?.empresa;
  const allForms = store.formularios;

  // --- NUEVO: Cargar formularios si no están en el store ---
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

  // --- NUEVO: Obtener detalles de formularios favoritos ---
  const favoriteFormsDetails = useMemo(() => {
    if (!currentUser || !currentUser.favoritos || allForms.length === 0) {
      return [];
    }
    return allForms.filter(form => currentUser.favoritos.includes(form.id_formulario));
  }, [currentUser, allForms]);


  // Cargar empresas del owner solo si el usuario es un owner
  useEffect(() => {
    if (currentUser && currentUser.rol === 'owner') {
      const token = localStorage.getItem('access_token');
      if (token && currentUser.empresa && ownerCompanies.length === 0) {
        fetchOwnerCompanies(token, currentUser.empresa.id_empresa);
      }
    }

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', dateOptions);
    setCurrentDateHeader(formattedDate);

  }, [currentUser, ownerCompanies.length, dispatch]);

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

  const handleUserUpdateSuccess = (updatedUserData) => {
    dispatch({ type: 'SET_USER', payload: updatedUserData });
    handleCloseEditUserModal();
  };

  const handleCompanyUpdateSuccess = (updatedCompanyData) => {
    if (company && company.id_empresa === updatedCompanyData.id_empresa) {
        dispatch({
            type: 'SET_USER',
            payload: {
                ...store.user,
                empresa: updatedCompanyData
            }
        });
        handleCloseUserCompanyModal();
    } else {
        setOwnerCompanies(prevCompanies =>
            prevCompanies.map(comp =>
                comp.id_empresa === updatedCompanyData.id_empresa ? updatedCompanyData : comp
            )
        );
        handleCloseOwnerCompanyModal();
    }
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Empresa ${updatedCompanyData.nombre_empresa} actualizada con éxito.` } });
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
        {/* Profile Card - Vuelve a ser una sección independiente */}
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

        {/* Calendar Card - Vuelve a ser una sección independiente */}
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


        {/* Formularios a Diligenciar (antes Información Personal) */}
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

        {/* Las otras tarjetas (Onboarding, Charts, Data Table, Progress) se mantienen igual */}
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
              <div className="progress-bar" style={{ width: '75%', backgroundColor: '#1abc9c' /* secondary-accent */ }}></div>
            </div>
            <span>75%</span>
          </div>
          <div className="progress-item">
            <p>Revisión Documental</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: '90%', backgroundColor: '#3498db' /* info-color */ }}></div>
            </div>
            <span>90%</span>
          </div>
          <div className="progress-item">
            <p>Reporte de Incidentes</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: '50%', backgroundColor: '#e74c3c' /* error-color */ }}></div>
            </div>
            <span>50%</span>
          </div>
           <div className="progress-item">
                <p>Auditoría Interna</p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: '30%', backgroundColor: '#f39c12' /* warning-color */ }}></div>
                </div>
                <span>30%</span>
            </div>
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
    </>
  );
};

export default Profile;

