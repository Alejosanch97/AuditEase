import os
from flask_admin import Admin
from .models import (
    db, Empresa, Usuario, Espacio, SubEspacio, 
    TipoRespuesta, Formulario, Pregunta, EnvioFormulario, 
    Respuesta, Observacion, Notificacion
)
from flask_admin.contrib.sqla import ModelView
from flask_admin.model import typefmt
from datetime import datetime

# Formatear fechas para el admin
# *** CORRECCIÓN A LA FUNCIÓN date_format ***
def date_format(view, context, model, name):
    """
    Formatea un valor de fecha/hora para ser mostrado en el panel de administración.
    Recibe (view, context, model, name) según la especificación de Flask-Admin.
    """
    value = getattr(model, name) # Obtiene el valor de la columna 'name' del objeto 'model'
    if value:
        return value.strftime('%Y-%m-%d %H:%M:%S')
    return ''

# Configuración personalizada para cada modelo (estas clases están bien)
class EmpresaView(ModelView):
    column_list = ['id_empresa', 'nombre_empresa', 'direccion', 'telefono', 'email_contacto', 'fecha_creacion']
    column_searchable_list = ['nombre_empresa', 'email_contacto']
    column_filters = ['fecha_creacion']
    column_formatters = {
        'fecha_creacion': date_format
    }
    form_columns = ['nombre_empresa', 'direccion', 'telefono', 'email_contacto', 'creado_por_admin_general_id']

class UsuarioView(ModelView):
    column_list = ['id_usuario', 'nombre_completo', 'email', 'rol', 'empresa.nombre_empresa', 'fecha_creacion', 'ultimo_login']
    column_searchable_list = ['nombre_completo', 'email', 'rol']
    column_filters = ['rol', 'fecha_creacion']
    column_formatters = {
        'fecha_creacion': date_format,
        'ultimo_login': date_format
    }
    form_columns = ['id_empresa', 'nombre_completo', 'email', 'contrasena_hash', 'rol']
    column_exclude_list = ['contrasena_hash']

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

class TipoRespuestaView(ModelView):
    column_list = ['id_tipo_respuesta', 'nombre_tipo', 'descripcion']
    column_searchable_list = ['nombre_tipo', 'descripcion']
    form_columns = ['nombre_tipo', 'descripcion']

class FormularioView(ModelView):
    column_list = ['id_formulario', 'nombre_formulario', 'empresa.nombre_empresa', 'frecuencia_minima_llenado', 'fecha_creacion']
    column_searchable_list = ['nombre_formulario', 'descripcion']
    column_filters = ['empresa.nombre_empresa', 'fecha_creacion']
    column_formatters = {
        'fecha_creacion': date_format
    }
    form_columns = ['id_empresa', 'nombre_formulario', 'descripcion', 'frecuencia_minima_llenado', 'creado_por_usuario_id']

class PreguntaView(ModelView):
    column_list = ['id_pregunta', 'texto_pregunta', 'formulario.nombre_formulario', 'tipo_respuesta.nombre_tipo', 'orden']
    column_searchable_list = ['texto_pregunta']
    column_filters = ['formulario.nombre_formulario', 'tipo_respuesta.nombre_tipo']
    form_columns = ['id_formulario', 'texto_pregunta', 'tipo_respuesta_id', 'orden', 'opciones_respuesta_json']

class EnvioFormularioView(ModelView):
    column_list = ['id_envio', 'formulario.nombre_formulario', 'usuario.nombre_completo', 'fecha_hora_envio', 'completado_automaticamente']
    column_searchable_list = ['formulario.nombre_formulario', 'usuario.nombre_completo']
    column_filters = ['formulario.nombre_formulario', 'completado_automaticamente', 'fecha_hora_envio']
    column_formatters = {
        'fecha_hora_envio': date_format
    }
    form_columns = ['id_formulario', 'id_usuario', 'fechas_horas_actividad_reales', 'completado_automaticamente', 'espacios_cubiertos_ids', 'subespacios_cubiertos_ids']

class RespuestaView(ModelView):
    column_list = ['id_respuesta', 'pregunta.texto_pregunta', 'envio.id_envio', 'valor_texto', 'valor_booleano', 'valor_numerico']
    column_searchable_list = ['valor_texto']
    column_filters = ['valor_booleano', 'pregunta.texto_pregunta']
    form_columns = ['id_envio', 'id_pregunta', 'valor_texto', 'valor_booleano', 'valor_numerico', 'valores_multiples_json']

class ObservacionView(ModelView):
    column_list = ['id_observacion', 'texto_observacion', 'envio.id_envio', 'espacio.nombre_espacio', 'resuelta', 'fecha_hora_observacion']
    column_searchable_list = ['texto_observacion']
    column_filters = ['resuelta', 'fecha_hora_observacion', 'espacio.nombre_espacio']
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
        'fecha_hora_enviada': date_format
    }
    form_columns = ['id_formulario', 'id_usuario_destinatario', 'tipo_notificacion', 'mensaje', 'fecha_hora_programada', 'estado', 'frecuencia_notificacion', 'horas_especificas_envio']

def setup_admin(app):
    app.secret_key = os.environ.get('FLASK_APP_KEY', 'sample key')
    app.config['FLASK_ADMIN_SWATCH'] = 'cerulean'
    admin = Admin(app, name='SGSST Admin', template_mode='bootstrap3')

    # Agregar todas las vistas de modelos al admin
    admin.add_view(EmpresaView(Empresa, db.session, name='Empresas'))
    admin.add_view(UsuarioView(Usuario, db.session, name='Usuarios'))
    admin.add_view(EspacioView(Espacio, db.session, name='Espacios'))
    admin.add_view(SubEspacioView(SubEspacio, db.session, name='Sub-Espacios'))
    admin.add_view(TipoRespuestaView(TipoRespuesta, db.session, name='Tipos de Respuesta'))
    admin.add_view(FormularioView(Formulario, db.session, name='Formularios'))
    admin.add_view(PreguntaView(Pregunta, db.session, name='Preguntas'))
    admin.add_view(EnvioFormularioView(EnvioFormulario, db.session, name='Envíos de Formularios'))
    admin.add_view(RespuestaView(Respuesta, db.session, name='Respuestas'))
    admin.add_view(ObservacionView(Observacion, db.session, name='Observaciones'))
    admin.add_view(NotificacionView(Notificacion, db.session, name='Notificaciones'))