import React, { useEffect } from 'react';
import "../styles/notificationAlert.css"; // ⭐ Importa el CSS específico

const NotificationAlert = ({ isOpen, message, type, onClose }) => {
    
    // Auto-cierre después de un tiempo (5 segundos)
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000); 
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    let icon;
    switch (type) {
        case 'success':
            icon = 'check-circle';
            break;
        case 'error':
            icon = 'times-circle';
            break;
        case 'info':
        default:
            icon = 'info-circle';
            break;
    }

    // El estilo principal se maneja con la clase base y la clase de tipo
    return (
        <div className={`notification-alert notification-alert-${type}`}>
            <i className={`fas fa-${icon} notification-icon`}></i>
            <span className="notification-message">{message}</span>
            <button 
                onClick={onClose} 
                className="notification-close-btn"
            >
                &times;
            </button>
        </div>
    );
};

export default NotificationAlert;