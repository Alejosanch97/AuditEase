from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean, Integer, DateTime, Text, JSON, ForeignKey, Table, Float # Asegúrate de importar Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import List, Optional

# Inicializa SQLAlchemy aquí
db = SQLAlchemy()

# Tablas intermedias para relaciones muchos a muchos
# Estas tablas son correctas y bien definidas.
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

class Empresa(db.Model):
    __tablename__ = 'empresas'

    id_empresa: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre_empresa: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[str] = mapped_column(String(500), nullable=True)
    telefono: Mapped[str] = mapped_column(String(20), nullable=True)
    email_contacto: Mapped[str] = mapped_column(String(120), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    creado_por_admin_general_id: Mapped[int] = mapped_column(Integer, nullable=True) # ID del OWNER que creó la empresa
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    activo: Mapped[bool] = mapped_column(db.Boolean, default=True) # Nuevo campo para activar/suspender empresas

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
            "activo": self.activo # Incluir el nuevo campo
        }


class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id_usuario: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_empresa: Mapped[int] = mapped_column(Integer, ForeignKey('empresas.id_empresa'), nullable=True)
    nombre_completo: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    contrasena_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(50), nullable=False)  # 'owner', 'admin_empresa', 'usuario_formulario'
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ultimo_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    imagen_perfil_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cambio_password_requerido: Mapped[bool] = mapped_column(db.Boolean, default=False) # NUEVO CAMPO
    activo: Mapped[bool] = mapped_column(db.Boolean, default=True) # Nuevo campo para activar/suspender usuarios

    # --- NUEVOS CAMPOS ---
    telefono_personal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) # Campo para teléfono personal
    cargo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # Campo para cargo (texto libre)
    # ---------------------

    # Relaciones: Los nombres de las clases destino están correctos
    empresa: Mapped[Optional["Empresa"]] = relationship("Empresa", back_populates="usuarios")
    envios_formulario: Mapped[List["EnvioFormulario"]] = relationship("EnvioFormulario", back_populates="usuario")
    notificaciones: Mapped[List["Notificacion"]] = relationship("Notificacion", back_populates="usuario_destinatario")

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
            "cambio_password_requerido": self.cambio_password_requerido, # Incluir el nuevo campo
            "activo": self.activo, # Incluir el nuevo campo
            "empresa": empresa_data
        }


class Espacio(db.Model):
    __tablename__ = 'espacios'
    
    id_espacio: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_empresa: Mapped[int] = mapped_column(Integer, ForeignKey('empresas.id_empresa'), nullable=False)
    nombre_espacio: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relaciones
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
    
    # Relaciones
    espacio: Mapped["Espacio"] = relationship("Espacio", back_populates="sub_espacios")
    formularios: Mapped[List["Formulario"]] = relationship("Formulario", secondary=formulario_subespacio, back_populates="sub_espacios")
    observaciones: Mapped[List["Observacion"]] = relationship("Observacion", back_populates="subespacio")
    
    def serialize(self):
        return {
            "id_subespacio": self.id_subespacio,
            "id_espacio": self.id_espacio,
            "nombre_subespacio": self.nombre_subespacio,
            "descripcion": self.descripcion
        }

class TipoRespuesta(db.Model):
    __tablename__ = 'tipos_respuesta'
    
    id_tipo_respuesta: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre_tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relaciones
    preguntas: Mapped[List["Pregunta"]] = relationship("Pregunta", back_populates="tipo_respuesta")
    
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
    frecuencia_minima_llenado: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    creado_por_usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)
    
    # Relaciones
    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="formularios")
    preguntas: Mapped[List["Pregunta"]] = relationship("Pregunta", back_populates="formulario")
    envios_formulario: Mapped[List["EnvioFormulario"]] = relationship("EnvioFormulario", back_populates="formulario")
    notificaciones: Mapped[List["Notificacion"]] = relationship("Notificacion", back_populates="formulario")
    espacios: Mapped[List["Espacio"]] = relationship("Espacio", secondary=formulario_espacio, back_populates="formularios")
    sub_espacios: Mapped[List["SubEspacio"]] = relationship("SubEspacio", secondary=formulario_subespacio, back_populates="formularios")
    
    def serialize(self):
        return {
            "id_formulario": self.id_formulario,
            "id_empresa": self.id_empresa,
            "nombre_formulario": self.nombre_formulario,
            "descripcion": self.descripcion,
            "frecuencia_minima_llenado": self.frecuencia_minima_llenado,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "creado_por_usuario_id": self.creado_por_usuario_id
        }

class Pregunta(db.Model):
    __tablename__ = 'preguntas'
    
    id_pregunta: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_formulario: Mapped[int] = mapped_column(Integer, ForeignKey('formularios.id_formulario'), nullable=False)
    texto_pregunta: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_respuesta_id: Mapped[int] = mapped_column(Integer, ForeignKey('tipos_respuesta.id_tipo_respuesta'), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    opciones_respuesta_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relaciones
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
            "opciones_respuesta_json": self.opciones_respuesta_json
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
    
    # Relaciones
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
            "subespacios_cubiertos_ids": self.subespacios_cubiertos_ids
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
    
    # Relaciones
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
            "valores_multiples_json": self.valores_multiples_json
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
    
    # Relaciones
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
    
    # Relaciones
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