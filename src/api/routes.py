# src/api/routes.py

# ... (tus otras importaciones existentes)
from flask import Flask, request, jsonify, url_for, Blueprint, redirect, current_app
from api.models import db, Usuario, Empresa, Espacio, SubEspacio, Objeto, Formulario, Pregunta, TipoRespuesta, EnvioFormulario, Respuesta, Observacion, Notificacion, formulario_espacio, formulario_subespacio, formulario_objeto, formulario_tipo_respuesta, DocumentosMinisterio, DocumentoCategoria, formulario_espacio, formulario_subespacio, formulario_objeto, formulario_tipo_respuesta, Grado, Concepto, Estudiante, TransaccionRecibo, DetalleRecibo 
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, JWTManager
from datetime import datetime, timedelta, date, time # Importa date
import re
from sqlalchemy import func, and_, cast, Date, Time, or_
from sqlalchemy.orm import joinedload

from collections import Counter
import json
from sqlalchemy.dialects.postgresql import JSONB

# *** IMPORTACIONES NECESARIAS PARA CLOUDINARY ***
import cloudinary
import cloudinary.uploader
import base64 # Para decodificar base64 de firmas

from threading import Thread
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer
import os


api = Blueprint('api', __name__)



# Función para validar email
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# Función para validar contraseña
def validate_password(password):
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe contener al menos una mayúscula."
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe contener al menos una minúscula."
    if not re.search(r'\d', password):
        return False, "La contraseña debe contener al menos un número."
    return True, "Contraseña válida"

# Decorador para verificar rol
def role_required(allowed_roles):
    def decorator(fn):
        @jwt_required()
        def wrapper(*args, **kwargs):
            current_user_id = get_jwt_identity()
            usuario = Usuario.query.get(int(current_user_id))
            if not usuario or usuario.rol not in allowed_roles:
                return jsonify({"error": "Acceso no autorizado: No tienes el rol requerido"}), 403
            return fn(*args, **kwargs)
        # Esto es necesario para que Flask reconozca la ruta correctamente
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator

@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():
    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }
    return jsonify(response_body), 200

# [NUEVA RUTA] Endpoint para enviar correo desde el formulario de contacto
@api.route('/send-contact-email', methods=['POST'])
def send_contact_email():
    """
    Endpoint para recibir los datos del formulario de contacto y enviar un correo electrónico.
    """
    if not request.is_json:
        return jsonify({"message": "La solicitud debe ser JSON"}), 400

    data = request.get_json()
    company_name = data.get('companyName')
    responsible_name = data.get('responsibleName')
    email = data.get('email')
    whatsapp = data.get('whatsapp')

    if not all([company_name, responsible_name, email]):
        return jsonify({"message": "Faltan campos obligatorios"}), 400

    # Lógica corregida para enviar el correo
    try:
        # Creamos el mensaje de correo.
        msg = Message(
            subject=f"Nueva solicitud de empresa: {company_name}",
            sender='sgsstflow@gmail.com',
            recipients=['sgsstflow@gmail.com']
        )
        
        # El cuerpo del mensaje contendrá los datos del formulario.
        msg.body = (
            f"Hola equipo SGSST Flow,\n\n"
            f"¡Tienes una nueva solicitud de registro de empresa!\n\n"
            f"Detalles:\n"
            f"- Nombre de la empresa: {company_name}\n"
            f"- Nombre del responsable: {responsible_name}\n"
            f"- Correo electrónico: {email}\n"
            f"- WhatsApp: {whatsapp if whatsapp else 'No proporcionado'}\n\n"
            f"Por favor, ponte en contacto con ellos lo antes posible."
        )

        # Accedemos a la instancia de Flask-Mail usando `current_app`
        # Este es el cambio clave que soluciona el error.
        mail_instance = current_app.extensions.get('mail')
        if mail_instance:
            mail_instance.send(msg)
        else:
            raise RuntimeError("Flask-Mail no se ha inicializado correctamente en la aplicación.")

        # Responde con un mensaje de éxito si el envío es exitoso.
        return jsonify({
            "message": "Solicitud recibida. Nos pondremos en contacto contigo pronto."
        }), 200
    except Exception as e:
        # Si hay un error, responde con un error 500 y un mensaje útil.
        print(f"Error al enviar el correo: {e}")
        return jsonify({"message": f"Error del servidor al enviar el correo: {str(e)}"}), 500


@api.route('/registro', methods=['POST'])
def registro_owner_inicial():
    """
    Ruta para el registro inicial del owner del sistema y la empresa principal (SGSST FLOW).
    Solo permite un único registro de owner.
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # --- Datos del usuario ---
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()

        # --- Datos de la empresa ---
        nombre_empresa = data.get('nombre_empresa', '').strip()
        direccion = data.get('direccion', '').strip()
        telefono = data.get('telefono', '').strip() # Teléfono de la empresa
        email_contacto = data.get('email_contacto', '').strip().lower()

        # --- Validaciones de campos requeridos ---
        if not all([nombre_completo, email, password, nombre_empresa]):
            return jsonify({"error": "Todos los campos obligatorios (nombre completo, email, contraseña, nombre de la empresa) son requeridos."}), 400

        if not validate_email(email):
            return jsonify({"error": "El formato del email del usuario no es válido."}), 400

        if email_contacto and not validate_email(email_contacto):
            return jsonify({"error": "El formato del email de contacto de la empresa no es válido."}), 400

        is_valid_password, password_message = validate_password(password)
        if not is_valid_password:
            return jsonify({"error": password_message}), 400

        # --- Lógica para detectar si ya hay un owner ---
        existing_owner = Usuario.query.filter_by(rol='owner').first()
        if existing_owner:
            return jsonify({"error": "El registro inicial de 'owner' ya ha sido completado. No se permiten más registros de este tipo."}), 403

        existing_user_by_email = Usuario.query.filter_by(email=email).first()
        if existing_user_by_email:
            return jsonify({"error": "Ya existe un usuario con ese email registrado."}), 409

        # Opcional: verificar que no exista una empresa con el mismo nombre si esta es la "principal"
        existing_empresa_by_name = Empresa.query.filter_by(nombre_empresa=nombre_empresa).first()
        if existing_empresa_by_name:
            return jsonify({"error": "Ya existe una empresa con ese nombre. Por favor, elige uno diferente."}), 409


        # --- CREAR NUEVA EMPRESA PRINCIPAL (asociada al owner) ---
        nueva_empresa_principal = Empresa(
            nombre_empresa=nombre_empresa,
            direccion=direccion if direccion else None,
            telefono=telefono if telefono else None,
            email_contacto=email_contacto if email_contacto else None,
            fecha_creacion=datetime.utcnow(),
            creado_por_admin_general_id=None, # Al inicio el owner no tiene un id aún, se puede actualizar después o dejarlo en None
            activo=True # La empresa del owner siempre activa
        )

        db.session.add(nueva_empresa_principal)
        db.session.flush() # Guarda la empresa para obtener su ID antes de crear el usuario

        # --- CREAR NUEVO USUARIO (OWNER) con los nuevos campos ---
        password_hash = generate_password_hash(password)
        nuevo_owner = Usuario(
            nombre_completo=nombre_completo,
            email=email,
            contrasena_hash=password_hash,
            rol='owner', # Rol explícito para el owner
            id_empresa=nueva_empresa_principal.id_empresa, # Asocia el owner a su propia empresa
            fecha_creacion=datetime.utcnow(),
            telefono_personal=telefono_personal if telefono_personal else None,
            cargo=cargo if cargo else None,
            cambio_password_requerido=False, # El owner no necesita cambiar su password inicial
            activo=True
        )

        db.session.add(nuevo_owner)
        db.session.commit()

        # Opcional: Actualizar created_by_admin_general_id con el ID del owner si lo deseas
        # nueva_empresa_principal.creado_por_admin_general_id = nuevo_owner.id_usuario
        # db.session.commit()


        # Serializar el usuario y la empresa para la respuesta
        owner_data = nuevo_owner.serialize()

        return jsonify({
            "message": "Registro de owner y empresa principal exitoso.",
            "usuario": owner_data,
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error en el registro del owner: {e}")
        return jsonify({"error": f"Error interno del servidor al registrar el owner: {str(e)}"}), 500

@api.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email:
            return jsonify({"error": "El email es requerido"}), 400

        if not password:
            return jsonify({"error": "La contraseña es requerida"}), 400

        usuario = Usuario.query.filter_by(email=email).first()

        if not usuario:
            return jsonify({"error": "Credenciales inválidas"}), 401

        # MODIFICADO: Bloquear login si el usuario está inactivo
        if not usuario.activo:
            return jsonify({"error": "Usuario inactivo. Contacta al administrador."}), 403
        
        # NUEVO: Bloquear login si la empresa del usuario está inactiva (excepto para el owner)
        if usuario.id_empresa: # Solo si el usuario está asociado a una empresa
            empresa = Empresa.query.get(usuario.id_empresa)
            if empresa and not empresa.activo and usuario.rol != 'owner':
                return jsonify({"error": "La empresa a la que perteneces está inactiva. Contacta al administrador."}), 403


        if not check_password_hash(usuario.contrasena_hash, password):
            return jsonify({"error": "Credenciales inválidas"}), 401

        usuario.ultimo_login = datetime.utcnow()
        db.session.commit()

        access_token = create_access_token(
            identity=str(usuario.id_usuario),
            expires_delta=timedelta(hours=24)
        )

        return jsonify({
            "message": "Login exitoso",
            "access_token": access_token,
            "usuario": usuario.serialize()
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/verificar-token', methods=['GET'])
@jwt_required()
def verificar_token():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # MODIFICADO: Verificar si el usuario está activo
        if not usuario.activo:
            return jsonify({"valid": False, "error": "Usuario inactivo"}), 403
        
        # NUEVO: Verificar si la empresa del usuario está activa (excepto para el owner)
        if usuario.id_empresa:
            empresa = Empresa.query.get(usuario.id_empresa)
            if empresa and not empresa.activo and usuario.rol != 'owner':
                return jsonify({"valid": False, "error": "La empresa a la que perteneces está inactiva."}), 403

        return jsonify({
            "valid": True,
            "usuario": usuario.serialize()
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/perfil', methods=['GET', 'PUT'])
@jwt_required()
def gestionar_perfil():
    """
    Gestiona la obtención y actualización del perfil de usuario.

    El método GET ahora devuelve la información del usuario, incluyendo
    los campos 'firma_perfil' y 'ultima_entrega', que deben estar
    disponibles en el método serialize() del modelo Usuario.
    """
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    if request.method == 'GET':
        # La información de la firma y última entrega se obtiene
        # automáticamente a través del método serialize()
        return jsonify({"usuario": usuario.serialize()}), 200

    elif request.method == 'PUT':
        try:
            data = request.get_json()

            nombre_completo = data.get('nombre_completo')
            email = data.get('email')
            telefono_personal = data.get('telefono_personal')
            cargo = data.get('cargo')

            # Imprime los datos recibidos para depuración
            print(f"DEBUG_UPDATE_PROFILE: Datos de JSON recibidos: {data}")

            if nombre_completo:
                usuario.nombre_completo = nombre_completo.strip()

            if email:
                new_email = email.strip().lower()
                # Valida el nuevo email
                # Esta función validate_email debe estar definida en tu código
                if not validate_email(new_email):
                    return jsonify({"error": "El formato del email no es válido."}), 400
                if new_email != usuario.email:
                    existing_user_with_new_email = Usuario.query.filter_by(email=new_email).first()
                    if existing_user_with_new_email and existing_user_with_new_email.id_usuario != usuario.id_usuario:
                        return jsonify({"error": "Este email ya está en uso por otro usuario."}), 409
                    usuario.email = new_email

            if telefono_personal is not None:
                usuario.telefono_personal = telefono_personal.strip() if telefono_personal else None
            if cargo is not None:
                usuario.cargo = cargo.strip() if cargo else None

            # IMPORTANTE: La lógica para 'imagen_perfil' y 'firma_perfil'
            # se manejan en rutas separadas, por lo que se elimina de aquí.

            db.session.commit()
            return jsonify({"message": "Perfil actualizado exitosamente", "usuario": usuario.serialize()}), 200

        except Exception as e:
            db.session.rollback()
            print(f"Error interno del servidor al actualizar el perfil: {str(e)}")
            return jsonify({"error": f"Error interno del servidor al actualizar el perfil: {str(e)}"}), 500
        
# NUEVA RUTA: Para subir o actualizar la imagen de perfil del usuario
@api.route('/perfil/imagen-perfil', methods=['PUT'])
@jwt_required()
def upload_user_profile_image():
    """
    Permite a un usuario subir o actualizar su imagen de perfil.
    Espera un archivo de imagen (FormData) o un JSON con 'clear_image: true' para borrar.
    """
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    try:
        # Intentar obtener el archivo de la imagen de FormData
        imagen_perfil_file = request.files.get('imagen_perfil')
        
        # O intentar obtener una bandera para borrar de un JSON
        data = request.get_json(silent=True) # silent=True para no fallar si no es JSON
        clear_image_flag = data.get('clear_image') if data else False

        if clear_image_flag:
            usuario.imagen_perfil_url = None # Establecer a None para borrar
            db.session.commit()
            return jsonify({"message": "Imagen de perfil eliminada exitosamente", "imagen_perfil_url": None}), 200

        if imagen_perfil_file:
            if imagen_perfil_file.filename == '':
                # Si se envía un archivo vacío, se interpreta como una solicitud de borrado
                usuario.imagen_perfil_url = None
                db.session.commit()
                return jsonify({"message": "Imagen de perfil eliminada exitosamente", "imagen_perfil_url": None}), 200
            elif not imagen_perfil_file.content_type.startswith('image/'):
                return jsonify({"error": "El archivo de imagen de perfil debe ser una imagen."}), 400
            
            upload_result = cloudinary.uploader.upload(imagen_perfil_file)
            usuario.imagen_perfil_url = upload_result['secure_url']
            
        else:
            return jsonify({"error": "No se proporcionó ninguna imagen de perfil (ni archivo ni bandera de borrado)."}), 400

        db.session.commit()
        return jsonify({"message": "Imagen de perfil actualizada exitosamente", "imagen_perfil_url": usuario.imagen_perfil_url}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al subir la imagen de perfil del usuario: {str(e)}")
        return jsonify({"error": f"Error interno del servidor al subir la imagen de perfil: {str(e)}"}), 500


# NUEVA RUTA: Para subir o actualizar la firma digital del usuario
@api.route('/perfil/firma', methods=['PUT'])
@jwt_required()
def upload_user_signature():
    """
    Permite a un usuario subir o actualizar su firma digital.
    Espera un archivo de imagen (FormData), base64, o un JSON con 'clear_signature: true' para borrar.
    """
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    try:
        # Intentar obtener el archivo de la firma de FormData
        firma_file = request.files.get('firma_digital')
        
        # O intentar obtener la firma en base64 o una bandera para borrar de un JSON
        data = request.get_json(silent=True) # silent=True para no fallar si no es JSON
        firma_base64 = data.get('firma_base64') if data else None
        clear_signature_flag = data.get('clear_signature') if data else False

        if clear_signature_flag:
            usuario.firma_digital_url = None # Establecer a None para borrar
            db.session.commit()
            return jsonify({"message": "Firma digital eliminada exitosamente", "firma_url": None}), 200

        if firma_file:
            if firma_file.filename == '': # Si se envía un archivo vacío, se interpreta como una solicitud de borrado
                usuario.firma_digital_url = None
                db.session.commit()
                return jsonify({"message": "Firma digital eliminada exitosamente", "firma_url": None}), 200
            elif not firma_file.content_type.startswith('image/'):
                return jsonify({"error": "El archivo de firma debe ser una imagen."}), 400
            
            upload_result = cloudinary.uploader.upload(firma_file)
            usuario.firma_digital_url = upload_result['secure_url']
            
        elif firma_base64:
            # Cloudinary puede subir directamente desde base64
            upload_result = cloudinary.uploader.upload(firma_base64)
            usuario.firma_digital_url = upload_result['secure_url']
        else:
            return jsonify({"error": "No se proporcionó ninguna imagen de firma (ni archivo, ni base64, ni bandera de borrado)."}), 400

        db.session.commit()
        return jsonify({"message": "Firma digital actualizada exitosamente", "firma_url": usuario.firma_digital_url}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al subir la firma digital del usuario: {str(e)}")
        return jsonify({"error": f"Error interno del servidor al subir la firma digital: {str(e)}"}), 500


@api.route('/solicitar-recuperacion-password', methods=['POST'])
def solicitar_recuperacion_password():
    """
    Ruta que recibe un email y envía un enlace de recuperación de contraseña.
    """
    try:
        data = request.get_json()
        email = data.get('email')

        if not email:
            return jsonify({"error": "El email es requerido"}), 400

        usuario = Usuario.query.filter_by(email=email).first()
        if not usuario:
            # Por seguridad, no reveles si el email no existe
            return jsonify({"message": "Si tu correo está en nuestro sistema, recibirás un enlace para restablecer tu contraseña."}), 200

        # Crear el serializador usando la clave de la app.
        # Ya no usamos la variable 's' porque no existe en este archivo.
        s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        token = s.dumps(str(usuario.id_usuario), salt='recuperar-password-salt')

        # Construir el enlace de recuperación con una URL dinámica
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        link_recuperacion = f"{frontend_url}/restablecer-password/{token}"
        
        # Acceder a la instancia de mail inicializada en app.py
        mail_sender = current_app.extensions.get('mail')
        if not mail_sender:
            return jsonify({"error": "El servicio de correo no está configurado correctamente."}), 500
        
        msg = Message("Recuperación de Contraseña",
                      sender=current_app.config['MAIL_USERNAME'],
                      recipients=[usuario.email])
        msg.body = f"Hola {usuario.nombre_completo},\n\nHaz clic en el siguiente enlace para restablecer tu contraseña:\n\n{link_recuperacion}\n\nEste enlace expirará en una hora."
        mail_sender.send(msg)

        return jsonify({"message": "Si tu correo está en nuestro sistema, recibirás un enlace para restablecer tu contraseña."}), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


@api.route('/restablecer-password', methods=['POST'])
def restablecer_password():
    """
    Ruta que recibe el token y la nueva contraseña para actualizarla.
    """
    try:
        data = request.get_json()
        token = data.get('token')
        nueva_password = data.get('nueva_password')
        confirmar_password = data.get('confirmar_password')

        if not token:
            return jsonify({"error": "Token de recuperación no proporcionado."}), 400
        if not nueva_password or not confirmar_password:
            return jsonify({"error": "Se requieren la nueva contraseña y su confirmación."}), 400
        if nueva_password != confirmar_password:
            return jsonify({"error": "Las contraseñas no coinciden."}), 400

        is_valid, message = validate_password(nueva_password)
        if not is_valid:
            return jsonify({"error": message}), 400

        # Crear el serializador usando la clave de la app
        s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        try:
            # max_age debe ser el mismo que el tiempo de vida del token
            user_id = s.loads(token, salt='recuperar-password-salt', max_age=3600)
        except Exception:
            return jsonify({"error": "El token de recuperación es inválido o ha expirado."}), 400

        usuario = Usuario.query.get(int(user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # Actualizar la contraseña
        usuario.contrasena_hash = generate_password_hash(nueva_password)
        usuario.cambio_password_requerido = False # Aseguramos que este flag esté en False
        db.session.commit()

        return jsonify({"message": "Contraseña restablecida exitosamente. Ahora puedes iniciar sesión."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/cambiar-password', methods=['PUT'])
@jwt_required()
def cambiar_password():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        password_actual = data.get('password_actual', '')
        nueva_password = data.get('nueva_password', '')

        if not password_actual or not nueva_password:
            return jsonify({"error": "Se requieren ambas contraseñas"}), 400

        is_valid, message = validate_password(nueva_password)
        if not is_valid:
            return jsonify({"error": message}), 400

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        if not check_password_hash(usuario.contrasena_hash, password_actual):
            return jsonify({"error": "Contraseña actual incorrecta"}), 401

        usuario.contrasena_hash = generate_password_hash(nueva_password)
        usuario.cambio_password_requerido = False # Una vez que cambia la password, ya no es requerido
        db.session.commit()

        return jsonify({"message": "Contraseña actualizada exitosamente"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/recuperar-password', methods=['POST'])
def recuperar_password():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        email = data.get('email', '').strip().lower()

        if not email:
            return jsonify({"error": "El email es requerido"}), 400

        usuario = Usuario.query.filter_by(email=email).first()

        if not usuario:
            return jsonify({"message": "Si el email existe, recibirás instrucciones para restablecer tu contraseña"}), 200

        # En un sistema real, aquí enviarías un email con un enlace de restablecimiento.
        # Por ahora, solo confirmamos que el proceso se activaría si el email existe.
        return jsonify({"message": "Si el email existe, recibirás instrucciones para restablecer tu contraseña"}), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        return jsonify({"message": "Logout exitoso"}), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        if not usuario.activo:
            return jsonify({"error": "Usuario inactivo. Contacta al administrador."}), 403

        # NUEVO: Verificar si la empresa del usuario está activa (excepto para el owner)
        if usuario.id_empresa:
            empresa = Empresa.query.get(usuario.id_empresa)
            if empresa and not empresa.activo and usuario.rol != 'owner':
                return jsonify({"error": "La empresa a la que perteneces está inactiva."}), 403

        return jsonify({
            "message": f"Bienvenido al dashboard, {usuario.nombre_completo}!",
            "usuario": usuario.serialize()
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/empresas', methods=['GET'])
@role_required(['owner', 'admin_empresa'])
def listar_empresas():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if usuario.rol == 'owner':
            empresas = Empresa.query.all()
        elif usuario.rol == 'admin_empresa':
            # Un admin de empresa solo ve su propia empresa
            empresas = [usuario.empresa] if usuario.empresa else []
        else:
            return jsonify({"error": "No tienes permisos para esta acción"}), 403

        return jsonify({
            "empresas": [empresa.serialize() for empresa in empresas]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/mi-empresa', methods=['GET', 'PUT'])
@jwt_required()
def gestionar_mi_empresa():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    # Solo el owner y admin_empresa pueden gestionar la empresa
    if usuario.rol not in ['owner', 'admin_empresa']:
        return jsonify({"error": "No tienes permisos para gestionar la empresa."}), 403

    # Si es admin_empresa, solo puede gestionar su propia empresa
    # Si es owner, puede gestionar CUALQUIER empresa (a través de otra ruta) o la suya si tiene una.
    # Esta ruta es para 'mi' empresa, por lo que se asume la empresa del usuario.
    empresa = usuario.empresa

    if not empresa:
        return jsonify({"error": "El usuario no está asociado a ninguna empresa"}), 404

    if request.method == 'GET':
        return jsonify({"empresa": empresa.serialize()}), 200

    elif request.method == 'PUT':
        # El owner puede editar cualquier empresa (a través de /empresas/<id>/),
        # un admin_empresa solo puede editar su propia empresa.
        # Esta ruta permite editar la empresa asociada al usuario loggeado.
        if usuario.rol == 'owner' or (usuario.rol == 'admin_empresa' and request.args.get('empresa_id') == str(empresa.id_empresa)):
            try:
                data = request.form

                nombre_empresa = data.get('nombre_empresa')
                direccion = data.get('direccion')
                telefono = data.get('telefono')
                email_contacto = data.get('email_contacto')
                # El campo 'activo' solo debería ser editable por el owner
                activo_str = data.get('activo') # Viene como string 'true' o 'false'

                print(f"DEBUG_UPDATE_COMPANY: Datos de formulario recibidos: {data}")

                if nombre_empresa:
                    empresa.nombre_empresa = nombre_empresa.strip()
                if direccion:
                    empresa.direccion = direccion.strip()
                if telefono:
                    empresa.telefono = telefono.strip()
                if email_contacto:
                    new_email_contacto = email_contacto.strip().lower()
                    if not validate_email(new_email_contacto):
                        return jsonify({"error": "El formato del email de contacto de la empresa no es válido."}), 400
                    empresa.email_contacto = new_email_contacto

                # Solo el owner puede cambiar el estado 'activo' de una empresa
                if usuario.rol == 'owner' and activo_str is not None:
                    empresa.activo = activo_str.lower() == 'true'
                    print(f"DEBUG_OWNER_UPDATE: Activo recibido '{activo_str}', convertido a {empresa.activo}")


                if 'logo_empresa' in request.files:
                    logo_empresa = request.files['logo_empresa']
                    if logo_empresa.filename == '':
                        pass
                    elif not logo_empresa.content_type.startswith('image/'):
                        return jsonify({"error": "El archivo del logo de la empresa debe ser una imagen."}), 400
                    else:
                        try:
                            upload_result = cloudinary.uploader.upload(logo_empresa)
                            empresa.logo_url = upload_result['secure_url']
                        except Exception as e:
                            print(f"Error al subir el logo de la empresa a Cloudinary: {str(e)}")
                            return jsonify({"error": f"Error al subir el logo de la empresa a Cloudinary: {str(e)}"}), 500

                db.session.commit()
                return jsonify({"message": "Datos de la empresa actualizados exitosamente", "empresa": empresa.serialize()}), 200

            except Exception as e:
                db.session.rollback()
                print(f"Error interno del servidor al actualizar la empresa: {str(e)}")
                return jsonify({"error": f"Error interno del servidor al actualizar la empresa: {str(e)}"}), 500
        else:
            return jsonify({"error": "No tienes permisos para actualizar esta empresa."}), 403


# --- NUEVAS RUTAS DE GESTIÓN (Owner) ---

@api.route('/owner/empresas', methods=['POST'])
@role_required(['owner'])
def crear_empresa_por_owner():
    """
    Permite al OWNER crear una nueva empresa.
    """
    try:
        current_user_id = get_jwt_identity() # El ID del owner loggeado
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_empresa = data.get('nombre_empresa', '').strip()
        direccion = data.get('direccion', '').strip()
        telefono = data.get('telefono', '').strip()
        email_contacto = data.get('email_contacto', '').strip().lower()

        if not nombre_empresa:
            return jsonify({"error": "El nombre de la empresa es requerido."}), 400

        if email_contacto and not validate_email(email_contacto):
            return jsonify({"error": "El formato del email de contacto de la empresa no es válido."}), 400

        existing_empresa = Empresa.query.filter_by(nombre_empresa=nombre_empresa).first()
        if existing_empresa:
            return jsonify({"error": "Ya existe una empresa con este nombre."}), 409

        nueva_empresa = Empresa(
            nombre_empresa=nombre_empresa,
            direccion=direccion if direccion else None,
            telefono=telefono if telefono else None,
            email_contacto=email_contacto if email_contacto else None,
            fecha_creacion=datetime.utcnow(),
            creado_por_admin_general_id=int(current_user_id), # Asociar al owner que la creó
            activo=True # Las empresas creadas por el owner se activan por defecto
        )
        db.session.add(nueva_empresa)
        db.session.commit()

        return jsonify({
            "message": "Empresa creada exitosamente.",
            "empresa": nueva_empresa.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear empresa por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al crear empresa: {str(e)}"}), 500

@api.route('/owner/empresas/<int:empresa_id>', methods=['PUT'])
@role_required(['owner'])
@jwt_required()
def actualizar_empresa_por_owner(empresa_id):
    """
    Permite al OWNER actualizar los datos de cualquier empresa, incluyendo su estado 'activo' y logo.
    Ahora espera FormData.
    Si la empresa se reactiva, sus usuarios asociados también se reactivan.
    """
    try:
        empresa = Empresa.query.get(empresa_id)
        if not empresa:
            return jsonify({"error": "Empresa no encontrada."}), 404

        data = request.form

        print(f"DEBUG_OWNER_UPDATE: Datos de formulario recibidos para empresa {empresa_id}: {data}")

        nombre_empresa = data.get('nombre_empresa', '').strip()
        direccion = data.get('direccion', '').strip()
        telefono = data.get('telefono', '').strip()
        email_contacto = data.get('email_contacto', '').strip().lower()
        activo_str = data.get('activo') # Viene como string 'true' o 'false' de FormData

        # Guardar el estado activo_anterior para la lógica de reactivación de usuarios
        activo_anterior = empresa.activo

        if nombre_empresa and nombre_empresa != empresa.nombre_empresa:
            existing_empresa = Empresa.query.filter_by(nombre_empresa=nombre_empresa).first()
            if existing_empresa and existing_empresa.id_empresa != empresa_id:
                return jsonify({"error": "Ya existe otra empresa con este nombre."}), 409
            empresa.nombre_empresa = nombre_empresa

        if direccion is not None:
            empresa.direccion = direccion if direccion else None
        if telefono is not None:
            empresa.telefono = telefono if telefono else None
        if email_contacto is not None:
            if email_contacto and not validate_email(email_contacto):
                return jsonify({"error": "El formato del email de contacto de la empresa no es válido."}), 400
            empresa.email_contacto = email_contacto if email_contacto else None

        if activo_str is not None:
            empresa.activo = activo_str.lower() == 'true'
            print(f"DEBUG_OWNER_UPDATE: Activo recibido '{activo_str}', convertido a {empresa.activo}")

            # Lógica NUEVA: Si la empresa se reactiva, reactivar sus usuarios
            if not activo_anterior and empresa.activo: # Si estaba inactiva y ahora está activa
                usuarios_asociados = Usuario.query.filter_by(id_empresa=empresa_id).all()
                for user in usuarios_asociados:
                    if not user.activo: # Solo reactivar si el usuario está inactivo
                        user.activo = True
                        db.session.add(user)
                print(f"DEBUG_OWNER_UPDATE: Usuarios asociados a empresa {empresa_id} reactivados.")


        if 'logo_empresa' in request.files:
            logo_empresa = request.files['logo_empresa']
            if logo_empresa.filename == '':
                pass
            elif not logo_empresa.content_type.startswith('image/'):
                return jsonify({"error": "El archivo del logo de la empresa debe ser una imagen."}), 400
            else:
                try:
                    upload_result = cloudinary.uploader.upload(logo_empresa)
                    empresa.logo_url = upload_result['secure_url']
                    print(f"DEBUG_OWNER_UPDATE: Logo subido a Cloudinary: {empresa.logo_url}")
                except Exception as e:
                    print(f"Error al subir el logo de la empresa a Cloudinary: {str(e)}")
                    return jsonify({"error": f"Error al subir el logo de la empresa a Cloudinary: {str(e)}"}), 500

        db.session.commit()
        return jsonify({"message": "Empresa actualizada exitosamente.", "empresa": empresa.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar empresa por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar empresa: {str(e)}"}), 500
@api.route('/owner/empresas/<int:empresa_id>/desactivar', methods=['DELETE'])
@role_required(['owner'])
@jwt_required()
def desactivar_empresa(empresa_id):
    """
    Desactiva una empresa y a todos sus usuarios asociados.
    """
    try:
        empresa = Empresa.query.get(empresa_id)
        if not empresa:
            return jsonify({"error": "Empresa no encontrada."}), 404

        if not empresa.activo:
            return jsonify({"message": "La empresa ya está inactiva."}), 200

        empresa.activo = False
        
        # Desactivar usuarios asociados
        usuarios_asociados = Usuario.query.filter_by(id_empresa=empresa_id, activo=True).all()
        for user in usuarios_asociados:
            user.activo = False
        
        db.session.commit()
        return jsonify({"message": f"Empresa '{empresa.nombre_empresa}' y sus usuarios han sido desactivados.", "empresa_id": empresa_id}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al desactivar empresa: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


@api.route('/owner/empresas/<int:empresa_id>/reactivar', methods=['PUT'])
@role_required(['owner'])
@jwt_required()
def reactivar_empresa(empresa_id):
    """
    Reactivar una empresa y a todos sus usuarios asociados.
    """
    try:
        empresa = Empresa.query.get(empresa_id)
        if not empresa:
            return jsonify({"error": "Empresa no encontrada."}), 404

        if empresa.activo:
            return jsonify({"message": "La empresa ya está activa."}), 200

        empresa.activo = True

        # Reactivar usuarios asociados
        # Se ha cambiado 'User' por 'Usuario'
        usuarios_asociados = Usuario.query.filter_by(id_empresa=empresa_id, activo=False).all()
        for user in usuarios_asociados:
            user.activo = True
        
        db.session.commit()
        return jsonify({"message": f"Empresa '{empresa.nombre_empresa}' y sus usuarios han sido reactivados."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al reactivar empresa: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# NUEVA RUTA: Eliminar (desactivar) una empresa por el OWNER
@api.route('/owner/empresas/<int:empresa_id>', methods=['DELETE'])
@role_required(['owner'])
@jwt_required()
def eliminar_empresa_por_owner(empresa_id):
    """
    Permite al OWNER desactivar (soft delete) una empresa.
    Una empresa desactivada no puede tener nuevos usuarios ni formularios asociados.
    Los usuarios existentes de esa empresa también serán desactivados.
    """
    try:
        current_user_id = get_jwt_identity()
        owner_user = Usuario.query.get(int(current_user_id))

        empresa_a_desactivar = Empresa.query.get(empresa_id)
        if not empresa_a_desactivar:
            return jsonify({"error": "Empresa no encontrada."}), 404

        if owner_user.id_empresa == empresa_id:
            return jsonify({"error": "No puedes desactivar la empresa a la que perteneces directamente."}), 403


        if not empresa_a_desactivar.activo:
            return jsonify({"message": "La empresa ya está inactiva."}), 200

        empresa_a_desactivar.activo = False
        db.session.add(empresa_a_desactivar)

        # Desactivar todos los usuarios asociados a esta empresa
        usuarios_afectados = Usuario.query.filter_by(id_empresa=empresa_id).all()
        for user in usuarios_afectados:
            if user.id_usuario != int(current_user_id):
                user.activo = False
                db.session.add(user)

        db.session.commit()
        return jsonify({"message": f"Empresa '{empresa_a_desactivar.nombre_empresa}' y sus usuarios asociados han sido desactivados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al desactivar empresa por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al desactivar empresa: {str(e)}"}), 500

# NUEVA RUTA: Eliminar PERMANENTEMENTE una empresa por el OWNER
@api.route('/owner/empresas/permanently/<int:empresa_id>', methods=['DELETE'])
@role_required(['owner'])
@jwt_required()
def eliminar_empresa_permanentemente(empresa_id):
    """
    Permite al OWNER eliminar PERMANENTEMENTE una empresa y TODOS sus datos relacionados
    (usuarios, formularios, respuestas, espacios, sub-espacios, objetos, etc.)
    de la base de datos.
    """
    try:
        current_user_id = get_jwt_identity()
        owner_user = Usuario.query.get(int(current_user_id))

        empresa_a_eliminar = Empresa.query.get(empresa_id)
        if not empresa_a_eliminar:
            return jsonify({"error": "Empresa no encontrada."}), 404

        # Prevenir que el owner elimine la empresa a la que pertenece
        if owner_user.id_empresa == empresa_id:
            return jsonify({"error": "No puedes eliminar permanentemente la empresa a la que perteneces."}), 403

        # --- ORDEN CRÍTICO DE ELIMINACIÓN PARA RESPETAR CLAVES FORÁNEAS ---
        # El orden es de las tablas más dependientes a las menos dependientes.

        # 1. Eliminar Observaciones y Notificaciones
        #    Estas tablas tienen FK a EnvioFormulario, Formulario o Usuario.
        #    Si tienen FK a EnvioFormulario o Formulario, se eliminarán en cascada
        #    cuando estos sean eliminados.
        #    Si tienen FK a Usuario, se eliminarán en cascada cuando el usuario sea eliminado.
        #    Si tuvieran una FK directa a Empresa, se necesitaría una eliminación explícita aquí.
        #    Basado en tus modelos, Observacion tiene FK a EnvioFormulario, Espacio, SubEspacio.
        #    Notificacion tiene FK a Formulario y Usuario.
        #    Por lo tanto, se eliminarán en cascada con sus padres.

        # 2. Eliminar Respuestas de Formularios
        #    Las Respuestas dependen de EnvioFormulario y Pregunta.
        #    Deben eliminarse antes que los Envíos y Preguntas.
        respuestas_a_eliminar = db.session.query(Respuesta).join(EnvioFormulario).join(Formulario).filter(Formulario.id_empresa == empresa_id).all()
        for respuesta in respuestas_a_eliminar:
            db.session.delete(respuesta)
        db.session.flush() # Asegurarse de que las eliminaciones se procesen antes de continuar

        # 3. Eliminar Envíos de Formularios
        #    Los Envíos dependen de Formularios y Usuarios.
        envios_a_eliminar = db.session.query(EnvioFormulario).join(Formulario).filter(Formulario.id_empresa == empresa_id).all()
        for envio in envios_a_eliminar:
            # Observaciones relacionadas con este envío (si las hay) se eliminarán en cascada si la relación está configurada así.
            # Si no, se necesitaría: Observacion.query.filter_by(id_envio=envio.id_envio).delete(synchronize_session=False)
            db.session.delete(envio)
        db.session.flush()

        # 4. Eliminar Preguntas de Formularios
        #    Las Preguntas dependen de Formularios.
        preguntas_a_eliminar = db.session.query(Pregunta).join(Formulario).filter(Formulario.id_empresa == empresa_id).all()
        for pregunta in preguntas_a_eliminar:
            db.session.delete(pregunta)
        db.session.flush()

        # 5. Eliminar Formularios (y relaciones muchos a muchos)
        #    Los Formularios dependen de Empresa.
        #    También tienen relaciones muchos a muchos que deben ser manejadas.
        #    Las relaciones many-to-many (formulario_espacio, formulario_subespacio, formulario_objeto, formulario_tipo_respuesta)
        #    se manejan automáticamente por SQLAlchemy si las relaciones están configuradas con `cascade="all, delete-orphan"`
        #    o si se eliminan las filas de las tablas intermedias manualmente.
        #    Para mayor seguridad, eliminaremos las entradas en las tablas intermedias explícitamente.
        formularios_empresa = Formulario.query.filter_by(id_empresa=empresa_id).all()
        for form in formularios_empresa:
            # Eliminar entradas en tablas intermedias de muchos a muchos
            db.session.execute(formulario_espacio.delete().where(formulario_espacio.c.id_formulario == form.id_formulario))
            db.session.execute(formulario_subespacio.delete().where(formulario_subespacio.c.id_formulario == form.id_formulario))
            db.session.execute(formulario_objeto.delete().where(formulario_objeto.c.id_formulario == form.id_formulario))
            db.session.execute(formulario_tipo_respuesta.delete().where(formulario_tipo_respuesta.c.id_formulario == form.id_formulario))
            db.session.delete(form)
        db.session.flush()


        # 6. Eliminar Objetos
        #    Los Objetos dependen de SubEspacio.
        objetos_a_eliminar = db.session.query(Objeto).join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == empresa_id).all()
        for objeto in objetos_a_eliminar:
            db.session.delete(objeto)
        db.session.flush()

        # 7. Eliminar SubEspacios
        #    Los SubEspacios dependen de Espacio.
        sub_espacios_a_eliminar = db.session.query(SubEspacio).join(Espacio).filter(Espacio.id_empresa == empresa_id).all()
        for sub_espacio in sub_espacios_a_eliminar:
            db.session.delete(sub_espacio)
        db.session.flush()

        # 8. Eliminar Espacios
        #    Los Espacios dependen de Empresa.
        espacios_a_eliminar = Espacio.query.filter_by(id_empresa=empresa_id).all()
        for espacio in espacios_a_eliminar:
            db.session.delete(espacio)
        db.session.flush()

        # 9. Eliminar Usuarios
        #    Los Usuarios dependen de Empresa.
        usuarios_a_eliminar = Usuario.query.filter_by(id_empresa=empresa_id).all()
        for user in usuarios_a_eliminar:
            if user.id_usuario != int(current_user_id): # Asegurarse de no eliminar al owner loggeado
                db.session.delete(user)
        db.session.flush()

        # 10. Finalmente, eliminar la Empresa
        db.session.delete(empresa_a_eliminar)
        db.session.commit()

        return jsonify({"message": f"Empresa '{empresa_a_eliminar.nombre_empresa}' y todos sus datos relacionados han sido eliminados permanentemente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar empresa permanentemente: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar empresa permanentemente: {str(e)}"}), 500


@api.route('/owner/usuarios', methods=['POST'])
@role_required(['owner'])
def crear_usuario_por_owner():
    """
    Permite al OWNER crear nuevos usuarios (admins de empresa o usuarios finales)
    para una empresa específica.
    """
    try:
        current_user_id = get_jwt_identity() # ID del owner loggeado
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # Datos requeridos para el usuario
        id_empresa = data.get('id_empresa')
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        rol = data.get('rol', '').strip().lower() # rol 'admin_empresa' o 'usuario_formulario'
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()

        if not all([id_empresa, nombre_completo, email, password, rol]):
            return jsonify({"error": "Todos los campos obligatorios (id_empresa, nombre completo, email, contraseña, rol) son requeridos."}), 400

        if not validate_email(email):
            return jsonify({"error": "El formato del email del usuario no es válido."}), 400

        is_valid_password, password_message = validate_password(password)
        if not is_valid_password:
            return jsonify({"error": password_message}), 400

        # Validar que el rol sea uno permitido para la creación por owner
        if rol not in ['admin_empresa', 'usuario_formulario']:
            return jsonify({"error": "Rol inválido. El owner solo puede crear roles 'admin_empresa' o 'usuario_formulario'."}), 400

        # Verificar que la empresa exista y esté activa
        empresa_destino = Empresa.query.get(id_empresa)
        if not empresa_destino:
            return jsonify({"error": "La empresa especificada no existe."}), 404
        if not empresa_destino.activo:
            return jsonify({"error": "No se pueden crear usuarios para una empresa inactiva."}), 403

        # Verificar que el email no esté ya en uso
        existing_user_by_email = Usuario.query.filter_by(email=email).first()
        if existing_user_by_email:
            return jsonify({"error": "Ya existe un usuario con este email."}), 409

        # Crear hash de contraseña
        password_hash = generate_password_hash(password)

        nuevo_usuario = Usuario(
            id_empresa=id_empresa,
            nombre_completo=nombre_completo,
            email=email,
            contrasena_hash=password_hash,
            rol=rol,
            fecha_creacion=datetime.utcnow(),
            telefono_personal=telefono_personal if telefono_personal else None,
            cargo=cargo if cargo else None,
            cambio_password_requerido=True, # ¡Clave! El nuevo usuario debe cambiar su contraseña
            activo=True
        )

        db.session.add(nuevo_usuario)
        db.session.commit()

        return jsonify({
            "message": "Usuario creado exitosamente por el owner.",
            "usuario": nuevo_usuario.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear usuario por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al crear usuario: {str(e)}"}), 500

# NUEVA RUTA: Para editar un usuario específico por el OWNER
@api.route('/owner/usuarios/<int:user_id>', methods=['PUT'])
@role_required(['owner'])
def editar_usuario_por_owner(user_id):
    """
    Permite al OWNER editar los datos de un usuario específico.
    Los campos a editar son: nombre_completo, email, telefono_personal, cargo.
    IMPORTANTE: La imagen y la firma se gestionan en rutas separadas.
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos para actualizar"}), 400

        # Encontrar el usuario a editar
        usuario_a_editar = Usuario.query.get(user_id)
        if not usuario_a_editar:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # Validaciones de los campos
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        telefono_personal = data.get('telefono_personal', '')
        cargo = data.get('cargo', '')

        # Validar y actualizar el nombre_completo
        if nombre_completo:
            usuario_a_editar.nombre_completo = nombre_completo

        # Validar y actualizar el email
        if email:
            if not validate_email(email):
                return jsonify({"error": "El formato del email no es válido."}), 400
            
            # Verificar si el nuevo email ya está en uso por otro usuario
            existing_user_with_new_email = Usuario.query.filter_by(email=email).first()
            if existing_user_with_new_email and existing_user_with_new_email.id_usuario != usuario_a_editar.id_usuario:
                return jsonify({"error": "Este email ya está en uso por otro usuario."}), 409
            
            usuario_a_editar.email = email
            
        # Actualizar teléfono y cargo (pueden ser nulos)
        # Se usa 'is not None' para permitir que el cliente envíe una cadena vacía para borrar el campo
        if telefono_personal is not None:
            usuario_a_editar.telefono_personal = telefono_personal.strip() if telefono_personal else None
        
        if cargo is not None:
            usuario_a_editar.cargo = cargo.strip() if cargo else None

        db.session.commit()
        return jsonify({
            "message": "Usuario actualizado exitosamente por el owner.",
            "usuario": usuario_a_editar.serialize()
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al editar usuario por owner: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    

# NUEVA RUTA: Reactivar un usuario
@api.route('/owner/usuarios/reactivate/<int:user_id>', methods=['PUT'])
@jwt_required()
def reactivate_user(user_id):
    """
    Permite al OWNER reactivar un usuario que se encuentra inactivo.
    """
    current_user_id = get_jwt_identity()
    current_user = Usuario.query.get(current_user_id)

    if current_user.rol != 'owner':
        return jsonify({'error': 'Acceso denegado. Solo el owner puede reactivar usuarios.'}), 403

    user = Usuario.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    if user.activo:
        return jsonify({'message': 'El usuario ya está activo.'}), 400

    try:
        user.activo = True
        db.session.commit()
        return jsonify({'message': f'Usuario {user.nombre_completo} reactivado exitosamente.', 'user': user.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al reactivar usuario: {e}")
        return jsonify({'error': 'Error interno del servidor al reactivar el usuario.'}), 500


@api.route('/owner/usuarios/<int:user_id>', methods=['DELETE'])
@role_required(['owner'])
@jwt_required()
def eliminar_usuario_por_owner(user_id):
    """
    Permite al OWNER desactivar (soft delete) un usuario.
    Un usuario desactivado no puede iniciar sesión.
    """
    try:
        current_user_id = get_jwt_identity()

        usuario_a_desactivar = Usuario.query.get(user_id)
        if not usuario_a_desactivar:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # Prevenir que el owner se desactive a sí mismo
        if user_id == int(current_user_id):
            return jsonify({"error": "No puedes desactivarte a ti mismo."}), 403
        
        # Prevenir que un owner desactive a otro owner (si hubiera más de uno)
        if usuario_a_desactivar.rol == 'owner':
            return jsonify({"error": "No puedes desactivar a otro usuario con rol 'owner'."}), 403

        if not usuario_a_desactivar.activo:
            return jsonify({"message": "El usuario ya está inactivo."}), 200

        usuario_a_desactivar.activo = False
        db.session.add(usuario_a_desactivar)
        db.session.commit()

        return jsonify({"message": f"Usuario '{usuario_a_desactivar.nombre_completo}' ha sido desactivado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al desactivar usuario por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al desactivar usuario: {str(e)}"}), 500

@api.route('/usuarios/permanently/<int:user_id>', methods=['DELETE'])
@jwt_required()
@role_required(['owner', 'admin_empresa'])
def permanently_delete_user(user_id):
    """
    Elimina permanentemente a un usuario y sus datos relacionados (respuestas de formulario).
    Accesible para 'owner' y 'admin_empresa'.
    """
    current_user_id = get_jwt_identity()
    current_user = Usuario.query.get(int(current_user_id))

    # 1. Buscar el usuario a eliminar
    user_to_delete = Usuario.query.get(user_id)

    if not user_to_delete:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    # 2. No permitir que un usuario se elimine a sí mismo
    if user_to_delete.id_usuario == current_user_id:
        return jsonify({'error': 'No puedes eliminarte a ti mismo permanentemente.'}), 400

    try:
        # Lógica para 'owner'
        if current_user.rol == 'owner':
            # El owner puede eliminar a cualquier usuario, pero con validaciones adicionales
            
            # Si el usuario a eliminar es un 'admin_empresa', verificar si hay otros
            if user_to_delete.rol == 'admin_empresa':
                otros_admins = Usuario.query.filter(
                    Usuario.id_empresa == user_to_delete.id_empresa,
                    Usuario.rol == 'admin_empresa',
                    Usuario.id_usuario != user_to_delete.id_usuario
                ).count()
                
                if otros_admins == 0:
                    return jsonify({
                        'error': 'No se puede eliminar a este admin de empresa porque es el único. Asigna a otro admin o cambia su rol antes de eliminarlo.'
                    }), 400
        
        # Lógica para 'admin_empresa'
        elif current_user.rol == 'admin_empresa':
            # Verificar que el admin solo pueda eliminar usuarios de su propia empresa
            if user_to_delete.id_empresa != current_user.id_empresa:
                return jsonify({'error': 'Acceso denegado. No puedes eliminar usuarios de otra empresa.'}), 403

            # Verificar que el admin no pueda eliminar a otro admin
            if user_to_delete.rol == 'admin_empresa':
                return jsonify({'error': 'Acceso denegado. Un admin no puede eliminar a otro admin de la misma empresa.'}), 403

            # El admin solo puede eliminar a 'usuario_formulario'
            if user_to_delete.rol != 'usuario_formulario':
                return jsonify({'error': 'Acceso denegado. Solo puedes eliminar usuarios con el rol "usuario_formulario".'}), 403

        # 3. Eliminar datos relacionados (respuestas y envíos de formularios)
        # Esto es crucial para mantener la integridad de los datos.
        # Primero, obtenemos los envíos de formularios del usuario a eliminar.
        user_submissions = EnvioFormulario.query.filter_by(id_usuario=user_to_delete.id_usuario).all()
        for submission in user_submissions:
            # Eliminar las respuestas asociadas a cada envío
            RespuestasFormulario.query.filter_by(id_envio=submission.id_envio).delete()
            # Luego, eliminar el envío del formulario
            db.session.delete(submission)

        # 4. Eliminar el usuario
        db.session.delete(user_to_delete)
        db.session.commit()

        return jsonify({'message': f'El usuario con ID {user_id} y sus datos relacionados han sido eliminados permanentemente.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar el usuario: {str(e)}'}), 500


@api.route('/owner/usuarios', methods=['GET'])
@role_required(['owner'])
def listar_todos_los_usuarios_por_owner():
    """
    Permite al OWNER listar todos los usuarios del sistema.
    """
    try:
        usuarios = Usuario.query.all()
        return jsonify({
            "usuarios": [user.serialize() for user in usuarios]
        }), 200
    except Exception as e:
        return jsonify({"error": f"Error interno del servidor al listar usuarios: {str(e)}"}), 500



# --- NUEVAS RUTAS DE GESTIÓN (Admin de Empresa) ---
@api.route('/empresa/usuarios', methods=['POST'])
@jwt_required() # Añadir jwt_required()
@role_required(['admin_empresa'])
def crear_usuario_por_admin_empresa():
    """
    Permite a un ADMIN_EMPRESA crear nuevos usuarios (admin_empresa o usuario_formulario)
    dentro de SU empresa.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        if not admin_empresa or not admin_empresa.id_empresa:
            return jsonify({"error": "El administrador de empresa no está asociado a una empresa válida."}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        rol = data.get('rol', '').strip().lower() # Puede ser 'admin_empresa' o 'usuario_formulario'
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()

        if not all([nombre_completo, email, password, rol]):
            return jsonify({"error": "Todos los campos obligatorios (nombre completo, email, contraseña, rol) son requeridos."}), 400

        if not validate_email(email):
            return jsonify({"error": "El formato del email del usuario no es válido."}), 400

        is_valid_password, password_message = validate_password(password)
        if not is_valid_password:
            return jsonify({"error": password_message}), 400

        # Validar que el rol sea uno permitido para la creación por admin_empresa
        if rol not in ['admin_empresa', 'usuario_formulario']:
            return jsonify({"error": "Rol inválido. Un administrador de empresa solo puede crear roles 'admin_empresa' o 'usuario_formulario'."}), 403

        # Verificar que el email no esté ya en uso
        existing_user_by_email = Usuario.query.filter_by(email=email).first()
        if existing_user_by_email:
            return jsonify({"error": "Ya existe un usuario con este email."}), 409

        password_hash = generate_password_hash(password)

        nuevo_usuario = Usuario(
            id_empresa=admin_empresa.id_empresa, # Se asocia automáticamente a la empresa del admin
            nombre_completo=nombre_completo,
            email=email,
            contrasena_hash=password_hash,
            rol=rol,
            fecha_creacion=datetime.utcnow(),
            telefono_personal=telefono_personal if telefono_personal else None,
            cargo=cargo if cargo else None,
            cambio_password_requerido=True,
            activo=True
        )

        db.session.add(nuevo_usuario)
        db.session.commit()

        return jsonify({
            "message": "Usuario creado exitosamente por el administrador de empresa.",
            "usuario": nuevo_usuario.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear usuario por admin de empresa: {e}")
        return jsonify({"error": f"Error interno del servidor al crear usuario: {str(e)}"}), 500

@api.route('/empresa/usuarios/<int:user_id>', methods=['PUT'])
@jwt_required()
@role_required(['admin_empresa'])
def editar_usuario_por_admin_empresa(user_id):
    """
    Permite a un ADMIN_EMPRESA editar los datos de un usuario dentro de SU empresa.
    - Los campos opcionales para actualizar son: nombre_completo, email, password, rol,
      telefono_personal, cargo y 'activo'.
    - Un ADMIN_EMPRESA no puede cambiarse a sí mismo a inactivo.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        if not admin_empresa or not admin_empresa.id_empresa:
            return jsonify({"error": "El administrador de empresa no está asociado a una empresa válida."}), 403

        usuario_a_editar = Usuario.query.get(user_id)
        if not usuario_a_editar:
            return jsonify({"error": f"Usuario con ID {user_id} no encontrado."}), 404

        if usuario_a_editar.id_empresa != admin_empresa.id_empresa:
            return jsonify({"error": "No tiene permisos para editar a este usuario."}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos para actualizar."}), 400

        # Procesar los campos a actualizar
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        rol = data.get('rol', '').strip().lower()
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()
        activo = data.get('activo') # Nuevo campo para activar/desactivar

        if nombre_completo:
            usuario_a_editar.nombre_completo = nombre_completo

        if email and email != usuario_a_editar.email:
            if not validate_email(email):
                return jsonify({"error": "El formato del email del usuario no es válido."}), 400
            
            existing_user_by_email = Usuario.query.filter(Usuario.email == email, Usuario.id_usuario != user_id).first()
            if existing_user_by_email:
                return jsonify({"error": "Ya existe un usuario con este email."}), 409
            
            usuario_a_editar.email = email

        if password:
            is_valid_password, password_message = validate_password(password)
            if not is_valid_password:
                return jsonify({"error": password_message}), 400
            
            usuario_a_editar.contrasena_hash = generate_password_hash(password)
            usuario_a_editar.cambio_password_requerido = True

        if rol:
            if rol not in ['admin_empresa', 'usuario_formulario']:
                return jsonify({"error": "Rol inválido. Un administrador de empresa solo puede asignar roles 'admin_empresa' o 'usuario_formulario'."}), 403
            
            # Un admin no puede cambiar su propio rol
            if user_id == admin_empresa.id_usuario and rol != admin_empresa.rol:
                 return jsonify({"error": "No puedes cambiar tu propio rol."}), 403

            usuario_a_editar.rol = rol

        if telefono_personal is not None:
            usuario_a_editar.telefono_personal = telefono_personal
            
        if cargo is not None:
            usuario_a_editar.cargo = cargo

        # NUEVA LÓGICA PARA ACTIVAR/DESACTIVAR
        if activo is not None and isinstance(activo, bool):
            if user_id == admin_empresa.id_usuario and not activo:
                return jsonify({"error": "No puedes desactivarte a ti mismo."}), 403
            # Restricción: un admin_empresa no puede desactivar a otro admin_empresa
            if usuario_a_editar.rol == 'admin_empresa' and usuario_a_editar.id_usuario != admin_empresa.id_usuario and not activo:
                return jsonify({"error": "No tienes permiso para desactivar a otro administrador de la empresa."}), 403

            usuario_a_editar.activo = activo

        db.session.commit()

        return jsonify({
            "message": "Usuario actualizado exitosamente por el administrador de empresa.",
            "usuario": usuario_a_editar.serialize()
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al editar usuario por admin de empresa: {e}")
        return jsonify({"error": f"Error interno del servidor al editar usuario: {str(e)}"}), 500


@api.route('/empresa/usuarios', methods=['GET'])
@jwt_required() # Añadir jwt_required()
@role_required(['admin_empresa'])
def listar_usuarios_por_empresa():
    """
    Permite a un ADMIN_EMPRESA listar los usuarios de SU empresa.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        if not admin_empresa or not admin_empresa.id_empresa:
            return jsonify({"error": "El administrador de empresa no está asociado a una empresa válida."}), 403

        usuarios_empresa = Usuario.query.filter_by(id_empresa=admin_empresa.id_empresa).all()
        return jsonify({
            "usuarios": [user.serialize() for user in usuarios_empresa]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor al listar usuarios de la empresa: {str(e)}"}), 500

# --- NUEVA RUTA: DESACTIVAR USUARIO POR ADMIN_EMPRESA ---
@api.route('/empresa/usuarios/<int:user_id>', methods=['DELETE'])
@jwt_required()
@role_required(['admin_empresa'])
def eliminar_usuario_por_admin_empresa(user_id):
    """
    Permite a un ADMIN_EMPRESA ELIMINAR PERMANENTEMENTE un usuario
    con rol 'usuario_formulario' de SU empresa.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        usuario_a_eliminar = Usuario.query.get(user_id)
        if not usuario_a_eliminar:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # 1. Restricción: Admin_empresa solo puede eliminar usuarios de SU empresa
        if usuario_a_eliminar.id_empresa != admin_empresa.id_empresa:
            return jsonify({"error": "No tienes permiso para eliminar usuarios de otra empresa."}), 403

        # 2. Restricción: No puede eliminarse a sí mismo
        if user_id == admin_empresa.id_usuario:
            return jsonify({"error": "No puedes eliminarte a ti mismo."}), 403

        # 3. Restricción: Solo puede eliminar permanentemente 'usuario_formulario'
        if usuario_a_eliminar.rol != 'usuario_formulario':
            return jsonify({"error": "No tienes permiso para eliminar un usuario con este rol (solo 'usuario_formulario')."}), 403
        
        # Opcional: Podrías añadir una validación para evitar borrar usuarios activos,
        # obligando a que se desactiven primero.
        if usuario_a_eliminar.activo:
            return jsonify({"error": "El usuario debe estar inactivo para ser eliminado permanentemente. Desactívalo primero."}), 403

        # Eliminar el usuario de la base de datos
        db.session.delete(usuario_a_eliminar)
        db.session.commit()

        return jsonify({"message": f"Usuario '{usuario_a_eliminar.nombre_completo}' ha sido eliminado permanentemente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar usuario por admin de empresa: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar usuario: {str(e)}"}), 500
    
# --- Ajustes en la ruta de cambio de contraseña para incluir el flag ---
@api.route('/cambiar-password-inicial', methods=['PUT'])
@jwt_required()
def cambiar_password_inicial():
    """
    Ruta específica para el primer cambio de contraseña de un usuario
    cuando el flag 'cambio_password_requerido' es True.
    No requiere la 'password_actual'.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nueva_password = data.get('nueva_password', '')
        confirmar_password = data.get('confirmar_password', '')

        if not nueva_password or not confirmar_password:
            return jsonify({"error": "Se requieren la nueva contraseña y su confirmación."}), 400
        if nueva_password != confirmar_password:
            return jsonify({"error": "La nueva contraseña y su confirmación no coinciden."}), 400

        is_valid, message = validate_password(nueva_password)
        if not is_valid:
            return jsonify({"error": message}), 400

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # Solo permite esta ruta si cambio_password_requerido es True
        if not usuario.cambio_password_requerido:
            return jsonify({"error": "No se requiere un cambio de contraseña inicial para este usuario."}), 403

        usuario.contrasena_hash = generate_password_hash(nueva_password)
        usuario.cambio_password_requerido = False # Una vez cambiada, se desactiva el flag
        db.session.commit()

        return jsonify({"message": "Contraseña inicial actualizada exitosamente. Ahora puedes iniciar sesión normalmente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    

@api.route('/espacios', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_espacios():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if usuario.rol == 'owner':
            espacios = Espacio.query.all()
        else: # admin_empresa o usuario_formulario
            if not usuario.id_empresa:
                return jsonify({"error": "Usuario no asociado a una empresa."}), 400
            espacios = Espacio.query.filter_by(id_empresa=usuario.id_empresa).all()

        return jsonify({"espacios": [espacio.serialize() for espacio in espacios]}), 200

    except Exception as e:
        print(f"Error al obtener espacios: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener espacios: {str(e)}"}), 500

@api.route('/espacios', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_espacio():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_espacio = data.get('nombre_espacio', '').strip()
        descripcion = data.get('descripcion', '').strip()
        id_empresa = data.get('id_empresa') # Para owner, puede especificar; para admin_empresa, se auto-asigna

        if not nombre_espacio:
            return jsonify({"error": "El nombre del espacio es requerido."}), 400

        # Lógica para determinar el id_empresa
        if usuario.rol == 'owner':
            if not id_empresa:
                return jsonify({"error": "Para el rol 'owner', el id_empresa es requerido para crear un espacio."}), 400
            empresa = Empresa.query.get(id_empresa)
            if not empresa:
                return jsonify({"error": "La empresa especificada no existe."}), 404
            if not empresa.activo:
                return jsonify({"error": "No se pueden crear espacios para una empresa inactiva."}), 403
            target_id_empresa = id_empresa
        else: # admin_empresa
            if not usuario.id_empresa:
                return jsonify({"error": "El usuario admin_empresa no está asociado a una empresa."}), 400
            target_id_empresa = usuario.id_empresa
            # Asegurarse de que el admin_empresa no intente crear un espacio en otra empresa
            if id_empresa and id_empresa != target_id_empresa:
                return jsonify({"error": "No tienes permisos para crear espacios en otra empresa."}), 403

        # Verificar si ya existe un espacio con el mismo nombre en la misma empresa
        existing_espacio = Espacio.query.filter_by(id_empresa=target_id_empresa, nombre_espacio=nombre_espacio).first()
        if existing_espacio:
            return jsonify({"error": f"Ya existe un espacio con el nombre '{nombre_espacio}' en esta empresa."}), 409

        nuevo_espacio = Espacio(
            id_empresa=target_id_empresa,
            nombre_espacio=nombre_espacio,
            descripcion=descripcion if descripcion else None
        )
        db.session.add(nuevo_espacio)
        db.session.commit()

        return jsonify({"message": "Espacio creado exitosamente.", "espacio": nuevo_espacio.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al crear espacio: {str(e)}"}), 500

@api.route('/espacios/<int:espacio_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_espacio(espacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        espacio = Espacio.query.get(espacio_id)
        if not espacio:
            return jsonify({"error": "Espacio no encontrado."}), 404

        # Control de acceso por empresa
        if usuario.rol != 'owner' and espacio.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para acceder a este espacio."}), 403

        return jsonify({"espacio": espacio.serialize()}), 200

    except Exception as e:
        print(f"Error al obtener espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener espacio: {str(e)}"}), 500

@api.route('/espacios/<int:espacio_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_espacio(espacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        espacio = Espacio.query.get(espacio_id)
        if not espacio:
            return jsonify({"error": "Espacio no encontrado."}), 404

        # Control de acceso por empresa
        if usuario.rol != 'owner' and espacio.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para actualizar este espacio."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_espacio = data.get('nombre_espacio', '').strip()
        descripcion = data.get('descripcion', '').strip()

        if nombre_espacio and nombre_espacio != espacio.nombre_espacio:
            # Verificar si el nuevo nombre ya existe en la misma empresa
            existing_espacio = Espacio.query.filter_by(id_empresa=espacio.id_empresa, nombre_espacio=nombre_espacio).first()
            if existing_espacio and existing_espacio.id_espacio != espacio_id:
                return jsonify({"error": f"Ya existe otro espacio con el nombre '{nombre_espacio}' en esta empresa."}), 409
            espacio.nombre_espacio = nombre_espacio

        if descripcion is not None:
            espacio.descripcion = descripcion if descripcion else None

        db.session.commit()
        return jsonify({"message": "Espacio actualizado exitosamente.", "espacio": espacio.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar espacio: {str(e)}"}), 500

@api.route('/espacios/<int:espacio_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_espacio(espacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        espacio = Espacio.query.get(espacio_id)
        if not espacio:
            return jsonify({"error": "Espacio no encontrado."}), 404

        # Control de acceso por empresa
        if usuario.rol != 'owner' and espacio.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para eliminar este espacio."}), 403

        # --- INICIO DE ELIMINACIÓN EN CASCADA MANUAL PARA ESPACIO ---

        # 1. Eliminar Observaciones asociadas directamente a este Espacio
        observaciones_espacio = Observacion.query.filter_by(id_espacio=espacio_id).all()
        for obs in observaciones_espacio:
            db.session.delete(obs)

        # 2. Eliminar Objetos de los SubEspacios de este Espacio
        # 3. Eliminar SubEspacios asociados a este Espacio
        # Iterar sobre una copia de la lista para evitar problemas al modificarla
        sub_espacios_a_eliminar = list(espacio.sub_espacios)
        for subespacio in sub_espacios_a_eliminar:
            # Eliminar Objetos asociados al SubEspacio
            objetos_subespacio = list(subespacio.objetos) # Copia para iterar
            for obj in objetos_subespacio:
                # Eliminar asociaciones de formularios (muchos a muchos)
                obj.formularios = [] # Desvincular antes de eliminar
                db.session.delete(obj)
            
            # Eliminar Observaciones asociadas al SubEspacio
            observaciones_subespacio = Observacion.query.filter_by(id_subespacio=subespacio.id_subespacio).all()
            for obs in observaciones_subespacio:
                db.session.delete(obs)

            # Eliminar asociaciones de formularios (muchos a muchos)
            subespacio.formularios = [] # Desvincular antes de eliminar
            db.session.delete(subespacio)

        # 4. Eliminar asociaciones de formularios (muchos a muchos) con este Espacio
        espacio.formularios = [] # Desvincular antes de eliminar

        # 5. Finalmente, eliminar el Espacio
        db.session.delete(espacio)
        db.session.commit()
        # --- FIN DE ELIMINACIÓN EN CASCADA MANUAL PARA ESPACIO ---

        return jsonify({"message": "Espacio y todos sus recursos asociados eliminados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar espacio: {str(e)}"}), 500

# --- FIN DE RUTAS PARA ESPACIOS ---


# --- INICIO DE RUTAS PARA SUB-ESPACIOS ---

@api.route('/subespacios', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_subespacios():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if usuario.rol == 'owner':
            sub_espacios = SubEspacio.query.all()
        else: # admin_empresa o usuario_formulario
            if not usuario.id_empresa:
                return jsonify({"error": "Usuario no asociado a una empresa."}), 400
            # Filtrar sub-espacios por la empresa del usuario
            sub_espacios = SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()

        return jsonify({"sub_espacios": [sub.serialize() for sub in sub_espacios]}), 200

    except Exception as e:
        print(f"Error al obtener sub-espacios: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener sub-espacios: {str(e)}"}), 500

@api.route('/subespacios', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_subespacio():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        id_espacio = data.get('id_espacio')
        nombre_subespacio = data.get('nombre_subespacio', '').strip()
        descripcion = data.get('descripcion', '').strip()

        if not all([id_espacio, nombre_subespacio]):
            return jsonify({"error": "El id_espacio y el nombre del sub-espacio son requeridos."}), 400

        espacio_padre = Espacio.query.get(id_espacio)
        if not espacio_padre:
            return jsonify({"error": "El espacio padre especificado no existe."}), 404

        # Control de acceso: el sub-espacio debe crearse en un espacio de la empresa del usuario
        if usuario.rol != 'owner' and espacio_padre.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para crear sub-espacios en este espacio."}), 403

        # Verificar si ya existe un sub-espacio con el mismo nombre en el mismo espacio padre
        existing_subespacio = SubEspacio.query.filter_by(id_espacio=id_espacio, nombre_subespacio=nombre_subespacio).first()
        if existing_subespacio:
            return jsonify({"error": f"Ya existe un sub-espacio con el nombre '{nombre_subespacio}' en este espacio padre."}), 409

        nuevo_subespacio = SubEspacio(
            id_espacio=id_espacio,
            nombre_subespacio=nombre_subespacio,
            descripcion=descripcion if descripcion else None
        )
        db.session.add(nuevo_subespacio)
        db.session.commit()

        return jsonify({"message": "Sub-espacio creado exitosamente.", "sub_espacio": nuevo_subespacio.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear sub-espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al crear sub-espacio: {str(e)}"}), 500

@api.route('/subespacios/<int:subespacio_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_subespacio(subespacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        subespacio = SubEspacio.query.get(subespacio_id)
        if not subespacio:
            return jsonify({"error": "Sub-espacio no encontrado."}), 404

        # Control de acceso por empresa del espacio padre
        if usuario.rol != 'owner':
            espacio_padre = Espacio.query.get(subespacio.id_espacio)
            if not espacio_padre or espacio_padre.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este sub-espacio."}), 403

        return jsonify({"sub_espacio": subespacio.serialize()}), 200

    except Exception as e:
        print(f"Error al obtener sub-espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener sub-espacio: {str(e)}"}), 500

@api.route('/subespacios/<int:subespacio_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_subespacio(subespacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        subespacio = SubEspacio.query.get(subespacio_id)
        if not subespacio:
            return jsonify({"error": "Sub-espacio no encontrado."}), 404

        # Control de acceso por empresa del espacio padre
        if usuario.rol != 'owner':
            espacio_padre = Espacio.query.get(subespacio.id_espacio)
            if not espacio_padre or espacio_padre.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para actualizar este sub-espacio."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_subespacio = data.get('nombre_subespacio', '').strip()
        descripcion = data.get('descripcion', '').strip()
        new_id_espacio = data.get('id_espacio') # Permitir cambiar el espacio padre

        # Validar cambio de espacio padre si se proporciona
        if new_id_espacio is not None and new_id_espacio != subespacio.id_espacio:
            new_espacio_padre = Espacio.query.get(new_id_espacio)
            if not new_espacio_padre:
                return jsonify({"error": "El nuevo espacio padre especificado no existe."}), 404
            # Asegurarse de que el nuevo espacio padre pertenece a la misma empresa (para admin_empresa)
            if usuario.rol != 'owner' and new_espacio_padre.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No puedes mover el sub-espacio a un espacio de otra empresa."}), 403
            subespacio.id_espacio = new_id_espacio

        if nombre_subespacio and nombre_subespacio != subespacio.nombre_subespacio:
            # Verificar si el nuevo nombre ya existe en el mismo espacio padre
            existing_subespacio = SubEspacio.query.filter_by(id_espacio=subespacio.id_espacio, nombre_subespacio=nombre_subespacio).first()
            if existing_subespacio and existing_subespacio.id_subespacio != subespacio_id:
                return jsonify({"error": f"Ya existe otro sub-espacio con el nombre '{nombre_subespacio}' en este espacio padre."}), 409
            subespacio.nombre_subespacio = nombre_subespacio

        if descripcion is not None:
            subespacio.descripcion = descripcion if descripcion else None

        db.session.commit()
        return jsonify({"message": "Sub-espacio actualizado exitosamente.", "sub_espacio": subespacio.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar sub-espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar sub-espacio: {str(e)}"}), 500

@api.route('/subespacios/<int:subespacio_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_subespacio(subespacio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        subespacio = SubEspacio.query.get(subespacio_id)
        if not subespacio:
            return jsonify({"error": "Sub-espacio no encontrado."}), 404

        # Control de acceso por empresa del espacio padre
        if usuario.rol != 'owner':
            espacio_padre = Espacio.query.get(subespacio.id_espacio)
            if not espacio_padre or espacio_padre.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para eliminar este sub-espacio."}), 403

        # --- INICIO DE ELIMINACIÓN EN CASCADA MANUAL PARA SUBESPACIO ---

        # 1. Eliminar Observaciones asociadas directamente a este SubEspacio
        # CORREGIDO: 'Observacion' ahora está importado
        observaciones_subespacio = Observacion.query.filter_by(id_subespacio=subespacio_id).all()
        for obs in observaciones_subespacio:
            db.session.delete(obs)

        # 2. Eliminar Objetos asociados a este SubEspacio
        objetos_a_eliminar = list(subespacio.objetos) # Copia para iterar
        for obj in objetos_a_eliminar:
            # Eliminar asociaciones de formularios (muchos a muchos)
            # obj.formularios = [] # Descomenta si es necesario y si Formulario tiene 'objetos'
            db.session.delete(obj)

        # 3. Eliminar asociaciones de formularios (muchos a muchos) con este SubEspacio
        # subespacio.formularios = [] # Descomenta si es necesario y si Formulario tiene 'sub_espacios'

        # 4. Finalmente, eliminar el SubEspacio
        db.session.delete(subespacio)
        db.session.commit()
        # --- FIN DE ELIMINACIÓN EN CASCADA MANUAL PARA SUBESPACIO ---

        return jsonify({"message": "Sub-espacio y sus objetos asociados eliminados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar sub-espacio: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar sub-espacio: {str(e)}"}), 500

# --- FIN DE RUTAS PARA SUB-ESPACIOS ---


# --- INICIO DE RUTAS PARA OBJETOS ---

@api.route('/objetos', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_objetos():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if usuario.rol == 'owner':
            objetos = Objeto.query.all()
        else: # admin_empresa o usuario_formulario
            if not usuario.id_empresa:
                return jsonify({"error": "Usuario no asociado a una empresa."}), 400
            # Filtrar objetos por la empresa del usuario
            objetos = Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()

        return jsonify({"objetos": [obj.serialize() for obj in objetos]}), 200

    except Exception as e:
        print(f"Error al obtener objetos: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener objetos: {str(e)}"}), 500

@api.route('/objetos', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_objeto():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        id_subespacio = data.get('id_subespacio')
        nombre_objeto = data.get('nombre_objeto', '').strip()
        descripcion = data.get('descripcion', '').strip()

        if not all([id_subespacio, nombre_objeto]):
            return jsonify({"error": "El id_subespacio y el nombre del objeto son requeridos."}), 400

        subespacio_padre = SubEspacio.query.get(id_subespacio)
        if not subespacio_padre:
            return jsonify({"error": "El sub-espacio padre especificado no existe."}), 404

        # Control de acceso: el objeto debe crearse en un sub-espacio de la empresa del usuario
        if usuario.rol != 'owner':
            espacio_del_subespacio = Espacio.query.get(subespacio_padre.id_espacio)
            if not espacio_del_subespacio or espacio_del_subespacio.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para crear objetos en este sub-espacio."}), 403

        # Verificar si ya existe un objeto con el mismo nombre en el mismo sub-espacio padre
        existing_objeto = Objeto.query.filter_by(id_subespacio=id_subespacio, nombre_objeto=nombre_objeto).first()
        if existing_objeto:
            return jsonify({"error": f"Ya existe un objeto con el nombre '{nombre_objeto}' en este sub-espacio padre."}), 409

        nuevo_objeto = Objeto(
            id_subespacio=id_subespacio,
            nombre_objeto=nombre_objeto,
            descripcion=descripcion if descripcion else None
        )
        db.session.add(nuevo_objeto)
        db.session.commit()

        return jsonify({"message": "Objeto creado exitosamente.", "objeto": nuevo_objeto.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear objeto: {e}")
        return jsonify({"error": f"Error interno del servidor al crear objeto: {str(e)}"}), 500

@api.route('/objetos/<int:objeto_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_objeto(objeto_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        objeto = Objeto.query.get(objeto_id)
        if not objeto:
            return jsonify({"error": "Objeto no encontrado."}), 404

        # Control de acceso por empresa del sub-espacio padre
        if usuario.rol != 'owner':
            subespacio_padre = SubEspacio.query.get(objeto.id_subespacio)
            espacio_del_subespacio = Espacio.query.get(subespacio_padre.id_espacio)
            if not espacio_del_subespacio or espacio_del_subespacio.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este objeto."}), 403

        return jsonify({"objeto": objeto.serialize()}), 200

    except Exception as e:
        print(f"Error al obtener objeto: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener objeto: {str(e)}"}), 500

@api.route('/objetos/<int:objeto_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_objeto(objeto_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        objeto = Objeto.query.get(objeto_id)
        if not objeto:
            return jsonify({"error": "Objeto no encontrado."}), 404

        # Control de acceso por empresa del sub-espacio padre
        if usuario.rol != 'owner':
            subespacio_padre = SubEspacio.query.get(objeto.id_subespacio)
            espacio_del_subespacio = Espacio.query.get(subespacio_padre.id_espacio)
            if not espacio_del_subespacio or espacio_del_subespacio.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para actualizar este objeto."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_objeto = data.get('nombre_objeto', '').strip()
        descripcion = data.get('descripcion', '').strip()
        new_id_subespacio = data.get('id_subespacio') # Permitir cambiar el sub-espacio padre

        # Validar cambio de sub-espacio padre si se proporciona
        if new_id_subespacio is not None and new_id_subespacio != objeto.id_subespacio:
            new_subespacio_padre = SubEspacio.query.get(new_id_subespacio)
            if not new_subespacio_padre:
                return jsonify({"error": "El nuevo sub-espacio padre especificado no existe."}), 404
            # Asegurarse de que el nuevo sub-espacio padre pertenece a la misma empresa (para admin_empresa)
            if usuario.rol != 'owner':
                new_espacio_del_subespacio = Espacio.query.get(new_subespacio_padre.id_espacio)
                if not new_espacio_del_subespacio or new_espacio_del_subespacio.id_empresa != usuario.id_empresa:
                    return jsonify({"error": "No puedes mover el objeto a un sub-espacio de otra empresa."}), 403
            objeto.id_subespacio = new_id_subespacio

        if nombre_objeto and nombre_objeto != objeto.nombre_objeto:
            # Verificar si el nuevo nombre ya existe en el mismo sub-espacio padre
            existing_objeto = Objeto.query.filter_by(id_subespacio=objeto.id_subespacio, nombre_objeto=nombre_objeto).first()
            if existing_objeto and existing_objeto.id_objeto != objeto_id:
                return jsonify({"error": f"Ya existe otro objeto con el nombre '{nombre_objeto}' en este sub-espacio padre."}), 409
            objeto.nombre_objeto = nombre_objeto

        if descripcion is not None:
            objeto.descripcion = descripcion if descripcion else None

        db.session.commit()
        return jsonify({"message": "Objeto actualizado exitosamente.", "objeto": objeto.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar objeto: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar objeto: {str(e)}"}), 500

@api.route('/objetos/<int:objeto_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_objeto(objeto_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        objeto = Objeto.query.get(objeto_id)
        if not objeto:
            return jsonify({"error": "Objeto no encontrado."}), 404

        # Control de acceso por empresa del sub-espacio padre
        if usuario.rol != 'owner':
            subespacio_padre = SubEspacio.query.get(objeto.id_subespacio)
            espacio_del_subespacio = Espacio.query.get(subespacio_padre.id_espacio)
            if not espacio_del_subespacio or espacio_del_subespacio.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para eliminar este objeto."}), 403

        db.session.delete(objeto)
        db.session.commit()
        return jsonify({"message": "Objeto eliminado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar objeto: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar objeto: {str(e)}"}), 500

# --- FIN DE RUTAS PARA OBJETOS ---

# --- INICIO DE RUTAS PARA FORMULARIOS ---

@api.route('/formularios', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_all_formularios():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formularios_query = Formulario.query
        formularios = []

        if usuario.rol == 'owner':
            owner_company_id = usuario.id_empresa
            
            # Formularios creados por el owner
            owner_created_forms = formularios_query.filter(Formulario.creado_por_usuario_id == usuario.id_usuario).all()
            
            # Plantillas globales
            global_templates = formularios_query.filter(
                Formulario.es_plantilla == True,
                Formulario.es_plantilla_global == True
            ).all()

            # Plantillas no globales compartidas con la empresa del owner
            shared_templates_with_owner_company = []
            if owner_company_id:
                # Corrección clave: Convertir a JSONB y usar el operador @>
                # El ID de la empresa debe ser parte de un array JSON para el operador @>
                shared_templates_with_owner_company = formularios_query.filter(
                    Formulario.es_plantilla == True,
                    Formulario.es_plantilla_global == False,
                    cast(Formulario.compartir_con_empresas_ids, JSONB).op('@>')(f'[{owner_company_id}]')
                ).all()
            
            all_owner_forms = set(owner_created_forms + global_templates + shared_templates_with_owner_company)
            formularios = list(all_owner_forms)

        else: # Roles: 'admin_empresa', 'usuario_formulario'
            if not usuario.id_empresa:
                return jsonify({"error": "Usuario no asociado a una empresa."}), 400
            
            user_company_id = usuario.id_empresa

            # Formularios que pertenecen a la empresa del usuario (creados por cualquier usuario de esa empresa)
            forms_for_user_company = formularios_query.filter_by(id_empresa=user_company_id).all()
            
            # Plantillas globales
            global_templates = formularios_query.filter(
                Formulario.es_plantilla == True,
                Formulario.es_plantilla_global == True
            ).all()

            # Plantillas compartidas específicamente con esta empresa
            shared_templates_with_this_company = formularios_query.filter(
                Formulario.es_plantilla == True,
                Formulario.es_plantilla_global == False,
                # Corrección clave: Convertir a JSONB y usar el operador @>
                cast(Formulario.compartir_con_empresas_ids, JSONB).op('@>')(f'[{user_company_id}]')
            ).all()

            combined_forms = set(forms_for_user_company + global_templates + shared_templates_with_this_company)
            formularios = list(combined_forms)

        # Ordenar los formularios por fecha de creación (más recientes primero)
        formularios.sort(key=lambda f: f.fecha_creacion, reverse=True)

        formularios_data = []
        for f in formularios:
            f_data = f.serialize()
            formularios_data.append(f_data)

        return jsonify({"formularios": formularios_data}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al obtener formularios: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener formularios: {str(e)}"}), 500

        
@api.route('/formularios/<int:form_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_formulario(form_id):
    """
    Obtiene los detalles de un formulario específico, incluyendo sus preguntas.
    Control de acceso: Solo usuarios de la misma empresa o el owner.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso por empresa (MODIFICADO para incluir plantillas)
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        # Serializar el formulario. La serialización ya incluye los nuevos campos de frecuencia.
        formulario_data = formulario.serialize()

        # Serializar las preguntas asociadas al formulario, ordenadas por 'orden'
        preguntas_data = []
        for pregunta in sorted(formulario.preguntas, key=lambda p: p.orden):
            p_data = pregunta.serialize()
            p_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo if pregunta.tipo_respuesta else None
            preguntas_data.append(p_data)

        formulario_data['preguntas'] = preguntas_data

        return jsonify({"formulario": formulario_data}), 200

    except Exception as e:
        db.session.rollback() # En caso de error en la base de datos
        print(f"Error al obtener el formulario {form_id}: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener el formulario: {str(e)}"}), 500


@api.route('/formularios', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_formulario():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_formulario = data.get('nombre_formulario', '').strip()
        descripcion = data.get('descripcion', '')
        
        # MODIFICADO: Nuevos campos para la frecuencia de llenado
        max_submissions_per_period = data.get('max_submissions_per_period')
        submission_period_days = data.get('submission_period_days')

        id_empresa = data.get('id_empresa')
        espacios_ids = data.get('espacios_ids', [])
        subespacios_ids = data.get('subespacios_ids', [])
        objetos_ids = data.get('objetos_ids', [])
        tipos_respuesta_ids = data.get('tipos_respuesta_ids', [])

        # NUEVOS CAMPOS DE PLANTILLA, NOTIFICACIONES Y AUTOMATIZACIÓN
        es_plantilla = data.get('es_plantilla', False)
        es_plantilla_global = data.get('es_plantilla_global', False)
        compartir_con_empresas_ids = data.get('compartir_con_empresas_ids', [])
        notificaciones_activas = data.get('notificaciones_activas', True)
        automatizacion_activa = data.get('automatizacion_activa', False)

        # MODIFICADO: Validación para los nuevos campos de frecuencia
        if not all([nombre_formulario, max_submissions_per_period is not None, submission_period_days is not None, id_empresa]):
            return jsonify({"error": "Nombre del formulario, frecuencia de llenado (veces y días) y ID de empresa son requeridos."}), 400
        
        if not isinstance(max_submissions_per_period, int) or max_submissions_per_period <= 0:
            return jsonify({"error": "El número máximo de diligencias debe ser un entero positivo."}), 400
        if not isinstance(submission_period_days, int) or submission_period_days <= 0:
            return jsonify({"error": "El período de días debe ser un entero positivo."}), 400


        empresa = Empresa.query.get(id_empresa)
        if not empresa:
            return jsonify({"error": "Empresa no encontrada."}), 404

        # Control de acceso por empresa: un admin_empresa solo puede crear formularios para su propia empresa
        if usuario.rol == 'admin_empresa' and usuario.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para crear formularios para esta empresa."}), 403
        
        # Validar lógica de plantillas: Owner solo puede crear plantillas para SU empresa registrada
        if es_plantilla:
            if usuario.rol != 'owner' or id_empresa != usuario.id_empresa:
                return jsonify({"error": "Solo el owner puede crear formularios plantilla y solo para su propia empresa registrada."}), 403
            
            if not es_plantilla_global and not compartir_con_empresas_ids:
                return jsonify({"error": "Si es una plantilla y no es global, debe especificar con qué empresas se comparte."}), 400
            if es_plantilla_global and compartir_con_empresas_ids:
                return jsonify({"error": "Si es una plantilla global, no debe especificar empresas para compartir."}), 400
            
            # Asegurarse de que las empresas en compartir_con_empresas_ids existan y estén activas
            for empresa_id_to_share in compartir_con_empresas_ids:
                empresa_to_share = Empresa.query.get(empresa_id_to_share)
                if not empresa_to_share or not empresa_to_share.activo:
                    return jsonify({"error": f"La empresa con ID {empresa_id_to_share} para compartir no existe o no está activa."}), 400
        
        # Validar y asociar espacios, sub-espacios y objetos
        # La validación de pertenencia a la empresa se omite si es una plantilla
        espacios_asociados = []
        if espacios_ids:
            for esp_id in espacios_ids:
                espacio = Espacio.query.get(esp_id)
                if not espacio: # Solo verificar si existe, no la pertenencia a la empresa si es plantilla
                    return jsonify({"error": f"Espacio con ID {esp_id} no encontrado."}), 400
                # Si no es plantilla, validar que el espacio pertenece a la empresa del formulario
                if not es_plantilla and espacio.id_empresa != id_empresa:
                    return jsonify({"error": f"Espacio con ID {esp_id} no pertenece a la empresa seleccionada."}), 400
                espacios_asociados.append(espacio)

        subespacios_asociados = []
        if subespacios_ids:
            for sub_id in subespacios_ids:
                subespacio = SubEspacio.query.get(sub_id)
                if not subespacio:
                    return jsonify({"error": f"Sub-espacio con ID {sub_id} no encontrado."}), 400
                if not es_plantilla and subespacio.espacio.id_empresa != id_empresa:
                    return jsonify({"error": f"Sub-espacio con ID {sub_id} no pertenece a la empresa seleccionada."}), 400
                subespacios_asociados.append(subespacio)

        objetos_asociados = []
        if objetos_ids:
            for obj_id in objetos_ids:
                objeto = Objeto.query.get(obj_id)
                if not objeto:
                    return jsonify({"error": f"Objeto con ID {obj_id} no encontrado."}), 400
                if not es_plantilla and objeto.sub_espacio.espacio.id_empresa != id_empresa:
                    return jsonify({"error": f"Objeto con ID {obj_id} no pertenece a la empresa seleccionada."}), 400
                objetos_asociados.append(objeto)

        # Validar y asociar tipos de respuesta
        tipos_respuesta_asociados = []
        if tipos_respuesta_ids:
            for tr_id in tipos_respuesta_ids:
                tipo_respuesta = TipoRespuesta.query.get(tr_id)
                if not tipo_respuesta:
                    return jsonify({"error": f"Tipo de respuesta con ID {tr_id} no encontrado."}), 400
                tipos_respuesta_asociados.append(tipo_respuesta)

        nuevo_formulario = Formulario(
            id_empresa=id_empresa,
            nombre_formulario=nombre_formulario,
            descripcion=descripcion,
            # MODIFICADO: Asignar los nuevos campos de frecuencia
            max_submissions_per_period=max_submissions_per_period,
            submission_period_days=submission_period_days,
            creado_por_usuario_id=usuario.id_usuario,
            es_plantilla=es_plantilla,
            es_plantilla_global=es_plantilla_global,
            compartir_con_empresas_ids=compartir_con_empresas_ids,
            notificaciones_activas=notificaciones_activas,
            automatizacion_activa=automatizacion_activa
        )
        nuevo_formulario.espacios = espacios_asociados
        nuevo_formulario.sub_espacios = subespacios_asociados
        nuevo_formulario.objetos = objetos_asociados
        nuevo_formulario.tipos_respuesta_disponibles = tipos_respuesta_asociados

        db.session.add(nuevo_formulario)
        db.session.commit()

        return jsonify({"message": "Formulario creado exitosamente.", "formulario": nuevo_formulario.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al crear formulario: {str(e)}"}), 500



@api.route('/formularios/<int:form_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_formulario(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso por empresa
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para actualizar este formulario."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_formulario = data.get('nombre_formulario', formulario.nombre_formulario).strip()
        descripcion = data.get('descripcion', formulario.descripcion)
        
        # MODIFICADO: Nuevos campos para la frecuencia de llenado
        max_submissions_per_period = data.get('max_submissions_per_period', formulario.max_submissions_per_period)
        submission_period_days = data.get('submission_period_days', formulario.submission_period_days)

        id_empresa = data.get('id_empresa', formulario.id_empresa) # Se puede cambiar la empresa si es owner
        espacios_ids = data.get('espacios_ids')
        subespacios_ids = data.get('subespacios_ids')
        objetos_ids = data.get('objetos_ids')
        tipos_respuesta_ids = data.get('tipos_respuesta_ids')

        # NUEVOS CAMPOS DE PLANTILLA, NOTIFICACIONES Y AUTOMATIZACIÓN
        es_plantilla = data.get('es_plantilla', formulario.es_plantilla)
        es_plantilla_global = data.get('es_plantilla_global', formulario.es_plantilla_global)
        compartir_con_empresas_ids = data.get('compartir_con_empresas_ids', formulario.compartir_con_empresas_ids)
        notificaciones_activas = data.get('notificaciones_activas', formulario.notificaciones_activas)
        automatizacion_activa = data.get('automatizacion_activa', formulario.automatizacion_activa)


        formulario.nombre_formulario = nombre_formulario
        formulario.descripcion = descripcion
        # MODIFICADO: Asignar los nuevos campos de frecuencia
        formulario.max_submissions_per_period = max_submissions_per_period
        formulario.submission_period_days = submission_period_days
        
        # Si se cambia la empresa (solo para owner)
        if id_empresa != formulario.id_empresa:
            if usuario.rol != 'owner':
                return jsonify({"error": "Solo un owner puede cambiar la empresa de un formulario existente."}), 403
            empresa = Empresa.query.get(id_empresa)
            if not empresa:
                return jsonify({"error": "Nueva empresa no encontrada."}), 404
            formulario.id_empresa = id_empresa
            # Limpiar relaciones si la empresa cambia (opcional, pero recomendado)
            formulario.espacios = []
            formulario.sub_espacios = []
            formulario.objetos = []
            formulario.tipos_respuesta_disponibles = []

        # Validar lógica de plantillas
        if es_plantilla:
            if usuario.rol != 'owner' or formulario.id_empresa != usuario.id_empresa: # La plantilla debe pertenecer a la empresa del owner
                return jsonify({"error": "Solo el owner puede gestionar formularios plantilla y solo para su propia empresa registrada."}), 403
            
            if not es_plantilla_global and not compartir_con_empresas_ids:
                return jsonify({"error": "Si es una plantilla y no es global, debe especificar con qué empresas se comparte."}), 400
            if es_plantilla_global and compartir_con_empresas_ids:
                return jsonify({"error": "Si es una plantilla global, no debe especificar empresas para compartir."}), 400
            
            # Asegurarse de que las empresas en compartir_con_empresas_ids existan y estén activas
            for empresa_id_to_share in compartir_con_empresas_ids:
                empresa_to_share = Empresa.query.get(empresa_id_to_share)
                if not empresa_to_share or not empresa_to_share.activo:
                    return jsonify({"error": f"La empresa con ID {empresa_id_to_share} para compartir no existe o no está activa."}), 400


        formulario.es_plantilla = es_plantilla
        formulario.es_plantilla_global = es_plantilla_global
        formulario.compartir_con_empresas_ids = compartir_con_empresas_ids
        formulario.notificaciones_activas = notificaciones_activas
        formulario.automatizacion_activa = automatizacion_activa

        # Actualizar espacios
        if espacios_ids is not None:
            espacios_asociados = []
            for esp_id in espacios_ids:
                espacio = Espacio.query.get(esp_id)
                if not espacio:
                    return jsonify({"error": f"Espacio con ID {esp_id} no encontrado."}), 400
                # Si no es plantilla, validar pertenencia a la empresa del formulario
                if not es_plantilla and espacio.id_empresa != formulario.id_empresa:
                    return jsonify({"error": f"Espacio con ID {esp_id} no pertenece a la empresa del formulario."}), 400
                espacios_asociados.append(espacio)
            formulario.espacios = espacios_asociados

        # Actualizar sub-espacios
        if subespacios_ids is not None:
            subespacios_asociados = []
            for sub_id in subespacios_ids:
                subespacio = SubEspacio.query.get(sub_id)
                if not subespacio:
                    return jsonify({"error": f"Sub-espacio con ID {sub_id} no encontrado."}), 400
                if not es_plantilla and subespacio.espacio.id_empresa != formulario.id_empresa:
                    return jsonify({"error": f"Sub-espacio con ID {sub_id} no pertenece a la empresa del formulario."}), 400
                subespacios_asociados.append(subespacio)
            formulario.sub_espacios = subespacios_asociados

        # Actualizar objetos
        if objetos_ids is not None:
            objetos_asociados = []
            for obj_id in objetos_ids:
                objeto = Objeto.query.get(obj_id)
                if not objeto:
                    return jsonify({"error": f"Objeto con ID {obj_id} no encontrado."}), 400
                if not es_plantilla and objeto.sub_espacio.espacio.id_empresa != formulario.id_empresa:
                    return jsonify({"error": f"Objeto con ID {obj_id} no pertenece a la empresa seleccionada."}), 400
                objetos_asociados.append(objeto)
            formulario.objetos = objetos_asociados

        # Actualizar tipos de respuesta disponibles
        if tipos_respuesta_ids is not None:
            tipos_respuesta_asociados = []
            for tr_id in tipos_respuesta_ids:
                tipo_respuesta = TipoRespuesta.query.get(tr_id)
                if not tipo_respuesta:
                    return jsonify({"error": f"Tipo de respuesta con ID {tr_id} no encontrado."}), 400
                tipos_respuesta_asociados.append(tipo_respuesta)
            formulario.tipos_respuesta_disponibles = tipos_respuesta_asociados


        db.session.commit()

        return jsonify({"message": "Formulario actualizado exitosamente.", "formulario": formulario.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar formulario: {str(e)}"}), 500

@api.route('/formularios/<int:form_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_formulario(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para eliminar este formulario."}), 403

        # --- INICIO DE ELIMINACIÓN EN CASCADA MANUAL PARA FORMULARIO ---

        # 1. Eliminar Notificaciones asociadas a este Formulario
        # Esta línea es la que causa el error si 'Notificacion' no está definida.
        notificaciones_formulario = Notificacion.query.filter_by(id_formulario=form_id).all()
        for notif in notificaciones_formulario:
            db.session.delete(notif)

        # 2. Eliminar Envíos de Formulario y sus Respuestas/Observaciones asociadas
        # Cargar los envíos para poder acceder a sus relaciones
        envios_formulario = EnvioFormulario.query.filter_by(id_formulario=form_id).options(joinedload(EnvioFormulario.respuestas), joinedload(EnvioFormulario.observaciones)).all()
        for envio in envios_formulario:
            # Eliminar Respuestas del Envío
            respuestas_envio = list(envio.respuestas) # Copia para iterar
            for respuesta in respuestas_envio:
                db.session.delete(respuesta)
            
            # Eliminar Observaciones del Envío
            observaciones_envio = list(envio.observaciones) # Copia para iterar
            for observacion in observaciones_envio:
                db.session.delete(observacion)

            db.session.delete(envio) # Eliminar el envío después de sus hijos

        # 3. Eliminar Preguntas y sus Respuestas asociadas
        # Cargar las preguntas para poder acceder a sus relaciones
        preguntas_formulario = Pregunta.query.filter_by(id_formulario=form_id).options(joinedload(Pregunta.respuestas)).all()
        for pregunta in preguntas_formulario:
            # Eliminar Respuestas de la Pregunta
            respuestas_pregunta = list(pregunta.respuestas) # Copia para iterar
            for respuesta in respuestas_pregunta:
                db.session.delete(respuesta)
            db.session.delete(pregunta) # Eliminar la pregunta después de sus respuestas

        # 4. Eliminar asociaciones de las tablas intermedias (muchos a muchos)
        # Esto es crucial para limpiar las tablas de unión
        # Desvincular formularios de espacios
        db.session.execute(formulario_espacio.delete().where(formulario_espacio.c.id_formulario == form_id))
        # Desvincular formularios de sub_espacios
        db.session.execute(formulario_subespacio.delete().where(formulario_subespacio.c.id_formulario == form_id))
        # Desvincular formularios de objetos
        db.session.execute(formulario_objeto.delete().where(formulario_objeto.c.id_formulario == form_id))
        # Desvincular formularios de tipos_respuesta
        db.session.execute(formulario_tipo_respuesta.delete().where(formulario_tipo_respuesta.c.id_formulario == form_id))

        # 5. Finalmente, eliminar el Formulario
        db.session.delete(formulario)
        db.session.commit()
        # --- FIN DE ELIMINACIÓN EN CASCADA MANUAL PARA FORMULARIO ---

        return jsonify({"message": "Formulario y todos sus datos asociados eliminados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar formulario: {str(e)}"}), 500


# --- FIN DE RUTAS PARA FORMULARIOS ---


# --- INICIO DE RUTAS PARA PREGUNTAS ---

@api.route('/formularios/<int:form_id>/preguntas', methods=['GET'])
@jwt_required()
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_preguntas_by_formulario(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.options(joinedload(Usuario.empresa)).get(int(current_user_id))
        
        formulario = Formulario.query.options(joinedload(Formulario.preguntas).joinedload(Pregunta.tipo_respuesta)).get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        if usuario.rol != 'owner':
            if formulario.es_plantilla:
                if not (formulario.es_plantilla_global or usuario.id_empresa in (formulario.compartir_con_empresas_ids or [])):
                    return jsonify({"error": "No tienes permisos para acceder a las preguntas de este formulario."}), 403
            elif formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a las preguntas de este formulario."}), 403

        if formulario.es_plantilla:
            return redirect(url_for('api.get_preguntas_de_plantilla', form_id=form_id))

        preguntas_data = []
        for p in formulario.preguntas:
            p_data = p.serialize()
            p_data['tipo_respuesta_nombre'] = p.tipo_respuesta.nombre_tipo if p.tipo_respuesta else None
            # Asegúrate de enviar la columna `recurso_asociado`
            # Nota: la serialización ya incluye esto si has actualizado el modelo.
            preguntas_data.append(p_data)

        return jsonify({"preguntas": preguntas_data}), 200

    except Exception as e:
        print(f"Error al obtener preguntas del formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener preguntas: {str(e)}"}), 500

@api.route('/formularios/<int:form_id>/preguntas/plantilla', methods=['GET'])
@jwt_required()
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_preguntas_de_plantilla(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.options(joinedload(Usuario.empresa)).get(int(current_user_id))
        
        formulario = Formulario.query.options(joinedload(Formulario.preguntas).joinedload(Pregunta.tipo_respuesta)).get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404
        
        if not formulario.es_plantilla:
            return redirect(url_for('api.get_preguntas_by_formulario', form_id=form_id))

        is_allowed_template = False
        if formulario.es_plantilla_global:
            is_allowed_template = True
        elif usuario.id_empresa in (formulario.compartir_con_empresas_ids or []):
            is_allowed_template = True
        
        if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para acceder a las preguntas de esta plantilla."}), 403

        preguntas_data = []
        for p in formulario.preguntas:
            p_data = p.serialize()
            p_data['tipo_respuesta_nombre'] = p.tipo_respuesta.nombre_tipo if p.tipo_respuesta else None
            
            # --- LÓGICA EXISTENTE PARA PLANTILLAS DE SELECCIÓN DE RECURSOS (SIN CAMBIOS) ---
            if p.recurso_asociado:
                opciones = {}
                if p.recurso_asociado == 'espacio':
                    opciones['espacios'] = []
                elif p.recurso_asociado == 'subespacio':
                    opciones['subespacios'] = []
                elif p.recurso_asociado == 'objeto':
                    opciones['objetos'] = []
                p_data['opciones_respuesta_json'] = opciones
            # Si `recurso_asociado` no está definido, o no es una pregunta de recursos,
            # mantenemos la lógica anterior.
            elif p.tipo_respuesta and p.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
                p_data['opciones_respuesta_json'] = {
                    'espacios': [],
                    'subespacios': [],
                    'objetos': []
                }
            # --- FIN DE LÓGICA DE SELECCIÓN DE RECURSOS ---
            
            # --- NUEVA LÓGICA PARA CARGAR OPCIONES DE SELECCIÓN ÚNICA Y MÚLTIPLE ---
            # Si la pregunta no es de selección de recursos, aseguramos que se envíe
            # el JSON de opciones tal cual está en la base de datos para los
            # tipos 'seleccion_unica' y 'seleccion_multiple'.
            elif p.tipo_respuesta.nombre_tipo in ['seleccion_unica', 'seleccion_multiple']:
                p_data['opciones_respuesta_json'] = p.opciones_respuesta_json
            # --- FIN DE NUEVA LÓGICA ---
            
            # Para el tipo 'dibujo' y otros, no se necesita lógica especial aquí
            # ya que el frontend se encargará de renderizar el componente correcto.
            
            preguntas_data.append(p_data)

        return jsonify({"preguntas": preguntas_data}), 200

    except Exception as e:
        print(f"Error al obtener preguntas de plantilla: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener preguntas de plantilla: {str(e)}"}), 500
    
# --- RUTA POST /formularios/<form_id>/preguntas (CORREGIDA) ---
@api.route('/formularios/<int:form_id>/preguntas', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_pregunta(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Validación: Esta ruta NO debe usarse para plantillas.
        if formulario.es_plantilla:
            return jsonify({"error": "Esta ruta no es válida para formularios de plantilla."}), 400

        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para añadir preguntas a este formulario."}), 403

        texto_pregunta = data.get('texto_pregunta', '').strip()
        tipo_respuesta_id = data.get('tipo_respuesta_id')
        orden = data.get('orden')
        opciones_respuesta_json = data.get('opciones_respuesta_json')
        recurso_asociado = None # En esta ruta, este campo siempre será nulo.

        if not all([texto_pregunta, tipo_respuesta_id, orden is not None]):
            return jsonify({"error": "Texto de pregunta, tipo de respuesta y orden son requeridos."}), 400

        tipo_respuesta = TipoRespuesta.query.get(tipo_respuesta_id)
        if not tipo_respuesta:
            return jsonify({"error": "Tipo de respuesta no válido."}), 400
        
        # --- Lógica de validación simplificada para formularios normales ---
        if tipo_respuesta.nombre_tipo in ['seleccion_multiple', 'seleccion_unica']:
            if not isinstance(opciones_respuesta_json, list) or not opciones_respuesta_json:
                return jsonify({"error": "Para selección múltiple/única, 'opciones_respuesta_json' debe ser una lista de opciones no vacía."}), 400
        
        elif tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            if not isinstance(opciones_respuesta_json, dict) or not opciones_respuesta_json:
                return jsonify({"error": "Para 'seleccion_recursos', 'opciones_respuesta_json' debe ser un diccionario de recursos."}), 400
        
        else:
            opciones_respuesta_json = None

        nueva_pregunta = Pregunta(
            id_formulario=form_id,
            texto_pregunta=texto_pregunta,
            tipo_respuesta_id=tipo_respuesta_id,
            orden=orden,
            opciones_respuesta_json=opciones_respuesta_json,
            recurso_asociado=recurso_asociado
        )
        db.session.add(nueva_pregunta)
        db.session.commit()

        pregunta_data = nueva_pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = tipo_respuesta.nombre_tipo

        return jsonify({"message": "Pregunta creada exitosamente.", "pregunta": pregunta_data}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear pregunta para formulario normal: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


@api.route('/formularios/plantillas/<int:form_id>/preguntas', methods=['POST'])
@role_required(['owner']) # Solo el owner puede crear preguntas en plantillas.
def create_pregunta_plantilla(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Validación: Esta ruta SOLO debe usarse para plantillas.
        if not formulario.es_plantilla:
            return jsonify({"error": "Esta ruta no es válida para formularios no plantilla."}), 400

        # Verificación de permisos para plantillas
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para añadir preguntas a esta plantilla."}), 403

        texto_pregunta = data.get('texto_pregunta', '').strip()
        tipo_respuesta_id = data.get('tipo_respuesta_id')
        orden = data.get('orden')
        # Inicializamos opciones_respuesta_json a None, pero lo actualizaremos si es necesario
        opciones_respuesta_json = None 
        recurso_asociado = data.get('recurso_asociado')


        if not all([texto_pregunta, tipo_respuesta_id, orden is not None]):
            return jsonify({"error": "Texto de pregunta, tipo de respuesta y orden son requeridos."}), 400

        tipo_respuesta = TipoRespuesta.query.get(tipo_respuesta_id)
        if not tipo_respuesta:
            return jsonify({"error": "Tipo de respuesta no válido."}), 400
        
        # --- Lógica de validación simplificada para plantillas ---
        if tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            if not recurso_asociado or recurso_asociado not in ['espacio', 'subespacio', 'objeto']:
                return jsonify({"error": "Para 'seleccion_recursos', 'recurso_asociado' es requerido y debe ser 'espacio', 'subespacio' u 'objeto'."}), 400
        
        # --- CAMBIO AÑADIDO: Lógica para guardar opciones de respuesta ---
        # Si el tipo de pregunta es seleccion_unica o seleccion_multiple,
        # asignamos el valor del body a opciones_respuesta_json.
        elif tipo_respuesta.nombre_tipo in ['seleccion_unica', 'seleccion_multiple']:
            opciones_respuesta_json = data.get('opciones_respuesta_json')
            if not opciones_respuesta_json or not isinstance(opciones_respuesta_json, list) or len(opciones_respuesta_json) == 0:
                 return jsonify({"error": "Para 'seleccion_unica' y 'seleccion_multiple', 'opciones_respuesta_json' es requerido y debe ser una lista no vacía."}), 400
        
        else: # Para todos los demás tipos de preguntas en plantillas
            recurso_asociado = None

        nueva_pregunta = Pregunta(
            id_formulario=form_id,
            texto_pregunta=texto_pregunta,
            tipo_respuesta_id=tipo_respuesta_id,
            orden=orden,
            opciones_respuesta_json=opciones_respuesta_json,
            recurso_asociado=recurso_asociado
        )
        db.session.add(nueva_pregunta)
        db.session.commit()

        pregunta_data = nueva_pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = tipo_respuesta.nombre_tipo

        return jsonify({"message": "Pregunta de plantilla creada exitosamente.", "pregunta": pregunta_data}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear pregunta para plantilla: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
    

# --- RUTA GET /preguntas/<pregunta_id> (CORREGIDA) ---
@api.route('/preguntas/<int:pregunta_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_pregunta(pregunta_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.options(joinedload(Usuario.empresa)).get(int(current_user_id))

        pregunta = Pregunta.query.options(joinedload(Pregunta.formulario).joinedload(Formulario.empresa), joinedload(Pregunta.tipo_respuesta)).get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = pregunta.formulario
        if not formulario:
            return jsonify({"error": "Formulario asociado a la pregunta no encontrado."}), 404
        
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a esta pregunta."}), 403

        pregunta_data = pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo if pregunta.tipo_respuesta else None

        # --- LÓGICA CLAVE CORREGIDA ---
        # Si es una plantilla y la pregunta es de selección de recursos,
        # usamos el nuevo campo `recurso_asociado` para filtrar.
        if formulario.es_plantilla and pregunta.recurso_asociado:
            recursos = []
            if pregunta.recurso_asociado == 'espacio':
                recursos = Espacio.query.filter_by(id_empresa=usuario.id_empresa).all()
            elif pregunta.recurso_asociado == 'subespacio':
                recursos = SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()
            elif pregunta.recurso_asociado == 'objeto':
                recursos = Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()

            pregunta_data['opciones_respuesta_json'] = {
                'espacios': [r.id_espacio for r in recursos if isinstance(r, Espacio)],
                'subespacios': [r.id_subespacio for r in recursos if isinstance(r, SubEspacio)],
                'objetos': [r.id_objeto for r in recursos if isinstance(r, Objeto)]
            }
        
        return jsonify({"pregunta": pregunta_data}), 200

    except Exception as e:
        print(f"Error al obtener pregunta: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener pregunta: {str(e)}"}), 500

# --- RUTA PUT /preguntas/<pregunta_id> (CORREGIDA) ---
@api.route('/owner/preguntas/<int:pregunta_id>', methods=['PUT'])
@role_required(['owner'])
def update_pregunta_owner(pregunta_id):
    """Permite al owner actualizar cualquier pregunta."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        pregunta = Pregunta.query.get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = Formulario.query.get(pregunta.id_formulario)
        if not formulario:
            return jsonify({"error": "Formulario asociado no encontrado."}), 404

        # Actualización de campos
        pregunta.texto_pregunta = data.get('texto_pregunta', pregunta.texto_pregunta).strip()
        pregunta.orden = data.get('orden', pregunta.orden)
        
        # El owner puede actualizar el recurso asociado y las opciones en plantillas
        pregunta.recurso_asociado = data.get('recurso_asociado', pregunta.recurso_asociado)
        pregunta.opciones_respuesta_json = data.get('opciones_respuesta_json', pregunta.opciones_respuesta_json)

        # Si se cambia el tipo de respuesta, se actualiza
        tipo_respuesta_id = data.get('tipo_respuesta_id', pregunta.tipo_respuesta_id)
        if tipo_respuesta_id != pregunta.tipo_respuesta_id:
            tipo_respuesta_nueva = TipoRespuesta.query.get(tipo_respuesta_id)
            if not tipo_respuesta_nueva:
                return jsonify({"error": "Tipo de respuesta no válido."}), 400
            pregunta.tipo_respuesta_id = tipo_respuesta_id

        # Validaciones de datos según el tipo de respuesta
        if pregunta.tipo_respuesta.nombre_tipo in ['seleccion_multiple', 'seleccion_unica']:
            if not isinstance(pregunta.opciones_respuesta_json, list):
                pregunta.opciones_respuesta_json = None
                # Opcionalmente, puedes retornar un error si es un dato obligatorio
                # return jsonify({"error": "Para tipos de selección, 'opciones_respuesta_json' debe ser una lista."}), 400
        elif pregunta.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            if pregunta.recurso_asociado not in ['espacio', 'subespacio', 'objeto']:
                return jsonify({"error": "El campo 'recurso_asociado' debe ser 'espacio', 'subespacio' u 'objeto'."}), 400
            # Las plantillas de recursos no tienen opciones, pero los formularios normales sí
            if formulario.es_plantilla:
                pregunta.opciones_respuesta_json = None
            elif not isinstance(pregunta.opciones_respuesta_json, dict):
                 return jsonify({"error": "Para 'seleccion_recursos', 'opciones_respuesta_json' debe ser un diccionario de listas."}), 400
        elif pregunta.opciones_respuesta_json is not None:
             pregunta.opciones_respuesta_json = None # Aseguramos que no tenga opciones si el tipo no lo permite


        db.session.commit()

        pregunta_data = pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo
        return jsonify({"message": "Pregunta actualizada exitosamente por el owner.", "pregunta": pregunta_data}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar pregunta por owner: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


# --- RUTA PARA 'admin_empresa' (GESTIÓN DE FORMULARIOS NORMALES) ---
@api.route('/admin_empresa/preguntas/<int:pregunta_id>', methods=['PUT'])
@role_required(['admin_empresa'])
def update_pregunta_admin(pregunta_id):
    """Permite al admin_empresa actualizar preguntas en formularios de su empresa que no sean plantillas."""
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        pregunta = Pregunta.query.get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = Formulario.query.get(pregunta.id_formulario)
        if not formulario:
            return jsonify({"error": "Formulario asociado no encontrado."}), 404

        # Validaciones de permisos:
        # 1. El formulario debe pertenecer a la empresa del administrador.
        # 2. El formulario no debe ser una plantilla.
        if formulario.id_empresa != usuario.id_empresa or formulario.es_plantilla:
            return jsonify({"error": "No tienes permisos para actualizar esta pregunta o el formulario es una plantilla."}), 403

        # Actualización de campos
        pregunta.texto_pregunta = data.get('texto_pregunta', pregunta.texto_pregunta).strip()
        pregunta.orden = data.get('orden', pregunta.orden)
        
        # El admin solo puede editar el recurso asociado en formularios no-plantillas
        pregunta.recurso_asociado = data.get('recurso_asociado', pregunta.recurso_asociado)
        pregunta.opciones_respuesta_json = data.get('opciones_respuesta_json', pregunta.opciones_respuesta_json)
        
        # Si se cambia el tipo de respuesta
        tipo_respuesta_id = data.get('tipo_respuesta_id', pregunta.tipo_respuesta_id)
        if tipo_respuesta_id != pregunta.tipo_respuesta_id:
            tipo_respuesta_nueva = TipoRespuesta.query.get(tipo_respuesta_id)
            if not tipo_respuesta_nueva:
                return jsonify({"error": "Tipo de respuesta no válido."}), 400
            pregunta.tipo_respuesta_id = tipo_respuesta_id

        # Validaciones de datos según el tipo de respuesta
        if pregunta.tipo_respuesta.nombre_tipo in ['seleccion_multiple', 'seleccion_unica']:
            if not isinstance(pregunta.opciones_respuesta_json, list):
                 pregunta.opciones_respuesta_json = None
        elif pregunta.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            if pregunta.recurso_asociado not in ['espacio', 'subespacio', 'objeto']:
                return jsonify({"error": "El campo 'recurso_asociado' debe ser 'espacio', 'subespacio' u 'objeto'."}), 400
            if not isinstance(pregunta.opciones_respuesta_json, dict):
                 return jsonify({"error": "Para 'seleccion_recursos', 'opciones_respuesta_json' debe ser un diccionario de listas."}), 400
        elif pregunta.opciones_respuesta_json is not None:
             pregunta.opciones_respuesta_json = None

        db.session.commit()

        pregunta_data = pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo
        return jsonify({"message": "Pregunta actualizada exitosamente por el administrador de empresa.", "pregunta": pregunta_data}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar pregunta por admin_empresa: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
# --- RUTA DELETE /preguntas/<pregunta_id> (SIN CAMBIOS) ---
@api.route('/preguntas/<int:pregunta_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_pregunta(pregunta_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        pregunta = Pregunta.query.get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = Formulario.query.get(pregunta.id_formulario)
        if not formulario:
            return jsonify({"error": "Formulario asociado a la pregunta no encontrado."}), 404
        
        if usuario.rol != 'owner':
            is_allowed_template_management = False
            if formulario.es_plantilla:
                if usuario.id_empresa == formulario.id_empresa:
                    is_allowed_template_management = True
            
            if not is_allowed_template_management and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para eliminar esta pregunta."}), 403

        respuestas_pregunta = list(pregunta.respuestas)
        for respuesta in respuestas_pregunta:
            db.session.delete(respuesta)

        db.session.delete(pregunta)
        db.session.commit()

        return jsonify({"message": "Pregunta y sus respuestas asociadas eliminadas exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar pregunta: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar pregunta: {str(e)}"}), 500


# --- INICIO DE RUTAS PARA ENVÍOS DE FORMULARIO (RESPUESTAS) ---
# NUEVO ENDPOINT: Obtener el conteo de envíos de un usuario para un formulario hoy
@api.route('/formularios/<int:form_id>/user_submissions_in_period_count', methods=['GET'])
@jwt_required()
def get_user_submissions_in_period_count(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso para el formulario (igual que otros GETs para formularios/preguntas)
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        # Calcular el inicio del período dinámicamente
        # Si submission_period_days es 1, se comporta como "por día"
        # Si es 7, se comporta como "por semana", etc.
        period_start = datetime.utcnow() - timedelta(days=formulario.submission_period_days)

        count = EnvioFormulario.query.filter(
            EnvioFormulario.id_formulario == form_id,
            EnvioFormulario.id_usuario == usuario.id_usuario,
            EnvioFormulario.fecha_hora_envio >= period_start
        ).count()

        return jsonify({"count": count}), 200

    except Exception as e:
        print(f"Error al obtener el conteo de envíos de usuario para el período: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/tipos-respuesta', methods=['GET'])
def get_tipos_respuesta():
    """
    Obtiene todos los tipos de respuesta disponibles.
    No requiere autenticación especial, ya que son datos estáticos.
    """
    try:
        tipos = TipoRespuesta.query.all()
        return jsonify({"tipos_respuesta": [t.serialize() for t in tipos]}), 200
    except Exception as e:
        print(f"Error al obtener tipos de respuesta: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener tipos de respuesta: {str(e)}"}), 500

@api.route('/tipos-respuesta', methods=['POST']) # NUEVA RUTA: para crear un nuevo tipo de respuesta
@role_required(['owner', 'admin_general']) # Solo owner o admin_general pueden crear nuevos tipos globales
def create_tipo_respuesta():
    try:
        data = request.get_json()
        if not data or 'nombre_tipo' not in data:
            return jsonify({"error": "Nombre del tipo de respuesta es requerido."}), 400
        
        nombre_tipo = data['nombre_tipo'].strip()
        descripcion = data.get('descripcion', '')

        if TipoRespuesta.query.filter_by(nombre_tipo=nombre_tipo).first():
            return jsonify({"error": "Ya existe un tipo de respuesta con ese nombre."}), 409

        new_tipo = TipoRespuesta(nombre_tipo=nombre_tipo, descripcion=descripcion)
        db.session.add(new_tipo)
        db.session.commit()
        return jsonify({"message": "Tipo de respuesta creado exitosamente.", "tipo_respuesta": new_tipo.serialize()}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al crear tipo de respuesta: {e}")
        return jsonify({"error": f"Error interno del servidor al crear tipo de respuesta: {str(e)}"}), 500


@api.route('/tipos-respuesta/seed', methods=['POST'])
@role_required(['owner']) # Solo un owner puede sembrar estos tipos
def seed_tipos_respuesta():
    """
    Siembra la base de datos con tipos de respuesta predefinidos.
    Esta ruta debe ejecutarse UNA ÚNICA VEZ para inicializar los tipos.
    """
    try:
        # Verifica si ya existen tipos para evitar duplicados
        if TipoRespuesta.query.count() > 0:
            return jsonify({"message": "Los tipos de respuesta ya existen en la base de datos. No se requiere sembrar de nuevo."}), 200

        predefined_types = [
            {"nombre_tipo": "texto", "descripcion": "Respuesta de texto libre"},
            {"nombre_tipo": "booleano", "descripcion": "Respuesta de Sí/No (verdadero/falso)"},
            {"nombre_tipo": "numerico", "descripcion": "Respuesta numérica"},
            {"nombre_tipo": "seleccion_unica", "descripcion": "Selección de una opción de una lista (solo una)"},
            {"nombre_tipo": "seleccion_multiple", "descripcion": "Selección de múltiples opciones de una lista"},
            {"nombre_tipo": "firma", "descripcion": "Captura de firma digital"},
            {"nombre_tipo": "dibujo", "descripcion": "Captura de dibujo o múltiples firmas"}, # Nuevo tipo para múltiples firmas
            {"nombre_tipo": "seleccion_recursos", "descripcion": "Selección de recursos (espacios, sub-espacios, objetos) como opciones"}
        ]

        for type_data in predefined_types:
            new_type = TipoRespuesta(
                nombre_tipo=type_data["nombre_tipo"],
                descripcion=type_data["descripcion"]
            )
            db.session.add(new_type)
        
        db.session.commit()
        return jsonify({"message": "Tipos de respuesta sembrados exitosamente."}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al sembrar tipos de respuesta: {e}")
        return jsonify({"error": f"Error interno del servidor al sembrar tipos de respuesta: {str(e)}"}), 500



# --- INICIO DE RUTAS PARA ENVÍOS DE FORMULARIO (RESPUESTAS) ---

@api.route('/envios-formulario', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_envios_formulario():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if usuario.rol == 'owner':
            envios = EnvioFormulario.query.all()
        elif usuario.rol == 'admin_empresa':
            # Un admin de empresa ve los envíos de formularios de su empresa
            envios = EnvioFormulario.query.join(Formulario).filter(Formulario.id_empresa == usuario.id_empresa).all()
        else: # usuario_formulario
            # Un usuario de formulario solo ve sus propios envíos
            envios = EnvioFormulario.query.filter_by(id_usuario=usuario.id_usuario).all()

        envios_data = []
        for envio in envios:
            envio_data = envio.serialize()
            # Opcional: añadir nombre del formulario y usuario para mejor contexto en la lista
            envio_data['nombre_formulario'] = envio.formulario.nombre_formulario if envio.formulario else 'N/A'
            envio_data['nombre_usuario'] = envio.usuario.nombre_completo if envio.usuario else 'N/A'
            envios_data.append(envio_data)

        return jsonify({"envios_formulario": envios_data}), 200

    except Exception as e:
        print(f"Error al obtener envíos de formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener envíos de formulario: {str(e)}"}), 500

@api.route('/envios-formulario', methods=['POST'])
@jwt_required() # Cualquier usuario loggeado puede enviar un formulario
def submit_formulario():
    """
    Permite a un usuario enviar un formulario completo con sus respuestas.
    """
    print("DEBUG BACKEND: Entrando a la función submit_formulario (POST /envios-formulario)")
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        if not usuario:
            print(f"DEBUG BACKEND: Usuario no encontrado para ID: {current_user_id}")
            return jsonify({"error": "Usuario no encontrado o sesión inválida."}), 404
        
        data = request.get_json()
        if not data:
            print("DEBUG BACKEND: No se recibieron datos en la solicitud.")
            return jsonify({"error": "No se recibieron datos"}), 400

        id_formulario = data.get('id_formulario')
        respuestas_data = data.get('respuestas', [])
        espacios_cubiertos_ids = data.get('espacios_cubiertos_ids', [])
        subespacios_cubiertos_ids = data.get('subespacios_cubiertos_ids', [])
        objetos_cubiertos_ids = data.get('objetos_cubiertos_ids', [])

        print(f"DEBUG BACKEND: Payload recibido: id_formulario={id_formulario}, id_usuario={usuario.id_usuario}, respuestas_count={len(respuestas_data)}")
        for idx, resp_item in enumerate(respuestas_data):
            print(f"  Respuesta {idx}: pregunta_id={resp_item.get('pregunta_id')}, valor_texto={resp_item.get('valor_texto')}, valor_booleano={resp_item.get('valor_booleano')}, valor_numerico={resp_item.get('valor_numerico')}, valores_multiples_json={resp_item.get('valores_multiples_json')}")

        if not id_formulario:
            print("DEBUG BACKEND: id_formulario es requerido en el payload.")
            return jsonify({"error": "El id_formulario es requerido."}), 400

        formulario = Formulario.query.get(id_formulario)
        if not formulario:
            print(f"DEBUG BACKEND: Formulario {id_formulario} no encontrado.")
            return jsonify({"error": "Formulario no encontrado."}), 404

        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                print(f"DEBUG BACKEND: Permisos insuficientes para usuario {usuario.id_usuario} en formulario {id_formulario}.")
                return jsonify({"error": "No tienes permisos para enviar respuestas a este formulario."}), 403

        period_start = datetime.utcnow() - timedelta(days=formulario.submission_period_days)
        current_submissions_in_period = EnvioFormulario.query.filter(
            EnvioFormulario.id_formulario == id_formulario,
            EnvioFormulario.id_usuario == usuario.id_usuario,
            EnvioFormulario.fecha_hora_envio >= period_start
        ).count()

        if current_submissions_in_period >= formulario.max_submissions_per_period:
            return jsonify({"error": f"Ya has alcanzado el límite de {formulario.max_submissions_per_period} diligencia(s) para este formulario en los últimos {formulario.submission_period_days} día(s)."}), 400

        nuevo_envio = EnvioFormulario(
            id_formulario=id_formulario,
            id_usuario=int(current_user_id),
            fecha_hora_envio=datetime.utcnow(),
            espacios_cubiertos_ids=espacios_cubiertos_ids,
            subespacios_cubiertos_ids=subespacios_cubiertos_ids,
            objetos_cubiertos_ids=objetos_cubiertos_ids
        )
        db.session.add(nuevo_envio)
        db.session.flush()

        print(f"DEBUG BACKEND: Nuevo envío creado con ID: {nuevo_envio.id_envio}")

        for respuesta_item in respuestas_data:
            pregunta_id = respuesta_item.get('pregunta_id')
            
            if pregunta_id is None:
                db.session.rollback()
                print("ERROR BACKEND: pregunta_id es None para una respuesta. Abortando envío.")
                return jsonify({"error": "Pregunta con ID None no encontrada o no pertenece a este formulario."}), 400

            valor_texto = respuesta_item.get('valor_texto')
            
            # --- CAMBIO CLAVE AQUÍ: Lógica de conversión booleana ---
            raw_valor_booleano = respuesta_item.get('valor_booleano')
            valor_booleano = None
            if isinstance(raw_valor_booleano, str):
                if raw_valor_booleano.lower() == 'true':
                    valor_booleano = True
                elif raw_valor_booleano.lower() == 'false':
                    valor_booleano = False
            elif isinstance(raw_valor_booleano, bool):
                valor_booleano = raw_valor_booleano
            
            valor_numerico = respuesta_item.get('valor_numerico')
            valores_multiples_json = respuesta_item.get('valores_multiples_json')
            
            firma_base64_list = respuesta_item.get('firma_base64_list')
            firma_base64_single = respuesta_item.get('firma_base64')

            pregunta = Pregunta.query.get(pregunta_id)
            if not pregunta or pregunta.id_formulario != id_formulario:
                db.session.rollback()
                print(f"ERROR BACKEND: Pregunta con ID {pregunta_id} no encontrada o no pertenece al formulario {id_formulario}. Abortando envío.")
                return jsonify({"error": f"Pregunta con ID {pregunta_id} no encontrada o no pertenece a este formulario."}), 400

            tipo_respuesta_obj = TipoRespuesta.query.get(pregunta.tipo_respuesta_id)
            valor_firma_url_list = []

            if tipo_respuesta_obj:
                if tipo_respuesta_obj.nombre_tipo == 'firma':
                    if usuario.firma_digital_url:
                        valor_firma_url_list.append(usuario.firma_digital_url)
                        print(f"DEBUG BACKEND: Usando firma digital de perfil para pregunta {pregunta_id}: {usuario.firma_digital_url}")
                    elif firma_base64_single:
                        try:
                            upload_result = cloudinary.uploader.upload(firma_base64_single)
                            valor_firma_url_list.append(upload_result['secure_url'])
                            print(f"DEBUG BACKEND: Firma subida para pregunta {pregunta_id}: {upload_result['secure_url']}")
                        except Exception as e:
                            print(f"ERROR BACKEND: Error al subir firma individual a Cloudinary para pregunta {pregunta_id}: {str(e)}")
                
                elif tipo_respuesta_obj.nombre_tipo == 'dibujo':
                    if firma_base64_list and isinstance(firma_base64_list, list):
                        for b64_signature in firma_base64_list:
                            try:
                                upload_result = cloudinary.uploader.upload(b64_signature)
                                valor_firma_url_list.append(upload_result['secure_url'])
                                print(f"DEBUG BACKEND: Dibujo/firma múltiple subida para pregunta {pregunta_id}: {upload_result['secure_url']}")
                            except Exception as e:
                                print(f"ERROR BACKEND: Error al subir dibujo/firma múltiple a Cloudinary para pregunta {pregunta_id}: {str(e)}")
                    elif firma_base64_single:
                         try:
                            upload_result = cloudinary.uploader.upload(firma_base64_single)
                            valor_firma_url_list.append(upload_result['secure_url'])
                            print(f"DEBUG BACKEND: Dibujo/firma única subida para pregunta {pregunta_id}: {upload_result['secure_url']}")
                         except Exception as e:
                            print(f"ERROR BACKEND: Error al subir dibujo/firma única a Cloudinary para pregunta {pregunta_id}: {str(e)}")

            nueva_respuesta = Respuesta(
                id_envio=nuevo_envio.id_envio,
                id_pregunta=pregunta_id,
                valor_texto=valor_texto,
                valor_booleano=valor_booleano,  # <--- SE ASIGNA EL VALOR YA CONVERTIDO
                valor_numerico=valor_numerico,
                valores_multiples_json=valores_multiples_json,
                valor_firma_url=valor_firma_url_list if valor_firma_url_list else None
            )
            db.session.add(nueva_respuesta)
            print(f"DEBUG BACKEND: Respuesta para pregunta {pregunta_id} añadida.")

        db.session.commit()
        print("DEBUG BACKEND: Formulario y respuestas guardados exitosamente.")
        return jsonify({"message": "Formulario enviado exitosamente.", "envio": nuevo_envio.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR BACKEND: Error inesperado al enviar formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al enviar formulario: {str(e)}"}), 500
    
@api.route('/envios-formulario/<int:envio_id>', methods=['GET'])
@jwt_required()
def get_envio_formulario(envio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario_acceso = Usuario.query.get(int(current_user_id))
        if not usuario_acceso:
            return jsonify({"error": "Usuario de acceso no encontrado."}), 404

        envio = EnvioFormulario.query.get(envio_id)
        if not envio:
            return jsonify({"error": "Envío de formulario no encontrado."}), 404
        
        usuario_envio = Usuario.query.get(envio.id_usuario)
        if not usuario_envio:
            return jsonify({"error": "Usuario que envió el formulario no encontrado."}), 404

        formulario_asociado = Formulario.query.get(envio.id_formulario)
        if not formulario_asociado:
            return jsonify({"error": "Formulario asociado al envío no encontrado."}), 404

        # Control de acceso para el usuario que intenta ver el envío
        if usuario_acceso.rol != 'owner':
            is_allowed_template = False
            if formulario_asociado.es_plantilla:
                if formulario_asociado.es_plantilla_global:
                    is_allowed_template = True
                elif usuario_acceso.id_empresa in formulario_asociado.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario_asociado.id_empresa != usuario_acceso.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este envío de formulario."}), 403

            # Si es usuario_formulario, solo puede ver sus propios envíos, incluso si es plantilla.
            if usuario_acceso.rol == 'usuario_formulario' and envio.id_usuario != usuario_acceso.id_usuario:
                return jsonify({"error": "No tienes permisos para acceder a este envío de formulario."}), 403

        envio_data = envio.serialize()
        envio_data['respuestas'] = []

        # --- LÓGICA CORREGIDA PARA PRE-FETCH DE RECURSOS ---
        # Usar el ID de la empresa del usuario que envió el formulario
        # Esto es crucial para plantillas que son llenadas por usuarios de diferentes empresas
        envio_company_id = usuario_envio.id_empresa 
        
        all_espacios = {e.id_espacio: e.nombre_espacio for e in Espacio.query.filter_by(id_empresa=envio_company_id).all()}
        all_subespacios = {s.id_subespacio: s.nombre_subespacio for s in SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == envio_company_id).all()}
        all_objetos = {o.id_objeto: o.nombre_objeto for o in Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == envio_company_id).all()}
        resource_names_map = {**all_espacios, **all_subespacios, **all_objetos}

        for respuesta in envio.respuestas:
            res_data = respuesta.serialize()
            pregunta = Pregunta.query.get(respuesta.id_pregunta)
            if pregunta:
                res_data['texto_pregunta'] = pregunta.texto_pregunta
                res_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo if pregunta.tipo_respuesta else None

                # Lógica para manejar seleccion_recursos y mostrar nombres
                if res_data['tipo_respuesta_nombre'] == 'seleccion_recursos' and res_data['valores_multiples_json']:
                    try:
                        selected_resource_ids = json.loads(res_data['valores_multiples_json'])
                        if isinstance(selected_resource_ids, list):
                            selected_resource_names = [
                                resource_names_map.get(res_id, f"ID Desconocido: {res_id}")
                                for res_id in selected_resource_ids
                            ]
                            res_data['valor_recursos_nombres'] = selected_resource_names
                        elif isinstance(selected_resource_ids, (int, str)):
                            name = resource_names_map.get(int(selected_resource_ids), f"ID Desconocido: {selected_resource_ids}")
                            res_data['valor_recursos_nombres'] = [name]
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"Error parsing valores_multiples_json for resource names in get_envio_formulario: {res_data['valores_multiples_json']} - {e}")
                        res_data['valor_recursos_nombres'] = ["Error al cargar recursos"]
            envio_data['respuestas'].append(res_data)

        # Opcional: añadir detalles del formulario y usuario que lo envió
        envio_data['formulario_info'] = formulario_asociado.serialize()
        envio_data['usuario_info'] = usuario_envio.serialize()

        return jsonify({"envio_formulario": envio_data}), 200

    except Exception as e:
        print(f"Error al obtener envío de formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener envío de formulario: {str(e)}"}), 500



@api.route('/envios-formulario/<int:envio_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_envio_formulario(envio_id):
    """
    Permite a un owner o admin_empresa actualizar metadatos de un envío de formulario.
    No permite la modificación de respuestas individuales para mantener la integridad.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        envio = EnvioFormulario.query.get(envio_id)
        if not envio:
            return jsonify({"error": "Envío de formulario no encontrado."}), 404

        formulario_asociado = Formulario.query.get(envio.id_formulario)
        if not formulario_asociado:
            return jsonify({"error": "Formulario asociado al envío no encontrado."}), 404

        # Control de acceso: owner puede todo, admin_empresa solo los de su empresa
        # MODIFICADO: Control de acceso para plantillas
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario_asociado.es_plantilla:
                if formulario_asociado.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario_asociado.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario_asociado.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para actualizar este envío de formulario."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos para actualizar."}), 400

        # Campos que pueden ser actualizados (metadatos del envío)
        fechas_horas_actividad_reales = data.get('fechas_horas_actividad_reales')
        completado_automaticamente = data.get('completado_automaticamente')
        espacios_cubiertos_ids = data.get('espacios_cubiertos_ids')
        subespacios_cubiertos_ids = data.get('subespacios_cubiertos_ids')
        objetos_cubiertos_ids = data.get('objetos_cubiertos_ids')

        if fechas_horas_actividad_reales is not None:
            if not isinstance(fechas_horas_actividad_reales, list):
                return jsonify({"error": "El campo 'fechas_horas_actividad_reales' debe ser una lista."}), 400
            envio.fechas_horas_actividad_reales = fechas_horas_actividad_reales

        if completado_automaticamente is not None:
            if not isinstance(completado_automaticamente, bool):
                return jsonify({"error": "El campo 'completado_automaticamente' debe ser un booleano."}), 400
            envio.completado_automaticamente = completado_automaticamente

        if espacios_cubiertos_ids is not None:
            if not isinstance(espacios_cubiertos_ids, list):
                return jsonify({"error": "El campo 'espacios_cubiertos_ids' debe ser una lista."}), 400
            envio.espacios_cubiertos_ids = espacios_cubiertos_ids

        if subespacios_cubiertos_ids is not None:
            if not isinstance(subespacios_cubiertos_ids, list):
                return jsonify({"error": "El campo 'subespacios_cubiertos_ids' debe ser una lista."}), 400
            envio.subespacios_cubiertos_ids = subespacios_cubiertos_ids

        if objetos_cubiertos_ids is not None:
            if not isinstance(objetos_cubiertos_ids, list):
                return jsonify({"error": "El campo 'objetos_cubiertos_ids' debe ser una lista."}), 400
            envio.objetos_cubiertos_ids = objetos_cubiertos_ids

        db.session.commit()
        return jsonify({"message": "Envío de formulario actualizado exitosamente.", "envio": envio.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar envío de formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar envío de formulario: {str(e)}"}), 500

@api.route('/envios-formulario/<int:envio_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_envio_formulario(envio_id):
    """
    Permite a un owner o admin_empresa eliminar un envío de formulario.
    Las respuestas y observaciones asociadas se eliminan manualmente.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        envio = EnvioFormulario.query.get(envio_id)
        if not envio:
            return jsonify({"error": "Envío de formulario no encontrado."}), 404

        formulario_asociado = Formulario.query.get(envio.id_formulario)
        if not formulario_asociado:
            return jsonify({"error": "Formulario asociado al envío no encontrado."}), 404

        # Control de acceso: owner puede todo, admin_empresa solo los de su empresa
        # También permite eliminar si es una plantilla compartida (si el admin_empresa es de la empresa destino)
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario_asociado.es_plantilla:
                if formulario_asociado.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario_asociado.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario_asociado.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para eliminar este envío de formulario."}), 403

        # --- INICIO DE ELIMINACIÓN EN CASCADA MANUAL PARA ENVIOFORMULARIO ---

        # 1. Eliminar Respuestas asociadas a este Envío de Formulario
        respuestas_envio = list(envio.respuestas) # Copia para iterar
        for respuesta in respuestas_envio:
            db.session.delete(respuesta)
        
        # 2. Eliminar Observaciones asociadas a este Envío de Formulario
        observaciones_envio = list(envio.observaciones) # Copia para iterar
        for observacion in observaciones_envio:
            db.session.delete(observacion)

        # 3. Finalmente, eliminar el Envío de Formulario
        db.session.delete(envio)
        db.session.commit()
        # --- FIN DE ELIMINACIÓN EN CASCADA MANUAL PARA ENVIOFORMULARIO ---

        return jsonify({"message": "Envío de formulario y sus datos asociados eliminados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar envío de formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al eliminar envío de formulario: {str(e)}"}), 500

# --- FIN DE RUTAS PARA ENVÍOS DE FORMULARIO ---
# NUEVAS RUTAS PARA FAVORITOS
@api.route('/usuarios/me/favoritos', methods=['GET'])
@jwt_required()
def get_user_favorites():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    # Asegurarse de que 'favoritos' sea siempre una lista, incluso si es None en DB
    favorite_ids = usuario.favoritos if usuario.favoritos is not None else []
    
    return jsonify({"favoritos": favorite_ids}), 200

@api.route('/usuarios/favoritos/<int:form_id>', methods=['POST'])
@jwt_required()
def add_favorite_form(form_id):
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    formulario = Formulario.query.get(form_id)
    if not formulario:
        return jsonify({"error": "Formulario no encontrado"}), 404

    # Obtener la lista actual, o inicializar si es None
    # Es crucial trabajar con una copia o reasignar para que SQLAlchemy detecte el cambio
    current_favorites = list(usuario.favoritos) if usuario.favoritos is not None else []

    if form_id not in current_favorites:
        current_favorites.append(form_id)
        usuario.favoritos = current_favorites # Reasignar la lista modificada
        db.session.add(usuario) # Asegurarse de que el objeto esté en la sesión para el seguimiento
        db.session.commit()
        db.session.refresh(usuario) # <--- ESTO ES CRÍTICO: Recargar el objeto desde la DB
        return jsonify({"message": "Formulario añadido a favoritos", "favoritos": usuario.favoritos}), 200
    else:
        return jsonify({"message": "El formulario ya está en favoritos", "favoritos": usuario.favoritos}), 200

@api.route('/usuarios/favoritos/<int:form_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite_form(form_id):
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    current_favorites = list(usuario.favoritos) if usuario.favoritos is not None else []

    if form_id in current_favorites:
        current_favorites.remove(form_id)
        usuario.favoritos = current_favorites # Reasignar la lista modificada
        db.session.add(usuario) # Asegurarse de que el objeto esté en la sesión para el seguimiento
        db.session.commit()
        db.session.refresh(usuario) # <--- ESTO ES CRÍTICO: Recargar el objeto desde la DB
        return jsonify({"message": "Formulario eliminado de favoritos", "favoritos": usuario.favoritos}), 200
    else:
        return jsonify({"message": "El formulario no estaba en favoritos", "favoritos": usuario.favoritos}), 200

# NUEVA RUTA: Para activar/desactivar notificaciones de un formulario
@api.route('/formularios/<int:form_id>/toggle-notificaciones', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def toggle_formulario_notificaciones(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para modificar las notificaciones de este formulario."}), 403
        
        # Un owner solo puede activar/desactivar notificaciones para formularios de su empresa (SGSST)
        if usuario.rol == 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "Como owner, solo puedes modificar notificaciones para formularios de tu empresa principal."}), 403

        formulario.notificaciones_activas = not formulario.notificaciones_activas
        db.session.commit()

        status = "activadas" if formulario.notificaciones_activas else "desactivadas"
        return jsonify({"message": f"Notificaciones del formulario '{formulario.nombre_formulario}' {status} exitosamente.", "notificaciones_activas": formulario.notificaciones_activas}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al cambiar estado de notificaciones: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# NUEVA RUTA: Para activar/desactivar la automatización de un formulario
@api.route('/formularios/<int:form_id>/toggle-automatizacion', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def toggle_formulario_automatizacion(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para modificar la automatización de este formulario."}), 403
        
        # Un owner solo puede activar/desactivar automatización para formularios de su empresa (SGSST)
        if usuario.rol == 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "Como owner, solo puedes modificar la automatización para formularios de tu empresa principal."}), 403

        formulario.automatizacion_activa = not formulario.automatizacion_activa
        db.session.commit()

        status = "activada" if formulario.automatizacion_activa else "desactivada"
        return jsonify({"message": f"Automatización del formulario '{formulario.nombre_formulario}' {status} exitosamente.", "automatizacion_activa": formulario.automatizacion_activa}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al cambiar estado de automatización: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


# NUEVA RUTA: Para ejecutar la automatización de llenado de formularios
# NUEVA RUTA: Para ejecutar la automatización de llenado de formularios
@api.route('/formularios/ejecutar-automatizacion', methods=['POST'])
@jwt_required()
def ejecutar_automatizacion_formularios():
    """
    Ejecuta el proceso de automatización para todos los formularios activos.
    Este endpoint es llamado por la interfaz de usuario para una ejecución manual de prueba.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario_actual = Usuario.query.get(int(current_user_id))

        if not usuario_actual:
            return jsonify({"error": "Usuario no encontrado."}), 404

        print("Iniciando ejecución de automatización...")
        
        # Filtramos los formularios que tienen la automatización activa
        formularios_a_automatizar = Formulario.query.filter_by(automatizacion_activa=True).all()
        
        formularios_procesados = []

        for formulario in formularios_a_automatizar:
            # Lógica para verificar si se debe ejecutar la automatización hoy
            today = date.today()
            if formulario.last_automated_run_date and formulario.last_automated_run_date == today:
                print(f"La automatización para el formulario {formulario.nombre_formulario} ya se ejecutó hoy. Saltando.")
                continue

            # Obtener el conteo de envíos manuales
            # CORREGIDO: Se usa el campo 'completado_automaticamente' del modelo EnvioFormulario
            manual_submissions_count = EnvioFormulario.query.join(Usuario).\
                filter(EnvioFormulario.id_formulario == formulario.id_formulario,
                       EnvioFormulario.completado_automaticamente == False,
                       Usuario.id_empresa == usuario_actual.id_empresa).count()
            
            # Verificar si se cumplen las condiciones para la automatización (ej. 5 envíos manuales)
            if manual_submissions_count < 5:
                print(f"El formulario '{formulario.nombre_formulario}' no tiene suficientes envíos manuales para automatizar ({manual_submissions_count}/5).")
                continue

            # Calcular el promedio o la moda de los datos existentes
            valores_calculados = calcular_valores_automatizados(formulario.id_formulario, usuario_actual.id_empresa)

            if not valores_calculados:
                print(f"No se pudieron calcular valores para el formulario '{formulario.nombre_formulario}'. Saltando.")
                continue

            # Crear un nuevo envío de formulario (EnvioFormulario)
            nuevo_envio = EnvioFormulario(
                id_formulario=formulario.id_formulario,
                id_usuario=usuario_actual.id_usuario,
                fecha_hora_envio=datetime.utcnow(),
                # CORREGIDO: Se establece el valor del campo 'completado_automaticamente'
                completado_automaticamente=True
            )
            db.session.add(nuevo_envio)
            db.session.flush() # Esto asigna un id_envio al nuevo objeto

            # Crear las respuestas basadas en los valores calculados
            for id_pregunta, valor_calculado in valores_calculados.items():
                nueva_respuesta = Respuesta(
                    id_envio=nuevo_envio.id_envio,
                    id_pregunta=id_pregunta,
                    valor_texto=valor_calculado.get('valor_texto'),
                    valor_numerico=valor_calculado.get('valor_numerico'),
                    valor_booleano=valor_calculado.get('valor_booleano'),
                    valores_multiples_json=valor_calculado.get('valores_multiples_json')
                )
                db.session.add(nueva_respuesta)

            # Actualizar la fecha de la última ejecución
            formulario.last_automated_run_date = today
            db.session.add(formulario)
            db.session.commit()
            
            formularios_procesados.append(formulario.nombre_formulario)
            print(f"Automatización exitosa para el formulario '{formulario.nombre_formulario}'.")

        if not formularios_procesados:
            return jsonify({"message": "No hay formularios listos para ser automatizados."}), 200

        return jsonify({
            "message": "Automatización ejecutada exitosamente.",
            "formularios_automatizados": formularios_procesados
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al ejecutar la automatización: {str(e)}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

def calcular_valores_automatizados(form_id, empresa_id):
    """
    Calcula los valores (moda o promedio) para las respuestas de un formulario.
    """
    from collections import Counter
    
    valores_por_pregunta = {}
    
    # Obtener todas las preguntas del formulario
    preguntas = Pregunta.query.filter_by(id_formulario=form_id).all()
    
    for pregunta in preguntas:
        # Obtener todas las respuestas manuales para esta pregunta
        # CORREGIDO: Ahora se obtienen los últimos 3 envíos manuales
        respuestas_manuales = Respuesta.query.join(EnvioFormulario).\
            filter(Respuesta.id_pregunta == pregunta.id_pregunta,
                   EnvioFormulario.completado_automaticamente == False,
                   EnvioFormulario.id_formulario == form_id).\
            join(Usuario).filter(Usuario.id_empresa == empresa_id).\
            order_by(EnvioFormulario.fecha_hora_envio.desc()).limit(3).all()
            
        if not respuestas_manuales:
            continue

        tipo_respuesta = pregunta.tipo_respuesta.nombre_tipo
        valor_calculado = {}

        if tipo_respuesta == 'numerico':
            valores_numericos = [r.valor_numerico for r in respuestas_manuales if r.valor_numerico is not None]
            if valores_numericos:
                promedio = sum(valores_numericos) / len(valores_numericos)
                valor_calculado = {'valor_numerico': promedio}
        elif tipo_respuesta in ['seleccion_unica', 'booleano', 'texto_corto']:
            valores_texto = [r.valor_texto for r in respuestas_manuales if r.valor_texto is not None]
            if valores_texto:
                moda = Counter(valores_texto).most_common(1)[0][0]
                valor_calculado = {'valor_texto': moda}
        elif tipo_respuesta == 'seleccion_multiple':
            valores_multiples = []
            for r in respuestas_manuales:
                if r.valores_multiples_json:
                    try:
                        selected_options = json.loads(r.valores_multiples_json)
                        valores_multiples.extend(selected_options)
                    except json.JSONDecodeError:
                        continue
            if valores_multiples:
                moda_multiple = Counter(valores_multiples).most_common(1)[0][0]
                valor_calculado = {'valores_multiples_json': json.dumps([moda_multiple])}
        elif tipo_respuesta == 'seleccion_recursos':
            # CORREGIDO: Se recolectan todos los recursos únicos de los últimos 3 envíos
            recursos_unicos = set()
            for r in respuestas_manuales:
                if r.valores_multiples_json:
                    try:
                        selected_options = json.loads(r.valores_multiples_json)
                        if isinstance(selected_options, list):
                            recursos_unicos.update(selected_options)
                        else:
                            recursos_unicos.add(selected_options)
                    except json.JSONDecodeError:
                        continue
            
            if recursos_unicos:
                valor_calculado = {'valores_multiples_json': json.dumps(list(recursos_unicos))}

        elif tipo_respuesta in ['firma', 'dibujo']:
            # Obtener el valor de la última respuesta
            ultima_respuesta = Respuesta.query.join(EnvioFormulario).\
                filter(Respuesta.id_pregunta == pregunta.id_pregunta,
                       # CORREGIDO: Se usa el campo 'completado_automaticamente' del modelo EnvioFormulario
                       EnvioFormulario.completado_automaticamente == False,
                       EnvioFormulario.id_formulario == form_id).\
                join(Usuario).filter(Usuario.id_empresa == empresa_id).\
                order_by(EnvioFormulario.fecha_hora_envio.desc()).first()
            
            if ultima_respuesta and ultima_respuesta.valor_texto:
                valor_calculado = {'valor_texto': ultima_respuesta.valor_texto}
        
        # Tipos de respuesta que se dejan vacíos
        elif tipo_respuesta in ['texto', 'texto_largo', 'fecha', 'hora']:
            pass

        if valor_calculado:
            valores_por_pregunta[pregunta.id_pregunta] = valor_calculado
            
    return valores_por_pregunta


    
# NUEVA RUTA: Para obtener el conteo de envíos manuales de un usuario para un formulario
@api.route('/formularios/<int:form_id>/manual_submissions_count', methods=['GET'])
@jwt_required()
def get_manual_submissions_count(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso (similar a otras rutas de formulario)
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        # Contar solo envíos manuales (completado_automaticamente = False)
        count = EnvioFormulario.query.filter(
            EnvioFormulario.id_formulario == form_id,
            EnvioFormulario.id_usuario == usuario.id_usuario,
            EnvioFormulario.completado_automaticamente == False
        ).count()

        return jsonify({"count": count}), 200

    except Exception as e:
        print(f"Error al obtener el conteo de envíos manuales: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


# NUEVA RUTA: Para establecer la hora de automatización programada de un formulario
# NUEVA RUTA: Para establecer la hora y cantidad de envíos de automatización programada de un formulario
@api.route('/formularios/<int:form_id>/set_automation_schedule', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def set_formulario_automation_schedule(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        # No es necesario que existan datos, pero si los hay, deben ser un diccionario
        if not data:
            return jsonify({"error": "No se recibieron datos para actualizar."}), 400

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para modificar la programación de este formulario."}), 403
        
        if usuario.rol == 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "Como owner, solo puedes modificar la programación para formularios de tu empresa principal."}), 403

        # Opcional: recibir la hora
        scheduled_time_str = data.get('scheduled_time')
        if scheduled_time_str is not None:
            try:
                # Convertir string "HH:MM" a objeto datetime.time
                scheduled_time_obj = datetime.strptime(scheduled_time_str, '%H:%M').time()
                formulario.scheduled_automation_time = scheduled_time_obj
            except ValueError:
                return jsonify({"error": "Formato de hora inválido. Use HH:MM."}), 400

        # NUEVO: Recibir y validar la cantidad de envíos automáticos
        automation_submissions_count = data.get('automation_submissions_count')
        if automation_submissions_count is not None:
            if not isinstance(automation_submissions_count, int) or automation_submissions_count <= 0:
                return jsonify({"error": "La cantidad de envíos automáticos debe ser un número entero positivo."}), 400
            formulario.automation_submissions_count = automation_submissions_count
        
        # Guardar los cambios en la base de datos
        db.session.commit()

        return jsonify({
            "message": f"Configuración de automatización para '{formulario.nombre_formulario}' actualizada exitosamente.",
            "scheduled_automation_time": formulario.scheduled_automation_time.strftime('%H:%M') if formulario.scheduled_automation_time else None,
            "automation_submissions_count": formulario.automation_submissions_count
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al establecer la configuración de automatización: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# NUEVA RUTA: Para obtener una lista de formularios para análisis (solo ID y nombre)
@api.route('/formularios/analytics', methods=['GET'])
@jwt_required()
def get_forms_for_analytics():
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        if usuario.rol == 'owner':
            all_forms = Formulario.query.all()
            formularios_data = [
                {"id_formulario": f.id_formulario, "nombre_formulario": f.nombre_formulario, "es_plantilla": f.es_plantilla}
                for f in all_forms
            ]
            return jsonify({"formularios": formularios_data}), 200

        formularios_accesibles = []
        
        formularios_empresa = Formulario.query.filter_by(id_empresa=usuario.id_empresa).all()
        formularios_accesibles.extend(formularios_empresa)
        
        plantillas_globales = Formulario.query.filter_by(es_plantilla_global=True).all()
        formularios_accesibles.extend(plantillas_globales)
        
        plantillas_compartidas = Formulario.query.filter(
            Formulario.compartir_con_empresas_ids.cast(db.String).ilike(f'%"{usuario.id_empresa}"%')
        ).all()
        formularios_accesibles.extend(plantillas_compartidas)

        formularios_finales = list({f.id_formulario: f for f in formularios_accesibles}.values())

        formularios_data = [
            {"id_formulario": f.id_formulario, "nombre_formulario": f.nombre_formulario, "es_plantilla": f.es_plantilla}
            for f in formularios_finales
        ]
        
        return jsonify({"formularios": formularios_data}), 200

    except Exception as e:
        print(f"Error al obtener formularios para análisis: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
@api.route('/formularios/<int:form_id>/preguntas/analytics', methods=['GET'])
@jwt_required()
def get_questions_for_analytics(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        preguntas = Pregunta.query.filter_by(id_formulario=form_id).options(joinedload(Pregunta.tipo_respuesta)).all()

        preguntas_data = []
        for p in preguntas:
            preguntas_data.append({
                "id_pregunta": p.id_pregunta,
                "texto_pregunta": p.texto_pregunta,
                "tipo_respuesta": p.tipo_respuesta.nombre_tipo,
                "opciones_respuesta_json": p.opciones_respuesta_json
            })

        return jsonify({"preguntas": preguntas_data}), 200

    except Exception as e:
        print(f"Error al obtener preguntas para análisis: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/formularios/<int:form_id>/respuestas/analytics', methods=['GET'])
@jwt_required()
def get_responses_for_analytics(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        question_id = request.args.get('question_id', type=int)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not question_id:
             return jsonify({"data": [], "chart_type": "none", "message": "Selecciona una pregunta para ver el gráfico."}), 200

        pregunta = Pregunta.query.get(question_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        selected_question_type = pregunta.tipo_respuesta.nombre_tipo
        
        query = Respuesta.query.join(EnvioFormulario).\
            filter(Respuesta.id_pregunta == question_id).\
            filter(EnvioFormulario.id_formulario == form_id).\
            join(Usuario, EnvioFormulario.id_usuario == Usuario.id_usuario).\
            filter(Usuario.id_empresa == usuario.id_empresa)
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(EnvioFormulario.fecha_hora_envio >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(EnvioFormulario.fecha_hora_envio < (end_date + timedelta(days=1)))

        results = query.all()

        if not results:
            return jsonify({"data": [], "chart_type": "none", "message": "No hay datos para mostrar el gráfico con los filtros seleccionados."}), 200

        chart_data = []
        chart_type = "none"

        if selected_question_type == 'booleano':
            true_count = sum(1 for r in results if r.valor_booleano is True)
            false_count = sum(1 for r in results if r.valor_booleano is False)
            chart_data = [
                {"name": "Sí", "value": true_count},
                {"name": "No", "value": false_count}
            ]
            chart_type = "pie"
        elif selected_question_type == 'numerico':
            numeric_values = [r.valor_numerico for r in results if r.valor_numerico is not None]
            if numeric_values:
                min_val = min(numeric_values)
                max_val = max(numeric_values)
                
                if min_val == max_val:
                    chart_data = [{"name": str(min_val), "value": len(numeric_values)}]
                else:
                    num_bins = 5 
                    bin_width = (max_val - min_val) / num_bins
                    bins = [0] * num_bins
                    
                    for val in numeric_values:
                        if val == max_val: 
                            bin_index = num_bins - 1
                        else:
                            bin_index = int((val - min_val) / bin_width)
                        bins[bin_index] += 1
                    
                    for i in range(num_bins):
                        lower_bound = round(min_val + i * bin_width, 2)
                        upper_bound = round(min_val + (i + 1) * bin_width, 2)
                        chart_data.append({"name": f"{lower_bound}-{upper_bound}", "value": bins[i]})
                chart_type = "bar" 
            else:
                chart_data = []
        elif selected_question_type == 'seleccion_unica':
            counts = Counter()
            for r in results:
                if r.valor_texto: 
                    counts[r.valor_texto] += 1
            chart_data = [{"name": item, "value": count} for item, count in counts.items()]
            chart_type = "pie"
        elif selected_question_type == 'seleccion_multiple':
            counts = Counter()
            for r in results:
                if r.valores_multiples_json:
                    try:
                        selected_options = json.loads(r.valores_multiples_json)
                        if isinstance(selected_options, list):
                            for option in selected_options:
                                counts[str(option)] += 1
                        elif isinstance(selected_options, (int, str)):
                            counts[str(selected_options)] += 1
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"Error parsing valores_multiples_json for multi selection: {r.valores_multiples_json} - {e}")
                        pass
            chart_data = [{"name": item, "value": count} for item, count in counts.items()]
            chart_type = "bar"
        elif selected_question_type == 'seleccion_recursos':
            counts = Counter()
            empresa_id_actual = usuario.id_empresa
            
            all_espacios = {e.id_espacio: e.nombre_espacio for e in Espacio.query.filter_by(id_empresa=empresa_id_actual).all()}
            all_subespacios = {s.id_subespacio: s.nombre_subespacio for s in SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == empresa_id_actual).all()}
            all_objetos = {o.id_objeto: o.nombre_objeto for o in Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == empresa_id_actual).all()}
            resource_names_map = {**all_espacios, **all_subespacios, **all_objetos}

            for r in results:
                if r.valores_multiples_json:
                    try:
                        selected_options = json.loads(r.valores_multiples_json)
                        if isinstance(selected_options, list):
                            for option_id in selected_options:
                                name = resource_names_map.get(int(option_id), None)
                                if name:
                                    counts[name] += 1
                        elif isinstance(selected_options, (int, str)):
                            name = resource_names_map.get(int(selected_options), None)
                            if name:
                                counts[name] += 1
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"Error parsing valores_multiples_json for resource selection: {r.valores_multiples_json} - {e}")
                        pass
            
            chart_data = [{"name": item, "value": count} for item, count in counts.items()]
            chart_type = "bar"
        # CORRECCIÓN: Agregar 'texto' a la lista de tipos de respuesta para tablas de texto
        elif selected_question_type in ['texto', 'texto_corto', 'texto_largo', 'fecha', 'hora']:
            chart_data = [
                {"id": r.id_respuesta, "value": r.valor_texto}
                for r in results
            ]
            chart_type = "table_text"
        elif selected_question_type in ['firma', 'dibujo']:
            chart_data = [
                {"id": r.id_respuesta, "value": r.valor_texto}
                for r in results if r.valor_texto
            ]
            chart_type = "table_image"
        
        return jsonify({"data": chart_data, "chart_type": chart_type, "message": "Datos de gráfico generados exitosamente."}), 200

    except Exception as e:
        print(f"Error al obtener datos de análisis: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# Función auxiliar para extraer el public_id de la URL de Cloudinary
def get_public_id_from_url(url):
    """Extrae el public_id de una URL de Cloudinary."""
    # La URL completa es algo como: https://res.cloudinary.com/.../raw/upload/v12345678/mi_archivo.pdf
    # El public_id es 'mi_archivo'
    if '/upload/' in url:
        return url.split('/')[-1].split('.')[0]
    return None

# --- Rutas para la gestión de categorías ---

@api.route('/documentos-categorias', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def create_documento_categoria():
    """
    Endpoint para crear una nueva categoría de documento.
    """
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')

    if not nombre or nombre.strip() == "":
        return jsonify({"error": "El nombre de la categoría es obligatorio."}), 400

    existing_category = DocumentoCategoria.query.filter_by(nombre=nombre).first()
    if existing_category:
        return jsonify({"error": "Ya existe una categoría con este nombre."}), 409

    try:
        nueva_categoria = DocumentoCategoria(
            nombre=nombre,
            descripcion=descripcion
        )
        db.session.add(nueva_categoria)
        db.session.commit()
        return jsonify({
            "message": "Categoría creada exitosamente.",
            "categoria": nueva_categoria.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al crear la categoría: {str(e)}")
        return jsonify({"error": "Error interno del servidor."}), 500


@api.route('/documentos-categorias/<int:categoria_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_documento_categoria(categoria_id):
    """
    Borra una categoría y todos los documentos asociados a ella,
    incluyendo los archivos de Cloudinary.
    """
    try:
        categoria = DocumentoCategoria.query.get(categoria_id)

        if not categoria:
            return jsonify({"error": "Categoría no encontrada."}), 404

        # Eliminar los archivos de Cloudinary y los registros de los documentos
        for documento in categoria.documentos:
            try:
                # Extraer el public_id del archivo para Cloudinary
                public_id = get_public_id_from_url(documento.url_archivo)
                if public_id:
                    # 'raw' es el tipo de recurso que usamos para los PDF
                    cloudinary.uploader.destroy(public_id, resource_type="raw")
                
                db.session.delete(documento)
            except Exception as e:
                # Si hay un error con Cloudinary, lo registramos pero continuamos
                print(f"Error al eliminar el archivo de Cloudinary para el documento {documento.id}: {str(e)}")
                # A pesar del error en Cloudinary, borramos el registro de la DB
                db.session.delete(documento)

        db.session.commit() # Confirmar la eliminación de los documentos

        # Finalmente, eliminar la categoría de la base de datos
        db.session.delete(categoria)
        db.session.commit()
        
        return jsonify({"message": f"Categoría '{categoria.nombre}' y todos sus documentos eliminados exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar la categoría y sus documentos: {str(e)}")
        return jsonify({"error": f"Error interno del servidor al eliminar la categoría: {str(e)}"}), 500

# --- Rutas para la gestión de documentos del ministerio (actualizadas) ---

# --- Rutas para la gestión de documentos del ministerio (actualizadas) ---
# --- RUTA PARA SUBIR DOCUMENTOS PDF ---
@api.route('/documentos-ministerio/upload-pdf', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def upload_pdf():
    """Sube un documento PDF."""
    current_user_id = get_jwt_identity()

    if 'documento_pdf' not in request.files:
        return jsonify({"error": "No se adjuntó el archivo PDF."}), 400

    documento_pdf = request.files['documento_pdf']
    titulo = request.form.get('titulo')
    categoria_id = request.form.get('categoria_id')

    # Validaciones
    if not titulo or titulo.strip() == "":
        return jsonify({"error": "El título del documento es obligatorio."}), 400
    if not categoria_id:
        return jsonify({"error": "La categoría del documento es obligatoria."}), 400
    if documento_pdf.content_type != 'application/pdf':
        return jsonify({"error": "Solo se permiten archivos PDF."}), 400
    
    try:
        categoria = DocumentoCategoria.query.get(int(categoria_id))
        if not categoria:
            return jsonify({"error": "La categoría seleccionada no existe."}), 404

        # Subir el documento a Cloudinary
        upload_result = cloudinary.uploader.upload(documento_pdf, resource_type="raw")
        url_documento = upload_result['secure_url']

        # Crear nuevo registro en la base de datos
        nuevo_documento = DocumentosMinisterio(
            nombre=titulo,
            url_archivo=url_documento,
            fecha_subida=datetime.utcnow(),
            user_id=int(current_user_id),
            categoria_id=int(categoria_id),
            tipo_contenido='pdf'  # Tipo de contenido fijo
        )
        db.session.add(nuevo_documento)
        db.session.commit()

        return jsonify({
            "message": "PDF subido y card creada exitosamente.",
            "documento": nuevo_documento.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al subir el PDF: {str(e)}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# --- RUTA PARA SUBIR LINKS ---
@api.route('/documentos-ministerio/upload-link', methods=['POST'])
@role_required(['owner', 'admin_empresa'])
def upload_link():
    """Sube un documento como un link (URL)."""
    current_user_id = get_jwt_identity()

    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos JSON."}), 400

    titulo = data.get('titulo')
    categoria_id = data.get('categoria_id')
    url_archivo = data.get('url_archivo')

    # Validaciones
    if not titulo or titulo.strip() == "":
        return jsonify({"error": "El título del documento es obligatorio."}), 400
    if not categoria_id:
        return jsonify({"error": "La categoría del documento es obligatoria."}), 400
    if not url_archivo or url_archivo.strip() == "":
        return jsonify({"error": "La URL del documento es obligatoria."}), 400
    
    try:
        categoria = DocumentoCategoria.query.get(int(categoria_id))
        if not categoria:
            return jsonify({"error": "La categoría seleccionada no existe."}), 404

        # Crear nuevo registro en la base de datos
        nuevo_documento = DocumentosMinisterio(
            nombre=titulo,
            url_archivo=url_archivo,
            fecha_subida=datetime.utcnow(),
            user_id=int(current_user_id),
            categoria_id=int(categoria_id),
            tipo_contenido='link'  # Tipo de contenido fijo
        )
        db.session.add(nuevo_documento)
        db.session.commit()

        return jsonify({
            "message": "Link subido y card creada exitosamente.",
            "documento": nuevo_documento.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al subir el link: {str(e)}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
@api.route('/documentos-ministerio', methods=['GET'])
@jwt_required()
def get_all_documentos_ministerio_with_categories():
    """
    Devuelve la lista de todas las categorías, con sus documentos anidados.
    """
    try:
        categorias = DocumentoCategoria.query.all()
        lista_categorias = [cat.serialize() for cat in categorias]

        return jsonify({
            "categorias": lista_categorias
        }), 200
    except Exception as e:
        print(f"Error al obtener las categorías y documentos: {str(e)}")
        return jsonify({"error": "Error interno del servidor."}), 500


@api.route('/documentos-ministerio/<int:documento_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa'])
def delete_documento_ministerio(documento_id):
    """
    Borra un documento específico de la base de datos y de Cloudinary.
    """
    try:
        documento = DocumentosMinisterio.query.get(documento_id)

        if not documento:
            return jsonify({"error": "Documento no encontrado."}), 404

        # Eliminar el archivo de Cloudinary
        public_id = get_public_id_from_url(documento.url_archivo)
        if public_id:
            try:
                cloudinary.uploader.destroy(public_id, resource_type="raw")
            except Exception as e:
                print(f"Advertencia: No se pudo eliminar el archivo de Cloudinary. {str(e)}")

        # Eliminar el registro de la base de datos
        db.session.delete(documento)
        db.session.commit()

        return jsonify({"message": "Documento eliminado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar el documento: {str(e)}")
        return jsonify({"error": f"Error interno del servidor al eliminar el documento: {str(e)}"}), 500




# --- NUEVA RUTA PARA OBTENER ENVIOS POR ID DE FORMULARIO ---
@api.route('/formularios/<int:form_id>/envios', methods=['GET'])
@jwt_required()
def get_envios_by_form(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        if not usuario:
            return jsonify({"error": "Usuario no encontrado."}), 404

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Obtener el parámetro 'limit' de la URL, si no existe, usar un valor por defecto
        # En este caso, el valor por defecto es None para obtener todos los envíos si no se especifica.
        # Si se usa en el frontend, el valor debería ser 9.
        limit_str = request.args.get('limit')
        limit = int(limit_str) if limit_str and limit_str.isdigit() else None
        
        # Control de acceso: el usuario debe tener permisos para ver este formulario
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario.es_plantilla:
                if formulario.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este formulario."}), 403

        query = EnvioFormulario.query

        # Si es un usuario de formulario, solo puede ver sus propios envíos
        if usuario.rol == 'usuario_formulario':
            query = query.filter_by(id_formulario=form_id, id_usuario=usuario.id_usuario)
        else:
            # Para 'owner' y 'admin_empresa', se filtran los envíos según la empresa del usuario que diligenció el formulario
            query = query.join(Usuario).filter(
                EnvioFormulario.id_formulario == form_id,
                Usuario.id_empresa == usuario.id_empresa
            )

        # Ordenar por fecha_hora_envio de forma descendente y aplicar el límite
        query = query.order_by(db.desc(EnvioFormulario.fecha_hora_envio))
        if limit is not None:
            query = query.limit(limit)

        envios = query.all()

        envios_data = []
        for envio in envios:
            usuario_envio = Usuario.query.get(envio.id_usuario)
            envios_data.append({
                "id_envio": envio.id_envio,
                "fecha_hora_envio": envio.fecha_hora_envio.isoformat(),
                "nombre_usuario": usuario_envio.nombre_completo if usuario_envio else 'N/A'
            })

        return jsonify({"envios": envios_data}), 200

    except Exception as e:
        print(f"Error al obtener envíos para el formulario {form_id}: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
# --- Proceso de NUEVA FUNCION ---------------------------------------------------    

# --- Funciones Auxiliares para el Proceso de Recibos (Asumimos la existencia de los modelos) ---

def get_current_user_company_id(user_id):
    """Obtiene el ID de la empresa del usuario actual (Placeholder)."""
    # Lógica real: usuario = Usuario.query.get(user_id); return usuario.id_empresa
    usuario = Usuario.query.get(user_id)
    return usuario.id_empresa if usuario else None

# --- CRUD: Grados ---

@api.route('/grados', methods=['POST'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def create_grado():
    """Crea un nuevo grado asociado a la empresa del usuario."""
    data = request.get_json()
    nombre_grado = data.get('nombre') # El usuario envía 'nombre', se mapea al atributo nombre_grado
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not nombre_grado or not id_empresa:
        return jsonify({"error": "Nombre del grado y empresa son requeridos."}), 400

    try:
        nuevo_grado = Grado(
            nombre_grado=nombre_grado,
            id_empresa=id_empresa
            # Orden y activo usarán los defaults del modelo
        )
        db.session.add(nuevo_grado)
        db.session.commit()
        # Nota: La serialización debe usar el campo nombre_grado del modelo
        return jsonify({"message": "Grado creado exitosamente.", "grado": nuevo_grado.serialize()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al crear el grado: {str(e)}"}), 500

@api.route('/grados', methods=['GET'])
@jwt_required()
def get_all_grados():
    """Obtiene todos los grados asociados a la empresa del usuario."""
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404

    # Filtra solo los grados activos
    grados = Grado.query.filter_by(id_empresa=id_empresa, activo=True).order_by(Grado.orden).all()
    return jsonify({"grados": [g.serialize() for g in grados]}), 200

@api.route('/grados/<int:grado_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa','usuario_formulario'])
def update_grado(grado_id):
    """Actualiza un grado existente."""
    data = request.get_json()
    nombre_grado = data.get('nombre') # El usuario envía 'nombre', se mapea al atributo nombre_grado
    orden = data.get('orden')
    activo = data.get('activo')
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        grado = Grado.query.get(grado_id)

        if not grado:
            return jsonify({"error": "Grado no encontrado."}), 404
        
        if grado.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para editar este grado."}), 403

        if nombre_grado:
            if not nombre_grado.strip():
                return jsonify({"error": "El nombre del grado no puede estar vacío."}), 400
            grado.nombre_grado = nombre_grado
        
        if orden is not None:
             try:
                 grado.orden = int(orden)
             except ValueError:
                 return jsonify({"error": "El orden debe ser un número entero válido."}), 400

        if activo is not None:
             grado.activo = bool(activo)
        
        db.session.commit()
        return jsonify({"message": "Grado actualizado exitosamente.", "grado": grado.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al actualizar el grado: {str(e)}"}), 500

@api.route('/grados/<int:grado_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def delete_grado(grado_id):
    """
    Desactiva o elimina un grado existente. 
    Se prefiere desactivar si hay dependencias, o eliminar si no las hay.
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        grado = Grado.query.get(grado_id)

        if not grado:
            return jsonify({"error": "Grado no encontrado."}), 404
        
        if grado.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para eliminar este grado."}), 403
        
        # Validación de dependencias: No se puede eliminar si hay estudiantes asociados
        estudiantes_asociados = Estudiante.query.filter_by(id_grado=grado_id, activo=True).first()
        if estudiantes_asociados:
            # Si hay estudiantes activos, se recomienda solo desactivar el grado
            grado.activo = False
            db.session.commit()
            return jsonify({"message": f"Grado '{grado.nombre_grado}' desactivado exitosamente (hay estudiantes activos asociados).", "grado": grado.serialize()}), 200

        # Si no hay dependencias activas, se puede eliminar (o desactivar si es la política)
        db.session.delete(grado)
        db.session.commit()
        return jsonify({"message": f"Grado '{grado.nombre_grado}' eliminado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al eliminar el grado: {str(e)}"}), 500


# --- CRUD: Conceptos ---

@api.route('/conceptos', methods=['POST'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def create_concepto():
    """Crea un nuevo concepto (ítem de cobro) asociado a la empresa."""
    data = request.get_json()
    nombre = data.get('nombre') # Nombre que envía el usuario, se mapea a nombre_concepto
    valor = data.get('valor')   # Valor que envía el usuario, se mapea a valor_base
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not nombre or valor is None or not id_empresa:
        return jsonify({"error": "Nombre, valor y empresa son requeridos."}), 400
    
    try:
        nuevo_concepto = Concepto(
            nombre_concepto=nombre,
            valor_base=float(valor),
            id_empresa=id_empresa,
            # activo usa el default
        )
        db.session.add(nuevo_concepto)
        db.session.commit()
        # Nota: La serialización debe usar el campo nombre_concepto y valor_base
        return jsonify({"message": "Concepto creado exitosamente.", "concepto": nuevo_concepto.serialize()}), 201
    except ValueError:
        return jsonify({"error": "El valor debe ser un número válido."}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al crear el concepto: {str(e)}"}), 500

@api.route('/conceptos', methods=['GET'])
@jwt_required()
def get_all_conceptos():
    """Obtiene todos los conceptos activos asociados a la empresa del usuario."""
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404

    conceptos = Concepto.query.filter_by(id_empresa=id_empresa, activo=True).all()
    return jsonify({"conceptos": [c.serialize() for c in conceptos]}), 200

@api.route('/conceptos/<int:concepto_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def update_concepto(concepto_id):
    """Actualiza un concepto existente."""
    data = request.get_json()
    nombre = data.get('nombre') # Mapea a nombre_concepto
    valor = data.get('valor')   # Mapea a valor_base
    activo = data.get('activo')
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        concepto = Concepto.query.get(concepto_id)

        if not concepto:
            return jsonify({"error": "Concepto no encontrado."}), 404
        
        if concepto.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para editar este concepto."}), 403

        if nombre:
            if not nombre.strip():
                 return jsonify({"error": "El nombre del concepto no puede estar vacío."}), 400
            concepto.nombre_concepto = nombre
        
        if valor is not None:
            try:
                concepto.valor_base = float(valor)
            except ValueError:
                return jsonify({"error": "El valor debe ser un número válido."}), 400

        if activo is not None:
            concepto.activo = bool(activo)
        
        db.session.commit()
        return jsonify({"message": "Concepto actualizado exitosamente.", "concepto": concepto.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al actualizar el concepto: {str(e)}"}), 500

@api.route('/conceptos/<int:concepto_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def delete_concepto(concepto_id):
    """
    Desactiva o elimina un concepto existente. 
    Se prefiere desactivar si tiene detalles de recibos asociados (histórico).
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        concepto = Concepto.query.get(concepto_id)

        if not concepto:
            return jsonify({"error": "Concepto no encontrado."}), 404
        
        if concepto.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para eliminar este concepto."}), 403
        
        # Validación de dependencias: No se puede eliminar si ya tiene recibos asociados
        # Usamos DetalleRecibo, el nuevo nombre de la tabla de detalles
        detalles_asociados = DetalleRecibo.query.filter_by(id_concepto=concepto_id).first()
        if detalles_asociados:
            # Si hay movimientos, solo se desactiva
            concepto.activo = False
            db.session.commit()
            return jsonify({"message": f"Concepto '{concepto.nombre_concepto}' desactivado exitosamente (tiene movimientos históricos).", "concepto": concepto.serialize()}), 200

        # Si no hay dependencias, se elimina
        db.session.delete(concepto)
        db.session.commit()
        return jsonify({"message": f"Concepto '{concepto.nombre_concepto}' eliminado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al eliminar el concepto: {str(e)}"}), 500


# --- CRUD: Estudiantes ---

@api.route('/estudiantes', methods=['POST'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def create_estudiante():
    """Crea un nuevo estudiante asociado a un grado y la empresa."""
    data = request.get_json()
    nombre_completo = data.get('nombre') # Mapea a nombre_completo
    grado_id = data.get('grado_id')
    correo_responsable = data.get('email') # Mapea a correo_responsable

    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not nombre_completo or not grado_id or not id_empresa:
        return jsonify({"error": "Nombre, Grado ID y empresa son requeridos."}), 400

    grado = Grado.query.get(grado_id)
    if not grado or grado.id_empresa != id_empresa:
        return jsonify({"error": "Grado no encontrado o no pertenece a tu empresa."}), 404
    
    try:
        nuevo_estudiante = Estudiante(
            nombre_completo=nombre_completo,
            id_grado=grado_id,
            id_empresa=id_empresa,
            correo_responsable=correo_responsable
        )
        db.session.add(nuevo_estudiante)
        db.session.commit()
        # Nota: La serialización debe usar nombre_completo y correo_responsable
        return jsonify({"message": "Estudiante creado exitosamente.", "estudiante": nuevo_estudiante.serialize()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al crear el estudiante: {str(e)}"}), 500

@api.route('/estudiantes', methods=['GET'])
@jwt_required()
def get_all_estudiantes():
    """Obtiene todos los estudiantes activos asociados a la empresa (con filtro opcional por grado)."""
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)
    grado_id = request.args.get('grado_id', type=int)

    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404

    query = Estudiante.query.filter_by(id_empresa=id_empresa, activo=True)
    if grado_id:
        query = query.filter_by(id_grado=grado_id)

    estudiantes = query.all()
    return jsonify({"estudiantes": [e.serialize() for e in estudiantes]}), 200

@api.route('/estudiantes/<int:student_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def update_estudiante(student_id):
    """Actualiza un estudiante existente."""
    data = request.get_json()
    nombre = data.get('nombre') # Mapea a nombre_completo
    grado_id = data.get('grado_id')
    email = data.get('email')   # Mapea a correo_responsable
    activo = data.get('activo')
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        estudiante = Estudiante.query.get(student_id)

        if not estudiante:
            return jsonify({"error": "Estudiante no encontrado."}), 404
        
        if estudiante.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para editar este estudiante."}), 403

        if nombre:
            if not nombre.strip():
                 return jsonify({"error": "El nombre del estudiante no puede estar vacío."}), 400
            estudiante.nombre_completo = nombre
        
        if email is not None:
            estudiante.correo_responsable = email

        if activo is not None:
            estudiante.activo = bool(activo)

        if grado_id is not None:
            grado = Grado.query.get(grado_id)
            if not grado or grado.id_empresa != id_empresa:
                return jsonify({"error": "Grado no encontrado o no pertenece a tu empresa."}), 404
            estudiante.id_grado = grado_id
        
        db.session.commit()
        return jsonify({"message": "Estudiante actualizado exitosamente.", "estudiante": estudiante.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al actualizar el estudiante: {str(e)}"}), 500

@api.route('/estudiantes/<int:student_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def delete_estudiante(student_id):
    """
    Desactiva o elimina un estudiante existente. 
    Se prefiere desactivar si ya tiene recibos asociados (histórico).
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    try:
        estudiante = Estudiante.query.get(student_id)

        if not estudiante:
            return jsonify({"error": "Estudiante no encontrado."}), 404
        
        if estudiante.id_empresa != id_empresa:
            return jsonify({"error": "No tienes permisos para eliminar este estudiante."}), 403
        
        # Validación de dependencias: No se puede eliminar si ya tiene recibos asociados
        # Usamos DetalleRecibo, el nuevo nombre de la tabla de detalles
        detalles_asociados = DetalleRecibo.query.filter_by(id_estudiante=student_id).first()
        if detalles_asociados:
            # Si hay movimientos, solo se desactiva
            estudiante.activo = False
            db.session.commit()
            return jsonify({"message": f"Estudiante '{estudiante.nombre_completo}' desactivado exitosamente (tiene movimientos históricos).", "estudiante": estudiante.serialize()}), 200


        # Si no hay dependencias, se elimina
        db.session.delete(estudiante)
        db.session.commit()
        return jsonify({"message": f"Estudiante '{estudiante.nombre_completo}' eliminado exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al eliminar el estudiante: {str(e)}"}), 500


# --- Proceso de Recibo (Venta) ---

# --- FUNCIÓN AUXILIAR PARA EL ENVÍO ASÍNCRONO (DEBE ESTAR AL INICIO) ---

def send_async_email(app, msg):
    """
    Envía correo dentro del contexto Flask-Mail.
    Captura errores SMTP y los imprime para Render.
    """
    with app.app_context():
        mail_sender = app.extensions.get('mail')
        try:
            mail_sender.send(msg)
            print(f"✅ Correo ASÍNCRONO enviado con éxito a: {msg.recipients}")
        except Exception as e:
            import traceback
            print(f"🛑 ERROR CRÍTICO DE CORREO (SMTP/RENDER): {type(e).__name__} | {str(e)}")
            traceback.print_exc()  # <-- esto muestra la traza completa


# URL del logo que solicitaste.
LOGO_URL = "https://i.pinimg.com/736x/44/12/e9/4412e9bdd73724a178b18295e4ba921e.jpg"

@api.route('/recibos/envio', methods=['POST'])
@jwt_required()
def submit_recibo():
    """
    Registra una nueva TransaccionRecibo (venta/abono) y sus detalles.
    Añade el envío de un correo de recibo de forma ASÍNCRONA si el tipo de pago es 'Total' o 'Abono'.
    """
    data = request.get_json()
    detalles_data = data.get('detalles', [])
    observaciones = data.get('observaciones')
    tipo_pago = data.get('tipo_pago', 'Total') 
    monto_pagado = data.get('monto_pagado', 0.0)
    
    try:
        monto_pagado = float(monto_pagado)
    except (TypeError, ValueError):
        return jsonify({"error": "Monto pagado debe ser un número válido."}), 400

    current_user_id = get_jwt_identity()
    # Asume que esta función y modelos están disponibles globalmente o importados
    id_empresa = get_current_user_company_id(current_user_id) 
    current_user = Usuario.query.get(current_user_id)
    empresa_instance = Empresa.query.get(id_empresa)
    empresa_nombre = empresa_instance.nombre_empresa

    if not detalles_data or not id_empresa:
        return jsonify({"error": "Detalles del recibo y empresa son requeridos."}), 400

    try:
        total_recibo = 0.0
        items_email = []
        recipient_emails = set()
        
        # 1. Pre-cálculo y Validación
        for item in detalles_data:
            
            concepto_id = item.get('concepto_id')
            student_id = item.get('student_id')
            cantidad = item.get('cantidad', 1)
            
            concepto = Concepto.query.get(concepto_id)
            estudiante = Estudiante.query.get(student_id)

            if not concepto or concepto.id_empresa != id_empresa or \
               not estudiante or estudiante.id_empresa != id_empresa:
                db.session.rollback()
                return jsonify({"error": "Concepto o estudiante inválido para esta empresa."}), 400
            
            valor_base = concepto.valor_base 
            subtotal = valor_base * cantidad
            total_recibo += subtotal 
            
            # Reutilizamos las instancias para el paso 2
            item['concepto_instance'] = concepto
            item['estudiante_instance'] = estudiante
            item['valor_base'] = valor_base
            item['subtotal'] = subtotal
            
        # 2. Cálculo del Saldo Pendiente
        monto_pagado_ajustado = min(monto_pagado, total_recibo)
        saldo_pendiente = total_recibo - monto_pagado_ajustado

        # 3. Crear el Encabezado de la Transacción (TransaccionRecibo)
        nueva_transaccion = TransaccionRecibo(
            id_usuario_creador=int(current_user_id),
            id_empresa=id_empresa,
            fecha_transaccion=datetime.utcnow(),
            observaciones=observaciones,
            tipo_pago=tipo_pago,
            total_recibo=total_recibo,         # Costo Total del recibo
            monto_pagado=monto_pagado_ajustado, # Monto pagado en esta transacción
            saldo_pendiente=saldo_pendiente    # Saldo restante
        )
        db.session.add(nueva_transaccion)
        db.session.flush()

        # 4. Procesar los Detalles (DetalleRecibo)
        for item in detalles_data:
            concepto = item['concepto_instance']
            estudiante = item['estudiante_instance']
            valor_base = item['valor_base']
            subtotal = item['subtotal']
            
            # Asumiendo que Estudiante.grado es un objeto con un atributo nombre_grado
            if not getattr(estudiante, 'grado', None):
                db.session.rollback()
                return jsonify({"error": "Estudiante sin grado asociado."}), 400
            
            nuevo_detalle = DetalleRecibo( 
                id_transaccion=nueva_transaccion.id_transaccion,
                id_concepto=concepto.id_concepto,
                id_estudiante=estudiante.id_estudiante,
                cantidad=item.get('cantidad', 1),
                valor_cobrado=valor_base,
            )
            db.session.add(nuevo_detalle)

            # Preparar datos para Email (Se recoge en el mismo loop)
            items_email.append({
                "concepto": concepto.nombre_concepto,
                "estudiante": estudiante.nombre_completo,
                "grado": estudiante.grado.nombre_grado,
                "valor_unitario": valor_base,
                "cantidad": item.get('cantidad', 1),
                "subtotal": subtotal,
            })
            
            # Recoger correos únicos de responsables
            if estudiante.correo_responsable:
                recipient_emails.add(estudiante.correo_responsable)


        # 5. Commit de la Transacción
        # La transacción queda guardada en la base de datos aquí.
        db.session.commit()

        # 6. Lógica Condicional para Envío de Correo (CORRECCIÓN: Se activa para Total y Abono)
        if (tipo_pago == 'Total' or tipo_pago == 'Abono') and recipient_emails:
            try:
                recibo_id = nueva_transaccion.id_transaccion
                fecha_str = nueva_transaccion.fecha_transaccion.strftime('%d/%m/%Y %H:%M:%S')
                
                # Ajuste de títulos según el tipo de pago
                asunto_tipo = "Recibo de Pago Total" if tipo_pago == 'Total' else "Recibo de Abono"
                confirmacion_tipo = "el **pago total**" if tipo_pago == 'Total' else f"un **abono** de ${monto_pagado_ajustado:.2f}"

                # Generar las filas de la tabla de detalles
                tabla_filas = ""
                for item in items_email:
                    tabla_filas += f"""
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">{item['estudiante']} ({item['grado']})</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">{item['concepto']}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{item['cantidad']}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item['valor_unitario']:.2f}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${item['subtotal']:.2f}</td>
                    </tr>
                    """

                # Estructura HTML del correo con el logo y estilos
                html_content = f"""
                <html>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); overflow: hidden;">
                        
                        <div style="text-align: center; padding: 20px 0; background-color: #f8f8f8; border-bottom: 3px solid #007bff;">
                            <img src="{LOGO_URL}" 
                                 alt="{empresa_nombre} Logo" 
                                 style="max-width: 150px; height: auto; display: block; margin: 0 auto; border-radius: 5px;">
                            <h1 style="color: #333; font-size: 24px; margin-top: 10px;">{asunto_tipo}</h1>
                            <p style="color: #666; font-size: 14px;">{empresa_nombre}</p>
                        </div>
                        
                        <div style="padding: 20px;">
                            <p style="font-size: 16px; color: #333;">Hola estimado(a) responsable,</p>
                            <p style="color: #555;">Confirmamos {confirmacion_tipo} del siguiente recibo registrado por **{current_user.nombre_completo}**.</p>
                            
                            <div style="background-color: #e9ecef; padding: 10px; border-radius: 4px; margin-bottom: 20px;">
                                <p style="margin: 0; color: #333;"><strong>Transacción No:</strong> {recibo_id}</p>
                                <p style="margin: 5px 0 0 0; color: #333;"><strong>Fecha:</strong> {fecha_str}</p>
                            </div>

                            <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Detalles de Conceptos</h3>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                                <thead style="background-color: #007bff; color: white;">
                                    <tr>
                                        <th style="border: 1px solid #007bff; padding: 8px; text-align: left;">Estudiante / Grado</th>
                                        <th style="border: 1px solid #007bff; padding: 8px; text-align: left;">Concepto</th>
                                        <th style="border: 1px solid #007bff; padding: 8px; text-align: right;">Cant.</th>
                                        <th style="border: 1px solid #007bff; padding: 8px; text-align: right;">V. Unitario</th>
                                        <th style="border: 1px solid #007bff; padding: 8px; text-align: right;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tabla_filas}
                                    <tr>
                                        <td colspan="4" style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; background-color: #f0f0f0;">MONTO PAGADO:</td>
                                        <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; background-color: #f0f0f0; color: #28a745; font-size: 18px;">${monto_pagado_ajustado:.2f}</td>
                                    </tr>
                                    {f'''<tr>
                                        <td colspan="4" style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; background-color: #fff1f0;">SALDO PENDIENTE:</td>
                                        <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; background-color: #fff1f0; color: #cf1322; font-size: 18px;">${saldo_pendiente:.2f}</td>
                                    </tr>''' if tipo_pago == 'Abono' else ''}
                                </tbody>
                            </table>
                            
                            <p style="color: #555;">**Observaciones:** {observaciones if observaciones else 'N/A'}</p>
                        </div>
                        
                        <div style="background-color: #f8f8f8; padding: 15px; text-align: center; border-top: 1px solid #eee;">
                            <p style="font-size: 12px; color: #999; margin: 0;">Este es un recibo generado automáticamente. Gracias por tu pronto pago.</p>
                            <p style="font-size: 12px; color: #999; margin: 5px 0 0 0;">Por favor, no respondas a este correo.</p>
                        </div>

                    </div>
                </body>
                </html>
                """
                
                # Crear el objeto Message
                msg = Message(
                    f"{asunto_tipo} #{recibo_id} - {empresa_nombre}",
                    sender=(empresa_nombre, current_app.config['MAIL_USERNAME']), 
                    recipients=list(recipient_emails)
                )
                
                # Asignar el contenido HTML
                msg.html = html_content 
                
                # Versión de texto plano de respaldo
                msg.body = f"{asunto_tipo} #{recibo_id}.\nMonto Pagado: ${monto_pagado_ajustado:.2f}.\nConsulta la versión HTML para los detalles completos."

                # --- EL CAMBIO CLAVE: INICIAR EL HILO ASÍNCRONO ---
                app_context_object = current_app._get_current_object()
                
                Thread(
                    target=send_async_email, 
                    args=(app_context_object, msg)
                ).start()
                
                print(f"✅ Hilo de correo iniciado para: {recipient_emails}. Respondiendo inmediatamente al cliente.")

            except Exception as e:
                print(f"⚠️ Error al intentar iniciar hilo de correo de recibo: {str(e)}")
        
        # 7. Respuesta Final
        return jsonify({
            "message": "Recibo registrado exitosamente. El correo se está enviando en segundo plano.", 
            "recibo": nueva_transaccion.serialize(),
            "email_sent_async": (tipo_pago == 'Total' or tipo_pago == 'Abono') and bool(recipient_emails)
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR BACKEND: Error al registrar el recibo: {e}")
        return jsonify({"error": f"Error interno del servidor al registrar el recibo: {str(e)}"}), 500

# --- Proceso de Recibo (Edición/Actualización de Pago) ---

@api.route('/recibos/<int:recibo_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario']) # Solo usuarios con permiso pueden editar
def update_recibo(recibo_id):
    """
    Actualiza el monto pagado, tipo de pago u observaciones de un TransaccionRecibo existente.
    """
    data = request.get_json()
    observaciones = data.get('observaciones')
    tipo_pago = data.get('tipo_pago') 
    monto_pagado_nuevo = data.get('monto_pagado')
    
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404

    try:
        # 1. Buscar la transacción y verificar permisos
        transaccion = TransaccionRecibo.query.filter_by(
            id_transaccion=recibo_id, 
            id_empresa=id_empresa
        ).first()

        if not transaccion:
            return jsonify({"error": "Recibo no encontrado o no pertenece a la empresa."}), 404

        # 2. Validar y ajustar el nuevo monto pagado
        if monto_pagado_nuevo is not None:
            try:
                monto_pagado_nuevo = float(monto_pagado_nuevo)
            except (TypeError, ValueError):
                return jsonify({"error": "Monto pagado debe ser un número válido."}), 400
            
            # El monto pagado nuevo no puede exceder el total del recibo
            monto_pagado_ajustado = min(monto_pagado_nuevo, transaccion.total_recibo)
            
            # Recalcular saldo pendiente
            saldo_pendiente_nuevo = transaccion.total_recibo - monto_pagado_ajustado

            transaccion.monto_pagado = monto_pagado_ajustado
            transaccion.saldo_pendiente = saldo_pendiente_nuevo
            # Si usas esta columna, asegúrate de que exista en tu modelo:
            # transaccion.fecha_ultima_actualizacion = datetime.utcnow() 

        # 3. Actualizar otros campos si son proporcionados
        if observaciones is not None:
            transaccion.observaciones = observaciones
        
        if tipo_pago is not None:
            transaccion.tipo_pago = tipo_pago
            
        db.session.commit()

        return jsonify({
            "message": "Recibo actualizado exitosamente.", 
            "recibo": transaccion.serialize()
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"ERROR BACKEND: Error al actualizar el recibo {recibo_id}: {e}")
        # Se devuelve el error específico para el diagnóstico en el frontend/logs
        return jsonify({"error": f"Error interno del servidor al actualizar el recibo: {str(e)}"}), 500


# ------------------------------------------------------------------
# --- Proceso de Recibo (ANULACIÓN FÍSICA / HARD DELETE) CON NOTIFICACIÓN ---
# ------------------------------------------------------------------

@api.route('/recibos/anular/<int:recibo_id>', methods=['DELETE'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario']) 
def anular_recibo(recibo_id):
    """
    Realiza la ELIMINACIÓN FÍSICA del recibo y envía un correo de notificación
    a los responsables antes de borrar los datos.
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)

    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404

    try:
        # 1. Buscar la transacción
        transaccion = TransaccionRecibo.query.filter_by(
            id_transaccion=recibo_id, 
            id_empresa=id_empresa
        ).first()

        if not transaccion:
            return jsonify({"error": "Recibo no encontrado o no pertenece a la empresa."}), 404

        # --- LOGICA DE NOTIFICACIÓN (ANTES DE ELIMINAR) ---
        recipient_emails = set()
        nombre_empresa = Empresa.query.get(id_empresa).nombre_empresa
        
        # Obtener los correos de los estudiantes involucrados en este recibo
        for detalle in transaccion.detalles:
            if detalle.estudiante and detalle.estudiante.correo_responsable:
                recipient_emails.add(detalle.estudiante.correo_responsable)

        if recipient_emails:
            try:
                # Construir el mensaje de anulación
                msg = Message(
                    f"ANULACIÓN de Recibo #{recibo_id} - {nombre_empresa}",
                    sender=(nombre_empresa, current_app.config['MAIL_USERNAME']),
                    recipients=list(recipient_emails)
                )
                
                html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
                        <div style="text-align: center; padding: 20px; background-color: #dc3545; color: white;">
                            <h1 style="margin: 0; font-size: 22px;">Aviso de Anulación de Recibo</h1>
                        </div>
                        <div style="padding: 20px; color: #333; line-height: 1.6;">
                            <p>Estimado(a) responsable,</p>
                            <p>Le informamos que el recibo con <strong>ID #{recibo_id}</strong>, emitido anteriormente por <strong>{nombre_empresa}</strong>, ha sido <strong>ANULADO</strong> en nuestro sistema.</p>
                            
                            <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Motivos posibles:</strong></p>
                                <ul style="margin-top: 5px;">
                                    <li>Error en la digitación de costos o conceptos.</li>
                                    <li>Actualización de la información del estudiante.</li>
                                </ul>
                            </div>

                            <p><strong>¿Qué debe hacer?</strong></p>
                            <p>Si la anulación se debió a un error de costos, pronto recibirá un nuevo recibo corregido. En caso de dudas, por favor diríjase a la oficina administrativa para aclarar la situación.</p>
                            
                            <p style="font-size: 13px; color: #666; margin-top: 30px;">
                                Fecha de anulación: {datetime.utcnow().strftime('%d/%m/%Y %H:%M:%S')} (UTC)
                            </p>
                        </div>
                        <div style="background-color: #f8f8f8; padding: 15px; text-align: center; font-size: 12px; color: #999;">
                            Este es un mensaje automático de {nombre_empresa}.
                        </div>
                    </div>
                </body>
                </html>
                """
                msg.html = html_content
                msg.body = f"El recibo #{recibo_id} ha sido anulado. Por favor diríjase a la oficina para más información."

                # Iniciar envío asíncrono
                app_context_object = current_app._get_current_object()
                Thread(target=send_async_email, args=(app_context_object, msg)).start()
                
            except Exception as email_err:
                print(f"⚠️ No se pudo enviar el correo de anulación: {str(email_err)}")

        # --- CONTINUAR CON EL BORRADO FÍSICO ---
        
        # 2. ELIMINACIÓN DE LOS DETALLES
        DetalleRecibo.query.filter_by(id_transaccion=recibo_id).delete()
        
        # 3. Eliminación de la Transacción Principal
        db.session.delete(transaccion)
        db.session.commit()

        return jsonify({
            "message": f"Recibo {recibo_id} anulado y notificación enviada.",
            "id_recibo_anulado": recibo_id
        }), 200

    except Exception as e:
        db.session.rollback()
        error_message = f"Error al anular el recibo: {str(e)}"
        print(f"ERROR: {error_message}")
        return jsonify({"error": error_message}), 500

@api.route('/recibos/analisis', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_recibos_analytics():
    """
    Genera un análisis de ventas (recibos) filtrado por rango de fechas y agrupado por concepto.
    Añadido cálculo del monto total pagado.
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)
    
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario."}), 404
        
    try:
        # Consulta base
        query = DetalleRecibo.query.join(TransaccionRecibo).\
            join(Concepto).filter(TransaccionRecibo.id_empresa == id_empresa)
            
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(TransaccionRecibo.fecha_transaccion >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(TransaccionRecibo.fecha_transaccion < (end_date + timedelta(days=1)))

        # Agrupar por Concepto (ID y Nombre)
        # Se necesita un JOIN adicional a TransaccionRecibo para obtener monto_pagado.
        # Al agrupar por detalle, el monto pagado se repite, por lo que lo agregaremos de forma independiente.
        
        # Primero, el análisis por costo (total_vendido)
        costo_query = query.with_entities(
            DetalleRecibo.id_concepto,
            Concepto.nombre_concepto,
            func.sum(DetalleRecibo.valor_cobrado * DetalleRecibo.cantidad).label('total_vendido'),
            func.count(DetalleRecibo.id_detalle).label('cantidad_transacciones')
        ).group_by(DetalleRecibo.id_concepto, Concepto.nombre_concepto).all()

        # Segundo, para el monto pagado (que es por transacción, no por detalle)
        # Para evitar sumar el monto_pagado múltiples veces por cada detalle, agrupamos por TransaccionRecibo.
        # Esta métrica es más difícil de agregar por concepto. La omitiremos del agrupamiento por concepto
        # para evitar complejizar el SQL, y solo mostraremos el costo total.
        # Si se desea el monto total pagado en el periodo, se consulta por separado:
        
        # Consulta para Total Pagado en el Periodo
        total_pagado_query = db.session.query(
            func.sum(TransaccionRecibo.monto_pagado).label('total_pagado_periodo')
        ).filter(TransaccionRecibo.id_empresa == id_empresa)
        
        if start_date_str:
             total_pagado_query = total_pagado_query.filter(TransaccionRecibo.fecha_transaccion >= start_date)
        if end_date_str:
            total_pagado_query = total_pagado_query.filter(TransaccionRecibo.fecha_transaccion < (end_date + timedelta(days=1)))

        total_pagado_result = total_pagado_query.scalar()
        total_pagado_periodo = float(total_pagado_result) if total_pagado_result else 0.0

        results = []
        for id_concepto, nombre_concepto, total_vendido, cantidad_transacciones in costo_query:
            results.append({
                "id_concepto": id_concepto,
                "concepto": nombre_concepto,
                "total_vendido": float(total_vendido),
                "cantidad_transacciones": int(cantidad_transacciones)
            })

        return jsonify({
            "analisis": results,
            "total_pagado_periodo": total_pagado_periodo # Nuevo resumen del total pagado
        }), 200

    except ValueError:
        return jsonify({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}), 400
    except Exception as e:
        print(f"ERROR BACKEND: Error al generar análisis de recibos: {e}")
        return jsonify({"error": f"Error interno del servidor al generar análisis: {str(e)}"}), 500

@api.route('/recibos/analisis/detalle', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_recibos_detalle_por_concepto():
    """
    Devuelve la lista detallada de recibos (nombre del estudiante, grado, total, etc.) 
    para un concepto específico dentro de un rango de fechas.
    Añadido 'monto_pagado' y 'saldo_pendiente' al detalle.
    """
    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)
    
    concepto_id = request.args.get('concepto_id', type=int)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    if not concepto_id or not id_empresa:
        return jsonify({"error": "Concepto ID y empresa son requeridos."}), 400

    try:
        # Se unen las tablas DetalleRecibo, TransaccionRecibo, Estudiante y Grado
        query = DetalleRecibo.query.join(TransaccionRecibo).\
            join(Estudiante, DetalleRecibo.id_estudiante == Estudiante.id_estudiante).\
            join(Grado, Estudiante.id_grado == Grado.id_grado).\
            join(Usuario, TransaccionRecibo.id_usuario_creador == Usuario.id_usuario).\
            filter(TransaccionRecibo.id_empresa == id_empresa, DetalleRecibo.id_concepto == concepto_id) 
            
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(TransaccionRecibo.fecha_transaccion >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(TransaccionRecibo.fecha_transaccion < (end_date + timedelta(days=1)))

        detalles = query.all()
        
        results = []
        for detalle in detalles:
            results.append({
                "id_recibo": detalle.id_transaccion,
                "fecha_recibo": detalle.transaccion.fecha_transaccion.isoformat(),
                "estudiante": detalle.estudiante.nombre_completo,
                "grado": detalle.estudiante.grado.nombre_grado,
                "valor_cobrado_unitario": detalle.valor_cobrado,
                "cantidad": detalle.cantidad,
                "subtotal_costo": detalle.valor_cobrado * detalle.cantidad, # Costo de la línea de detalle
                "costo_total_recibo": detalle.transaccion.total_recibo, # Costo Total de la Transacción
                "monto_pagado": detalle.transaccion.monto_pagado,       # Monto Pagado (Abono o Total)
                "saldo_pendiente": detalle.transaccion.saldo_pendiente, # Saldo Pendiente
                "tipo_pago": detalle.transaccion.tipo_pago,
                "usuario_registro": detalle.transaccion.usuario_creador.nombre_completo
            })

        return jsonify({"detalles": results}), 200

    except ValueError:
        return jsonify({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}), 400
    except Exception as e:
        print(f"ERROR BACKEND: Error al obtener detalles de recibos: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener detalles: {str(e)}"}), 500
    

@api.route('/estudiantes/carga-masiva', methods=['POST'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario']) # Roles que pueden subir estudiantes
@jwt_required()
def bulk_upload_students():
    """
    Carga masiva de estudiantes a partir de un array JSON.
    El JSON esperado es una lista de objetos: 
    [{ "nombre_completo": "...", "correo_responsable": "...", "nombre_grado": "..." }]
    """
    students_data = request.get_json()
    
    if not isinstance(students_data, list):
        return jsonify({"error": "El formato esperado es un array JSON de estudiantes."}), 400

    current_user_id = get_jwt_identity()
    id_empresa = get_current_user_company_id(current_user_id)
    
    if not id_empresa:
        return jsonify({"error": "Empresa no asociada al usuario autenticado."}), 404

    try:
        # Pre-carga todos los Grados de la empresa para mapeo rápido.
        # Esto reduce consultas a la BD dentro del loop
        grados_map = {
            g.nombre_grado.lower(): g.id_grado 
            for g in Grado.query.filter_by(id_empresa=id_empresa).all()
        }

        new_students = []
        errors = []
        students_added_count = 0

        for index, data in enumerate(students_data):
            try:
                # 1. Validación de datos obligatorios en el payload
                nombre_completo = data.get('nombre_completo')
                nombre_grado = data.get('nombre_grado') # Usado para buscar el id_grado
                
                if not nombre_completo:
                    raise ValueError("Falta el campo obligatorio 'nombre_completo'.")
                
                if not nombre_grado:
                    raise ValueError("Falta el campo obligatorio 'nombre_grado'.")

                # 2. Mapeo del Grado (Case Insensitive)
                id_grado = grados_map.get(nombre_grado.lower())
                if not id_grado:
                    raise ValueError(f"Grado '{nombre_grado}' no encontrado o no pertenece a esta empresa.")

                # 3. Validar Correo (opcional, pero se recomienda validar formato si está presente)
                correo_responsable = data.get('correo_responsable')
                if correo_responsable and "@" not in correo_responsable:
                     # Puedes añadir una validación de formato de email más rigurosa aquí
                    raise ValueError(f"El correo responsable '{correo_responsable}' no tiene un formato válido.")

                # 4. Crear instancia del modelo Estudiante
                new_student = Estudiante(
                    id_empresa=id_empresa,
                    id_grado=id_grado,
                    nombre_completo=nombre_completo,
                    correo_responsable=correo_responsable,
                    activo=data.get('activo', True) # Permite definir activo o usa True por defecto
                    # NOTA: Tu modelo no tiene 'cedula', 'direccion' o 'telefono_responsable'. 
                    # Si necesitas esos campos, debes agregarlos a tu clase Estudiante.
                )
                new_students.append(new_student)
                
            except ValueError as ve:
                errors.append(f"Fila {index + 1} ({data.get('nombre_completo', 'N/A')}): {str(ve)}")
            except Exception as e:
                errors.append(f"Fila {index + 1} ({data.get('nombre_completo', 'N/A')}): Error inesperado - {str(e)}")

        if errors:
            # Si hay errores en la validación, abortamos la transacción
            return jsonify({
                "error": "Se encontraron errores durante la validación de algunos estudiantes. Ningún estudiante fue guardado.",
                "errores_detalle": errors,
                "estudiantes_listos_para_agregar": len(new_students)
            }), 400

        if new_students:
            db.session.add_all(new_students)
            db.session.commit()
            students_added_count = len(new_students)

        return jsonify({
            "message": "Carga masiva completada exitosamente.",
            "estudiantes_agregados": students_added_count,
            "total_procesados": len(students_data)
        }), 201

    except SQLAlchemyError as sqlae:
        db.session.rollback()
        print(f"ERROR DB: Error al intentar guardar los estudiantes: {sqlae}")
        return jsonify({"error": f"Error de base de datos al guardar (SQLAlchemy): {str(sqlae)}"}), 500
    except Exception as e:
        db.session.rollback()
        print(f"ERROR BACKEND: Error en la carga masiva: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500