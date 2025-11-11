// src/store/flux.js

export const initialStore = () => {
  return {
    message: null, 
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
    user: null, 
    isLoggedIn: false, 
    requiresPasswordChange: false, 
    userRole: null, 

    // *** PROPIEDADES PARA EMPRESAS (si las gestionas en el store directamente) ***
    empresas: [],
    currentEmpresa: null,

    // *** PROPIEDADES PARA ESPACIOS, SUBESPACIOS Y OBJETOS ***
    espacios: [],
    subEspacios: [],
    objetos: [],

    // *** PROPIEDADES PARA FORMULARIOS, PREGUNTAS Y ENVÍOS ***
    formularios: [],
    currentForm: null,
    preguntas: [],
    tiposRespuesta: [],
    enviosFormulario: [],
    currentEnvio: null,

    // =========================================================================
    // *** PROPIEDADES PARA DOCUMENTOS DEL MINISTERIO ***
    // =========================================================================
    documentosCategorias: [], 
    isLoadingDocumentos: false,
    errorDocumentos: null, 

    // =========================================================================
    // *** PROPIEDADES PARA TRANSACCIONES Y RECIBOS (INCLUYE ABONOS/SALDOS) ***
    // =========================================================================
    transacciones: [],          // Array principal para almacenar todas las transacciones/recibos (TransaccionRecibo).
    currentTransaccion: null,   // Objeto para almacenar la transacción seleccionada/actual.
    isLoadingTransacciones: false, 
    errorTransacciones: null,
    // Podrías añadir un campo para el análisis si lo gestionas globalmente:
    // recibosAnalisis: null, 
    // recibosDetallesConcepto: [],
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
        empresas: [],
        espacios: [],
        subEspacios: [],
        objetos: [],
        formularios: [],
        currentForm: null,
        preguntas: [],
        tiposRespuesta: [],
        enviosFormulario: [],
        currentEnvio: null,
        documentosCategorias: [], 
        isLoadingDocumentos: false,
        errorDocumentos: null,
        transacciones: [], 
        currentTransaccion: null,
        isLoadingTransacciones: false,
        errorTransacciones: null,
        message: { type: 'success', text: 'Sesión cerrada exitosamente.' }
      };

    case 'SET_PASSWORD_CHANGE_REQUIRED':
      return {
        ...store,
        requiresPasswordChange: action.payload,
        user: store.user ? { ...store.user, cambio_password_requerido: action.payload } : store.user
      };
    
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
        espacios: action.payload
      };
    case 'ADD_ESPACIO':
      return {
        ...store,
        espacios: [...store.espacios, action.payload]
      };
    case 'UPDATE_ESPACIO':
      return {
        ...store,
        espacios: store.espacios.map(esp =>
          esp.id_espacio === action.payload.id_espacio ? action.payload : esp
        )
      };
    case 'DELETE_ESPACIO':
      return {
        ...store,
        espacios: store.espacios.filter(esp => esp.id_espacio !== action.payload)
      };

    // *** ACCIONES PARA SUBESPACIOS ***
    case 'SET_SUBESPACIOS':
      return {
        ...store,
        subEspacios: action.payload
      };
    case 'ADD_SUBESPACIO':
      return {
        ...store,
        subEspacios: [...store.subEspacios, action.payload]
      };
    case 'UPDATE_SUBESPACIO':
      return {
        ...store,
        subEspacios: store.subEspacios.map(sub =>
          sub.id_subespacio === action.payload.id_subespacio ? action.payload : sub
        )
      };
    case 'DELETE_SUBESPACIO':
      return {
        ...store,
        subEspacios: store.subEspacios.filter(sub => sub.id_subespacio !== action.payload)
      };

    // *** ACCIONES PARA OBJETOS ***
    case 'SET_OBJETOS':
      return {
        ...store,
        objetos: action.payload
      };
    case 'ADD_OBJETO':
      return {
        ...store,
        objetos: [...store.objetos, action.payload]
      };
    case 'UPDATE_OBJETO':
      return {
        ...store,
        objetos: store.objetos.map(obj =>
          obj.id_objeto === action.payload.id_objeto ? action.payload : obj
        )
      };
    case 'DELETE_OBJETO':
      return {
        ...store,
        objetos: store.objetos.filter(obj => obj.id_objeto !== action.payload)
      };

    // *** ACCIONES PARA FORMULARIOS ***
    case 'SET_FORMULARIOS':
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
        currentForm: store.currentForm ? {
          ...store.currentForm,
          preguntas: [...store.currentForm.preguntas, action.payload].sort((a,b) => a.orden - b.orden)
        } : store.currentForm,
        preguntas: [...store.preguntas, action.payload].sort((a,b) => a.orden - b.orden)
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
      return {
        ...store,
        currentEnvio: action.payload
      };
    case 'CLEAR_CURRENT_ENVIO':
      return {
        ...store,
        currentEnvio: null
      };

    // =========================================================================
    // *** ACCIONES PARA DOCUMENTOS DEL MINISTERIO ***
    // =========================================================================
    case 'SET_CATEGORIAS_DOCUMENTOS':
        return {
            ...store,
            documentosCategorias: action.payload,
            isLoadingDocumentos: false,
            errorDocumentos: null,
        };
    case 'ADD_NUEVA_CATEGORIA':
        return {
            ...store,
            documentosCategorias: [...store.documentosCategorias, action.payload],
            isLoadingDocumentos: false,
        };

    case 'DELETE_CATEGORIA':
        return {
            ...store,
            documentosCategorias: store.documentosCategorias.filter(
                cat => cat.id !== action.payload
            ),
            isLoadingDocumentos: false,
        };

    case 'ADD_DOCUMENTO_TO_CATEGORIA':
        return {
            ...store,
            documentosCategorias: store.documentosCategorias.map(cat =>
                cat.id === action.payload.categoriaId
                    ? { ...cat, documentos: [...(cat.documentos || []), action.payload.documento] }
                    : cat
            ),
            isLoadingDocumentos: false,
            errorDocumentos: null,
        };

    case 'DELETE_DOCUMENTO':
        return {
            ...store,
            documentosCategorias: store.documentosCategorias.map(cat => ({
                ...cat,
                documentos: cat.documentos.filter(doc => doc.id !== action.payload),
            })),
            isLoadingDocumentos: false,
        };

    case 'SET_LOADING_DOCUMENTOS':
        return {
            ...store,
            isLoadingDocumentos: action.payload,
        };

    case 'SET_ERROR_DOCUMENTOS':
        return {
            ...store,
            errorDocumentos: action.payload,
            isLoadingDocumentos: false,
        };

    // =========================================================================
    // *** ACCIONES PARA TRANSACCIONES Y RECIBOS (CORRECTO PARA ABONOS/SALDOS) ***
    // =========================================================================
    case 'SET_TRANSACCIONES':
        // Establece la lista completa de transacciones
        return {
            ...store,
            transacciones: action.payload,
            isLoadingTransacciones: false,
            errorTransacciones: null,
        };
    
    case 'ADD_TRANSACCION':
        // Añade una nueva transacción a la lista
        return {
            ...store,
            // Asegúrate de que el backend devuelve la transaccion serializada (con total_recibo, monto_pagado, saldo_pendiente)
            transacciones: [...store.transacciones, action.payload],
            isLoadingTransacciones: false,
        };

    case 'UPDATE_TRANSACCION':
        // Actualiza una transacción existente por su ID
        return {
            ...store,
            transacciones: store.transacciones.map(t =>
                t.id === action.payload.id ? action.payload : t
            ),
            currentTransaccion: store.currentTransaccion && store.currentTransaccion.id === action.payload.id
                ? action.payload
                : store.currentTransaccion,
            isLoadingTransacciones: false,
        };

    case 'DELETE_TRANSACCION':
        // Elimina una transacción por su ID
        return {
            ...store,
            transacciones: store.transacciones.filter(t => t.id !== action.payload),
            currentTransaccion: store.currentTransaccion && store.currentTransaccion.id === action.payload
                ? null
                : store.currentTransaccion,
            isLoadingTransacciones: false,
        };
    
    case 'SET_CURRENT_TRANSACCION':
        // Establece la transacción que se está viendo o editando
        return {
            ...store,
            currentTransaccion: action.payload,
        };
    
    case 'CLEAR_CURRENT_TRANSACCION':
        // Limpia la transacción actual
        return {
            ...store,
            currentTransaccion: null,
        };

    case 'SET_LOADING_TRANSACCIONES':
        return {
            ...store,
            isLoadingTransacciones: action.payload,
            errorTransacciones: action.payload ? null : store.errorTransacciones,
        };

    case 'SET_ERROR_TRANSACCIONES':
        return {
            ...store,
            errorTransacciones: action.payload,
            isLoadingTransacciones: false,
        };

    default:
      console.warn(`Unknown action type: ${action.type}`);
      return store;
  }
}