import os
from flask_admin import Admin
from .models import (
    db, Empresa, Usuario, Espacio, SubEspacio, Objeto,
    TipoRespuesta, Formulario, Pregunta, EnvioFormulario,
    Respuesta, Observacion, Notificacion, Concepto, Grado, Estudiante, TransaccionRecibo, DetalleRecibo 
)
from flask_admin.contrib.sqla import ModelView
from flask_admin.model import typefmt
from datetime import datetime

# Formatear fechas para el admin
def date_format(view, context, model, name):
    """
    Formatea un valor de fecha/hora para ser mostrado en el panel de administración.
    Recibe (view, context, model, name) según la especificación de Flask-Admin.
    """
    value = getattr(model, name)
    if value:
        return value.strftime('%Y-%m-%d %H:%M:%S')
    return ''

# Formatear JSON para visualización en el admin
def json_formatter(view, context, model, name):
    """
    Formatea un valor JSON para ser mostrado en el panel de administración.
    """
    value = getattr(model, name)
    if value is not None:
        # Esto es una forma simple de mostrar JSON. Para JSON complejos, 
        # podrías necesitar una plantilla personalizada o una mejor serialización.
        return str(value) 
    return ''

# Configuración personalizada para cada modelo
class EmpresaView(ModelView):
    column_list = ['id_empresa', 'nombre_empresa', 'direccion', 'telefono', 'email_contacto', 'fecha_creacion', 'activo']
    column_searchable_list = ['nombre_empresa', 'email_contacto']
    column_filters = ['fecha_creacion', 'activo']
    column_formatters = {
        'fecha_creacion': date_format
    }
    form_columns = ['nombre_empresa', 'direccion', 'telefono', 'email_contacto', 'creado_por_admin_general_id', 'logo_url', 'activo']

class UsuarioView(ModelView):
    column_list = ['id_usuario', 'nombre_completo', 'email', 'rol', 'empresa.nombre_empresa', 'fecha_creacion', 'ultimo_login', 'telefono_personal', 'cargo', 'cambio_password_requerido', 'activo', 'firma_digital_url'] # AÑADIDO: firma_digital_url
    column_searchable_list = ['nombre_completo', 'email', 'rol', 'telefono_personal', 'cargo']
    column_filters = ['rol', 'fecha_creacion', 'cambio_password_requerido', 'activo']
    column_formatters = {
        'fecha_creacion': date_format,
        'ultimo_login': date_format
    }
    # Asegúrate de que 'contrasena_hash' no se muestre directamente en el formulario de edición
    form_columns = [
        'id_empresa', 'nombre_completo', 'email', 'contrasena_hash', 'rol', 
        'imagen_perfil_url', 'telefono_personal', 'cargo', 
        'cambio_password_requerido', 'activo', 'favoritos', 'firma_digital_url' # AÑADIDO: favoritos y firma_digital_url
    ] 
    column_exclude_list = ['contrasena_hash'] # Mantiene la exclusión de la contraseña hash

class EspacioView(ModelView):
    column_list = ['id_espacio', 'nombre_espacio', 'empresa.nombre_empresa', 'descripcion']
    column_searchable_list = ['nombre_espacio', 'descripcion']
    column_filters = ['empresa.nombre_empresa']
    form_columns = ['id_empresa', 'nombre_espacio', 'descripcion']

class SubEspacioView(ModelView):
    column_list = ['id_subespacio', 'nombre_subespacio', 'espacio.nombre_espacio', 'descripcion']
    column_searchable_list = ['nombre_subespacio', 'descripcion']
    column_filters = ['espacio.nombre_espacio']
    form_columns = ['id_espacio', 'nombre_subespacio', 'descripcion']

class ObjetoView(ModelView):
    column_list = ['id_objeto', 'nombre_objeto', 'sub_espacio.nombre_subespacio', 'descripcion']
    column_searchable_list = ['nombre_objeto', 'descripcion']
    column_filters = ['sub_espacio.nombre_subespacio']
    form_columns = ['id_subespacio', 'nombre_objeto', 'descripcion']

class TipoRespuestaView(ModelView):
    column_list = ['id_tipo_respuesta', 'nombre_tipo', 'descripcion']
    column_searchable_list = ['nombre_tipo', 'descripcion']
    form_columns = ['nombre_tipo', 'descripcion']

class FormularioView(ModelView):
    column_list = [
        'id_formulario', 'nombre_formulario', 'empresa.nombre_empresa', 
        'frecuencia_minima_llenado', 'fecha_creacion', 
        'es_plantilla', 'es_plantilla_global', 'notificaciones_activas', 'automatizacion_activa' # AÑADIDO
    ]
    column_searchable_list = ['nombre_formulario', 'descripcion']
    column_filters = [
        'empresa.nombre_empresa', 'fecha_creacion', 
        'es_plantilla', 'es_plantilla_global', 'notificaciones_activas', 'automatizacion_activa' # AÑADIDO
    ]
    column_formatters = {
        'fecha_creacion': date_format,
        'compartir_con_empresas_ids': json_formatter # Para visualizar IDs de empresas compartidas
    }
    # Actualizado form_columns para incluir los nuevos campos y las relaciones muchos a muchos
    form_columns = [
        'id_empresa',
        'nombre_formulario',
        'descripcion',
        'max_submissions_per_period',
        'submission_period_days',
        'creado_por_usuario_id',
        'es_plantilla',              # NUEVO
        'es_plantilla_global',       # NUEVO
        'compartir_con_empresas_ids', # NUEVO: Flask-Admin lo renderizará como un campo de texto para JSON
        'notificaciones_activas',    # NUEVO
        'automatizacion_activa',     # NUEVO
        'espacios',                  # Relación muchos a muchos con Espacio
        'sub_espacios',              # Relación muchos a muchos con SubEspacio
        'objetos',                   # Relación muchos a muchos con Objeto
        'tipos_respuesta_disponibles' # NUEVO: Relación muchos a muchos con TipoRespuesta
    ]

class PreguntaView(ModelView):
    column_list = ['id_pregunta', 'texto_pregunta', 'formulario.nombre_formulario', 'tipo_respuesta.nombre_tipo', 'orden']
    column_searchable_list = ['texto_pregunta']
    column_filters = ['formulario.nombre_formulario', 'tipo_respuesta.nombre_tipo']
    form_columns = ['id_formulario', 'texto_pregunta', 'tipo_respuesta_id', 'orden', 'opciones_respuesta_json']

class EnvioFormularioView(ModelView):
    column_list = [
        'id_envio', 'formulario.nombre_formulario', 'usuario.nombre_completo', 
        'fecha_hora_envio', 'completado_automaticamente', 
        'espacios_cubiertos_ids', 'subespacios_cubiertos_ids', 'objetos_cubiertos_ids' # AÑADIDO: objetos_cubiertos_ids
    ]
    column_searchable_list = ['formulario.nombre_formulario', 'usuario.nombre_completo']
    column_filters = ['formulario.nombre_formulario', 'completado_automaticamente', 'fecha_hora_envio']
    column_formatters = {
        'fecha_hora_envio': date_format,
        'fechas_horas_actividad_reales': json_formatter,
        'espacios_cubiertos_ids': json_formatter,
        'subespacios_cubiertos_ids': json_formatter,
        'objetos_cubiertos_ids': json_formatter # AÑADIDO
    }
    form_columns = [
        'id_formulario', 'id_usuario', 'fechas_horas_actividad_reales', 
        'completado_automaticamente', 'espacios_cubiertos_ids', 
        'subespacios_cubiertos_ids', 'objetos_cubiertos_ids' # AÑADIDO
    ]

class RespuestaView(ModelView):
    column_list = ['id_respuesta', 'pregunta.texto_pregunta', 'envio.id_envio', 'valor_texto', 'valor_booleano', 'valor_numerico', 'valor_firma_url'] # AÑADIDO: valor_firma_url
    column_searchable_list = ['valor_texto']
    column_filters = ['valor_booleano', 'pregunta.texto_pregunta']
    column_formatters = {
        'valores_multiples_json': json_formatter,
        'valor_firma_url': json_formatter # AÑADIDO: Formateador para mostrar el JSON de URLs
    }
    form_columns = [
        'id_envio', 'id_pregunta', 'valor_texto', 'valor_booleano', 
        'valor_numerico', 'valores_multiples_json', 'valor_firma_url' # AÑADIDO: valor_firma_url
    ]

class ObservacionView(ModelView):
    column_list = ['id_observacion', 'texto_observacion', 'envio.id_envio', 'espacio.nombre_espacio', 'subespacio.nombre_subespacio', 'resuelta', 'fecha_hora_observacion']
    column_searchable_list = ['texto_observacion']
    column_filters = ['resuelta', 'fecha_hora_observacion', 'espacio.nombre_espacio', 'subespacio.nombre_subespacio']
    column_formatters = {
        'fecha_hora_observacion': date_format,
        'fecha_resolucion': date_format
    }
    form_columns = ['id_envio', 'id_espacio', 'id_subespacio', 'texto_observacion', 'resuelta', 'fecha_resolucion', 'resuelto_por_usuario_id']

class NotificacionView(ModelView):
    column_list = ['id_notificacion', 'tipo_notificacion', 'formulario.nombre_formulario', 'usuario_destinatario.nombre_completo', 'estado', 'fecha_hora_programada']
    column_searchable_list = ['tipo_notificacion', 'mensaje']
    column_filters = ['tipo_notificacion', 'estado', 'fecha_hora_programada']
    column_formatters = {
        'fecha_hora_programada': date_format,
        'fecha_hora_enviada': date_format,
        'horas_especificas_envio': json_formatter # AÑADIDO: Formateador para JSON
    }
    form_columns = ['id_formulario', 'id_usuario_destinatario', 'tipo_notificacion', 'mensaje', 'fecha_hora_programada', 'estado', 'frecuencia_notificacion', 'horas_especificas_envio']

# --- Vistas de Nuevos Modelos de Recibos y Análisis ---

class ConceptoView(ModelView):
    column_list = ['id_concepto', 'nombre_concepto', 'empresa.nombre_empresa', 'valor_base', 'activo']
    column_searchable_list = ['nombre_concepto']
    column_filters = ['activo', 'empresa.nombre_empresa']
    # Aquí están las form_columns definidas:
    form_columns = ['id_empresa', 'nombre_concepto', 'valor_base', 'activo']
    column_labels = dict(nombre_concepto='Nombre del Concepto', valor_base='Valor Base')

class GradoView(ModelView):
    column_list = ['id_grado', 'nombre_grado', 'empresa.nombre_empresa', 'orden', 'activo']
    column_searchable_list = ['nombre_grado']
    column_filters = ['activo', 'empresa.nombre_empresa']
    # Aquí están las form_columns definidas:
    form_columns = ['id_empresa', 'nombre_grado', 'orden', 'activo']
    column_labels = dict(nombre_grado='Nombre del Grado')

class EstudianteView(ModelView):
    column_list = ['id_estudiante', 'nombre_completo', 'grado.nombre_grado', 'empresa.nombre_empresa', 'correo_responsable', 'activo']
    column_searchable_list = ['nombre_completo', 'correo_responsable']
    column_filters = ['activo', 'grado.nombre_grado', 'empresa.nombre_empresa']
    # Aquí están las form_columns definidas:
    form_columns = ['id_empresa', 'id_grado', 'nombre_completo', 'correo_responsable', 'activo']
    column_labels = dict(correo_responsable='Correo del Responsable')

class TransaccionReciboView(ModelView):
    column_list = ['id_transaccion', 'empresa.nombre_empresa', 'usuario_creador.nombre_completo', 'fecha_transaccion', 'total_recibo', 'tipo_pago', 'observaciones']
    column_searchable_list = ['tipo_pago']
    column_filters = ['fecha_transaccion', 'tipo_pago', 'empresa.nombre_empresa']
    column_formatters = {
        'fecha_transaccion': date_format
    }
    # Aquí están las form_columns definidas:
    form_columns = ['id_empresa', 'id_usuario_creador', 'fecha_transaccion', 'total_recibo', 'tipo_pago', 'observaciones']
    column_labels = dict(usuario_creador='Creado por Usuario', total_recibo='Total Recibo')

class DetalleReciboView(ModelView):
    column_list = ['id_detalle', 'transaccion.id_transaccion', 'estudiante.nombre_completo', 'concepto.nombre_concepto', 'valor_cobrado', 'cantidad']
    column_searchable_list = ['valor_cobrado']
    column_filters = ['concepto.nombre_concepto', 'estudiante.nombre_completo']
    # Aquí están las form_columns definidas:
    form_columns = ['id_transaccion', 'id_estudiante', 'id_concepto', 'valor_cobrado', 'cantidad']
    column_labels = dict(valor_cobrado='Valor Cobrado')


def setup_admin(app):
    app.secret_key = os.environ.get('FLASK_APP_KEY', 'sample key')
    app.config['FLASK_ADMIN_SWATCH'] = 'cerulean'
    admin = Admin(app, name='SGSST Admin', template_mode='bootstrap3')

    # Agregar todas las vistas de modelos al admin
    admin.add_view(EmpresaView(Empresa, db.session, name='Empresas'))
    admin.add_view(UsuarioView(Usuario, db.session, name='Usuarios'))
    admin.add_view(EspacioView(Espacio, db.session, name='Espacios'))
    admin.add_view(SubEspacioView(SubEspacio, db.session, name='Sub-Espacios'))
    admin.add_view(ObjetoView(Objeto, db.session, name='Objetos'))
    admin.add_view(TipoRespuestaView(TipoRespuesta, db.session, name='Tipos de Respuesta'))
    admin.add_view(FormularioView(Formulario, db.session, name='Formularios'))
    admin.add_view(PreguntaView(Pregunta, db.session, name='Preguntas'))
    admin.add_view(EnvioFormularioView(EnvioFormulario, db.session, name='Envíos de Formularios'))
    admin.add_view(RespuestaView(Respuesta, db.session, name='Respuestas'))
    admin.add_view(ObservacionView(Observacion, db.session, name='Observaciones'))
    admin.add_view(NotificacionView(Notificacion, db.session, name='Notificaciones'))
    # --- Añadidas las Vistas de Recibos y Análisis ---
    admin.add_view(ConceptoView(Concepto, db.session, name='Conceptos'))
    admin.add_view(GradoView(Grado, db.session, name='Grados'))
    admin.add_view(EstudianteView(Estudiante, db.session, name='Estudiantes'))
    admin.add_view(TransaccionReciboView(TransaccionRecibo, db.session, name='Transacciones Recibos'))
    admin.add_view(DetalleReciboView(DetalleRecibo, db.session, name='Detalle Recibo'))