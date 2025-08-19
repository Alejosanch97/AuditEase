from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, Integer, DateTime, Text, JSON, ForeignKey, Table, Float, Time, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date, time
from typing import List, Optional

# Inicializa SQLAlchemy aquí
db = SQLAlchemy()

# Tablas intermedias para relaciones muchos a muchos
formulario_espacio = Table(
    'formulario_espacio',
    db.metadata,
    db.Column('id_formulario', Integer, ForeignKey('formularios.id_formulario'), primary_key=True),
    db.Column('id_espacio', Integer, ForeignKey('espacios.id_espacio'), primary_key=True)
)

formulario_subespacio = Table(
    'formulario_subespacio',
    db.metadata,
    db.Column('id_formulario', Integer, ForeignKey('formularios.id_formulario'), primary_key=True),
    db.Column('id_subespacio', Integer, ForeignKey('sub_espacios.id_subespacio'), primary_key=True)
)

formulario_objeto = Table(
    'formulario_objeto',
    db.metadata,
    db.Column('id_formulario', Integer, ForeignKey('formularios.id_formulario'), primary_key=True),
    db.Column('id_objeto', Integer, ForeignKey('objetos.id_objeto'), primary_key=True)
)

# NUEVA TABLA INTERMEDIA: formulario_tipo_respuesta
formulario_tipo_respuesta = Table(
    'formulario_tipo_respuesta',
    db.metadata,
    db.Column('id_formulario', Integer, ForeignKey('formularios.id_formulario'), primary_key=True),
    db.Column('id_tipo_respuesta', Integer, ForeignKey('tipos_respuesta.id_tipo_respuesta'), primary_key=True)
)


class Empresa(db.Model):
    __tablename__ = 'empresas'

    id_empresa: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre_empresa: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[str] = mapped_column(String(500), nullable=True)
    telefono: Mapped[str] = mapped_column(String(20), nullable=True)
    email_contacto: Mapped[str] = mapped_column(String(120), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    creado_por_admin_general_id: Mapped[int] = mapped_column(Integer, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    activo: Mapped[bool] = mapped_column(db.Boolean, default=True) # Campo para activar/desactivar empresa

    usuarios: Mapped[List["Usuario"]] = relationship("Usuario", back_populates="empresa")
    espacios: Mapped[List["Espacio"]] = relationship("Espacio", back_populates="empresa")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", back_populates="empresa")

    def serialize(self):
        return {
            "id_empresa": self.id_empresa,
            "nombre_empresa": self.nombre_empresa,
            "direccion": self.direccion,
            "telefono": self.telefono,
            "email_contacto": self.email_contacto,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "creado_por_admin_general_id": self.creado_por_admin_general_id,
            "logo_url": self.logo_url,
            "activo": self.activo
        }


class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id_usuario: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_empresa: Mapped[int] = mapped_column(Integer, ForeignKey('empresas.id_empresa'), nullable=True)
    nombre_completo: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    contrasena_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(50), nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ultimo_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    imagen_perfil_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cambio_password_requerido: Mapped[bool] = mapped_column(db.Boolean, default=False)
    activo: Mapped[bool] = mapped_column(db.Boolean, default=True)
    
    telefono_personal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cargo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    favoritos: Mapped[List[int]] = mapped_column(JSON, default=list, nullable=False)
    
    # NUEVO: Campo para la firma digital del usuario
    firma_digital_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) 

    empresa: Mapped[Optional["Empresa"]] = relationship("Empresa", back_populates="usuarios")
    envios_formulario: Mapped[List["EnvioFormulario"]] = relationship("EnvioFormulario", back_populates="usuario")
    notificaciones: Mapped[List["Notificacion"]] = relationship("Notificacion", back_populates="usuario_destinatario")

    documentos_subidos: Mapped[List["DocumentosMinisterio"]] = relationship("DocumentosMinisterio", back_populates="usuario_que_subio")


    def serialize(self):
        empresa_data = None
        if self.empresa:
            empresa_data = self.empresa.serialize()

        return {
            "id_usuario": self.id_usuario,
            "id_empresa": self.id_empresa,
            "nombre_completo": self.nombre_completo,
            "email": self.email,
            "rol": self.rol,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "ultimo_login": self.ultimo_login.isoformat() if self.ultimo_login else None,
            "imagen_perfil_url": self.imagen_perfil_url,
            "telefono_personal": self.telefono_personal,
            "cargo": self.cargo,
            "cambio_password_requerido": self.cambio_password_requerido,
            "activo": self.activo,
            "empresa": empresa_data,
            "favoritos": self.favoritos,
            "firma_digital_url": self.firma_digital_url # Incluir en la serialización
        }


class Espacio(db.Model):
    __tablename__ = 'espacios'

    id_espacio: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_empresa: Mapped[int] = mapped_column(Integer, ForeignKey('empresas.id_empresa'), nullable=False)
    nombre_espacio: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="espacios")
    sub_espacios: Mapped[List["SubEspacio"]] = relationship("SubEspacio", back_populates="espacio")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", secondary=formulario_espacio, back_populates="espacios")
    observaciones: Mapped[List["Observacion"]] = relationship("Observacion", back_populates="espacio")

    def serialize(self):
        return {
            "id_espacio": self.id_espacio,
            "id_empresa": self.id_empresa,
            "nombre_espacio": self.nombre_espacio,
            "descripcion": self.descripcion
        }

class SubEspacio(db.Model):
    __tablename__ = 'sub_espacios'

    id_subespacio: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_espacio: Mapped[int] = mapped_column(Integer, ForeignKey('espacios.id_espacio'), nullable=False)
    nombre_subespacio: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    espacio: Mapped["Espacio"] = relationship("Espacio", back_populates="sub_espacios")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", secondary=formulario_subespacio, back_populates="sub_espacios")
    observaciones: Mapped[List["Observacion"]] = relationship("Observacion", back_populates="subespacio")
    objetos: Mapped[List["Objeto"]] = relationship("Objeto", back_populates="sub_espacio")

    def serialize(self):
        return {
            "id_subespacio": self.id_subespacio,
            "id_espacio": self.id_espacio,
            "nombre_subespacio": self.nombre_subespacio,
            "descripcion": self.descripcion
        }

class Objeto(db.Model):
    __tablename__ = 'objetos'

    id_objeto: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_subespacio: Mapped[int] = mapped_column(Integer, ForeignKey('sub_espacios.id_subespacio'), nullable=False)
    nombre_objeto: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sub_espacio: Mapped["SubEspacio"] = relationship("SubEspacio", back_populates="objetos")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", secondary=formulario_objeto, back_populates="objetos")

    def serialize(self):
        return {
            "id_objeto": self.id_objeto,
            "id_subespacio": self.id_subespacio,
            "nombre_objeto": self.nombre_objeto,
            "descripcion": self.descripcion
        }


class TipoRespuesta(db.Model):
    __tablename__ = 'tipos_respuesta'

    id_tipo_respuesta: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre_tipo: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    preguntas: Mapped[List["Pregunta"]] = relationship("Pregunta", back_populates="tipo_respuesta")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", secondary=formulario_tipo_respuesta, back_populates="tipos_respuesta_disponibles")


    def serialize(self):
        return {
            "id_tipo_respuesta": self.id_tipo_respuesta,
            "nombre_tipo": self.nombre_tipo,
            "descripcion": self.descripcion
        }

class Formulario(db.Model):
    __tablename__ = 'formularios'

    id_formulario: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_empresa: Mapped[int] = mapped_column(Integer, ForeignKey('empresas.id_empresa'), nullable=False)
    nombre_formulario: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    max_submissions_per_period: Mapped[int] = mapped_column(Integer, nullable=False, default=1) # Cuántas veces se puede llenar
    submission_period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1)     # En cuántos días (ej: 1 para diario, 7 para semanal)
    
    
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    creado_por_usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)

    es_plantilla: Mapped[bool] = mapped_column(Boolean, default=False)
    es_plantilla_global: Mapped[bool] = mapped_column(Boolean, default=False) # Si es plantilla global para todas las empresas activas
    # Si no es global, lista de IDs de empresas con las que se comparte esta plantilla específica
    compartir_con_empresas_ids: Mapped[List[int]] = mapped_column(JSON, default=list, nullable=False) 

    # NUEVO: Campo para activar/desactivar notificaciones del formulario
    notificaciones_activas: Mapped[bool] = mapped_column(Boolean, default=True)

    # NUEVO: Campo para activar/desactivar la automatización de llenado
    automatizacion_activa: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_automation_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True) # Hora programada (solo hora)
    last_automated_run_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True) # Última fecha de ejecución de la automatización


    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="formularios")
    preguntas: Mapped[List["Pregunta"]] = relationship("Pregunta", back_populates="formulario")
    envios_formulario: Mapped[List["EnvioFormulario"]] = relationship("EnvioFormulario", back_populates="formulario")
    notificaciones: Mapped[List["Notificacion"]] = relationship("Notificacion", back_populates="formulario")
    espacios: Mapped[List["Espacio"]] = relationship("Espacio", secondary=formulario_espacio, back_populates="formularios")
    sub_espacios: Mapped[List["SubEspacio"]] = relationship("SubEspacio", secondary=formulario_subespacio, back_populates="formularios")
    objetos: Mapped[List["Objeto"]] = relationship("Objeto", secondary=formulario_objeto, back_populates="formularios")

    # NUEVA RELACIÓN: muchos a muchos con TipoRespuesta
    tipos_respuesta_disponibles: Mapped[List["TipoRespuesta"]] = relationship("TipoRespuesta", secondary=formulario_tipo_respuesta, back_populates="formularios")


    def serialize(self):
        tipos_respuesta_data = [tr.serialize() for tr in self.tipos_respuesta_disponibles] if self.tipos_respuesta_disponibles else []

        return {
            "id_formulario": self.id_formulario,
            "id_empresa": self.id_empresa,
            "nombre_formulario": self.nombre_formulario,
            "descripcion": self.descripcion,
            "max_submissions_per_period": self.max_submissions_per_period,
            "submission_period_days": self.submission_period_days,

            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "creado_por_usuario_id": self.creado_por_usuario_id,
            "es_plantilla": self.es_plantilla, # Incluir en la serialización
            "es_plantilla_global": self.es_plantilla_global, # Incluir en la serialización
            "compartir_con_empresas_ids": self.compartir_con_empresas_ids, # Incluir en la serialización
            "notificaciones_activas": self.notificaciones_activas, # Incluir en la serialización
            "automatizacion_activa": self.automatizacion_activa, # Incluir en la serialización
            "scheduled_automation_time": self.scheduled_automation_time.strftime('%H:%M') if self.scheduled_automation_time else None, # Formato HH:MM
            "last_automated_run_date": self.last_automated_run_date.isoformat() if self.last_automated_run_date else None, # Formato YYYY-MM-DD
            "tipos_respuesta_disponibles": tipos_respuesta_data
        }

class Pregunta(db.Model):
    __tablename__ = 'preguntas'

    id_pregunta: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_formulario: Mapped[int] = mapped_column(Integer, ForeignKey('formularios.id_formulario'), nullable=False)
    texto_pregunta: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_respuesta_id: Mapped[int] = mapped_column(Integer, ForeignKey('tipos_respuesta.id_tipo_respuesta'), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    opciones_respuesta_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    recurso_asociado: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)


    formulario: Mapped["Formulario"] = relationship("Formulario", back_populates="preguntas")
    tipo_respuesta: Mapped["TipoRespuesta"] = relationship("TipoRespuesta", back_populates="preguntas")
    respuestas: Mapped[List["Respuesta"]] = relationship("Respuesta", back_populates="pregunta")

    def serialize(self):
        return {
            "id_pregunta": self.id_pregunta,
            "id_formulario": self.id_formulario,
            "texto_pregunta": self.texto_pregunta,
            "tipo_respuesta_id": self.tipo_respuesta_id,
            "orden": self.orden,
            "opciones_respuesta_json": self.opciones_respuesta_json,
            "recurso_asociado": self.recurso_asociado
        }

class EnvioFormulario(db.Model):
    __tablename__ = 'envios_formulario'

    id_envio: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_formulario: Mapped[int] = mapped_column(Integer, ForeignKey('formularios.id_formulario'), nullable=False)
    id_usuario: Mapped[int] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)
    fecha_hora_envio: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fechas_horas_actividad_reales: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    completado_automaticamente: Mapped[bool] = mapped_column(Boolean, default=False)
    espacios_cubiertos_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    subespacios_cubiertos_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    objetos_cubiertos_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    formulario: Mapped["Formulario"] = relationship("Formulario", back_populates="envios_formulario")
    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="envios_formulario")
    respuestas: Mapped[List["Respuesta"]] = relationship("Respuesta", back_populates="envio")
    observaciones: Mapped[List["Observacion"]] = relationship("Observacion", back_populates="envio")

    def serialize(self):
        return {
            "id_envio": self.id_envio,
            "id_formulario": self.id_formulario,
            "id_usuario": self.id_usuario,
            "fecha_hora_envio": self.fecha_hora_envio.isoformat() if self.fecha_hora_envio else None,
            "fechas_horas_actividad_reales": self.fechas_horas_actividad_reales,
            "completado_automaticamente": self.completado_automaticamente,
            "espacios_cubiertos_ids": self.espacios_cubiertos_ids,
            "subespacios_cubiertos_ids": self.subespacios_cubiertos_ids,
            "objetos_cubiertos_ids": self.objetos_cubiertos_ids
        }

class Respuesta(db.Model):
    __tablename__ = 'respuestas'

    id_respuesta: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_envio: Mapped[int] = mapped_column(Integer, ForeignKey('envios_formulario.id_envio'), nullable=False)
    id_pregunta: Mapped[int] = mapped_column(Integer, ForeignKey('preguntas.id_pregunta'), nullable=False)
    valor_texto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valor_booleano: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    valor_numerico: Mapped[Optional[float]] = mapped_column(db.Float, nullable=True)
    valores_multiples_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # MODIFICADO: Ahora puede almacenar una lista de URLs de firmas (JSON)
    valor_firma_url: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True) 

    envio: Mapped["EnvioFormulario"] = relationship("EnvioFormulario", back_populates="respuestas")
    pregunta: Mapped["Pregunta"] = relationship("Pregunta", back_populates="respuestas")

    def serialize(self):
        return {
            "id_respuesta": self.id_respuesta,
            "id_envio": self.id_envio,
            "id_pregunta": self.id_pregunta,
            "valor_texto": self.valor_texto,
            "valor_booleano": self.valor_booleano,
            "valor_numerico": self.valor_numerico,
            "valores_multiples_json": self.valores_multiples_json,
            "valor_firma_url": self.valor_firma_url
        }

class Observacion(db.Model):
    __tablename__ = 'observaciones'

    id_observacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_envio: Mapped[int] = mapped_column(Integer, ForeignKey('envios_formulario.id_envio'), nullable=False)
    id_espacio: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('espacios.id_espacio'), nullable=True)
    id_subespacio: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('sub_espacios.id_subespacio'), nullable=True)
    texto_observacion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_hora_observacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resuelta: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_resolucion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resuelto_por_usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=True)

    envio: Mapped["EnvioFormulario"] = relationship("EnvioFormulario", back_populates="observaciones")
    espacio: Mapped[Optional["Espacio"]] = relationship("Espacio", back_populates="observaciones")
    subespacio: Mapped[Optional["SubEspacio"]] = relationship("SubEspacio", back_populates="observaciones")

    def serialize(self):
        return {
            "id_observacion": self.id_observacion,
            "id_envio": self.id_envio,
            "id_espacio": self.id_espacio,
            "id_subespacio": self.id_subespacio,
            "texto_observacion": self.texto_observacion,
            "fecha_hora_observacion": self.fecha_hora_observacion.isoformat() if self.fecha_hora_observacion else None,
            "resuelta": self.resuelta,
            "fecha_resolucion": self.fecha_resolucion.isoformat() if self.fecha_resolucion else None,
            "resuelto_por_usuario_id": self.resuelto_por_usuario_id
        }

class Notificacion(db.Model):
    __tablename__ = 'notificaciones'

    id_notificacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_formulario: Mapped[int] = mapped_column(Integer, ForeignKey('formularios.id_formulario'), nullable=False)
    id_usuario_destinatario: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=True)
    tipo_notificacion: Mapped[str] = mapped_column(String(100), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_hora_programada: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fecha_hora_enviada: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    estado: Mapped[str] = mapped_column(String(50), default='pendiente')
    frecuencia_notificacion: Mapped[str] = mapped_column(String(50), nullable=False)
    horas_especificas_envio: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    formulario: Mapped["Formulario"] = relationship("Formulario", back_populates="notificaciones")
    usuario_destinatario: Mapped[Optional["Usuario"]] = relationship("Usuario", back_populates="notificaciones")

    def serialize(self):
        return {
            "id_notificacion": self.id_notificacion,
            "id_formulario": self.id_formulario,
            "id_usuario_destinatario": self.id_usuario_destinatario,
            "tipo_notificacion": self.tipo_notificacion,
            "mensaje": self.mensaje,
            "fecha_hora_programada": self.fecha_hora_programada.isoformat() if self.fecha_hora_programada else None,
            "fecha_hora_enviada": self.fecha_hora_enviada.isoformat() if self.fecha_hora_enviada else None,
            "estado": self.estado,
            "frecuencia_notificacion": self.frecuencia_notificacion,
            "horas_especificas_envio": self.horas_especificas_envio
        }

# Modelo de la tabla de Documentos del Ministerio
class DocumentoCategoria(db.Model):
    __tablename__ = 'documento_categorias'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relación uno a muchos con la tabla de documentos
    documentos: Mapped[List["DocumentosMinisterio"]] = relationship("DocumentosMinisterio", back_populates="categoria")

    def __repr__(self):
        return f'<DocumentoCategoria {self.nombre}>'

    def serialize(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "documentos": [doc.serialize() for doc in self.documentos] # Serializamos los documentos de la categoría
        }


# =========================================================================
# MODELO DE DOCUMENTOS MODIFICADO
# =========================================================================
class DocumentosMinisterio(db.Model):
    __tablename__ = 'documentos_ministerio'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url_archivo: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha_subida: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)

    # NUEVA CLAVE FORÁNEA: vincula el documento a una categoría
    categoria_id: Mapped[int] = mapped_column(Integer, ForeignKey('documento_categorias.id'), nullable=False)

    # Relaciones
    usuario_que_subio: Mapped["Usuario"] = relationship("Usuario", back_populates="documentos_subidos")
    categoria: Mapped["DocumentoCategoria"] = relationship("DocumentoCategoria", back_populates="documentos")


    def __repr__(self):
        return f'<DocumentoMinisterio {self.nombre}>'

    def serialize(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "url_archivo": self.url_archivo,
            "fecha_subida": self.fecha_subida.isoformat() if self.fecha_subida else None,
            "user_id": self.user_id,
            "categoria_id": self.categoria_id
        }