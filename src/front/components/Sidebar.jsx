// src/components/Sidebar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Agrega 'isVisible' a las props del componente
export const Sidebar = ({ currentUser, handleLogout, isVisible, onClose }) => {
  const location = useLocation();

  if (!currentUser) {
    return null;
  }

  // Crea una clase CSS dinámica. Si isVisible es 'true', agrega la clase 'is-visible'.
  // Esto permitirá que el CSS controle la visibilidad de la barra lateral.
  const sidebarClass = `sidebar ${isVisible ? 'is-visible' : ''}`;

  return (
    // Usa la clase dinámica en el elemento <aside>
    <aside className={sidebarClass}>
      {/* NUEVO: Botón para cerrar el sidebar en móviles */}
      <button className="close-sidebar-btn" onClick={onClose}>
        <i className="fas fa-times"></i>
      </button>

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
          {currentUser.rol === 'owner' && (
            <li className={location.pathname === '/profile' ? 'active' : ''}>
              <Link to="/profile"><i className="fas fa-user"></i> Mi Perfil</Link>
            </li>
          )}

          {(currentUser.rol === 'admin_empresa' || currentUser.rol === 'usuario_formulario') && (
            <li className={location.pathname === '/usersprofile' ? 'active' : ''}>
              <Link to="/usersprofile"><i className="fas fa-user"></i> Mi Perfil</Link>
            </li>
          )}

          {currentUser.rol === 'owner' && (
            <li className={location.pathname === '/user-company-management' ? 'active' : ''}>
              <Link to="/user-company-management"><i className="fas fa-users"></i> Gestión de Empresas y Usuarios</Link>
            </li>
          )}
          {(currentUser.rol === 'admin_empresa') && (
          <li className={location.pathname === '/user-management' ? 'active' : ''}>
            <Link to="/user-management"><i className="fas fa-users-cog"></i> Gestión de Usuarios</Link>
          </li>
        )}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
            <li className={location.pathname === '/manage-spaces' ? 'active' : ''}>
              <Link to="/manage-spaces"><i className="fas fa-map-marked-alt"></i> Gestión de Espacios</Link>
            </li>
          )}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
          <li className={location.pathname === '/CreateForms' ? 'active' : ''}>
            <Link to="/CreateForms"><i className="fas fa-file-alt"></i> Crear Formularios</Link>
          </li>
          )}
          <li className={location.pathname.startsWith('/Answerforms') ? 'active' : ''}>
            <Link to="/Answerforms"><i className="fas fa-clipboard-check"></i> Contestar Formularios</Link>
          </li>
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
          <li className={location.pathname === '/analytics' ? 'active' : ''}>
            <Link to="/analytics"><i className="fas fa-chart-line"></i> Gráficas y Datos</Link>
          </li>
          )}
          {(currentUser.rol === 'owner' || currentUser.rol === 'admin_empresa') && (
            <li className={location.pathname === '/documentos-ministerio' ? 'active' : ''}>
              <Link to="/documentos-ministerio"><i className="fas fa-folder-open"></i> Documentos</Link>
            </li>
          )}

          <li>
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