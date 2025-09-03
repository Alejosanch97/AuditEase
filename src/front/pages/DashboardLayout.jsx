// src/layouts/DashboardLayout.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import { Sidebar } from '../components/Sidebar'; 
import { Footer } from '../components/Footer'; 
import ScrollToTop from '../components/ScrollToTop'; 

import "../styles/dashboard.css"; 

export const DashboardLayout = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [loadingInitialAuth, setLoadingInitialAuth] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false); // NUEVO: Estado para controlar la visibilidad del sidebar

  // NUEVO: Función para alternar la visibilidad del sidebar
  const handleToggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

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
      setLoadingInitialAuth(false);
      navigate('/login');
    } else {
      setLoadingInitialAuth(false);
    }

    const fetchGlobalResources = async () => {
      const currentToken = localStorage.getItem('access_token');
      if (!currentToken) return;

      try {
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

  if (!store.isLoggedIn || !store.user) {
    return null; 
  }

  return (
    <ScrollToTop> 
      <div className="dashboard-container">
        {/* NUEVO: Botón de menú hamburguesa para móviles. Solo será visible con CSS en pantallas pequeñas */}
        <button className="hamburger-menu" onClick={handleToggleSidebar}>
          <i className="fas fa-bars"></i>
        </button>

        {/* NUEVO: Pasa el estado de visibilidad del sidebar como una prop
          al componente Sidebar. El componente Sidebar usará esta prop
          para aplicar una clase CSS que lo haga visible u oculto.
        */}
        <Sidebar currentUser={store.user} handleLogout={handleLogout} isVisible={isSidebarVisible} />

        <main className="main-content"> 
          <Outlet /> 
        </main>
      </div>
    </ScrollToTop>
  );
};