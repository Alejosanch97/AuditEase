export const initialStore = () => {
  return {
    message: null, // Cambiado para ser un objeto { type: 'success' | 'error', text: '...' }
    todos: [
      {
        id: 1,
        title: "Make the bed",
        background: null,
      },
      {
        id: 2,
        title: "Do my homework",
        background: null,
      }
    ],
    // *** PROPIEDADES PARA EL ESTADO DEL USUARIO Y AUTENTICACIÓN ***
    user: null, // Aquí se guardará el objeto completo del usuario logeado (incluyendo empresa)
    isLoggedIn: false, // Un booleano para indicar si el usuario está autenticado
    requiresPasswordChange: false, // NUEVO: Para saber si el usuario necesita cambiar su contraseña inicial
    userRole: null // NUEVO: Para acceso rápido al rol del usuario logeado
  }
}

export default function storeReducer(store, action = {}) {
  switch (action.type) {
    case 'SET_MESSAGE':
      return {
        ...store,
        message: action.payload
      };

    case 'ADD_TASK':
      const { id, color } = action.payload
      return {
        ...store,
        todos: store.todos.map((todo) => (todo.id === id ? { ...todo, background: color } : todo))
      };

    // *** ACCIONES PARA MANEJO DE AUTENTICACIÓN ***
    case 'SET_USER':
      return {
        ...store,
        user: action.payload, // El 'payload' será el objeto 'usuario' que viene de tu backend
        isLoggedIn: true, // Marcamos como logeado
        requiresPasswordChange: action.payload.cambio_password_requerido || false, // Asigna el valor del backend
        userRole: action.payload.rol || null // Asigna el rol del backend
      };

    case 'LOGOUT':
      return {
        ...store,
        user: null, // Limpiamos el usuario al cerrar sesión
        isLoggedIn: false, // Marcamos como no logeado
        requiresPasswordChange: false, // Reiniciamos el flag
        userRole: null, // Reiniciamos el rol
        message: { type: 'success', text: 'Sesión cerrada exitosamente.' } // Opcional: mensaje de logout
      };

    // NUEVA ACCIÓN PARA ACTUALIZAR SOLO EL FLAG DE CAMBIO DE CONTRASEÑA
    case 'SET_PASSWORD_CHANGE_REQUIRED':
      return {
        ...store,
        requiresPasswordChange: action.payload,
        // Opcional: si el usuario cambió la contraseña, quizás también quieras actualizar user.cambio_password_requerido
        user: store.user ? { ...store.user, cambio_password_requerido: action.payload } : null
      };

    default:
      console.warn(`Unknown action type: ${action.type}`);
      return store;
  }
}