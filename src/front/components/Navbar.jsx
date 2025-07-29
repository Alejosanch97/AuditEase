
import React from "react";
import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm py-3">
      <div className="container-fluid">
        {/* Logo Section */}
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-primary me-2"
          >
            <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />
            <circle cx="8" cy="8" r="2" fill="white" />
            <circle cx="16" cy="8" r="2" fill="white" />
            <circle cx="8" cy="16" r="2" fill="white" />
            <circle cx="16" cy="16" r="2" fill="white" />
          </svg>
          <span className="h5 mb-0 text-dark">SGSST FLOW</span>
        </Link>

        {/* Mobile Menu Button */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navigation Links and Call to Actions */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {/* Productos Dropdown */}
            <li className="nav-item dropdown">
              <Link
                className="nav-link dropdown-toggle"
                to="#"
                id="navbarDropdownProductos"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Productos
              </Link>
              <ul className="dropdown-menu" aria-labelledby="navbarDropdownProductos">
                <li>
                  <Link className="dropdown-item" to="/products/project-management">
                    Gestión de Proyectos
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/products/crm">
                    CRM
                  </Link>
                </li>
              </ul>
            </li>

            {/* Soluciones Dropdown */}
            <li className="nav-item dropdown">
              <Link
                className="nav-link dropdown-toggle"
                to="#"
                id="navbarDropdownSoluciones"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Soluciones
              </Link>
              <ul className="dropdown-menu" aria-labelledby="navbarDropdownSoluciones">
                <li>
                  <Link className="dropdown-item" to="/solutions/marketing">
                    Marketing
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/solutions/sales">
                    Ventas
                  </Link>
                </li>
              </ul>
            </li>

            {/* Recursos Dropdown */}
            <li className="nav-item dropdown">
              <Link
                className="nav-link dropdown-toggle"
                to="#"
                id="navbarDropdownRecursos"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Recursos
              </Link>
              <ul className="dropdown-menu" aria-labelledby="navbarDropdownRecursos">
                <li>
                  <Link className="dropdown-item" to="/resources/blog">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/resources/guides">
                    Guías
                  </Link>
                </li>
              </ul>
            </li>

            <li className="nav-item">
              <Link className="nav-link" to="/enterprise">
                Enterprise
              </Link>
            </li>
          </ul>

          {/* Call to Actions */}
          <div className="d-flex align-items-center">
            <Link className="nav-link me-3" to="/login">
              Iniciar sesión
            </Link>
            {/* CAMBIO AQUÍ: `to="/login"` */}
            <Link className="btn btn-primary rounded-pill d-flex align-items-center" to="/login">
              <span>Empezar ahora</span>
              <svg className="ms-2" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </Link>
            {/* Three dots icon (optional) */}
            <button className="btn btn-link text-dark d-none d-lg-block ms-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};