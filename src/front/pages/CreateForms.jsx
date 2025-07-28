// src/pages/CreateForms.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';

import "../styles/modal.css";
import "../styles/modalformcreate.css";
import '../styles/modalquestioncreate.css';

import "../styles/createForms.css";

import { CreateEditFormModal } from '../components/CreateEditFormModal.jsx';
import { CreateEditQuestionModal } from '../components/CreateEditQuestionModal.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';

export const CreateForms = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const [showCreateFormModal, setShowCreateFormModal] = useState(false);
  const [showEditFormModal, setShowEditFormModal] = useState(false);
  const [formToEdit, setFormToEdit] = useState(null);
  const [formToDelete, setFormToDelete] = useState(null);

  const [showCreateQuestionModal, setShowCreateQuestionModal] = useState(false);
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState(null);
  const [questionToDelete, setQuestionToDelete] = useState(null); // Estado para la pregunta a eliminar

  const [selectedFormForQuestions, setSelectedFormForQuestions] = useState(null);

  const [allCompanies, setAllCompanies] = useState([]);

  const currentUser = store.user;
  const userRole = currentUser?.rol;
  const isLoggedIn = store.isLoggedIn;

  const fetchAllResources = useCallback(async (token, currentUserId, currentUserRole) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_FORMULARIOS', payload: data.formularios });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar formularios: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar formularios:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar formularios.' } });
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/espacios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_ESPACIOS', payload: data.espacios });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar espacios: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar espacios:', error);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subespacios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_SUBESPACIOS', payload: data.sub_espacios });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar sub-espacios: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar sub-espacios:', error);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/objetos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_OBJETOS', payload: data.objetos });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar objetos: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar objetos:', error);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tipos-respuesta`);
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_TIPOS_RESPUESTA', payload: data.tipos_respuesta });
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar tipos de respuesta: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error al cargar tipos de respuesta:', error);
    }

    if (currentUserRole === 'owner') {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/empresas`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          setAllCompanies(data.empresas);
        } else {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar todas las empresas: ${data.error}` } });
        }
      } catch (error) {
        console.error('Error al cargar todas las empresas:', error);
      }
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
      return;
    }

    // Solo cargar si los datos no están ya en el store o si la lista de empresas no está completa para el owner
    // Evita recargas innecesarias si los datos ya están presentes
    if (store.formularios.length === 0 || store.espacios.length === 0 || (userRole === 'owner' && allCompanies.length === 0)) {
        fetchAllResources(token, currentUser.id_usuario, userRole);
    }

  }, [isLoggedIn, currentUser, userRole, navigate, dispatch, fetchAllResources, store.formularios.length, store.espacios.length, allCompanies.length]);


  const fetchQuestionsForSelectedForm = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (selectedFormForQuestions && token) {
      try {
        const formResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${selectedFormForQuestions.id_formulario}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const formData = await formResponse.json();

        if (formResponse.ok) {
          // Actualizar el selectedFormForQuestions con los tipos de respuesta disponibles
          setSelectedFormForQuestions(formData.formulario);
          dispatch({ type: 'SET_CURRENT_FORM', payload: formData.formulario });

          const questionsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${selectedFormForQuestions.id_formulario}/preguntas`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const questionsData = await questionsResponse.json();
          if (questionsResponse.ok) {
            dispatch({ type: 'SET_PREGUNTAS', payload: questionsData.preguntas });
          } else {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar preguntas: ${questionsData.error}` } });
          }
        } else {
          dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al cargar detalles del formulario: ${formData.error}` } });
        }
      } catch (error) {
        console.error('Error al cargar preguntas o detalles del formulario:', error);
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión al cargar preguntas/detalles del formulario.' } });
      }
    } else {
      dispatch({ type: 'SET_PREGUNTAS', payload: [] });
      dispatch({ type: 'CLEAR_CURRENT_FORM' });
    }
  }, [selectedFormForQuestions?.id_formulario, dispatch]);

  useEffect(() => {
    fetchQuestionsForSelectedForm();
  }, [fetchQuestionsForSelectedForm]);


  const handleCreateFormSuccess = (newFormData) => {
    dispatch({ type: 'ADD_FORMULARIO', payload: newFormData });
    setShowCreateFormModal(false);
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Formulario creado exitosamente.' } });
    // Después de crear, recargar todos los recursos para asegurar la consistencia
    const token = localStorage.getItem('access_token');
    if (token && currentUser) {
        fetchAllResources(token, currentUser.id_usuario, userRole);
    }
  };

  const handleUpdateFormSuccess = (updatedFormData) => {
    dispatch({ type: 'UPDATE_FORMULARIO', payload: updatedFormData });
    // Si el formulario actualizado es el que estamos viendo, también actualiza currentForm
    if (selectedFormForQuestions && selectedFormForQuestions.id_formulario === updatedFormData.id_formulario) {
      setSelectedFormForQuestions(updatedFormData);
      dispatch({ type: 'SET_CURRENT_FORM', payload: updatedFormData });
    }
    setShowEditFormModal(false);
    setFormToEdit(null);
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Formulario actualizado exitosamente.' } });
    // Después de actualizar, recargar todos los recursos para asegurar la consistencia
    const token = localStorage.getItem('access_token');
    if (token && currentUser) {
        fetchAllResources(token, currentUser.id_usuario, userRole);
    }
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;

    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/formularios/${formToDelete.id_formulario}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'DELETE_FORMULARIO', payload: formToDelete.id_formulario });
        // Si eliminamos el formulario que estamos viendo, deseleccionarlo
        if (selectedFormForQuestions && selectedFormForQuestions.id_formulario === formToDelete.id_formulario) {
          setSelectedFormForQuestions(null);
        }
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
        // Después de eliminar, recargar todos los recursos para asegurar la consistencia
        const token = localStorage.getItem('access_token');
        if (token && currentUser) {
            fetchAllResources(token, currentUser.id_usuario, userRole);
        }
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al eliminar formulario: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error de conexión al eliminar formulario:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setFormToDelete(null);
    }
  };

  const handleCreateQuestionSuccess = (newQuestionData) => {
    setShowCreateQuestionModal(false);
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Pregunta creada exitosamente.' } });
    // Después de crear una pregunta, recargar las preguntas para el formulario seleccionado
    fetchQuestionsForSelectedForm();
  };

  const handleUpdateQuestionSuccess = (updatedQuestionData) => {
    setShowEditQuestionModal(false);
    setQuestionToEdit(null);
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Pregunta actualizada exitosamente.' } });
    // Después de actualizar una pregunta, recargar las preguntas para el formulario seleccionado
    fetchQuestionsForSelectedForm();
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;

    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/preguntas/${questionToDelete.id_pregunta}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
        // Después de eliminar una pregunta, recargar las preguntas para el formulario seleccionado
        fetchQuestionsForSelectedForm();
      } else {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: `Error al eliminar pregunta: ${data.error}` } });
      }
    } catch (error) {
      console.error('Error de conexión al eliminar pregunta:', error);
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Error de conexión.' } });
    } finally {
      setQuestionToDelete(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="cf-loading-spinner-container">
        Cargando...
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <h1 className="headline">Gestión de Formularios</h1>
        <div className="header-right">
          <i className="fas fa-bell header-icon"></i>
          <i className="fas fa-cog header-icon"></i>
        </div>
      </header>

      <div className="cf-content-area">
        <section className="cf-card cf-full-width-card">
          <div className="cf-card-header">
            <h3>Listado de Formularios</h3>
            {(userRole === 'owner' || userRole === 'admin_empresa') && (
              <button className="cf-btn cf-btn-primary cf-btn-create-form" onClick={() => setShowCreateFormModal(true)}>
                <i className="fas fa-plus-circle"></i> Crear Nuevo Formulario
              </button>
            )}
          </div>
          <div className="cf-table-responsive">
            {store.formularios.length > 0 ? (
              <table className="cf-data-table">
                <thead>
                  <tr>
                    <th>Nombre del Formulario</th>
                    <th>Descripción</th>
                    <th>Frecuencia Mínima</th>
                    <th>Fecha Creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {store.formularios.map(form => (
                    <tr key={form.id_formulario}>
                      <td>{form.nombre_formulario}</td>
                      <td>{form.descripcion || 'N/A'}</td>
                      <td>Cada {form.frecuencia_minima_llenado} día(s)</td>
                      <td>{new Date(form.fecha_creacion).toLocaleDateString()}</td>
                      <td className="cf-actions-column">
                        <button className="cf-btn cf-btn-secondary cf-btn-sm" onClick={() => setSelectedFormForQuestions(form)}>
                          <i className="fas fa-eye"></i> Ver Preguntas
                        </button>
                        {(userRole === 'owner' || userRole === 'admin_empresa') && (
                          <>
                            <button className="cf-btn cf-btn-info cf-btn-sm" onClick={() => { setFormToEdit(form); setShowEditFormModal(true); }}>
                              <i className="fas fa-edit"></i> Editar
                            </button>
                            <button className="cf-btn cf-btn-danger cf-btn-sm" onClick={() => setFormToDelete(form)}>
                              <i className="fas fa-trash-alt"></i> Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="cf-no-data-message">No hay formularios disponibles. {(userRole === 'owner' || userRole === 'admin_empresa') && "Crea uno nuevo para empezar."}</p>
            )}
          </div>
        </section>

        {selectedFormForQuestions && (
          <section className="cf-card cf-full-width-card cf-mt-4">
            <div className="cf-card-header">
              <h3>Preguntas para: {selectedFormForQuestions.nombre_formulario}</h3>
              {(userRole === 'owner' || userRole === 'admin_empresa') && (
                <button className="cf-btn cf-btn-primary" onClick={() => setShowCreateQuestionModal(true)}>
                  <i className="fas fa-plus-circle"></i> Añadir Nueva Pregunta
                </button>
              )}
            </div>
            <div className="cf-table-responsive">
              {store.preguntas.length > 0 ? (
                <table className="cf-data-table">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Pregunta</th>
                      <th>Tipo de Respuesta</th>
                      <th>Opciones</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.preguntas.map(question => (
                      <tr key={question.id_pregunta}>
                        <td>{question.orden}</td>
                        <td>{question.texto_pregunta}</td>
                        <td>{question.tipo_respuesta_nombre || 'N/A'}</td>
                        {/* Lógica condicional para mostrar opciones/recursos */}
                        <td>
                          {question.tipo_respuesta_nombre === 'seleccion_multiple' || question.tipo_respuesta_nombre === 'seleccion_unica' ? (
                            Array.isArray(question.opciones_respuesta_json) ? question.opciones_respuesta_json.join(', ') : 'N/A'
                          ) : question.tipo_respuesta_nombre === 'seleccion_recursos' ? (
                            question.opciones_respuesta_json && typeof question.opciones_respuesta_json === 'object' ? (
                              <>
                                {question.opciones_respuesta_json.espacios?.length > 0 && `Espacios: ${question.opciones_respuesta_json.espacios.length} `}
                                {question.opciones_respuesta_json.subespacios?.length > 0 && `Sub-Espacios: ${question.opciones_respuesta_json.subespacios.length} `}
                                {question.opciones_respuesta_json.objetos?.length > 0 && `Objetos: ${question.opciones_respuesta_json.objetos.length}`}
                                {/* Si no hay ninguna selección, pero es de recursos (plantilla), mostrar un mensaje */}
                                {question.opciones_respuesta_json.espacios?.length === 0 && 
                                 question.opciones_respuesta_json.subespacios?.length === 0 && 
                                 question.opciones_respuesta_json.objetos?.length === 0 && 
                                 'Definición de plantilla (recursos dinámicos)'}
                              </>
                            ) : 'N/A'
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="cf-actions-column">
                          {(userRole === 'owner' || userRole === 'admin_empresa') && (
                            <>
                              <button className="cf-btn cf-btn-info cf-btn-sm" onClick={() => { setQuestionToEdit(question); setShowEditQuestionModal(true); }}>
                                <i className="fas fa-edit"></i> Editar
                              </button>
                              <button className="cf-btn cf-btn-danger cf-btn-sm" onClick={() => setQuestionToDelete(question)}>
                                <i className="fas fa-trash-alt"></i> Eliminar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="cf-no-data-message">Este formulario no tiene preguntas. {(userRole === 'owner' || userRole === 'admin_empresa') && "Añade una nueva pregunta."}</p>
            )}
            </div>
            <div className="cf-card-footer">
              <button className="cf-btn cf-btn-secondary" onClick={() => setSelectedFormForQuestions(null)}>
                <i className="fas fa-arrow-left"></i> Volver a Formularios
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Modales */}
      {showCreateFormModal && (
        <CreateEditFormModal
          mode="create"
          onClose={() => setShowCreateFormModal(false)}
          onSuccess={handleCreateFormSuccess}
          espacios={store.espacios || []}
          subEspacios={store.subEspacios || []}
          objetos={store.objetos || []}
          currentUser={currentUser}
          allCompanies={allCompanies || []}
          tiposRespuesta={store.tiposRespuesta || []}
        />
      )}

      {showEditFormModal && formToEdit && (
        <CreateEditFormModal
          mode="edit"
          form={formToEdit}
          onClose={() => { setShowEditFormModal(false); setFormToEdit(null); }}
          onSuccess={handleUpdateFormSuccess}
          espacios={store.espacios || []}
          subEspacios={store.subEspacios || []}
          objetos={store.objetos || []}
          currentUser={currentUser}
          allCompanies={allCompanies || []}
          tiposRespuesta={store.tiposRespuesta || []}
        />
      )}

      {formToDelete && (
        <ConfirmationModal
          // MENSAJE DE CONFIRMACIÓN ACTUALIZADO
          message={`¿Estás seguro de que quieres eliminar el formulario "${formToDelete.nombre_formulario}"? Esto eliminará PERMANENTEMENTE todas sus preguntas, envíos y respuestas asociadas, y no se puede deshacer.`}
          onConfirm={handleDeleteForm}
          onCancel={() => setFormToDelete(null)}
        />
      )}

      {showCreateQuestionModal && selectedFormForQuestions && (
        <CreateEditQuestionModal
          mode="create"
          form={selectedFormForQuestions}
          onClose={() => setShowCreateQuestionModal(false)}
          onSuccess={handleCreateQuestionSuccess}
          tiposRespuesta={selectedFormForQuestions.tipos_respuesta_disponibles || []}
          allEspacios={store.espacios || []}
          allSubEspacios={store.subEspacios || []}
          allObjetos={store.objetos || []}
          currentUser={currentUser}
          allCompanies={allCompanies || []} 
        />
      )}

      {showEditQuestionModal && questionToEdit && selectedFormForQuestions && (
        <CreateEditQuestionModal
          mode="edit"
          form={selectedFormForQuestions}
          question={questionToEdit}
          onClose={() => { setShowEditQuestionModal(false); setQuestionToEdit(null); }}
          onSuccess={handleUpdateQuestionSuccess}
          tiposRespuesta={selectedFormForQuestions.tipos_respuesta_disponibles || []}
          allEspacios={store.espacios || []}
          allSubEspacios={store.subEspacios || []}
          allObjetos={store.objetos || []}
          currentUser={currentUser}
          allCompanies={allCompanies || []} 
        />
      )}

      {questionToDelete && (
        <ConfirmationModal
          message={`¿Estás seguro de que quieres eliminar la pregunta "${questionToDelete.texto_pregunta}"? Esto también eliminará TODAS las respuestas asociadas a esta pregunta y no se puede deshacer.`}
          onConfirm={handleDeleteQuestion}
          onCancel={() => setQuestionToDelete(null)}
        />
      )}
    </>
  );
};

export default CreateForms;
