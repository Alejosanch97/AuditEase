import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/recibos-analytics.css";
// ⭐ IMPORTACIONES DE COMPONENTES DE MENSAJERÍA/MODALES
import NotificationAlert from './NotificationAlert'; // Asegúrate de exportarlo por defecto si usas esta sintaxis
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Colores para los gráficos (Recharts)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#d068d8'];

// Función helper para obtener la fecha de hoy en formato YYYY-MM-DD
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const RecibosAnalytics = () => {
    const { store, dispatch } = useGlobalReducer();
    const navigate = useNavigate();
    const isLoggedIn = store.isLoggedIn;

    // --- ESTADOS PRINCIPALES ---
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [resumenData, setResumenData] = useState([]);
    const [totalPagadoPeriodo, setTotalPagadoPeriodo] = useState(0); 

    // Data de detalle (para la tabla inferior)
    const [detalleConcepto, setDetalleConcepto] = useState([]);
    const [selectedConceptoId, setSelectedConceptoId] = useState('');
    const [selectedConceptoName, setSelectedConceptoName] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null); // Para errores de carga de la página/resumen

    // ⭐ ESTADOS PARA MODALES Y ALERTAS MEJORADAS ⭐
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecibo, setCurrentRecibo] = useState(null); 
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // ID para el modal de confirmación

    // Estado para la alerta (éxito/error/info)
    const [alertState, setAlertState] = useState({ 
        isOpen: false, 
        message: '', 
        type: 'info' 
    });
    
    // Función para mostrar una alerta flotante
    const showAlert = useCallback((message, type = 'info') => {
        setAlertState({ isOpen: true, message, type });
        // Nota: El auto-cierre se maneja dentro de NotificationAlert.jsx
    }, []);

    // --- FETCHERS Y HANDLERS ---
    
    // Función de recarga de detalle, definida primero para usarla en los handlers de acción
    const fetchDetalleConcepto = useCallback(async (conceptoId) => {
        if (!conceptoId) {
            setDetalleConcepto([]);
            return;
        }
        
        const token = localStorage.getItem('access_token');
        let url = `${import.meta.env.VITE_BACKEND_URL}/api/recibos/analisis/detalle?concepto_id=${conceptoId}`;
        
        const currentStartDate = startDate || getTodayDateString();
        const currentEndDate = endDate || '';
        
        if (currentStartDate) url += `&start_date=${currentStartDate}`;
        if (currentEndDate) url += `&end_date=${currentEndDate}`;
        
        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();

            if (response.ok) {
                setDetalleConcepto(data.detalles);
            } else {
                // setError(data.error || "Error al cargar el detalle del concepto."); // Mantener solo showAlert para errores detallados
                showAlert(data.error || "Error al cargar el detalle del concepto.", 'error');
                setDetalleConcepto([]);
            }
        } catch (err) {
            console.error("Error fetching concepto detail:", err);
            showAlert("Error de conexión al cargar los detalles.", 'error');
            setDetalleConcepto([]);
        } 
    }, [startDate, endDate, showAlert]);

    // Función de recarga de resumen, definida primero para usarla en los handlers de acción
    const fetchResumenData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('access_token');
        if (!token) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
            setLoading(false);
            return;
        }

        let url = `${import.meta.env.VITE_BACKEND_URL}/api/recibos/analisis`;
        
        const currentStartDate = startDate || getTodayDateString();
        const currentEndDate = endDate || '';
        
        const params = new URLSearchParams();
        if (currentStartDate) params.append('start_date', currentStartDate);
        if (currentEndDate) params.append('end_date', currentEndDate);
        
        url += `?${params.toString()}`;

        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            
            if (response.ok) {
                const chartFormattedData = data.analisis.map(item => ({
                    name: item.concepto,
                    value: item.total_vendido,
                    id_concepto: item.id_concepto,
                    cantidad_transacciones: item.cantidad_transacciones || 0
                }));
                
                setResumenData(chartFormattedData);
                setTotalPagadoPeriodo(data.total_pagado_periodo);
                
                if (!chartFormattedData.find(c => c.id_concepto === selectedConceptoId)) {
                    setSelectedConceptoId('');
                    setSelectedConceptoName('');
                    setDetalleConcepto([]);
                }
                
            } else {
                setError(data.error || "Error al cargar el análisis de recibos.");
                setResumenData([]);
                setTotalPagadoPeriodo(0);
            }
        } catch (err) {
            console.error("Error fetching recibos analysis:", err);
            setError("Error de conexión al cargar los datos de análisis.");
            setResumenData([]);
            setTotalPagadoPeriodo(0);
        } finally {
            setLoading(false);
        }
    }, [dispatch, navigate, startDate, endDate, selectedConceptoId]);

    
    // ⭐ HANDLER DE EDICIÓN: ABRE MODAL
    const handleEdit = useCallback((reciboData) => {
        setCurrentRecibo(reciboData);
        setIsModalOpen(true);
    }, []);


    // ⭐ HANDLER DE ANULACIÓN (DELETE) - Ahora solo abre el modal de confirmación
    const handleDeleteClick = useCallback((reciboId) => {
        setConfirmDeleteId(reciboId); // Establece el ID para mostrar el modal
    }, []);

    // ⭐ HANDLER DE CONFIRMACIÓN DE ANULACIÓN (LLAMADA DELETE)
    const handleConfirmDelete = useCallback(async () => {
        const reciboId = confirmDeleteId;
        if (!reciboId) return;

        setConfirmDeleteId(null); // Cierra el modal de confirmación
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/recibos/anular/${reciboId}`;

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                showAlert(`Recibo ${reciboId} anulado exitosamente. Recargando datos.`, 'success');
                
                await fetchDetalleConcepto(selectedConceptoId);
                await fetchResumenData(); 
            } else {
                const data = await response.json();
                showAlert(data.error || `Error al anular el recibo ${reciboId}.`, 'error');
            }
        } catch (err) {
            console.error("Error deleting recibo:", err);
            showAlert("Error de conexión al anular el recibo.", 'error');
        } finally {
            setLoading(false);
        }
    }, [fetchDetalleConcepto, fetchResumenData, selectedConceptoId, confirmDeleteId, showAlert]);


    // ⭐ HANDLER DE GUARDAR EDICIÓN (LLAMADA PUT)
    const handleSaveEdit = useCallback(async (reciboId, updatedData) => {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/recibos/${reciboId}`;

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(updatedData)
            });
            
            if (response.ok) {
                showAlert(`Recibo ${reciboId} actualizado exitosamente.`, 'success');
                setIsModalOpen(false); // Cierra el modal
                
                // Recargar para mostrar los datos actualizados
                await fetchDetalleConcepto(selectedConceptoId);
                await fetchResumenData(); 
            } else {
                const data = await response.json();
                showAlert(data.error || `Error al actualizar el recibo ${reciboId}.`, 'error');
            }
        } catch (err) {
            console.error("Error saving recibo edit:", err);
            showAlert("Error de conexión al actualizar el recibo.", 'error');
        } finally {
            setLoading(false);
        }

    }, [fetchDetalleConcepto, fetchResumenData, selectedConceptoId, showAlert]);


    // --- Efectos ---
    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login');
            return;
        }
        fetchResumenData();
    }, [isLoggedIn, navigate, fetchResumenData]); 

    useEffect(() => {
        fetchDetalleConcepto(selectedConceptoId);
    }, [selectedConceptoId, startDate, endDate, fetchDetalleConcepto]);

    const handleApplyFilters = () => {
        fetchResumenData(); 
    };
    
    const handleConceptoSelect = (conceptoId, conceptoName) => {
        setSelectedConceptoId(conceptoId);
        setSelectedConceptoName(conceptoName);
    };

    // --- Render Functions (sin cambios en el cuerpo de renderización) ---

    const renderPieChart = () => {
        if (loading && resumenData.length === 0) { 
            return <p className="analytics-loading-message">Cargando datos de ventas...</p>; 
        }
        if (error) { 
            return <p className="analytics-error-message">Error: {error}</p>; 
        }
        if (!resumenData || resumenData.length === 0) {
            return <p className="analytics-info-message">No se registraron ventas en el periodo seleccionado.</p>;
        }

        return (
            <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                    <Pie 
                        data={resumenData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={120} 
                        innerRadius={60} 
                        fill="#8884d8" 
                        labelLine={false} 
                        label={({ name, percent, value }) => 
                            `${name} (${(percent * 100).toFixed(0)}%) $${value}`
                        }
                    >
                        {resumenData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        formatter={(value, name) => [`$${value}`, name]} 
                    />
                    <Legend 
                        layout="horizontal" 
                        align="center" 
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: '10px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    const renderResumenTable = () => {
        if (loading && resumenData.length === 0) {
            return <p className="analytics-loading-message">Cargando resumen de recibos...</p>;
        }
        if (error) { return null; }
        
        if (!resumenData || resumenData.length === 0) {
            return <p className="analytics-info-message">No hay datos de resumen para mostrar en la tabla.</p>;
        }

        return (
            <div className="analytics-table-container" style={{ marginTop: '20px' }}>
                <table className="analytics-table">
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Total Cobrado (Vendido)</th>
                            <th># Transacciones</th> 
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resumenData.map(item => (
                            <tr 
                                key={item.id_concepto} 
                                className={selectedConceptoId === item.id_concepto ? 'analytics-row-selected' : ''}
                            >
                                <td>{item.name}</td>
                                <td>**${item.value}**</td>
                                <td>{item.cantidad_transacciones}</td> 
                                <td>
                                    <button 
                                        className="analytics-btn-detail"
                                        onClick={() => handleConceptoSelect(item.id_concepto, item.name)}
                                        disabled={loading}
                                    >
                                        Ver Detalle
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };
    
    const renderDetalleTable = () => {
        if (!selectedConceptoId) {
            return (
                <div className="analytics-chart-area">
                    <p className="analytics-info-message">Selecciona un concepto en la tabla superior para ver el detalle de los recibos asociados.</p>
                </div>
            );
        }
        
        if (loading && detalleConcepto.length === 0) {
             return <p className="analytics-loading-message">Cargando detalle de "{selectedConceptoName}"...</p>;
        }
        
        if (detalleConcepto.length === 0) {
            return (
                <div className="analytics-chart-area">
                    <p className="analytics-info-message">No se encontraron recibos para el concepto "{selectedConceptoName}" en este periodo.</p>
                </div>
            );
        }

        return (
            <div className="analytics-table-container">
                <h3>Detalle de Recibos para: **{selectedConceptoName}**</h3>
                <table className="analytics-table">
                    <thead>
                        <tr>
                            <th>ID Recibo</th>
                            <th>Fecha</th>
                            <th>Estudiante</th>
                            <th>Grado</th>
                            <th>Costo Total Recibo</th>
                            <th>Monto Pagado</th>
                            <th>Saldo Pendiente</th>
                            <th>Tipo Pago</th>
                            <th>Registrado por</th>
                            <th>Acciones</th> 
                        </tr>
                    </thead>
                    <tbody>
                        {detalleConcepto.map((recibo, index) => (
                            <tr key={recibo.id_recibo + '-' + index}>
                                <td>{recibo.id_recibo}</td>
                                <td>{new Date(recibo.fecha_recibo).toLocaleDateString()}</td>
                                <td>{recibo.estudiante}</td>
                                <td>{recibo.grado}</td>
                                <td>${recibo.costo_total_recibo}</td>
                                <td>**${recibo.monto_pagado}**</td>
                                <td>${recibo.saldo_pendiente}</td>
                                <td>{recibo.tipo_pago}</td>
                                <td>{recibo.usuario_registro}</td>
                                
                                {/* BOTONES DE ACCIÓN */}
                                <td className="analytics-actions-cell">
                                    <button 
                                        className="analytics-btn-edit"
                                        onClick={() => handleEdit(recibo)} 
                                        disabled={loading}
                                        title="Editar detalles de pago (monto/observaciones)"
                                    >
                                        <i className="fas fa-edit"></i> Editar
                                    </button>
                                    <button 
                                        className="analytics-btn-delete"
                                        onClick={() => handleDeleteClick(recibo.id_recibo)} // ⭐ Usa el handler que abre el modal
                                        disabled={loading}
                                        title="Anular (soft delete) el recibo"
                                    >
                                        <i className="fas fa-trash-alt"></i> Anular
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const totalGlobalVentaCosto = resumenData.reduce((sum, entry) => sum + entry.value, 0); 


    return (
        <>
            <header className="main-header">
                <h1 className="headline">Análisis de Recibos y Ventas 📈</h1>
                <div className="header-right">
                    <button className="sm-back-button" onClick={() => navigate('/profile')}>
                        <i className="fas fa-arrow-left"></i> Volver a Perfil
                    </button>
                </div>
            </header>

            <div className="analytics-content-area">
                
                {error && <div className="analytics-error-message">{error}</div>}

                {/* --- SECCIÓN 1: FILTROS Y RESUMEN GENERAL --- */}
                <section className="analytics-card analytics-full-width-card">
                    <div className="analytics-card-header">
                        <h3>Filtros de Período</h3>
                        <div className="analytics-filters-container">
                            <div className="analytics-filter-group">
                                <label htmlFor="startDate">Desde:</label>
                                <input 
                                    type="date" 
                                    id="startDate" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                    disabled={loading} 
                                />
                            </div>
                            <div className="analytics-filter-group">
                                <label htmlFor="endDate">Hasta:</label>
                                <input 
                                    type="date" 
                                    id="endDate" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    disabled={loading} 
                                />
                            </div>
                            <button 
                                onClick={handleApplyFilters} 
                                className="analytics-btn-apply-filters" 
                                disabled={loading}
                            >
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                    
                    <hr/>
                    
                    {/* === Mensajes de Total === */}
                    <p className="analytics-period-total-message">
                       **Total Monto Pagado en el Período:** **${totalPagadoPeriodo}**
                    </p>

                    {resumenData && resumenData.length > 0 && (
                        <div className="total-venta-resumen">
                            <p>Total Venta (Costo): **${totalGlobalVentaCosto}**</p>
                        </div>
                    )}
                    
                    {/* Gráfico y Tabla de Resumen */}
                    <div className="analytics-chart-area">
                        <h3>Distribución de Ventas (Costo) por Concepto</h3>
                        {renderPieChart()}
                    </div>
                    
                    {renderResumenTable()}

                </section>

                {/* --- SECCIÓN 2: DETALLE DE RECIBOS POR CONCEPTO SELECCIONADO --- */}
                <section className="analytics-card analytics-full-width-card">
                    <div className="analytics-card-header">
                        <h2>Historial Detallado de Recibos</h2>
                    </div>
                    {renderDetalleTable()}
                </section>
            </div>
            
            {/* ⭐ LLAMADA AL MODAL DE EDICIÓN ⭐ */}
            <EditReciboModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                recibo={currentRecibo}
                onSave={handleSaveEdit}
                isLoading={loading}
            />

            {/* ⭐ LLAMADA A TU MODAL DE CONFIRMACIÓN (para anulación) ⭐ */}
            {confirmDeleteId && (
                <ConfirmationModal 
                    message={`¿Está seguro de que desea ANULAR el Recibo ID ${confirmDeleteId}? Esta acción revierte el estado a "anulado" y es sensible.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}

            {/* ⭐ COMPONENTE PARA ALERTAS (ÉXITO/ERROR) ⭐ */}
            <NotificationAlert
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </>
    );
};

// ===========================================
// ⭐ COMPONENTE MODAL DE EDICIÓN (Corregido para usar showAlert)
// ===========================================

const EditReciboModal = ({ isOpen, onClose, recibo, onSave, isLoading, showAlert }) => {
    
    // Estado interno del modal para manejar los campos de edición
    const [editedData, setEditedData] = useState({
        monto_pagado: 0,
        tipo_pago: '',
        observaciones: ''
    });
    
    // Sincroniza los datos del recibo con el estado interno cuando se abre el modal
    useEffect(() => {
        if (recibo) {
            setEditedData({
                monto_pagado: recibo.monto_pagado,
                tipo_pago: recibo.tipo_pago,
                observaciones: recibo.observaciones || '' 
            });
        }
    }, [recibo]);

    if (!isOpen || !recibo) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedData(prev => ({
            ...prev,
            [name]: name === 'monto_pagado' ? parseFloat(value) || 0 : value
        }));
    };
    
    const handleSave = () => {
        // Validación básica: Monto no puede ser negativo
        if (editedData.monto_pagado < 0) {
            // ⭐ Usamos showAlert en lugar de alert()
            showAlert("El monto pagado no puede ser negativo.", 'error'); 
            return;
        }
        
        onSave(recibo.id_recibo, editedData);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Editar Recibo ID: {recibo.id_recibo}</h2>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>Costo Total del Recibo: **${recibo.costo_total_recibo}**</p>
                    <p>Saldo Actual: **${recibo.saldo_pendiente}**</p>
                    
                    <div className="form-group">
                        <label htmlFor="monto_pagado">Monto Pagado (Nuevo Abono/Total):</label>
                        <input
                            id="monto_pagado"
                            name="monto_pagado"
                            type="number"
                            step="0.01"
                            value={editedData.monto_pagado}
                            onChange={handleChange}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="tipo_pago">Tipo de Pago:</label>
                        <select
                            id="tipo_pago"
                            name="tipo_pago"
                            value={editedData.tipo_pago}
                            onChange={handleChange}
                            disabled={isLoading}
                        >
                            <option value="Total">Total</option>
                            <option value="Abono">Abono</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="observaciones">Observaciones:</label>
                        <textarea
                            id="observaciones"
                            name="observaciones"
                            value={editedData.observaciones}
                            onChange={handleChange}
                            rows="3"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button 
                        className="analytics-btn-cancel" 
                        onClick={onClose} 
                        disabled={isLoading}
                    >
                        Cancelar
                    </button>
                    <button 
                        className="analytics-btn-apply-filters" 
                        onClick={handleSave} 
                        disabled={isLoading}
                    >
                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecibosAnalytics;