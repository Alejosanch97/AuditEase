import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalReducer from '../hooks/useGlobalReducer';
import "../styles/recibos-analytics.css";
// ⭐ IMPORTACIONES DE COMPONENTES DE MENSAJERÍA/MODALES
import NotificationAlert from './NotificationAlert'; 
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Colores para los gráficos (Recharts)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#d068d8'];

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

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
    const [error, setError] = useState(null); 

    // ⭐ ESTADOS PARA MODALES Y ALERTAS ⭐
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecibo, setCurrentRecibo] = useState(null); 
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); 

    // --- NUEVOS ESTADOS PARA VISTA RÁPIDA (OJITO) ---
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewReciboData, setViewReciboData] = useState(null);

    const [alertState, setAlertState] = useState({ 
        isOpen: false, 
        message: '', 
        type: 'info' 
    });
    
    const showAlert = useCallback((message, type = 'info') => {
        setAlertState({ isOpen: true, message, type });
    }, []);

    // --- FETCHERS Y HANDLERS ---
    
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
                showAlert(data.error || "Error al cargar el detalle del concepto.", 'error');
                setDetalleConcepto([]);
            }
        } catch (err) {
            console.error("Error fetching concepto detail:", err);
            showAlert("Error de conexión al cargar los detalles.", 'error');
            setDetalleConcepto([]);
        } 
    }, [startDate, endDate, showAlert]);

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

    const handleEdit = useCallback((reciboData) => {
        setCurrentRecibo(reciboData);
        setIsModalOpen(true);
    }, []);

    // ⭐ CORRECCIÓN APLICADA AQUÍ:
    const handleViewDetails = (recibo) => {
        // Buscamos todos los registros en 'detalleConcepto' que compartan el mismo 'id_recibo'
        // Esto permite mostrar múltiples conceptos si el recibo fue por varios ítems cargados en el estado actual.
        const todosLosItemsDelRecibo = detalleConcepto.filter(item => item.id_recibo === recibo.id_recibo);
        
        setViewReciboData({
            ...recibo,
            conceptos_detalle: todosLosItemsDelRecibo.map(item => ({
                nombre_concepto: item.concepto || selectedConceptoName,
                monto: item.subtotal_costo || item.monto_pagado,
                cantidad: item.cantidad || 1,
                valor_unitario: item.valor_cobrado_unitario || item.monto_pagado
            }))
        });
        setIsViewModalOpen(true);
    };

    const handleDeleteClick = useCallback((reciboId) => {
        setConfirmDeleteId(reciboId);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        const reciboId = confirmDeleteId;
        if (!reciboId) return;

        setConfirmDeleteId(null);
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
                setIsModalOpen(false);
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
                            `${name} (${(percent * 100).toFixed(0)}%) ${formatCurrency(value)}`
                        }
                    >
                        {resumenData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        formatter={(value, name) => [formatCurrency(value), name]} 
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
                                <td>{formatCurrency(item.value)}</td>
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
                                <td>{formatCurrency(recibo.costo_total_recibo)}</td>
                                <td>**{formatCurrency(recibo.monto_pagado)}**</td>
                                <td>{formatCurrency(recibo.saldo_pendiente)}</td>
                                <td>{recibo.tipo_pago}</td>
                                <td>{recibo.usuario_registro}</td>
                                
                                <td className="analytics-actions-cell">
                                    <button 
                                        className="analytics-btn-view"
                                        onClick={() => handleViewDetails(recibo)}
                                        title="Ver desglose de conceptos"
                                    >
                                        <i className="fas fa-eye"></i>
                                    </button>
                                    <button 
                                        className="analytics-btn-edit"
                                        onClick={() => handleEdit(recibo)} 
                                        disabled={loading}
                                        title="Editar detalles de pago (monto/observaciones)"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button 
                                        className="analytics-btn-delete"
                                        onClick={() => handleDeleteClick(recibo.id_recibo)}
                                        disabled={loading}
                                        title="Anular (soft delete) el recibo"
                                    >
                                        <i className="fas fa-trash-alt"></i>
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
                <section className="analytics-card analytics-full-width-card">
                    <div className="analytics-card-header">
                        <h3>Filtros de Período</h3>
                        <div className="analytics-filters-container">
                            <div className="analytics-filter-group">
                                <label htmlFor="startDate">Desde:</label>
                                <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
                            </div>
                            <div className="analytics-filter-group">
                                <label htmlFor="endDate">Hasta:</label>
                                <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
                            </div>
                            <button onClick={handleApplyFilters} className="analytics-btn-apply-filters" disabled={loading}>Aplicar Filtros</button>
                        </div>
                    </div>
                    <hr/>
                    <p className="analytics-period-total-message">
                       **Total Monto Pagado en el Período:** **{formatCurrency(totalPagadoPeriodo)}**
                    </p>
                    {resumenData && resumenData.length > 0 && (
                        <div className="total-venta-resumen">
                            <p>Total Venta (Costo): **{formatCurrency(totalGlobalVentaCosto)}**</p>
                        </div>
                    )}
                    <div className="analytics-chart-area">
                        <h3>Distribución de Ventas (Costo) por Concepto</h3>
                        {renderPieChart()}
                    </div>
                    {renderResumenTable()}
                </section>

                <section className="analytics-card analytics-full-width-card">
                    <div className="analytics-card-header">
                        <h2>Historial Detallado de Recibos</h2>
                    </div>
                    {renderDetalleTable()}
                </section>
            </div>
            
            <EditReciboModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                recibo={currentRecibo}
                onSave={handleSaveEdit}
                isLoading={loading}
                showAlert={showAlert}
            />

            <ViewReciboDetailsModal 
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                recibo={viewReciboData}
            />

            {confirmDeleteId && (
                <ConfirmationModal 
                    message={`¿Está seguro de que desea ANULAR el Recibo ID ${confirmDeleteId}?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}

            <NotificationAlert
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </>
    );
};

// --- MODAL DE VISTA RÁPIDA (DESGLOSE) ---
const ViewReciboDetailsModal = ({ isOpen, onClose, recibo }) => {
    if (!isOpen || !recibo) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', backgroundColor: '#1a222d', color: 'white', borderRadius: '12px' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #3a475a' }}>
                    <h2 style={{ margin: 0 }}>Recibo de Pago #{recibo.id_recibo}</h2>
                    <button className="modal-close-btn" onClick={onClose} style={{ fontSize: '24px', color: '#61dafb' }}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#252f3f', borderRadius: '8px' }}>
                        <p style={{ margin: 0 }}><strong>Estudiante:</strong> {recibo.estudiante}</p>
                        <p style={{ margin: 0 }}><strong>Grado:</strong> {recibo.grado}</p>
                        <p style={{ margin: 0 }}><strong>Fecha:</strong> {new Date(recibo.fecha_recibo).toLocaleString()}</p>
                        <p style={{ margin: 0 }}><strong>Registrado por:</strong> {recibo.usuario_registro}</p>
                    </div>
                    
                    <h3 style={{ color: '#61dafb', fontSize: '1.2em', marginBottom: '10px' }}>Conceptos Detallados:</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #3a475a', color: '#90a4ae' }}>
                                <th style={{ padding: '8px' }}>Concepto</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recibo.conceptos_detalle && recibo.conceptos_detalle.length > 0 ? (
                                recibo.conceptos_detalle.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #3a475a' }}>
                                        <td style={{ padding: '8px' }}>{item.nombre_concepto}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.cantidad}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.monto)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td style={{ padding: '8px' }}>Monto Registrado</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>1</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(recibo.monto_pagado)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div style={{ textAlign: 'right', backgroundColor: '#252f3f', padding: '15px', borderRadius: '8px' }}>
                        <p style={{ margin: '5px 0' }}>Total Recibo: <strong>{formatCurrency(recibo.costo_total_recibo)}</strong></p>
                        <p style={{ margin: '5px 0', fontSize: '1.2em', color: '#4caf50' }}>Monto Pagado ({recibo.tipo_pago}): <strong>{formatCurrency(recibo.monto_pagado)}</strong></p>
                        {recibo.saldo_pendiente > 0 && (
                            <p style={{ margin: '5px 0', color: '#ff5252' }}>Saldo Pendiente: <strong>{formatCurrency(recibo.saldo_pendiente)}</strong></p>
                        )}
                        {recibo.observaciones && (
                             <p style={{ margin: '10px 0 0 0', textAlign: 'left', fontSize: '0.9em', color: '#90a4ae', borderTop: '1px solid #3a475a', paddingTop: '10px' }}>
                                <strong>Obs:</strong> {recibo.observaciones}
                             </p>
                        )}
                    </div>
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid #3a475a', padding: '15px' }}>
                    <button className="analytics-btn-cancel" onClick={onClose} style={{ width: '100%' }}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL DE EDICIÓN ---
const EditReciboModal = ({ isOpen, onClose, recibo, onSave, isLoading, showAlert }) => {
    const [editedData, setEditedData] = useState({ monto_pagado: 0, tipo_pago: '', observaciones: '' });
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
        setEditedData(prev => ({ ...prev, [name]: name === 'monto_pagado' ? parseFloat(value) || 0 : value }));
    };
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Editar Recibo ID: {recibo.id_recibo}</h2>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>Costo Total: **{formatCurrency(recibo.costo_total_recibo)}**</p>
                    <div className="form-group">
                        <label>Monto Pagado:</label>
                        <input name="monto_pagado" type="number" step="0.01" value={editedData.monto_pagado} onChange={handleChange} disabled={isLoading} />
                    </div>
                    <div className="form-group">
                        <label>Tipo de Pago:</label>
                        <select name="tipo_pago" value={editedData.tipo_pago} onChange={handleChange} disabled={isLoading}>
                            <option value="Total">Total</option>
                            <option value="Abono">Abono</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Observaciones:</label>
                        <textarea name="observaciones" value={editedData.observaciones} onChange={handleChange} rows="3" disabled={isLoading} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="analytics-btn-cancel" onClick={onClose} disabled={isLoading}>Cancelar</button>
                    <button className="analytics-btn-apply-filters" onClick={() => onSave(recibo.id_recibo, editedData)} disabled={isLoading}>
                        {isLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecibosAnalytics;