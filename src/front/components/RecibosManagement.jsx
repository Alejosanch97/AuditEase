import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/recibos.css";

// Helper para parsear valores numéricos, evita NaN
const parseNumber = (value) => {
  const num = parseInt(value, 10);
  return isNaN(num) ? '' : num;
};

export const RecibosManagement = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  // 1. ESTADOS PARA DATOS Y GESTIÓN
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [grados, setGrados] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);

  // Estados para formularios de gestión (CRUD)
  const [showCreateGradoForm, setShowCreateGradoForm] = useState(false);
  const [showCreateConceptoForm, setShowCreateConceptoForm] = useState(false);
  const [showCreateEstudianteForm, setShowCreateEstudianteForm] = useState(false);

  // **CORRECCIÓN 2: Valores iniciales sin 0**
  const [gradoFormData, setGradoFormData] = useState({ nombre: '', orden: '' });
  const [conceptoFormData, setConceptoFormData] = useState({ nombre: '', valor: '' });
  const [estudianteFormData, setEstudianteFormData] = useState({ grado_id: '', nombre: '', email: '' });
  const [bulkStudentsData, setBulkStudentsData] = useState(''); // Estado para la carga masiva

  const [editingGrado, setEditingGrado] = useState(null);
  const [editingConcepto, setEditingConcepto] = useState(null);
  const [editingEstudiante, setEditingEstudiante] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // ESTADOS NUEVOS PARA COLAPSAR SECCIONES DE GESTIÓN (Minimizar)
  const [isGradosOpen, setIsGradosOpen] = useState(false);
  const [isConceptosOpen, setIsConceptosOpen] = useState(false);
  const [isEstudiantesOpen, setIsEstudiantesOpen] = useState(false);


  // 2. ESTADOS PARA LA CREACIÓN DE RECIBOS (ACTUALIZADO)
  const [reciboItems, setReciboItems] = useState([
    {
      tempId: Date.now(),
      grado_id: '',
      student_id: '',
      items: [{ tempId: Date.now() + 1, concepto_id: '' }]
    }
  ]);
  const [tipoPago, setTipoPago] = useState('Total');
  const [observaciones, setObservaciones] = useState('');
  // **CORRECCIÓN 2: Monto Abono sin 0 inicial**
  const [montoAbono, setMontoAbono] = useState('');


  // Helper function to fetch all related resources for a given company ID
  const fetchAllResourcesForCompany = useCallback(async (companyIdToFetch) => {
    setLoading(true);
    setErrors({});
    try {
      const token = localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      // 1. Fetch Grados
      const gradosResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/grados`, { method: 'GET', headers });
      const gradosData = await gradosResponse.json();
      let fetchedGrados = [];
      if (gradosResponse.ok && gradosData.grados) {
        fetchedGrados = gradosData.grados;
        setGrados(fetchedGrados);
        dispatch({ type: 'SET_GRADOS_MOCK', payload: fetchedGrados });
      } else {
        setErrors(prev => ({ ...prev, fetchGrados: gradosData.error || 'Error al cargar grados.' }));
      }

      // 2. Fetch Conceptos 
      const conceptosResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/conceptos`, { method: 'GET', headers });
      const conceptosData = await conceptosResponse.json();
      let fetchedConceptos = [];
      if (conceptosResponse.ok && conceptosData.conceptos) {
        fetchedConceptos = conceptosData.conceptos;
        setConceptos(fetchedConceptos);
        dispatch({ type: 'SET_CONCEPTOS_MOCK', payload: fetchedConceptos });
      } else {
        setErrors(prev => ({ ...prev, fetchConceptos: conceptosData.error || 'Error al cargar conceptos.' }));
      }

      // 3. Fetch Estudiantes
      const estudiantesResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/estudiantes`, { method: 'GET', headers });
      const estudiantesData = await estudiantesResponse.json();
      let fetchedEstudiantes = [];
      if (estudiantesResponse.ok && estudiantesData.estudiantes) {
        fetchedEstudiantes = estudiantesData.estudiantes;
        setEstudiantes(fetchedEstudiantes);
        dispatch({ type: 'SET_ESTUDIANTES_MOCK', payload: fetchedEstudiantes });
      } else {
        setErrors(prev => ({ ...prev, fetchEstudiantes: estudiantesData.error || 'Error al cargar estudiantes.' }));
      }

    } catch (error) {
      console.error('Error loading resources for company:', error);
      setErrors(prev => ({ ...prev, general: 'Error de conexión al cargar recursos.' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Efecto inicial para cargar empresas y redirigir
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
            let initialCompanyId = store.user.empresa?.id_empresa || data.empresas[0].id_empresa;
            setSelectedCompanyId(initialCompanyId);
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
    }
  }, [store.user, navigate, dispatch]);

  // Efecto para cargar recursos cuando cambia la empresa seleccionada
  useEffect(() => {
    if (selectedCompanyId) {
      fetchAllResourcesForCompany(selectedCompanyId);
    } else {
      setGrados([]);
      setConceptos([]);
      setEstudiantes([]);
      setErrors({});
      setSuccessMessage('');
    }
  }, [selectedCompanyId, fetchAllResourcesForCompany]);


  // --- Handlers de Cambio de Formulario de Gestión ---

  const handleCompanySelectChange = (e) => {
    setSelectedCompanyId(parseInt(e.target.value));
    setErrors({});
    setSuccessMessage('');
  };

  const handleGradoChange = (e) => {
    const { name, value } = e.target;
    // **CORRECCIÓN 2: Usar parseNumber para orden**
    setGradoFormData(prev => ({ ...prev, [name]: name === 'orden' ? parseNumber(value) : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleConceptoChange = (e) => {
    const { name, value } = e.target;
    // **CORRECCIÓN 2: Usar parseNumber para valor**
    setConceptoFormData(prev => ({ ...prev, [name]: name === 'valor' ? parseNumber(value) : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleEstudianteChange = (e) => {
    const { name, value } = e.target;
    setEstudianteFormData(prev => ({ ...prev, [name]: name === 'grado_id' ? parseInt(value) || '' : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // --- Funciones CRUD (Grados, Conceptos, Estudiantes) ---

  const validateGradoForm = () => {
    const newErrors = {};
    if (!gradoFormData.nombre.trim()) {
      newErrors.nombre = 'El nombre del grado es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateConceptoForm = () => {
    const newErrors = {};
    const valor = parseInt(conceptoFormData.valor, 10); // **CORRECCIÓN 1: Usar parseInt**

    if (!conceptoFormData.nombre.trim()) {
      newErrors.nombre = 'El nombre del concepto es requerido.';
    }
    if (isNaN(valor) || valor <= 0) {
      newErrors.valor = 'El valor debe ser un número entero positivo.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEstudianteForm = () => {
    const newErrors = {};
    if (!estudianteFormData.grado_id) {
      newErrors.grado_id = 'Debes seleccionar un grado.';
    }
    if (!estudianteFormData.nombre.trim()) {
      newErrors.nombre = 'El nombre del estudiante es requerido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateGrado = async (e) => {
    e.preventDefault();
    if (!validateGradoForm()) return;
    if (!selectedCompanyId) { setErrors({ general: 'Por favor, selecciona una empresa primero.' }); return; }
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        nombre: gradoFormData.nombre,
        orden: parseInt(gradoFormData.orden) || 0 // Asegurar que sea 0 si está vacío
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/grados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Grado creado exitosamente.');
        // **CORRECCIÓN 2: Resetear sin 0**
        setGradoFormData({ nombre: '', orden: '' });
        setShowCreateGradoForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al crear el grado.' }); }
    } catch (error) {
      console.error('Error creating grado:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleEditGrado = (grado) => {
    setEditingGrado(grado);
    setGradoFormData({
      nombre: grado.nombre_grado,
      orden: grado.orden // El valor se carga desde el backend
    });
    setErrors({}); setSuccessMessage(''); setShowCreateGradoForm(true);
    setIsGradosOpen(true); // Abrir la sección si se edita
  };

  const handleUpdateGrado = async (e) => {
    e.preventDefault();
    if (!validateGradoForm() || !editingGrado) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        nombre: gradoFormData.nombre,
        orden: parseInt(gradoFormData.orden) || 0
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/grados/${editingGrado.id_grado}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Grado actualizado exitosamente.');
        setEditingGrado(null);
        // **CORRECCIÓN 2: Resetear sin 0**
        setGradoFormData({ nombre: '', orden: '' });
        setShowCreateGradoForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al actualizar el grado.' }); }
    } catch (error) {
      console.error('Error updating grado:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleDeleteGrado = async (gradoId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar/desactivar este grado? Esto podría desactivar estudiantes asociados.')) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/grados/${gradoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(data.message || 'Grado eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al eliminar el grado.' }); }
    } catch (error) {
      console.error('Error deleting grado:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleCreateConcepto = async (e) => {
    e.preventDefault();
    if (!validateConceptoForm()) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        nombre: conceptoFormData.nombre,
        valor: parseInt(conceptoFormData.valor, 10) // **CORRECCIÓN 1: Usar parseInt**
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/conceptos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Concepto creado exitosamente.');
        // **CORRECCIÓN 2: Resetear sin 0**
        setConceptoFormData({ nombre: '', valor: '' });
        setShowCreateConceptoForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al crear el concepto.' }); }
    } catch (error) {
      console.error('Error creating concepto:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleEditConcepto = (concepto) => {
    setEditingConcepto(concepto);
    setConceptoFormData({
      nombre: concepto.nombre_concepto,
      valor: concepto.valor_base // El valor se carga desde el backend
    });
    setErrors({}); setSuccessMessage(''); setShowCreateConceptoForm(true);
    setIsConceptosOpen(true); // Abrir la sección si se edita
  };

  const handleUpdateConcepto = async (e) => {
    e.preventDefault();
    if (!validateConceptoForm() || !editingConcepto) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        nombre: conceptoFormData.nombre,
        valor: parseInt(conceptoFormData.valor, 10)
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/conceptos/${editingConcepto.id_concepto}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Concepto actualizado exitosamente.');
        setEditingConcepto(null);
        // **CORRECCIÓN 2: Resetear sin 0**
        setConceptoFormData({ nombre: '', valor: '' });
        setShowCreateConceptoForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al actualizar el concepto.' }); }
    } catch (error) {
      console.error('Error updating concepto:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleDeleteConcepto = async (conceptoId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar/desactivar este concepto? Si tiene movimientos históricos, solo se desactivará.')) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/conceptos/${conceptoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(data.message || 'Concepto eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al eliminar el concepto.' }); }
    } catch (error) {
      console.error('Error deleting concepto:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleCreateEstudiante = async (e) => {
    e.preventDefault();
    if (!validateEstudianteForm()) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        // ⭐ CORRECCIÓN APLICADA: Mapear a las claves esperadas por el backend (Flask POST)
        nombre: estudianteFormData.nombre, 
        grado_id: estudianteFormData.grado_id, 
        email: estudianteFormData.email // Flask mapea 'email' a correo_responsable
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/estudiantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Estudiante creado exitosamente.');
        setEstudianteFormData({ grado_id: '', nombre: '', email: '' });
        setShowCreateEstudianteForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al crear el estudiante.' }); }
    } catch (error) {
      console.error('Error creating estudiante:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  const handleEditEstudiante = (estudiante) => {
    setEditingEstudiante(estudiante);
    setEstudianteFormData({
      grado_id: estudiante.id_grado,
      nombre: estudiante.nombre_completo,
      email: estudiante.correo_responsable
    });
    setErrors({}); setSuccessMessage(''); setShowCreateEstudianteForm(true);
    setIsEstudiantesOpen(true); // Abrir la sección si se edita
  };

  const handleUpdateEstudiante = async (e) => {
    e.preventDefault();
    if (!validateEstudianteForm() || !editingEstudiante) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        // ⭐ CORRECCIÓN APLICADA: Mapear a las claves esperadas por el backend (Flask PUT)
        nombre: estudianteFormData.nombre,
        grado_id: estudianteFormData.grado_id,
        email: estudianteFormData.email 
      };
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/estudiantes/${editingEstudiante.id_estudiante}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Estudiante actualizado exitosamente.');
        setEditingEstudiante(null);
        setEstudianteFormData({ grado_id: '', nombre: '', email: '' });
        setShowCreateEstudianteForm(false);
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al actualizar el estudiante.' }); }
    } catch (error) {
      console.error('Error updating estudiante:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };
  
  const handleDeleteEstudiante = async (estudianteId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar/desactivar este estudiante? Si tiene recibos asociados, solo se desactivará.')) return;
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/estudiantes/${estudianteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(data.message || 'Estudiante eliminado exitosamente.');
        fetchAllResourcesForCompany(selectedCompanyId);
      } else { setErrors({ general: data.error || 'Error al eliminar el estudiante.' }); }
    } catch (error) {
      console.error('Error deleting estudiante:', error);
      setErrors({ general: 'Error de conexión. Intenta nuevamente.' });
    } finally { setLoading(false); }
  };

  // **CORRECCIÓN 3: Función de Carga Masiva**
  const handleBulkUploadStudents = async () => {
    if (!bulkStudentsData.trim()) {
      setErrors({ bulk: 'El campo de datos masivos no puede estar vacío.' });
      return;
    }
    setLoading(true); setErrors({}); setSuccessMessage('');

    try {
      // Intentar parsear el JSON
      const studentsArray = JSON.parse(bulkStudentsData);
      if (!Array.isArray(studentsArray)) {
        throw new Error("El formato esperado es un array JSON.");
      }

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/estudiantes/carga-masiva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(studentsArray)
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`Carga masiva exitosa: ${data.estudiantes_agregados} estudiantes agregados.`);
        setBulkStudentsData(''); // Limpiar el textarea
        fetchAllResourcesForCompany(selectedCompanyId); // Recargar la lista
      } else {
        // Manejar errores detallados de la API de carga masiva
        const errorMessage = data.error || 'Error al realizar la carga masiva.';
        const detail = data.errores_detalle ? data.errores_detalle.join(' | ') : '';
        setErrors({ bulk: `${errorMessage} ${detail}` });
      }
    } catch (error) {
      console.error('Error en la carga masiva:', error);
      setErrors({ bulk: `Error de formato JSON: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };


  // Helper para obtener el nombre de un grado dado su ID
  const getGradoName = (id) => {
    const grado = grados.find(s => s.id_grado === id);
    return grado ? grado.nombre_grado : 'Desconocido';
  };

  // --- Handlers de Formulario de RECIBOS ---

  const handleAddStudentSection = () => {
    setReciboItems(prev => [
      ...prev,
      {
        tempId: Date.now(),
        grado_id: '',
        student_id: '',
        items: [{ tempId: Date.now() + 1, concepto_id: '' }]
      }
    ]);
    setErrors({});
  };

  const handleRemoveStudentSection = (tempId) => {
    setReciboItems(prev => prev.filter(item => item.tempId !== tempId));
    setErrors({});
  };

  const handleGradoSelectChange = (tempId, value) => {
    const newGradoId = parseInt(value) || '';
    setReciboItems(prev => prev.map(studentItem =>
      studentItem.tempId === tempId ? {
        ...studentItem,
        grado_id: newGradoId,
        student_id: ''
      } : studentItem
    ));
    setErrors(prev => ({ ...prev, [`grado_${tempId}`]: '' }));
  };

  const handleStudentSelectChange = (tempId, value) => {
    setReciboItems(prev => prev.map(studentItem =>
      studentItem.tempId === tempId ? { ...studentItem, student_id: parseInt(value) || '' } : studentItem
    ));
    setErrors(prev => ({ ...prev, [`student_${tempId}`]: '' }));
  };

  const handleAddConceptoToStudent = (studentTempId) => {
    setReciboItems(prev => prev.map(studentItem =>
      studentItem.tempId === studentTempId ? {
        ...studentItem,
        items: [...studentItem.items, { tempId: Date.now(), concepto_id: '' }]
      } : studentItem
    ));
    setErrors({});
  };

  const handleRemoveConcepto = (studentTempId, conceptoTempId) => {
    setReciboItems(prev => prev.map(studentItem =>
      studentItem.tempId === studentTempId ? {
        ...studentItem,
        items: studentItem.items.filter(item => item.tempId !== conceptoTempId)
      } : studentItem
    ));
    setErrors({});
  };

  const handleConceptoItemChange = (studentTempId, conceptoTempId, value) => {
    setReciboItems(prev => prev.map(studentItem => {
      if (studentItem.tempId === studentTempId) {
        return {
          ...studentItem,
          items: studentItem.items.map(item => {
            if (item.tempId === conceptoTempId) {
              return { ...item, concepto_id: parseInt(value) || '' };
            }
            return item;
          })
        };
      }
      return studentItem;
    }));
    setErrors(prev => ({ ...prev, [`concepto_${conceptoTempId}`]: '' }));
  };

  // Helper para calcular el total
  const calculateTotal = () => {
    let total = 0;
    reciboItems.forEach(studentItem => {
      studentItem.items.forEach(item => {
        const concepto = conceptos.find(c => c.id_concepto === item.concepto_id);
        if (concepto) {
          total += concepto.valor_base;
        }
      });
    });
    return total; // **CORRECCIÓN 1: Retorna entero**
  };

  // Cálculo del Saldo Pendiente (Solo si es Abono)
  const calculateSaldoPendiente = () => {
    if (tipoPago !== 'Abono') return 0;
    const total = calculateTotal();
    // **CORRECCIÓN 1: Monto Abono como entero**
    const abono = parseInt(montoAbono, 10) || 0;
    const saldo = total - abono;
    return saldo > 0 ? saldo : 0; // Retorna entero
  };


  const handleSubmitRecibo = async (e) => {
    e.preventDefault();
    setErrors({}); setSuccessMessage('');

    if (!selectedCompanyId) { setErrors({ general: 'Debe seleccionar una empresa.' }); return; }

    const allDetalles = [];
    let isValid = true;

    reciboItems.forEach((studentItem) => {
      // Validaciones de Grado y Estudiante
      if (!studentItem.grado_id) {
        setErrors(prev => ({ ...prev, [`grado_${studentItem.tempId}`]: 'Grado requerido.' }));
        isValid = false;
      }
      if (!studentItem.student_id) {
        setErrors(prev => ({ ...prev, [`student_${studentItem.tempId}`]: 'Estudiante requerido.' }));
        isValid = false;
      }

      if (studentItem.items.length === 0) {
        setErrors(prev => ({ ...prev, general: 'Cada estudiante debe tener al menos un concepto.' }));
        isValid = false;
      }

      studentItem.items.forEach(item => {
        // Validación de Concepto
        if (!item.concepto_id) {
          setErrors(prev => ({ ...prev, [`concepto_${item.tempId}`]: 'Concepto requerido.' }));
          isValid = false;
        }

        if (item.concepto_id && studentItem.student_id) {
          allDetalles.push({
            concepto_id: item.concepto_id,
            student_id: studentItem.student_id,
            cantidad: 1
          });
        }
      });
    });

    // Validación de Abono
    const totalRecibo = calculateTotal();
    // **CORRECCIÓN 1: Obtener abono como entero**
    const abono = parseInt(montoAbono, 10) || 0;

    if (tipoPago === 'Abono') {
      if (abono <= 0 || isNaN(abono)) {
        setErrors(prev => ({ ...prev, montoAbono: 'El monto del abono debe ser un entero positivo.' }));
        isValid = false;
      }
      // Permitimos que el abono sea igual al total, pero no mayor
      if (abono > totalRecibo) {
        setErrors(prev => ({ ...prev, montoAbono: 'El abono no puede ser mayor al total a pagar.' }));
        isValid = false;
      }
    }


    if (!isValid || allDetalles.length === 0) {
      setErrors(prev => ({ ...prev, general: 'Por favor, completa todos los campos requeridos correctamente.' }));
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      // Si el pago es total, se usa el monto total. Si es abono, se usa el monto del abono.
      const montoPagado = tipoPago === 'Total' ? totalRecibo : abono;

      const payload = {
        detalles: allDetalles,
        observaciones: observaciones,
        tipo_pago: tipoPago,
        monto_pagado: montoPagado
      };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recibos/envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        // **CORRECCIÓN 1: Eliminar decimales en el mensaje**
        setSuccessMessage(`Recibo #${data.recibo.id_transaccion} registrado exitosamente. Total: $${totalRecibo}. ${tipoPago === 'Abono' ? `Abono de $${abono} y Saldo Pendiente de $${calculateSaldoPendiente()}.` : ''}`);
        window.scrollTo(0, 0);

        // Resetear el formulario
        setReciboItems([{ tempId: Date.now(), grado_id: '', student_id: '', items: [{ tempId: Date.now() + 1, concepto_id: '' }] }]);
        setTipoPago('Total');
        setObservaciones('');
        // **CORRECCIÓN 2: Resetear sin 0**
        setMontoAbono('');
      } else {
        setErrors({ general: data.error || 'Error al registrar el recibo.' });
      }
    } catch (error) {
      console.error('Error submitting recibo:', error);
      setErrors({ general: 'Error de conexión al registrar el recibo. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };


  // Render loading spinner for initial data fetch
  if (loading && companies.length === 0 && selectedCompanyId === '') {
    return (
      <div className="sm-loading-spinner-container">
        Cargando gestión de Grados, Conceptos y Estudiantes...
      </div>
    );
  }

  if (!store.user || (store.user.rol !== 'owner' && store.user.rol !== 'admin_empresa')) {
    return null;
  }

  // --- PARTE 4: Renderizado (JSX) ---
  return (
    <>
      <header className="main-header">
        <h1 className="headline">Gestión de Recibos</h1>
        <div className="header-right">
          <button className="sm-back-button" onClick={() => navigate('/profile')}>
            <i className="fas fa-arrow-left"></i> Volver a Mi Perfil
          </button>
        </div>
      </header>

      <div className="sm-content-area">
        <div className="sm-messages-container">
          {errors.general && (
            <div className="sm-alert sm-alert-danger">{errors.general}</div>
          )}
          {errors.fetchCompanies && (
            <div className="sm-alert sm-alert-danger">{errors.fetchCompanies}</div>
          )}
          {errors.fetchGrados && (
            <div className="sm-alert sm-alert-danger">{errors.fetchGrados}</div>
          )}
          {errors.fetchConceptos && (
            <div className="sm-alert sm-alert-danger">{errors.fetchConceptos}</div>
          )}
          {errors.fetchEstudiantes && (
            <div className="sm-alert sm-alert-danger">{errors.fetchEstudiantes}</div>
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
            {/* SECCIÓN DE CREACIÓN DE RECIBO (PRIORITARIO) */}
            <section className="sm-section sm-recibo-creation-section">
              <div className="sm-section-header">
                <h2 style={{ color: 'var(--secondary-accent)' }}>Crear Nuevo Recibo</h2>
                <span className="sm-badge">Creador: **{store.user.nombre}**</span>
              </div>
              <form onSubmit={handleSubmitRecibo} className="sm-form sm-recibo-form">

                {reciboItems.map((studentItem, studentIndex) => {

                  // Estudiantes disponibles para el grado seleccionado
                  const availableStudents = estudiantes.filter(e =>
                    e.activo && (studentItem.grado_id === '' || e.id_grado === studentItem.grado_id)
                  );

                  return (
                    <div key={studentItem.tempId} className="sm-recibo-student-group">
                      <h3 className="sm-recibo-subtitle">
                        Estudiante #{studentIndex + 1}
                        <div className="sm-header-actions">
                          {studentIndex > 0 && (
                            <button
                              type="button"
                              className="sm-button sm-button-delete sm-inline-btn"
                              onClick={() => handleRemoveStudentSection(studentItem.tempId)}
                              disabled={loading}
                            >
                              Eliminar Estudiante
                            </button>
                          )}
                        </div>
                      </h3>

                      {/* 1. Selector de Grado */}
                      <div className="sm-form-group sm-col-6">
                        <label htmlFor={`grado_select_${studentItem.tempId}`}>Grado <span className="sm-required-star">*</span></label>
                        <select
                          id={`grado_select_${studentItem.tempId}`}
                          value={studentItem.grado_id}
                          onChange={(e) => handleGradoSelectChange(studentItem.tempId, e.target.value)}
                          className={errors[`grado_${studentItem.tempId}`] ? 'sm-is-invalid' : ''}
                          required
                        >
                          <option value="">-- Selecciona un grado --</option>
                          {grados.filter(g => g.activo).map(grado => (
                            <option key={grado.id_grado} value={grado.id_grado}>
                              {grado.nombre_grado}
                            </option>
                          ))}
                        </select>
                        {errors[`grado_${studentItem.tempId}`] && <div className="sm-invalid-feedback">{errors[`grado_${studentItem.tempId}`]}</div>}
                      </div>

                      {/* 2. Selector de Estudiante */}
                      <div className="sm-form-group sm-col-6">
                        <label htmlFor={`student_select_${studentItem.tempId}`}>Estudiante <span className="sm-required-star">*</span></label>
                        <select
                          id={`student_select_${studentItem.tempId}`}
                          value={studentItem.student_id}
                          onChange={(e) => handleStudentSelectChange(studentItem.tempId, e.target.value)}
                          className={errors[`student_${studentItem.tempId}`] ? 'sm-is-invalid' : ''}
                          required
                          disabled={!studentItem.grado_id || availableStudents.length === 0} // Deshabilitar si no hay grado o estudiantes
                        >
                          <option value="">-- Selecciona un estudiante --</option>
                          {availableStudents.map(est => (
                            <option key={est.id_estudiante} value={est.id_estudiante}>
                              {est.nombre_completo} ({getGradoName(est.id_grado)})
                            </option>
                          ))}
                        </select>
                        {errors[`student_${studentItem.tempId}`] && <div className="sm-invalid-feedback">{errors[`student_${studentItem.tempId}`]}</div>}
                      </div>

                      {/* Conceptos asociados al Estudiante */}
                      <div className="sm-recibo-concepts sm-full-width">
                        <h4>Conceptos a Cobrar (Una unidad c/u):</h4>
                        {studentItem.items.map((conceptoItem, conceptoIndex) => {
                          const conceptoData = conceptos.find(c => c.id_concepto === conceptoItem.concepto_id);

                          return (
                            <div key={conceptoItem.tempId} className="sm-concept-row">
                              {/* Selector de Concepto */}
                              <div className="sm-form-group sm-col-8">
                                <label htmlFor={`concepto_select_${conceptoItem.tempId}`}>Concepto <span className="sm-required-star">*</span></label>
                                <select
                                  id={`concepto_select_${conceptoItem.tempId}`}
                                  name="concepto_id"
                                  value={conceptoItem.concepto_id}
                                  onChange={(e) => handleConceptoItemChange(studentItem.tempId, conceptoItem.tempId, e.target.value)}
                                  className={errors[`concepto_${conceptoItem.tempId}`] ? 'sm-is-invalid' : ''}
                                  required
                                >
                                  <option value="">-- Selecciona un concepto --</option>
                                  {conceptos.filter(c => c.activo).map(concepto => (
                                    <option key={concepto.id_concepto} value={concepto.id_concepto}>
                                      {concepto.nombre_concepto}
                                    </option>
                                  ))}
                                </select>
                                {errors[`concepto_${conceptoItem.tempId}`] && <div className="sm-invalid-feedback">{errors[`concepto_${conceptoItem.tempId}`]}</div>}
                              </div>

                              {/* Precio y Eliminar */}
                              <div className="sm-col-4">
                                <p className="sm-subtotal-text">
                                  {/* **CORRECCIÓN 1: Eliminar decimales** */}
                                  Precio: **${conceptoData ? conceptoData.valor_base : 0}**
                                </p>
                                {studentItem.items.length > 1 && (
                                  <button
                                    type="button"
                                    className="sm-button sm-button-delete sm-inline-btn"
                                    onClick={() => handleRemoveConcepto(studentItem.tempId, conceptoItem.tempId)}
                                    disabled={loading}
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className="sm-button sm-button-secondary"
                          onClick={() => handleAddConceptoToStudent(studentItem.tempId)}
                          disabled={loading}
                        >
                          + Agregar Otro Concepto
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="sm-button sm-submit-button sm-full-width sm-add-student-btn"
                  onClick={handleAddStudentSection}
                  disabled={loading}
                >
                  + Agregar Otro Estudiante (Multi-cobro)
                </button>

                <hr className="sm-separator" />

                {/* Opciones Finales y Total */}
                <div className="sm-final-options sm-full-width">
                  <div className="sm-form-group sm-col-4">
                    <label htmlFor="tipo_pago_select">Tipo de Pago</label>
                    <select
                      id="tipo_pago_select"
                      value={tipoPago}
                      onChange={(e) => { setTipoPago(e.target.value); setMontoAbono(''); }} // **CORRECCIÓN 2: Limpiar sin 0**
                      className="sm-select"
                    >
                      <option value="Total">Total (Se considera pagado completamente)</option>
                      <option value="Abono">Abono (Queda un saldo pendiente)</option>
                    </select>
                  </div>

                  {tipoPago === 'Abono' && (
                    <div className="sm-form-group sm-col-4">
                      <label htmlFor="monto_abono">Monto del Abono <span className="sm-required-star">*</span></label>
                      <input
                        type="number"
                        // **CORRECCIÓN 1: Sin step decimal**
                        id="monto_abono"
                        value={montoAbono}
                        onChange={(e) => setMontoAbono(e.target.value)} // Guardar como cadena para evitar 0
                        className={errors.montoAbono ? 'sm-is-invalid' : ''}
                        placeholder="Monto pagado (entero)"
                        required
                      />
                      {errors.montoAbono && <div className="sm-invalid-feedback">{errors.montoAbono}</div>}
                    </div>
                  )}

                  <div className="sm-form-group sm-full-width">
                    <label htmlFor="observaciones">Observaciones (Opcional)</label>
                    <textarea
                      id="observaciones"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className="sm-textarea"
                      rows="2"
                    ></textarea>
                  </div>

                  <div className="sm-total-display sm-full-width">
                    {/* **CORRECCIÓN 1: Eliminar decimales** */}
                    Total a Pagar: **<span className="sm-total-amount">${calculateTotal()}</span>**
                    {tipoPago === 'Abono' && (
                      <p className="sm-saldo-pendiente">
                        {/* **CORRECCIÓN 1: Eliminar decimales** */}
                        Saldo Pendiente: **${calculateSaldoPendiente()}**
                      </p>
                    )}
                  </div>
                </div>

                <div className="sm-form-actions sm-full-width">
                  <button type="submit" className="sm-submit-button sm-large-submit-button" disabled={loading || reciboItems.length === 0}>
                    {loading ? 'Registrando Recibo...' : 'Registrar Recibo y Enviar'}
                  </button>
                </div>
              </form>
            </section>

            <hr className="sm-separator" />

            {/* Sección de Gestión de GRADOS (COLAPSABLE) */}
            <section className="sm-section sm-collapsible">
              <div
                className="sm-collapsible-header"
                onClick={() => setIsGradosOpen(!isGradosOpen)}
              >
                <h2>Gestión de Grados ({grados.length})</h2>
                <i className={`fas fa-chevron-${isGradosOpen ? 'up' : 'down'}`} style={{ color: 'var(--primary-dark)' }}></i>
              </div>
              <div className={`sm-collapsible-content ${isGradosOpen ? 'sm-open' : ''}`}>
                <div className="sm-section-header">
                  <button className="sm-toggle-button" onClick={() => setShowCreateGradoForm(!showCreateGradoForm)}>
                    {showCreateGradoForm ? (editingGrado ? 'Ocultar Edición' : 'Ocultar Creación') : 'Crear Nuevo Grado'}
                  </button>
                </div>
                {showCreateGradoForm && (
                  <form onSubmit={editingGrado ? handleUpdateGrado : handleCreateGrado} className="sm-form">
                    <div className="sm-form-group">
                      <label htmlFor="grado_name">Nombre del Grado <span className="sm-required-star">*</span></label>
                      <input
                        type="text"
                        id="grado_name"
                        name="nombre"
                        value={gradoFormData.nombre}
                        onChange={handleGradoChange}
                        className={errors.nombre ? 'sm-is-invalid' : ''}
                        placeholder="Ej: 1er Grado"
                        required
                      />
                      {errors.nombre && <div className="sm-invalid-feedback">{errors.nombre}</div>}
                    </div>
                    <div className="sm-form-group">
                      <label htmlFor="grado_orden">Orden (Prioridad)</label>
                      <input
                        type="number"
                        id="grado_orden"
                        name="orden"
                        value={gradoFormData.orden}
                        onChange={handleGradoChange}
                        className="sm-input"
                        placeholder="Ej: 1"
                      />
                    </div>
                    <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                        {loading ? (editingGrado ? 'Actualizando...' : 'Creando...') : (editingGrado ? 'Actualizar Grado' : 'Crear Grado')}
                      </button>
                      {editingGrado && (
                        <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingGrado(null); setShowCreateGradoForm(false); setGradoFormData({ nombre: '', orden: '' }); }} disabled={loading}>
                          Cancelar Edición
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {grados.length > 0 ? (
                  <div className="sm-table-container">
                    <table className="sm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Orden</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grados.map(grado => (
                          <tr key={grado.id_grado}>
                            <td>{grado.id_grado}</td>
                            <td>{grado.nombre_grado}</td>
                            <td>{grado.orden}</td>
                            <td>{grado.activo ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <button className="sm-button sm-button-edit" onClick={() => handleEditGrado(grado)}>
                                Editar
                              </button>
                              <button className="sm-button sm-button-delete" onClick={() => handleDeleteGrado(grado.id_grado)}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="sm-no-data-message">No hay grados creados para esta empresa.</p>
                )}
              </div>
            </section>

            {/* Sección de Gestión de CONCEPTOS (COLAPSABLE) */}
            <section className="sm-section sm-collapsible">
              <div
                className="sm-collapsible-header"
                onClick={() => setIsConceptosOpen(!isConceptosOpen)}
              >
                <h2>Gestión de Conceptos de Cobro ({conceptos.length})</h2>
                <i className={`fas fa-chevron-${isConceptosOpen ? 'up' : 'down'}`} style={{ color: 'var(--primary-dark)' }}></i>
              </div>
              <div className={`sm-collapsible-content ${isConceptosOpen ? 'sm-open' : ''}`}>
                <div className="sm-section-header">
                  <button className="sm-toggle-button" onClick={() => setShowCreateConceptoForm(!showCreateConceptoForm)}>
                    {showCreateConceptoForm ? (editingConcepto ? 'Ocultar Edición' : 'Ocultar Creación') : 'Crear Nuevo Concepto'}
                  </button>
                </div>
                {showCreateConceptoForm && (
                  <form onSubmit={editingConcepto ? handleUpdateConcepto : handleCreateConcepto} className="sm-form">
                    <div className="sm-form-group">
                      <label htmlFor="concepto_name">Nombre del Concepto <span className="sm-required-star">*</span></label>
                      <input
                        type="text"
                        id="concepto_name"
                        name="nombre"
                        value={conceptoFormData.nombre}
                        onChange={handleConceptoChange}
                        className={errors.nombre ? 'sm-is-invalid' : ''}
                        placeholder="Ej: Colegiatura Mensual"
                        required
                      />
                      {errors.nombre && <div className="sm-invalid-feedback">{errors.nombre}</div>}
                    </div>
                    <div className="sm-form-group">
                      <label htmlFor="concepto_valor">Valor Base (Entero) <span className="sm-required-star">*</span></label>
                      <input
                        type="number"
                        // **CORRECCIÓN 1: Sin step decimal**
                        id="concepto_valor"
                        name="valor"
                        value={conceptoFormData.valor}
                        onChange={handleConceptoChange}
                        className={errors.valor ? 'sm-is-invalid' : ''}
                        placeholder="Ej: 150"
                        required
                      />
                      {errors.valor && <div className="sm-invalid-feedback">{errors.valor}</div>}
                    </div>
                    <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                        {loading ? (editingConcepto ? 'Actualizando...' : 'Creando...') : (editingConcepto ? 'Actualizar Concepto' : 'Crear Concepto')}
                      </button>
                      {editingConcepto && (
                        <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingConcepto(null); setShowCreateConceptoForm(false); setConceptoFormData({ nombre: '', valor: '' }); }} disabled={loading}>
                          Cancelar Edición
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {conceptos.length > 0 ? (
                  <div className="sm-table-container">
                    <table className="sm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Valor Base</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conceptos.map(concepto => (
                          <tr key={concepto.id_concepto}>
                            <td>{concepto.id_concepto}</td>
                            <td>{concepto.nombre_concepto}</td>
                            {/* **CORRECCIÓN 1: Eliminar decimales** */}
                            <td>${concepto.valor_base}</td>
                            <td>{concepto.activo ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <button className="sm-button sm-button-edit" onClick={() => handleEditConcepto(concepto)}>
                                Editar
                              </button>
                              <button className="sm-button sm-button-delete" onClick={() => handleDeleteConcepto(concepto.id_concepto)}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="sm-no-data-message">No hay conceptos de cobro creados para esta empresa.</p>
                )}
              </div>
            </section>

            {/* Sección de Gestión de ESTUDIANTES (COLAPSABLE) */}
            <section className="sm-section sm-collapsible">
              <div
                className="sm-collapsible-header"
                onClick={() => setIsEstudiantesOpen(!isEstudiantesOpen)}
              >
                <h2>Gestión de Estudiantes ({estudiantes.length})</h2>
                <i className={`fas fa-chevron-${isEstudiantesOpen ? 'up' : 'down'}`} style={{ color: 'var(--primary-dark)' }}></i>
              </div>
              <div className={`sm-collapsible-content ${isEstudiantesOpen ? 'sm-open' : ''}`}>
                <div className="sm-section-header sm-flex-justify-between">
                  <div>
                    <button className="sm-toggle-button" onClick={() => setShowCreateEstudianteForm(!showCreateEstudianteForm)}>
                      {showCreateEstudianteForm ? (editingEstudiante ? 'Ocultar Edición' : 'Ocultar Creación') : 'Crear Nuevo Estudiante'}
                    </button>
                  </div>
                  {/* **CORRECCIÓN 3: Botón de Carga Masiva** */}
                  <button className="sm-button sm-button-primary" onClick={() => document.getElementById('bulkUploadModal').style.display = 'block'}>
                    Subir Estudiantes Masivamente
                  </button>
                </div>

                {/* Modal para Carga Masiva */}
                <div id="bulkUploadModal" className="sm-modal">
                  <div className="sm-modal-content">
                    <span className="sm-close-button" onClick={() => document.getElementById('bulkUploadModal').style.display = 'none'}>&times;</span>
                    <h3>Carga Masiva de Estudiantes</h3>
                    <p>Pega aquí el array JSON con la información de los estudiantes.</p>
                    <blockquote style={{ fontSize: '0.9em' }}>
                      **Formato esperado:**
                      <br />
                      <span style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        [{'"'}nombre_completo{'"'}: {'"'}...{'"'}, {'"'}correo_responsable{'"'}: {'"'}...{'"'}, {'"'}nombre_grado{'"'}: {'"'}...{'"'}]
                      </span>
                    </blockquote>
                    <div className="sm-form-group sm-full-width">
                      <textarea
                        value={bulkStudentsData}
                        onChange={(e) => setBulkStudentsData(e.target.value)}
                        className={errors.bulk ? 'sm-textarea sm-is-invalid' : 'sm-textarea'}
                        rows="8"
                        placeholder='[{"nombre_completo": "Ana Torres", "correo_responsable": "ana.resp@mail.com", "nombre_grado": "1er Grado"}, ...]'
                      ></textarea>
                      {errors.bulk && <div className="sm-invalid-feedback">{errors.bulk}</div>}
                    </div>
                    <div className="sm-form-actions">
                      <button className="sm-submit-button" onClick={handleBulkUploadStudents} disabled={loading}>
                        {loading ? 'Cargando...' : 'Procesar Carga Masiva'}
                      </button>
                      <button type="button" className="sm-button sm-button-cancel" onClick={() => document.getElementById('bulkUploadModal').style.display = 'none'}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>

                {showCreateEstudianteForm && (
                  <form onSubmit={editingEstudiante ? handleUpdateEstudiante : handleCreateEstudiante} className="sm-form">
                    <div className="sm-form-group">
                      <label htmlFor="student_grado">Grado <span className="sm-required-star">*</span></label>
                      <select
                        id="student_grado"
                        name="grado_id"
                        value={estudianteFormData.grado_id}
                        onChange={handleEstudianteChange}
                        className={errors.grado_id ? 'sm-is-invalid' : ''}
                        required
                      >
                        <option value="">-- Selecciona un grado --</option>
                        {grados.filter(g => g.activo).map(grado => (
                          <option key={grado.id_grado} value={grado.id_grado}>
                            {grado.nombre_grado}
                          </option>
                        ))}
                      </select>
                      {errors.grado_id && <div className="sm-invalid-feedback">{errors.grado_id}</div>}
                    </div>
                    <div className="sm-form-group">
                      <label htmlFor="student_name">Nombre Completo <span className="sm-required-star">*</span></label>
                      <input
                        type="text"
                        id="student_name"
                        name="nombre"
                        value={estudianteFormData.nombre}
                        onChange={handleEstudianteChange}
                        className={errors.nombre ? 'sm-is-invalid' : ''}
                        placeholder="Ej: Juan Pérez"
                        required
                      />
                      {errors.nombre && <div className="sm-invalid-feedback">{errors.nombre}</div>}
                    </div>
                    <div className="sm-form-group sm-full-width">
                      <label htmlFor="student_email">Correo del Responsable (Opcional)</label>
                      <input
                        type="email"
                        id="student_email"
                        name="email"
                        value={estudianteFormData.email}
                        onChange={handleEstudianteChange}
                        className="sm-input"
                        placeholder="Ej: responsable@ejemplo.com"
                      />
                    </div>
                    <div className="sm-form-actions">
                      <button type="submit" className="sm-submit-button" disabled={loading}>
                        {loading ? (editingEstudiante ? 'Actualizando...' : 'Creando...') : (editingEstudiante ? 'Actualizar Estudiante' : 'Crear Estudiante')}
                      </button>
                      {editingEstudiante && (
                        <button type="button" className="sm-button sm-button-cancel" onClick={() => { setEditingEstudiante(null); setShowCreateEstudianteForm(false); setEstudianteFormData({ grado_id: '', nombre: '', email: '' }); }} disabled={loading}>
                          Cancelar Edición
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {estudiantes.length > 0 ? (
                  <div className="sm-table-container">
                    <table className="sm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Grado</th>
                          <th>Email Responsable</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantes.map(est => (
                          <tr key={est.id_estudiante}>
                            <td>{est.id_estudiante}</td>
                            <td>{est.nombre_completo}</td>
                            <td>{getGradoName(est.id_grado)}</td>
                            <td>{est.correo_responsable || 'N/A'}</td>
                            <td>{est.activo ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <button className="sm-button sm-button-edit" onClick={() => handleEditEstudiante(est)}>
                                Editar
                              </button>
                              <button className="sm-button sm-button-delete" onClick={() => handleDeleteEstudiante(est.id_estudiante)}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="sm-no-data-message">No hay estudiantes creados para esta empresa.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="sm-no-data-message">Por favor, selecciona una empresa para gestionar grados, conceptos y estudiantes.</p>
        )}
      </div>
    </>
  );
};