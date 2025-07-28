import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Importa useLocation para saber la ruta actual

export const Sidebar = ({ currentUser, handleLogout }) => {
  const location = useLocation(); // Hook para obtener la ruta URL actual

  // Si no hay un usuario loggeado, no renderizamos la barra lateral.
  // Esto se complementa con la lógica de autenticación en DashboardLayout.
  if (!currentUser) {
    return null;
  }

  return (
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
          {/* Usamos location.pathname para aplicar la clase 'active' dinámicamente */}
          <li className={location.pathname === '/profile' ? 'active' : ''}>
            <Link to="/profile"><i className="fas fa-user"></i> Mi Perfil</Link>
          </li>
          {currentUser.rol === 'owner' && (
            <li className={location.pathname === '/user-company-management' ? 'active' : ''}>
              <Link to="/user-company-management"><i className="fas fa-users"></i> Gestión de Empresas y Usuarios</Link>
            </li>
          )}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
            <li className={location.pathname === '/manage-spaces' ? 'active' : ''}>
              <Link to="/manage-spaces"><i className="fas fa-map-marked-alt"></i> Gestión de Espacios</Link>
            </li>
          )}
          <li className={location.pathname === '/CreateForms' ? 'active' : ''}>
            <Link to="/CreateForms"><i className="fas fa-file-alt"></i> Crear Formularios</Link>
          </li>
          {/* Para AnswerFormPage, la ruta puede ser /answer-forms o /answer-forms/:formId,
              así que verificamos si la ruta actual comienza con '/answer-forms' */}
          <li className={location.pathname.startsWith('/Answerforms') ? 'active' : ''}>
            <Link to="/Answerforms"><i className="fas fa-clipboard-check"></i> Contestar Formularios</Link>
          </li>
          <li className={location.pathname === '/form-templates' ? 'active' : ''}>
            <Link to="/form-templates"><i className="fas fa-clipboard-list"></i> Plantillas de Formularios</Link>
          </li>
          <li className={location.pathname === '/generate-reports' ? 'active' : ''}>
            <Link to="/generate-reports"><i className="fas fa-chart-line"></i> Generar Reportes</Link>
          </li>
          <li className={location.pathname === '/agenda' ? 'active' : ''}>
            <Link to="/agenda"><i className="fas fa-calendar-alt"></i> Agenda y Citas</Link>
          </li>
          <li className={location.pathname === '/notifications' ? 'active' : ''}>
            <Link to="/notifications"><i className="fas fa-bell"></i> Notificaciones</Link>
          </li>
          <li className={location.pathname === '/settings' ? 'active' : ''}>
            <Link to="/settings"><i className="fas fa-cogs"></i> Configuraciones</Link>
          </li>
          <li className={location.pathname === '/help-support' ? 'active' : ''}>
            <Link to="/help-support"><i className="fas fa-question-circle"></i> Ayuda y Soporte</Link>
          </li>
          <li>
            {/* El manejador de logout se pasa como prop */}
            <Link to="#" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Cerrar Sesión</Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <p>&copy; 2025 SGSST FLOW. Todos los derechos reservados.</p>
      </div>
    </aside>
  );
};