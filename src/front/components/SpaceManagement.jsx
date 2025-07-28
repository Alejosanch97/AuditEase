import React, { useState, useEffect, useCallback } from 'react'; // <-- AÑADIDO useCallback AQUÍ
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/spaceManagment.css"; // Usa el CSS de UserCompanyManagement para consistencia

export const SpaceManagement = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  // Estados para datos
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [spaces, setSpaces] = useState([]);
  const [subSpaces, setSubSpaces] = useState([]);
  const [objects, setObjects] = useState([]);

  // Estados para formularios y edición
  const [showCreateSpaceForm, setShowCreateSpaceForm] = useState(false);
  const [showCreateSubSpaceForm, setShowCreateSubSpaceForm] = useState(false);
  const [showCreateObjectForm, setShowCreateObjectForm] = useState(false);

  const [spaceFormData, setSpaceFormData] = useState({ nombre_espacio: '', descripcion: '' });
  const [subSpaceFormData, setSubSpaceFormData] = useState({ id_espacio: '', nombre_subespacio: '', descripcion: '' });
  const [objectFormData, setObjectFormData] = useState({ id_subespacio: '', nombre_objeto: '', descripcion: '' });

  const [editingSpace, setEditingSpace] = useState(null);
  const [editingSubSpace, setEditingSubSpace] = useState(null);
  const [editingObject, setEditingObject] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Helper function to fetch all related resources for a given company ID
  const fetchAllResourcesForCompany = useCallback(async (companyIdToFetch) => {
    setLoading(true);
    setErrors({});
    try {
      const token = localStorage.getItem('access_token');

      // 1. Fetch spaces
      const spacesResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const spacesData = await spacesResponse.json();
      let fetchedSpaces = [];
      if (spacesResponse.ok && spacesData.espacios) {
        fetchedSpaces = spacesData.espacios.filter(s => s.id_empresa === companyIdToFetch);
        setSpaces(fetchedSpaces);
        dispatch({ type: 'SET_ESPACIOS', payload: fetchedSpaces });
      } else {
        setErrors(prev => ({ ...prev, fetchSpaces: spacesData.error || 'Error al cargar espacios.' }));
      }

      // 2. Fetch sub-spaces (depends on fetchedSpaces)
      const subSpacesResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const subSpacesData = await subSpacesResponse.json();
      let fetchedSubSpaces = [];
      if (subSpacesResponse.ok && subSpacesData.sub_espacios) {
        fetchedSubSpaces = subSpacesData.sub_espacios.filter(sub =>
          fetchedSpaces.some(s => s.id_espacio === sub.id_espacio)
        );
        setSubSpaces(fetchedSubSpaces);
        dispatch({ type: 'SET_SUBESPACIOS', payload: fetchedSubSpaces });
      } else {
        setErrors(prev => ({ ...prev, fetchSubSpaces: subSpacesData.error || 'Error al cargar sub-espacios.' }));
      }

      // 3. Fetch objects (depends on fetchedSubSpaces)
      const objectsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const objectsData = await objectsResponse.json();
      let fetchedObjects = [];
      if (objectsResponse.ok && objectsData.objetos) {
        fetchedObjects = objectsData.objetos.filter(obj =>
          fetchedSubSpaces.some(sub => sub.id_subespacio === obj.id_subespacio)
        );
        setObjects(fetchedObjects);
        dispatch({ type: 'SET_OBJETOS', payload: fetchedObjects });
      } else {
        setErrors(prev => ({ ...prev, fetchObjects: objectsData.error || 'Error al cargar objetos.' }));
      }

    } catch (error) {
      console.error('Error loading resources for company:', error);
      setErrors(prev => ({ ...prev, general: 'Error de conexión al cargar recursos.' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Efecto inicial para cargar empresas (si es owner) y redirigir si no está autorizado
  useEffect(() => {
    if (!store.user || (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa')) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Acceso no autorizado.' } });
      navigate('/profile');
      return;
    }

    const token = localStorage.getItem('access_token');
    const fetchCompaniesForOwner = async (token) => {
      setLoading(true);
      setErrors({});
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
          setCompanies(data.empresas || []);
          if (data.empresas.length > 0) {
            let initialCompanyId = '';
            if (store.user.empresa && data.empresas.some(c => c.id_empresa === store.user.empresa.id_empresa)) {
              initialCompanyId = store.user.empresa.id_empresa;
            } else {
              initialCompanyId = data.empresas[0].id_empresa;
            }
            setSelectedCompanyId(initialCompanyId);
            fetchAllResourcesForCompany(initialCompanyId);
          } else {
            setLoading(false);
          }
        } else {
          setErrors({ fetchCompanies: data.error || 'Error al cargar empresas.' });
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
        setErrors({ fetchCompanies: 'Error de conexión al cargar empresas.' });
        setLoading(false);
      }
    };

    if (store.user.rol === 'owner') {
      fetchCompaniesForOwner(token);
    } else if (store.user.rol === 'admin_empresa' && store.user.empresa) {
      setSelectedCompanyId(store.user.empresa.id_empresa);
      fetchAllResourcesForCompany(store.user.empresa.id_empresa);
    }
  }, [store.user, navigate, dispatch, fetchAllResourcesForCompany]);

  // Efecto para cargar espacios, sub-espacios y objetos cuando cambia la empresa seleccionada
  useEffect(() => {
    if (selectedCompanyId) {
      const isInitialLoadForOwner = store.user.rol === 'owner' &&
                                   companies.length > 0 &&
                                   selectedCompanyId === (store.user.empresa?.id_empresa || companies[0]?.id_empresa);
      const isInitialLoadForAdmin = store.user.rol === 'admin_empresa' &&
                                    selectedCompanyId === store.user.empresa?.id_empresa;

      if (!isInitialLoadForOwner && !isInitialLoadForAdmin) {
        fetchAllResourcesForCompany(selectedCompanyId);
      }
    } else {
        setSpaces([]);
        setSubSpaces([]);
        setObjects([]);
        setErrors({});
        setSuccessMessage('');
    }
  }, [selectedCompanyId, dispatch, fetchAllResourcesForCompany, store.user, companies]);


  // --- Handlers de Cambio de Formulario ---

  const handleCompanySelectChange = (e) => {
    setSelectedCompanyId(parseInt(e.target.value));
    setErrors({});
    setSuccessMessage('');
  };

  const handleSpaceChange = (e) => {
    const { name, value } = e.target;
    setSpaceFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubSpaceChange = (e) => {
    const { name, value } = e.target;
    setSubSpaceFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleObjectChange = (e) => {
    const { name, value } = e.target;
    setObjectFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // --- Validaciones de Formulario ---

  const validateSpaceForm = () => {
    const newErrors = {};
    if (!spaceFormData.nombre_espacio.trim()) {
      newErrors.nombre_espacio = 'El nombre del espacio es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSubSpaceForm = () => {
    const newErrors = {};
    if (!subSpaceFormData.id_espacio) {
      newErrors.id_espacio = 'Debes seleccionar un espacio padre.';
    }
    if (!subSpaceFormData.nombre_subespacio.trim()) {
      newErrors.nombre_subespacio = 'El nombre del sub-espacio es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateObjectForm = () => {
    const newErrors = {};
    if (!objectFormData.id_subespacio) {
      newErrors.id_subespacio = 'Debes seleccionar un sub-espacio padre.';
    }
    if (!objectFormData.nombre_objeto.trim()) {
      newErrors.nombre_objeto = 'El nombre del objeto es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Funciones CRUD (Espacios) ---

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!validateSpaceForm()) return;
    if (!selectedCompanyId) {
        setErrors({ general: 'Por favor, selecciona una empresa primero.' });
        return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
          ...spaceFormData,
          id_empresa: selectedCompanyId
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Espacio creado exitosamente.');
        setSpaceFormData({ nombre_espacio: '', descripcion: '' });
        setShowCreateSpaceForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al crear el espacio.' });
      }
    } catch (error) {
      console.error('Error creating space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSpace = (space) => {
    setEditingSpace(space);
    setSpaceFormData({
      nombre_espacio: space.nombre_espacio,
      descripcion: space.descripcion
    });
    setErrors({});
    setSuccessMessage('');
    setShowCreateSpaceForm(true);
  };

  const handleUpdateSpace = async (e) => {
    e.preventDefault();
    if (!validateSpaceForm()) return;
    if (!editingSpace) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
          ...spaceFormData,
          id_empresa: selectedCompanyId
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios/${editingSpace.id_espacio}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Espacio actualizado exitosamente.');
        setEditingSpace(null);
        setSpaceFormData({ nombre_espacio: '', descripcion: '' });
        setShowCreateSpaceForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al actualizar el espacio.' });
      }
    } catch (error) {
      console.error('Error updating space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpace = async (spaceId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este espacio? Esto también eliminará sus sub-espacios y objetos asociados.')) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios/${spaceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Espacio eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al eliminar el espacio.' });
      }
    } catch (error) {
      console.error('Error deleting space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  // --- Funciones CRUD (Sub-Espacios) ---

  const handleCreateSubSpace = async (e) => {
    e.preventDefault();
    if (!validateSubSpaceForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = { ...subSpaceFormData };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Sub-espacio creado exitosamente.');
        setSubSpaceFormData({ id_espacio: '', nombre_subespacio: '', descripcion: '' });
        setShowCreateSubSpaceForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al crear el sub-espacio.' });
      }
    } catch (error) {
      console.error('Error creating sub-space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubSpace = (subSpace) => {
    setEditingSubSpace(subSpace);
    setSubSpaceFormData({
      id_espacio: subSpace.id_espacio,
      nombre_subespacio: subSpace.nombre_subespacio,
      descripcion: subSpace.descripcion
    });
    setErrors({});
    setSuccessMessage('');
    setShowCreateSubSpaceForm(true);
  };

  const handleUpdateSubSpace = async (e) => {
    e.preventDefault();
    if (!validateSubSpaceForm()) return;
    if (!editingSubSpace) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = { ...subSpaceFormData };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios/${editingSubSpace.id_subespacio}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Sub-espacio actualizado exitosamente.');
        setEditingSubSpace(null);
        setSubSpaceFormData({ id_espacio: '', nombre_subespacio: '', descripcion: '' });
        setShowCreateSubSpaceForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al actualizar el sub-espacio.' });
      }
    } catch (error) {
      console.error('Error updating sub-space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubSpace = async (subSpaceId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este sub-espacio? Esto también eliminará sus objetos asociados.')) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios/${subSpaceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Sub-espacio eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al eliminar el sub-espacio.' });
      }
    } catch (error) {
      console.error('Error deleting sub-space:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  // --- Funciones CRUD (Objetos) ---

  const handleCreateObject = async (e) => {
    e.preventDefault();
    if (!validateObjectForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = { ...objectFormData };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Objeto creado exitosamente.');
        setObjectFormData({ id_subespacio: '', nombre_objeto: '', descripcion: '' });
        setShowCreateObjectForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al crear el objeto.' });
      }
    } catch (error) {
      console.error('Error creating object:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditObject = (object) => {
    setEditingObject(object);
    setObjectFormData({
      id_subespacio: object.id_subespacio,
      nombre_objeto: object.nombre_objeto,
      descripcion: object.descripcion
    });
    setErrors({});
    setSuccessMessage('');
    setShowCreateObjectForm(true);
  };

  const handleUpdateObject = async (e) => {
    e.preventDefault();
    if (!validateObjectForm()) return;
    if (!editingObject) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = { ...objectFormData };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos/${editingObject.id_objeto}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Objeto actualizado exitosamente.');
        setEditingObject(null);
        setObjectFormData({ id_subespacio: '', nombre_objeto: '', descripcion: '' });
        setShowCreateObjectForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al actualizar el objeto.' });
      }
    } catch (error) {
      console.error('Error updating object:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObject = async (objectId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este objeto?')) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos/${objectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Objeto eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else {
        setErrors({ general: data.error || 'Error al eliminar el objeto.' });
      }
    } catch (error) {
      console.error('Error deleting object:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  // Helper para obtener el nombre de un espacio dado su ID
  const getSpaceName = (id) => {
    const space = spaces.find(s => s.id_espacio === id);
    return space ? space.nombre_espacio : 'Desconocido';
  };

  // Helper para obtener el nombre de un sub-espacio dado su ID
  const getSubSpaceName = (id) => {
    const sub = subSpaces.find(s => s.id_subespacio === id);
    return sub ? sub.nombre_subespacio : 'Desconocido';
  };

  // Render loading spinner for initial data fetch
  if (loading && companies.length === 0 && selectedCompanyId === '') {
    return (
      <div className="sm-loading-spinner-container">
        Cargando gestión de espacios...
      </div>
    );
  }

  // If not owner/admin_empresa, the useEffect already redirects, so we shouldn't reach here if the logic is correct.
  if (!store.user || (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa')) {
    return null;
  }

  return (
    <> {/* Usamos un fragmento ya que el DashboardLayout proporciona el contenedor principal */}
      <header className="main-header">
        <h1 className="headline">Gestión de Espacios, Sub-Espacios y Objetos</h1>
        <div className="header-right">
          <button className="sm-back-button" onClick={() => navigate('/profile')}>
            <i className="fas fa-arrow-left"></i> Volver a Mi Perfil
          </button>
        </div>
      </header>

      <div className="sm-content-area"> {/* Nuevo contenedor para el contenido principal de la página */}
        <div className="sm-messages-container">
          {errors.general && (
            <div className="sm-alert sm-alert-danger">{errors.general}</div>
          )}
          {errors.fetchCompanies && (
            <div className="sm-alert sm-alert-danger">{errors.fetchCompanies}</div>
          )}
          {errors.fetchSpaces && (
            <div className="sm-alert sm-alert-danger">{errors.fetchSpaces}</div>
          )}
          {errors.fetchSubSpaces && (
            <div className="sm-alert sm-alert-danger">{errors.fetchSubSpaces}</div>
          )}
          {errors.fetchObjects && (
            <div className="sm-alert sm-alert-danger">{errors.fetchObjects}</div>
          )}
          {successMessage && (
            <div className="sm-alert sm-alert-success">{successMessage}</div>
          )}
        </div>

        {/* Selector de Empresa (solo para Owner) */}
        {store.user.rol === 'owner' && (
          <section className="sm-section sm-company-select-section">
            <div className="sm-section-header">
              <h2>Seleccionar Empresa</h2>
            </div>
            <div className="sm-form-group">
              <label htmlFor="company_select">Selecciona una Empresa:</label>
              <select
                id="company_select"
                value={selectedCompanyId}
                onChange={handleCompanySelectChange}
                className="sm-select"
              >
                <option value="">-- Selecciona una empresa --</option>
                {companies.map(company => (
                  <option key={company.id_empresa} value={company.id_empresa}>
                    {company.nombre_empresa}
                  </option>
                ))}
              </select>
              {errors.selectedCompany && <div className="sm-invalid-feedback">{errors.selectedCompany}</div>}
            </div>
          </section>
        )}

        {selectedCompanyId ? (
          <>
            {/* Sección de Gestión de Espacios */}
            <section className="sm-section sm-space-section">
              <div className="sm-section-header">
                <h2>Gestión de Espacios</h2>
                <button className="sm-toggle-button" onClick={() => setShowCreateSpaceForm(!showCreateSpaceForm)}>
                  {showCreateSpaceForm ? 'Ocultar Formulario' : 'Crear Nuevo Espacio'}
                </button>
              </div>
              {showCreateSpaceForm && (
                <form onSubmit={editingSpace ? handleUpdateSpace : handleCreateSpace} className="sm-form">
                  <div className="sm-form-group">
                    <label htmlFor="space_name">Nombre del Espacio <span className="sm-required-star">*</span></label>
                    <input
                      type="text"
                      id="space_name"
                      name="nombre_espacio"
                      value={spaceFormData.nombre_espacio}
                      onChange={handleSpaceChange}
                      className={errors.nombre_espacio ? 'sm-is-invalid' : ''}
                      placeholder="Ej: Edificio Principal"
                      required
                    />
                    {errors.nombre_espacio && <div className="sm-invalid-feedback">{errors.nombre_espacio}</div>}
                  </div>
                  <div className="sm-form-group sm-full-width">
                    <label htmlFor="space_description">Descripción</label>
                    <textarea
                      id="space_description"
                      name="descripcion"
                      value={spaceFormData.descripcion}
                      onChange={handleSpaceChange}
                      className="sm-textarea"
                      placeholder="Descripción del espacio (opcional)"
                      rows="4"
                    />
                  </div>
                  <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                          {loading ? (editingSpace ? 'Actualizando...' : 'Creando...') : (editingSpace ? 'Actualizar Espacio' : 'Crear Espacio')}
                      </button>
                      {editingSpace && (
                          <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingSpace(null); setShowCreateSpaceForm(false); }} disabled={loading}>
                              Cancelar Edición
                          </button>
                      )}
                  </div>
                </form>
              )}

              {spaces.length > 0 ? (
                <div className="sm-table-container">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spaces.map(space => (
                        <tr key={space.id_espacio}>
                          <td>{space.id_espacio}</td>
                          <td>{space.nombre_espacio}</td>
                          <td>{space.descripcion || 'N/A'}</td>
                          <td>
                            <button className="sm-button sm-button-edit" onClick={() => handleEditSpace(space)}>
                              Editar
                            </button>
                            <button className="sm-button sm-button-delete" onClick={() => handleDeleteSpace(space.id_espacio)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sm-no-data-message">No hay espacios creados para esta empresa.</p>
              )}
            </section>

            {/* Sección de Gestión de Sub-Espacios */}
            <section className="sm-section sm-subspace-section">
              <div className="sm-section-header">
                <h2>Gestión de Sub-Espacios</h2>
                <button className="sm-toggle-button" onClick={() => setShowCreateSubSpaceForm(!showCreateSubSpaceForm)}>
                  {showCreateSubSpaceForm ? 'Ocultar Formulario' : 'Crear Nuevo Sub-Espacio'}
                </button>
              </div>
              {showCreateSubSpaceForm && (
                <form onSubmit={editingSubSpace ? handleUpdateSubSpace : handleCreateSubSpace} className="sm-form">
                  <div className="sm-form-group">
                    <label htmlFor="subspace_parent_space">Espacio Padre <span className="sm-required-star">*</span></label>
                    <select
                      id="subspace_parent_space"
                      name="id_espacio"
                      value={subSpaceFormData.id_espacio}
                      onChange={handleSubSpaceChange}
                      className={errors.id_espacio ? 'sm-is-invalid' : ''}
                      required
                    >
                      <option value="">-- Selecciona un espacio --</option>
                      {spaces.map(space => (
                        <option key={space.id_espacio} value={space.id_espacio}>
                          {space.nombre_espacio}
                        </option>
                      ))}
                    </select>
                    {errors.id_espacio && <div className="sm-invalid-feedback">{errors.id_espacio}</div>}
                  </div>
                  <div className="sm-form-group">
                    <label htmlFor="subspace_name">Nombre del Sub-Espacio <span className="sm-required-star">*</span></label>
                    <input
                      type="text"
                      id="subspace_name"
                      name="nombre_subespacio"
                      value={subSpaceFormData.nombre_subespacio}
                      onChange={handleSubSpaceChange}
                      className={errors.nombre_subespacio ? 'sm-is-invalid' : ''}
                      placeholder="Ej: Oficina 101"
                      required
                    />
                    {errors.nombre_subespacio && <div className="sm-invalid-feedback">{errors.nombre_subespacio}</div>}
                  </div>
                  <div className="sm-form-group sm-full-width">
                    <label htmlFor="subspace_description">Descripción</label>
                    <textarea
                      id="subspace_description"
                      name="descripcion"
                      value={subSpaceFormData.descripcion}
                      onChange={handleSubSpaceChange}
                      className="sm-textarea"
                      placeholder="Descripción del sub-espacio (opcional)"
                      rows="4"
                    />
                  </div>
                  <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                          {loading ? (editingSubSpace ? 'Actualizando...' : 'Creando...') : (editingSubSpace ? 'Actualizar Sub-Espacio' : 'Crear Sub-Espacio')}
                      </button>
                      {editingSubSpace && (
                          <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingSubSpace(null); setShowCreateSubSpaceForm(false); }} disabled={loading}>
                              Cancelar Edición
                          </button>
                      )}
                  </div>
                </form>
              )}

              {subSpaces.length > 0 ? (
                <div className="sm-table-container">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Espacio Padre</th>
                        <th>Descripción</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subSpaces.map(sub => (
                        <tr key={sub.id_subespacio}>
                          <td>{sub.id_subespacio}</td>
                          <td>{sub.nombre_subespacio}</td>
                          <td>{getSpaceName(sub.id_espacio)}</td>
                          <td>{sub.descripcion || 'N/A'}</td>
                          <td>
                            <button className="sm-button sm-button-edit" onClick={() => handleEditSubSpace(sub)}>
                              Editar
                            </button>
                            <button className="sm-button sm-button-delete" onClick={() => handleDeleteSubSpace(sub.id_subespacio)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sm-no-data-message">No hay sub-espacios creados para esta empresa.</p>
              )}
            </section>

            {/* Sección de Gestión de Objetos */}
            <section className="sm-section sm-object-section">
              <div className="sm-section-header">
                <h2>Gestión de Objetos</h2>
                <button className="sm-toggle-button" onClick={() => setShowCreateObjectForm(!showCreateObjectForm)}>
                  {showCreateObjectForm ? 'Ocultar Formulario' : 'Crear Nuevo Objeto'}
                </button>
              </div>
              {showCreateObjectForm && (
                <form onSubmit={editingObject ? handleUpdateObject : handleCreateObject} className="sm-form">
                  <div className="sm-form-group">
                    <label htmlFor="object_parent_subspace">Sub-Espacio Padre <span className="sm-required-star">*</span></label>
                    <select
                      id="object_parent_subspace"
                      name="id_subespacio"
                      value={objectFormData.id_subespacio}
                      onChange={handleObjectChange}
                      className={errors.id_subespacio ? 'sm-is-invalid' : ''}
                      required
                    >
                      <option value="">-- Selecciona un sub-espacio --</option>
                      {subSpaces.map(sub => (
                        <option key={sub.id_subespacio} value={sub.id_subespacio}>
                          {sub.nombre_subespacio} (Espacio: {getSpaceName(sub.id_espacio)})
                        </option>
                      ))}
                    </select>
                    {errors.id_subespacio && <div className="sm-invalid-feedback">{errors.id_subespacio}</div>}
                  </div>
                  <div className="sm-form-group">
                    <label htmlFor="object_name">Nombre del Objeto <span className="sm-required-star">*</span></label>
                    <input
                      type="text"
                      id="object_name"
                      name="nombre_objeto"
                      value={objectFormData.nombre_objeto}
                      onChange={handleObjectChange}
                      className={errors.nombre_objeto ? 'sm-is-invalid' : ''}
                      placeholder="Ej: Extintor ABC"
                      required
                    />
                    {errors.nombre_objeto && <div className="sm-invalid-feedback">{errors.nombre_objeto}</div>}
                  </div>
                  <div className="sm-form-group sm-full-width">
                    <label htmlFor="object_description">Descripción</label>
                    <textarea
                      id="object_description"
                      name="descripcion"
                      value={objectFormData.descripcion}
                      onChange={handleObjectChange}
                      className="sm-textarea"
                      placeholder="Descripción del objeto (opcional)"
                      rows="4"
                    />
                  </div>
                  <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                          {loading ? (editingObject ? 'Actualizando...' : 'Creando...') : (editingObject ? 'Actualizar Objeto' : 'Crear Objeto')}
                      </button>
                      {editingObject && (
                          <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingObject(null); setShowCreateObjectForm(false); }} disabled={loading}>
                              Cancelar Edición
                          </button>
                      )}
                  </div>
                </form>
              )}

              {objects.length > 0 ? (
                <div className="sm-table-container">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Sub-Espacio Padre</th>
                        <th>Descripción</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {objects.map(obj => (
                        <tr key={obj.id_objeto}>
                          <td>{obj.id_objeto}</td>
                          <td>{obj.nombre_objeto}</td>
                          <td>{getSubSpaceName(obj.id_subespacio)}</td>
                          <td>{obj.descripcion || 'N/A'}</td>
                          <td>
                            <button className="sm-button sm-button-edit" onClick={() => handleEditObject(obj)}>
                              Editar
                            </button>
                            <button className="sm-button sm-button-delete" onClick={() => handleDeleteObject(obj.id_objeto)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sm-no-data-message">No hay objetos creados para esta empresa.</p>
              )}
            </section>
          </>
        ) : (
          <p className="sm-no-data-message">Por favor, selecciona una empresa para gestionar espacios, sub-espacios y objetos.</p>
        )}
      </div>
    </>
  );
};

