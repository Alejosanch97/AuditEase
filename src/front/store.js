// src/store/flux.js (o tu archivo de store principal)

export const initialStore = () => {
  return {
    message: null, // Cambiado para ser un objeto { type: 'success' | 'error', text: '...' }
    todos: [ // Mantengo esto por si lo sigues usando, si no, puedes eliminarlo
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
    user: null, // Aquí se guardará el objeto completo del usuario logeado
              // Incluirá campos como 'firma_digital_url' si el backend los envía.
    isLoggedIn: false, // Un booleano para indicar si el usuario está autenticado
    requiresPasswordChange: false, // Para saber si el usuario necesita cambiar su contraseña inicial
    userRole: null, // Para acceso rápido al rol del usuario logeado

    // *** PROPIEDADES PARA EMPRESAS (si las gestionas en el store directamente) ***
    // Si el owner lista empresas, podrías tener un array aquí
    empresas: [], // Lista de empresas (principalmente para el owner)
    currentEmpresa: null, // Empresa actualmente seleccionada/editada

    // *** PROPIEDADES PARA ESPACIOS, SUBESPACIOS Y OBJETOS ***
    espacios: [], // Lista de todos los espacios de la empresa del usuario (o todos para owner)
    subEspacios: [], // Lista de todos los sub-espacios de la empresa del usuario (o todos para owner)
    objetos: [], // Lista de todos los objetos de la empresa del usuario (o todos para owner)

    // *** PROPIEDADES PARA FORMULARIOS, PREGUNTAS Y ENVÍOS ***
    formularios: [], // Lista de todos los formularios disponibles (filtrados por empresa/plantilla)
                    // Los objetos de formulario aquí incluirán los nuevos campos:
                    // es_plantilla, es_plantilla_global, compartir_con_empresas_ids,
                    // notificaciones_activas, automatizacion_activa
    currentForm: null, // El formulario actualmente seleccionado/editado, incluyendo sus preguntas y relaciones
                       // También contendrá los nuevos campos de plantilla/automatización.
    preguntas: [], // Preguntas de un formulario específico (útil para listas)
    tiposRespuesta: [], // Lista de todos los tipos de respuesta disponibles (ej: texto, numérico, booleano, firma, dibujo, seleccion_recursos)
    enviosFormulario: [], // Lista de todos los envíos de formulario (respuestas)
    currentEnvio: null, // El envío de formulario actualmente seleccionado para ver sus detalles
                        // Las respuestas dentro de este objeto contendrán 'valor_firma_url' como una lista de URLs.
  }
}

export default function storeReducer(store, action = {}) {
  switch (action.type) {
    case 'SET_MESSAGE':
      return {
        ...store,
        message: action.payload
      };

    case 'ADD_TASK': // Mantengo esta acción si la sigues usando
      const { id, color } = action.payload
      return {
        ...store,
        todos: store.todos.map((todo) => (todo.id === id ? { ...todo, background: color } : todo))
      };

    // *** ACCIONES PARA MANEJO DE AUTENTICACIÓN ***
    case 'SET_USER':
      // El 'payload' será el objeto 'usuario' completo que viene de tu backend.
      // Este objeto ya incluirá 'firma_digital_url' y otros campos nuevos.
      return {
        ...store,
        user: action.payload,
        isLoggedIn: true,
        requiresPasswordChange: action.payload.cambio_password_requerido || false,
        userRole: action.payload.rol || null
      };

    case 'LOGOUT':
      return {
        ...store,
        user: null,
        isLoggedIn: false,
        requiresPasswordChange: false,
        userRole: null,
        // Limpiamos todos los datos sensibles o específicos del usuario al cerrar sesión
        empresas: [], // Si se cargan por usuario
        espacios: [],
        subEspacios: [],
        objetos: [],
        formularios: [],
        currentForm: null,
        preguntas: [],
        tiposRespuesta: [],
        enviosFormulario: [],
        currentEnvio: null,
        message: { type: 'success', text: 'Sesión cerrada exitosamente.' }
      };

    case 'SET_PASSWORD_CHANGE_REQUIRED':
      return {
        ...store,
        requiresPasswordChange: action.payload,
        // También actualiza el campo en el objeto de usuario si existe
        user: store.user ? { ...store.user, cambio_password_requerido: action.payload } : store.user
      };
    
    // NUEVA ACCIÓN: Para actualizar la URL de la firma digital del usuario
    case 'SET_USER_SIGNATURE_URL':
      return {
        ...store,
        user: store.user ? { ...store.user, firma_digital_url: action.payload } : store.user
      };

    // *** ACCIONES PARA EMPRESAS (si las gestionas en el store) ***
    case 'SET_EMPRESAS':
      return {
        ...store,
        empresas: action.payload
      };
    case 'ADD_EMPRESA':
      return {
        ...store,
        empresas: [...store.empresas, action.payload]
      };
    case 'UPDATE_EMPRESA':
      return {
        ...store,
        empresas: store.empresas.map(emp =>
          emp.id_empresa === action.payload.id_empresa ? action.payload : emp
        )
      };
    case 'DELETE_EMPRESA':
      return {
        ...store,
        empresas: store.empresas.filter(emp => emp.id_empresa !== action.payload)
      };
    case 'SET_CURRENT_EMPRESA':
      return {
        ...store,
        currentEmpresa: action.payload
      };
    case 'CLEAR_CURRENT_EMPRESA':
      return {
        ...store,
        currentEmpresa: null
      };


    // *** ACCIONES PARA ESPACIOS ***
    case 'SET_ESPACIOS':
      return {
        ...store,
        espacios: action.payload // payload: array de objetos espacio
      };
    case 'ADD_ESPACIO':
      return {
        ...store,
        espacios: [...store.espacios, action.payload] // payload: nuevo objeto espacio
      };
    case 'UPDATE_ESPACIO':
      return {
        ...store,
        espacios: store.espacios.map(esp =>
          esp.id_espacio === action.payload.id_espacio ? action.payload : esp
        ) // payload: objeto espacio actualizado
      };
    case 'DELETE_ESPACIO':
      return {
        ...store,
        espacios: store.espacios.filter(esp => esp.id_espacio !== action.payload) // payload: id_espacio a eliminar
      };

    // *** ACCIONES PARA SUBESPACIOS ***
    case 'SET_SUBESPACIOS':
      return {
        ...store,
        subEspacios: action.payload // payload: array de objetos sub-espacio
      };
    case 'ADD_SUBESPACIO':
      return {
        ...store,
        subEspacios: [...store.subEspacios, action.payload] // payload: nuevo objeto sub-espacio
      };
    case 'UPDATE_SUBESPACIO':
      return {
        ...store,
        subEspacios: store.subEspacios.map(sub =>
          sub.id_subespacio === action.payload.id_subespacio ? action.payload : sub
        ) // payload: objeto sub-espacio actualizado
      };
    case 'DELETE_SUBESPACIO':
      return {
        ...store,
        subEspacios: store.subEspacios.filter(sub => sub.id_subespacio !== action.payload) // payload: id_subespacio a eliminar
      };

    // *** ACCIONES PARA OBJETOS ***
    case 'SET_OBJETOS':
      return {
        ...store,
        objetos: action.payload // payload: array de objetos
      };
    case 'ADD_OBJETO':
      return {
        ...store,
        objetos: [...store.objetos, action.payload] // payload: nuevo objeto
      };
    case 'UPDATE_OBJETO':
      return {
        ...store,
        objetos: store.objetos.map(obj =>
          obj.id_objeto === action.payload.id_objeto ? action.payload : obj
        ) // payload: objeto actualizado
      };
    case 'DELETE_OBJETO':
      return {
        ...store,
        objetos: store.objetos.filter(obj => obj.id_objeto !== action.payload) // payload: id_objeto a eliminar
      };

    // *** ACCIONES PARA FORMULARIOS ***
    case 'SET_FORMULARIOS':
      // Los objetos de formulario en action.payload ya contendrán los nuevos campos
      // (es_plantilla, es_plantilla_global, compartir_con_empresas_ids, notificaciones_activas, automatizacion_activa)
      return {
        ...store,
        formularios: action.payload
      };
    case 'ADD_FORMULARIO':
      return {
        ...store,
        formularios: [...store.formularios, action.payload]
      };
    case 'UPDATE_FORMULARIO':
      return {
        ...store,
        formularios: store.formularios.map(form =>
          form.id_formulario === action.payload.id_formulario ? action.payload : form
        )
      };
    case 'DELETE_FORMULARIO':
      return {
        ...store,
        formularios: store.formularios.filter(form => form.id_formulario !== action.payload)
      };
    case 'SET_CURRENT_FORM':
      // El payload debe ser el objeto formulario completo con sus relaciones y nuevos campos
      return {
        ...store,
        currentForm: action.payload
      };
    case 'CLEAR_CURRENT_FORM':
      return {
        ...store,
        currentForm: null
      };

    // *** ACCIONES PARA PREGUNTAS ***
    case 'SET_PREGUNTAS':
      return {
        ...store,
        preguntas: action.payload
      };
    case 'ADD_PREGUNTA':
      return {
        ...store,
        // Si tienes currentForm, también podrías querer actualizar sus preguntas
        currentForm: store.currentForm ? {
          ...store.currentForm,
          preguntas: [...store.currentForm.preguntas, action.payload].sort((a,b) => a.orden - b.orden)
        } : store.currentForm,
        preguntas: [...store.preguntas, action.payload].sort((a,b) => a.orden - b.orden) // Mantener ordenado
      };
    case 'UPDATE_PREGUNTA':
      return {
        ...store,
        currentForm: store.currentForm ? {
          ...store.currentForm,
          preguntas: store.currentForm.preguntas.map(p =>
            p.id_pregunta === action.payload.id_pregunta ? action.payload : p
          ).sort((a,b) => a.orden - b.orden)
        } : store.currentForm,
        preguntas: store.preguntas.map(p =>
          p.id_pregunta === action.payload.id_pregunta ? action.payload : p
        ).sort((a,b) => a.orden - b.orden)
      };
    case 'DELETE_PREGUNTA':
      return {
        ...store,
        currentForm: store.currentForm ? {
          ...store.currentForm,
          preguntas: store.currentForm.preguntas.filter(p => p.id_pregunta !== action.payload)
        } : store.currentForm,
        preguntas: store.preguntas.filter(p => p.id_pregunta !== action.payload)
      };

    // *** ACCIONES PARA TIPOS DE RESPUESTA ***
    case 'SET_TIPOS_RESPUESTA':
      return {
        ...store,
        tiposRespuesta: action.payload
      };

    // *** ACCIONES PARA ENVÍOS DE FORMULARIO (RESPUESTAS) ***
    case 'SET_ENVIOS_FORMULARIO':
      return {
        ...store,
        enviosFormulario: action.payload
      };
    case 'ADD_ENVIO_FORMULARIO':
      // El objeto 'envio' en action.payload ya contendrá las respuestas,
      // y dentro de ellas, 'valor_firma_url' será una lista de URLs si aplica.
      return {
        ...store,
        enviosFormulario: [...store.enviosFormulario, action.payload]
      };
    case 'UPDATE_ENVIO_FORMULARIO':
      return {
        ...store,
        enviosFormulario: store.enviosFormulario.map(env =>
          env.id_envio === action.payload.id_envio ? action.payload : env
        )
      };
    case 'DELETE_ENVIO_FORMULARIO':
      return {
        ...store,
        enviosFormulario: store.enviosFormulario.filter(env => env.id_envio !== action.payload)
      };
    case 'SET_CURRENT_ENVIO':
      // El payload debe ser el objeto envío completo con sus respuestas,
      // incluyendo 'valor_firma_url' como lista de URLs en las respuestas.
      return {
        ...store,
        currentEnvio: action.payload
      };
    case 'CLEAR_CURRENT_ENVIO':
      return {
        ...store,
        currentEnvio: null
      };

    default:
      console.warn(`Unknown action type: ${action.type}`);
      return store;
  }
}