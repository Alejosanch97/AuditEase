import React, { useState, useEffect } from 'react';
import useGlobalReducer from '../hooks/useGlobalReducer';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import { UploadDocumentoModal } from '../components/UploadDocumentoModal.jsx';
import { ViewPdfModal } from '../components/ViewPdfModal.jsx';
import { CreateCategoryModal } from '../components/CreateCategoryModal.jsx';
import '../styles/DocumentosMinisterio.css'; 

export const DocumentosMinisterio = () => {
    const { store, dispatch } = useGlobalReducer();
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showViewPdfModal, setShowViewPdfModal] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null);
    const [docToView, setDocToView] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);

    const documentosCategorias = store.documentosCategorias || []; 
    const userRole = store.user?.rol;
    const canManageDocs = userRole === 'owner' || userRole === 'admin_empresa';

    // Función para obtener las categorías de documentos y sus documentos
    const fetchDocumentsAndCategories = async () => {
        dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: true });
        const token = localStorage.getItem('access_token');
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/documentos-ministerio`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_CATEGORIAS_DOCUMENTOS', payload: data.categorias });
            } else {
                throw new Error(data.error || "Error al cargar los documentos y categorías");
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
            dispatch({ type: 'SET_ERROR_DOCUMENTOS', payload: error.message });
        } finally {
            dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: false });
        }
    };

    useEffect(() => {
        fetchDocumentsAndCategories();
    }, []);

    // --- REEMPLAZO: Eliminar la función handleUploadDocument ---
    // Ya no es necesaria, porque la lógica de la API ahora está en el modal.

    // --- Manejo de la creación de categorías ---
    const handleCreateCategory = async (nombre, descripcion) => {
        const token = localStorage.getItem('access_token');
        dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: true });
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/documentos-categorias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nombre, descripcion })
            });
            const data = await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
                dispatch({ type: 'ADD_NUEVA_CATEGORIA', payload: data.categoria });
                setShowCreateCategoryModal(false);
            } else {
                throw new Error(data.error || "Error al crear la categoría");
            }
        } catch (error) {
            console.error("Error creating category:", error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: error.message } });
        } finally {
            dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: false });
        }
    };

    // --- Manejo de la eliminación de documentos ---
    const handleDeleteConfirmation = (doc) => {
        setDocToDelete(doc);
        setShowConfirmationModal(true);
    };

    const handleDeleteDocument = async () => {
        const token = localStorage.getItem('access_token');
        dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: true });
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/documentos-ministerio/${docToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
                dispatch({ type: 'DELETE_DOCUMENTO', payload: docToDelete.id });
                setShowConfirmationModal(false);
                setDocToDelete(null);
            } else {
                throw new Error(data.error || "Error al eliminar el documento");
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: error.message } });
            setShowConfirmationModal(false);
        } finally {
            dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: false });
        }
    };

    // --- Manejo de la eliminación de categorías ---
    const handleDeleteCategoryConfirmation = (category) => {
        setCategoryToDelete(category);
        setShowConfirmationModal(true);
    };

    const handleDeleteCategory = async () => {
        const token = localStorage.getItem('access_token');
        dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: true });
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/documentos-categorias/${categoryToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: data.message } });
                dispatch({ type: 'DELETE_CATEGORIA', payload: categoryToDelete.id });
                setShowConfirmationModal(false);
                setCategoryToDelete(null);
            } else {
                throw new Error(data.error || "Error al eliminar la categoría");
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: error.message } });
            setShowConfirmationModal(false);
        } finally {
            dispatch({ type: 'SET_LOADING_DOCUMENTOS', payload: false });
        }
    };

    // --- Manejo de la visualización de PDF ---
    const handleViewPdf = (doc) => {
        setDocToView(doc);
        setShowViewPdfModal(true);
    };

    const handleUploadClick = (categoryId) => {
        setSelectedCategoryId(categoryId);
        setShowUploadModal(true);
    };

    // --- NUEVO: Manejador para el cierre del modal de subida ---
    const handleUploadModalClose = (shouldReload = false) => {
        setShowUploadModal(false);
        if (shouldReload) {
            fetchDocumentsAndCategories();
        }
    };

    return (
        <div className="documentos-ministerio-page">
            <header className="page-header">
                <h1>Documentos del Ministerio</h1>
                {canManageDocs && (
                    <button className="btn-primary-header" onClick={() => setShowCreateCategoryModal(true)}>
                        <i className="fas fa-folder-plus"></i> Crear Categoría
                    </button>
                )}
            </header>
            
            <div className="document-list-container">
                {store.isLoadingDocumentos ? (
                    <p className="loading-message">Cargando documentos...</p>
                ) : store.errorDocumentos ? (
                    <p className="error-message">Error: {store.errorDocumentos}</p>
                ) : documentosCategorias.length === 0 ? (
                    <div className="empty-state">
                        <p>No hay categorías ni documentos disponibles. ¡Crea la primera categoría!</p>
                    </div>
                ) : (
                    <div className="categories-list">
                        {documentosCategorias.map(categoria => (
                            <div key={categoria.id} className="category-section">
                                <div className="category-header">
                                    <h2 className="category-title">
                                        <i className="fas fa-folder"></i> {categoria.nombre}
                                    </h2>
                                    {canManageDocs && (
                                        <div className="category-actions">
                                            <button className="btn-secondary" onClick={() => handleUploadClick(categoria.id)}>
                                                <i className="fas fa-upload"></i> Subir Documento
                                            </button>
                                            <button className="btn-danger-icon" onClick={() => handleDeleteCategoryConfirmation(categoria)}>
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="category-description">{categoria.descripcion}</p>
                                <div className="document-grid">
                                    {categoria.documentos.length === 0 ? (
                                        <p className="empty-category">No hay documentos en esta categoría.</p>
                                    ) : (
                                        categoria.documentos.map(doc => (
                                            <div key={doc.id} className="document-card">
                                                <div className="card-icon">
                                                    {/* Elige el ícono según el tipo de contenido */}
                                                    {doc.tipo_contenido === 'link' ? (
                                                        <i className="fas fa-link"></i>
                                                    ) : (
                                                        <i className="fas fa-file-pdf"></i>
                                                    )}
                                                </div>
                                                <div className="card-body">
                                                    <h4 className="document-title">{doc.nombre}</h4>
                                                    <span className="document-date">Subido el: {new Date(doc.fecha_subida).toLocaleDateString()}</span>
                                                </div>
                                                <div className="card-actions">
                                                    {/* Muestra un botón diferente según el tipo de contenido */}
                                                    {doc.tipo_contenido === 'link' ? (
                                                        <a href={doc.url_archivo} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                                            <i className="fas fa-external-link-alt"></i>
                                                        </a>
                                                    ) : (
                                                        <button className="btn-secondary" onClick={() => handleViewPdf(doc)}>
                                                            <i className="fas fa-eye"></i>
                                                        </button>
                                                    )}
                                                    {canManageDocs && (
                                                        <button className="btn-danger" onClick={() => handleDeleteConfirmation(doc)}>
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modales */}
            {showCreateCategoryModal && (
                <CreateCategoryModal
                    onClose={() => setShowCreateCategoryModal(false)}
                    onCreate={handleCreateCategory}
                />
            )}
            {showUploadModal && (
                <UploadDocumentoModal
                    onClose={handleUploadModalClose}
                    categorias={documentosCategorias}
                    selectedCategoryId={selectedCategoryId}
                />
            )}
            {showViewPdfModal && docToView && (
                <ViewPdfModal
                    url={docToView.url_archivo}
                    onClose={() => setShowViewPdfModal(false)}
                />
            )}
            {showConfirmationModal && (
                <ConfirmationModal
                    title="Confirmar Eliminación"
                    message={`¿Estás seguro de que quieres eliminar ${docToDelete ? `el documento "${docToDelete.nombre}"` : `la categoría "${categoryToDelete.nombre}" y todos sus documentos asociados"}`}. Esta acción es irreversible.`}
                    onConfirm={docToDelete ? handleDeleteDocument : handleDeleteCategory}
                    onCancel={() => {
                        setShowConfirmationModal(false);
                        setDocToDelete(null);
                        setCategoryToDelete(null);
                    }}
                />
            )}
        </div>
    );
};