// src/layouts/DashboardLayout.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import { Sidebar } from '../components/Sidebar'; // Importa el componente Sidebar
import { Footer } from '../components/Footer'; // Mantén el Footer si lo quieres en el dashboard
import ScrollToTop from '../components/ScrollToTop'; // Mantén ScrollToTop

import "../styles/dashboard.css"; // Estilos generales del dashboard
// Asegúrate de que modal.css también esté disponible si tus modales lo usan

export const DashboardLayout = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [loadingInitialAuth, setLoadingInitialAuth] = useState(true);

  // Efecto para verificar el token y cargar el usuario al renderizado inicial
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
        } finally {
          setLoadingInitialAuth(false);
        }
      };
      verifyToken();
    } else if (!store.isLoggedIn && !store.user && !token) {
      // Si no hay token y no está loggeado, redirigir inmediatamente
      setLoadingInitialAuth(false);
      navigate('/login');
    } else {
      // El usuario ya está loggeado o el token acaba de ser verificado
      setLoadingInitialAuth(false);
    }

    // --- Cargar datos globales para el store si no están presentes ---
    // Esto es crucial para que AnswerFormPage y otros componentes tengan los datos.
    const fetchGlobalResources = async () => {
      const currentToken = localStorage.getItem('access_token');
      if (!currentToken) return;

      try {
        // Solo cargar si el array correspondiente en el store está vacío
        if (store.tiposRespuesta.length === 0) {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tipos-respuesta`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
          const data = await res.json();
          if (res.ok && data.tipos_respuesta) {
            dispatch({ type: 'SET_TIPOS_RESPUESTA', payload: data.tipos_respuesta });
          }
        }
        if (store.espacios.length === 0) {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
          const data = await res.json();
          if (res.ok && data.espacios) {
            dispatch({ type: 'SET_ESPACIOS', payload: data.espacios });
          }
        }
        if (store.subEspacios.length === 0) {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
          const data = await res.json();
          if (res.ok && data.sub_espacios) {
            dispatch({ type: 'SET_SUBESPACIOS', payload: data.sub_espacios });
          }
        }
        if (store.objetos.length === 0) {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
          const data = await res.json();
          if (res.ok && data.objetos) {
            dispatch({ type: 'SET_OBJETOS', payload: data.objetos });
          }
        }
      } catch (error) {
        console.error("Error cargando recursos globales en DashboardLayout:", error);
      }
    };

    // Solo cargar recursos globales si el usuario está loggeado y el store está listo
    // y si no estamos en el proceso de autenticación inicial para evitar llamadas duplicadas
    if (store.isLoggedIn && store.user && !loadingInitialAuth) {
      fetchGlobalResources();
    }

  }, [store.isLoggedIn, store.user, navigate, dispatch, loadingInitialAuth,
      store.tiposRespuesta.length, store.espacios.length, store.subEspacios.length, store.objetos.length]);


  // Función de logout centralizada
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  // Muestra un spinner de carga mientras se verifica la autenticación inicial
  if (loadingInitialAuth) {
    return (
      <div className="loading-spinner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2em', color: 'var(--primary-dark)' }}>
        Cargando autenticación...
      </div>
    );
  }

  // Si no está loggeado después de la verificación inicial, el useEffect ya habrá redirigido.
  if (!store.isLoggedIn || !store.user) {
    return null; // O un spinner si prefieres, pero el usuario será redirigido.
  }

  return (
    <ScrollToTop> {/* ScrollToTop envuelve todo el layout del dashboard */}
      <div className="dashboard-container">
        {/* El componente Sidebar se renderizará aquí */}
        <Sidebar currentUser={store.user} handleLogout={handleLogout} />

        {/* El contenido de la página específica se renderizará aquí */}
        {/* La clase main-content se aplica al contenedor de Outlet */}
        <main className="main-content"> {/* Cambiado de div a main por semántica */}
          <Outlet /> {/* Aquí se renderizarán los componentes de las rutas anidadas */}
        </main>
      </div>
    </ScrollToTop>
  );
};