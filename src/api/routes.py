# src/api/routes.py

# ... (tus otras importaciones existentes)
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, Usuario, Empresa, Espacio, SubEspacio, Objeto, Formulario, Pregunta, TipoRespuesta, EnvioFormulario, Respuesta, Observacion, Notificacion, formulario_espacio, formulario_subespacio, formulario_objeto, formulario_tipo_respuesta
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, JWTManager
from datetime import datetime, timedelta, date, time # Importa date
import re
from sqlalchemy import func, and_ # Importa func y and_ para consultas de fecha
from sqlalchemy.orm import joinedload

# *** IMPORTACIONES NECESARIAS PARA CLOUDINARY ***
import cloudinary
import cloudinary.uploader
import base64 # Para decodificar base64 de firmas

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
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(int(current_user_id))

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    if request.method == 'GET':
        return jsonify({"usuario": usuario.serialize()}), 200

    elif request.method == 'PUT':
        try:
            # MODIFICADO: Ahora espera JSON para los datos de texto del perfil
            data = request.get_json()

            nombre_completo = data.get('nombre_completo')
            email = data.get('email')
            telefono_personal = data.get('telefono_personal')
            cargo = data.get('cargo')

            print(f"DEBUG_UPDATE_PROFILE: Datos de JSON recibidos: {data}")

            if nombre_completo:
                usuario.nombre_completo = nombre_completo.strip()

            if email:
                new_email = email.strip().lower()
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

            # IMPORTANTE: La lógica de 'imagen_perfil' ya NO se maneja aquí.
            # Se ha movido a la nueva ruta /perfil/imagen-perfil
            # if 'imagen_perfil' in request.files: ... (ESTO SE ELIMINA DE AQUÍ)

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

@api.route('/owner/usuarios/<int:user_id>', methods=['PUT'])
@role_required(['owner'])
def actualizar_usuario_por_owner(user_id):
    """
    Permite al OWNER actualizar los datos de cualquier usuario,
    incluyendo su rol y estado 'activo'.
    """
    try:
        usuario_a_actualizar = Usuario.query.get(user_id)
        if not usuario_a_actualizar:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # Un owner no debería poder cambiar su propio rol o desactivarse a sí mismo a través de esta ruta
        current_user_id = get_jwt_identity()
        if user_id == int(current_user_id) and ('rol' in request.get_json() or 'activo' in request.get_json()):
            return jsonify({"error": "No puedes modificar tu propio rol o estado activo como owner a través de esta ruta."}), 403

        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # Campos que pueden ser actualizados por el owner
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()
        rol = data.get('rol', '').strip().lower()
        activo = data.get('activo') # Puede ser booleano directamente
        id_empresa = data.get('id_empresa') # También puede cambiar la empresa de un usuario

        if nombre_completo:
            usuario_a_actualizar.nombre_completo = nombre_completo

        if email and email != usuario_a_actualizar.email:
            if not validate_email(email):
                return jsonify({"error": "El formato del email no es válido."}), 400
            existing_user_with_new_email = Usuario.query.filter_by(email=email).first()
            if existing_user_with_new_email and existing_user_with_new_email.id_usuario != user_id:
                return jsonify({"error": "Este email ya está en uso por otro usuario."}), 409
            usuario_a_actualizar.email = email

        if telefono_personal is not None:
            usuario_a_actualizar.telefono_personal = telefono_personal if telefono_personal else None
        if cargo is not None:
            usuario_a_actualizar.cargo = cargo if cargo else None

        if rol and rol != usuario_a_actualizar.rol:
            # El owner puede cambiar roles a admin_empresa, usuario_formulario
            if rol not in ['admin_empresa', 'usuario_formulario', 'owner']: # Owner puede asignar owner a otro usuario (ceder el rol)
                return jsonify({"error": "Rol no válido para asignación por el owner."}), 400
            # Prevenir que un owner cambie su propio rol si no es un paso de "transferencia"
            # (ya lo manejamos arriba, pero redundancia no está mal)
            if user_id == int(current_user_id) and rol != 'owner':
                return jsonify({"error": "Un owner no puede cambiar su propio rol a algo diferente de 'owner'."}), 403
            usuario_a_actualizar.rol = rol

        if activo is not None and isinstance(activo, bool):
            # Un owner no puede desactivarse a sí mismo
            if user_id == int(current_user_id) and not activo:
                return jsonify({"error": "Un owner no puede desactivarse a sí mismo."}), 403
            usuario_a_actualizar.activo = activo

        if id_empresa is not None and id_empresa != usuario_a_actualizar.id_empresa:
            new_empresa = Empresa.query.get(id_empresa)
            if not new_empresa:
                return jsonify({"error": "La nueva empresa especificada no existe."}), 404
            usuario_a_actualizar.id_empresa = id_empresa

        db.session.commit()
        return jsonify({"message": "Usuario actualizado exitosamente por el owner.", "usuario": usuario_a_actualizar.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar usuario por owner: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar usuario: {str(e)}"}), 500

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
@role_required(['admin_empresa'])
def crear_usuario_por_admin_empresa():
    """
    Permite a un ADMIN_EMPRESA crear nuevos usuarios (solo usuario_formulario)
    dentro de SU empresa.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        if not admin_empresa.id_empresa:
            return jsonify({"error": "El administrador de empresa no está asociado a una empresa."}), 403

        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # Datos requeridos para el usuario
        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        rol = data.get('rol', '').strip().lower() # Solo puede ser 'usuario_formulario'
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()

        if not all([nombre_completo, email, password, rol]):
            return jsonify({"error": "Todos los campos obligatorios (nombre completo, email, contraseña, rol) son requeridos."}), 400

        if not validate_email(email):
            return jsonify({"error": "El formato del email del usuario no es válido."}), 400

        is_valid_password, password_message = validate_password(password)
        if not is_valid_password:
            return jsonify({"error": password_message}), 400

        # Validar que el rol sea el permitido para la creación por admin_empresa
        if rol != 'usuario_formulario':
            return jsonify({"error": "Rol inválido. El administrador de empresa solo puede crear usuarios con rol 'usuario_formulario'."}), 400

        # Verificar que el email no esté ya en uso
        existing_user_by_email = Usuario.query.filter_by(email=email).first()
        if existing_user_by_email:
            return jsonify({"error": "Ya existe un usuario con este email."}), 409

        # Crear hash de contraseña
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
            cambio_password_requerido=True, # ¡Clave! El nuevo usuario debe cambiar su contraseña
            activo=True # Se activa por defecto
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
@role_required(['admin_empresa'])
def actualizar_usuario_por_admin_empresa(user_id):
    """
    Permite a un ADMIN_EMPRESA actualizar los datos de usuarios
    dentro de SU empresa. Solo puede modificar roles a 'usuario_formulario'.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        usuario_a_actualizar = Usuario.query.get(user_id)
        if not usuario_a_actualizar:
            return jsonify({"error": "Usuario no encontrado."}), 404

        # Un admin_empresa no puede modificarse a sí mismo o a otros admins de empresa
        # También solo puede modificar usuarios de SU empresa
        if usuario_a_actualizar.id_empresa != admin_empresa.id_empresa:
            return jsonify({"error": "No tienes permiso para modificar usuarios de otras empresas."}), 403
        if usuario_a_actualizar.rol != 'usuario_formulario' and user_id != admin_empresa.id_usuario:
            return jsonify({"error": "Solo puedes modificar usuarios con rol 'usuario_formulario'."}), 403
        if user_id == admin_empresa.id_usuario and ('rol' in request.get_json() or 'activo' in request.get_json()):
            return jsonify({"error": "No puedes modificar tu propio rol o estado activo como admin de empresa a través de esta ruta."}), 403


        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        nombre_completo = data.get('nombre_completo', '').strip()
        email = data.get('email', '').strip().lower()
        telefono_personal = data.get('telefono_personal', '').strip()
        cargo = data.get('cargo', '').strip()
        rol = data.get('rol', '').strip().lower() # Solo 'usuario_formulario'
        activo = data.get('activo')

        if nombre_completo:
            usuario_a_actualizar.nombre_completo = nombre_completo

        if email and email != usuario_a_actualizar.email:
            if not validate_email(email):
                return jsonify({"error": "El formato del email no es válido."}), 400
            existing_user_with_new_email = Usuario.query.filter_by(email=email).first()
            if existing_user_with_new_email and existing_user_with_new_email.id_usuario != user_id:
                return jsonify({"error": "Este email ya está en uso por otro usuario."}), 409
            usuario_a_actualizar.email = email

        if telefono_personal is not None:
            usuario_a_actualizar.telefono_personal = telefono_personal if telefono_personal else None
        if cargo is not None:
            usuario_a_actualizar.cargo = cargo if cargo else None

        if rol and rol != usuario_a_actualizar.rol:
            if rol != 'usuario_formulario':
                return jsonify({"error": "Un administrador de empresa solo puede asignar el rol 'usuario_formulario'."}), 400
            usuario_a_actualizar.rol = rol

        if activo is not None and isinstance(activo, bool):
            # Un admin de empresa no puede desactivar a otro admin o al owner, ni a sí mismo
            if usuario_a_actualizar.rol in ['owner', 'admin_empresa'] and not activo:
                 return jsonify({"error": "No tienes permiso para desactivar un usuario con este rol."}), 403
            usuario_a_actualizar.activo = activo

        db.session.commit()
        return jsonify({"message": "Usuario actualizado exitosamente por el administrador de empresa.", "usuario": usuario_a_actualizar.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar usuario por admin de empresa: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar usuario: {str(e)}"}), 500

@api.route('/empresa/usuarios', methods=['GET'])
@role_required(['admin_empresa'])
def listar_usuarios_por_empresa():
    """
    Permite a un ADMIN_EMPRESA listar los usuarios de SU empresa.
    """
    try:
        current_user_id = get_jwt_identity()
        admin_empresa = Usuario.query.get(int(current_user_id))

        if not admin_empresa.id_empresa:
            return jsonify({"error": "El administrador de empresa no está asociado a una empresa."}), 403

        usuarios_empresa = Usuario.query.filter_by(id_empresa=admin_empresa.id_empresa).all()
        return jsonify({
            "usuarios": [user.serialize() for user in usuarios_empresa]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor al listar usuarios de la empresa: {str(e)}"}), 500

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

        if usuario.rol == 'owner':
            # El owner ve todos los formularios, incluyendo sus plantillas
            formularios = formularios_query.all()
        else:
            # Usuarios de empresa ven sus propios formularios y las plantillas compartidas
            formularios_empresa = formularios_query.filter_by(id_empresa=usuario.id_empresa).all()
            
            # Plantillas globales
            plantillas_globales = formularios_query.filter_by(es_plantilla=True, es_plantilla_global=True).all()

            # Plantillas compartidas específicamente con esta empresa
            plantillas_compartidas_especificas = formularios_query.filter(
                Formulario.es_plantilla == True,
                Formulario.es_plantilla_global == False,
                Formulario.compartir_con_empresas_ids.contains([usuario.id_empresa]) # Busca si el ID de la empresa está en la lista JSON
            ).all()

            # Combinar y eliminar duplicados
            formularios = list(set(formularios_empresa + plantillas_globales + plantillas_compartidas_especificas))

        formularios_data = []
        for f in formularios:
            # La serialización del formulario ya incluye los campos de frecuencia actualizados
            # gracias a los cambios en el modelo Formulario.
            f_data = f.serialize()
            formularios_data.append(f_data)

        return jsonify({"formularios": formularios_data}), 200

    except Exception as e:
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
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_preguntas_by_formulario(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.options(joinedload(Usuario.empresa)).get(int(current_user_id)) # Cargar la empresa del usuario
        
        formulario = Formulario.query.options(joinedload(Formulario.preguntas).joinedload(Pregunta.tipo_respuesta)).get(form_id) # Cargar preguntas y sus tipos
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
                return jsonify({"error": "No tienes permisos para acceder a las preguntas de este formulario."}), 403

        preguntas_data = []
        for p in formulario.preguntas: # Iterar sobre las preguntas cargadas
            p_data = p.serialize()
            p_data['tipo_respuesta_nombre'] = p.tipo_respuesta.nombre_tipo if p.tipo_respuesta else None

            # LÓGICA CLAVE: Si es una plantilla y la pregunta es de selección de recursos
            # Se devuelven los recursos de la empresa del usuario que CONSUME la plantilla
            if formulario.es_plantilla and p.tipo_respuesta and p.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
                # Obtener todos los espacios, subespacios y objetos de la empresa del usuario actual
                all_espacios_for_current_company = Espacio.query.filter_by(id_empresa=usuario.id_empresa).all()
                all_subespacios_for_current_company = SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()
                all_objetos_for_current_company = Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()

                p_data['opciones_respuesta_json'] = {
                    'espacios': [e.id_espacio for e in all_espacios_for_current_company],
                    'subespacios': [s.id_subespacio for s in all_subespacios_for_current_company],
                    'objetos': [o.id_objeto for o in all_objetos_for_current_company]
                }
            
            preguntas_data.append(p_data)

        return jsonify({"preguntas": preguntas_data}), 200

    except Exception as e:
        print(f"Error al obtener preguntas del formulario: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener preguntas: {str(e)}"}), 500

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

        # Control de acceso por empresa (MODIFICADO para incluir plantillas)
        if usuario.rol != 'owner': # Owner siempre puede añadir preguntas a sus plantillas
            is_allowed_template_management = False
            if formulario.es_plantilla:
                # Solo el owner de la empresa de la plantilla puede añadir/modificar preguntas de plantilla
                if usuario.id_empresa == formulario.id_empresa:
                    is_allowed_template_management = True
            
            if not is_allowed_template_management and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para añadir preguntas a este formulario."}), 403

        texto_pregunta = data.get('texto_pregunta', '').strip()
        tipo_respuesta_id = data.get('tipo_respuesta_id')
        orden = data.get('orden')
        opciones_respuesta_json = data.get('opciones_respuesta_json')

        if not all([texto_pregunta, tipo_respuesta_id, orden is not None]):
            return jsonify({"error": "Texto de pregunta, tipo de respuesta y orden son requeridos."}), 400

        tipo_respuesta = TipoRespuesta.query.get(tipo_respuesta_id)
        if not tipo_respuesta:
            return jsonify({"error": "Tipo de respuesta no válido."}), 400

        # Validaciones específicas según el tipo de respuesta
        if tipo_respuesta.nombre_tipo in ['seleccion_multiple', 'seleccion_unica']:
            if not isinstance(opciones_respuesta_json, list):
                return jsonify({"error": "Para selección múltiple/única, 'opciones_respuesta_json' debe ser una lista de opciones."}), 400
        elif tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            # Para seleccion_recursos, esperamos un diccionario con listas de IDs
            if not isinstance(opciones_respuesta_json, dict) or \
               'espacios' not in opciones_respuesta_json or \
               'subespacios' not in opciones_respuesta_json or \
               'objetos' not in opciones_respuesta_json or \
               not isinstance(opciones_respuesta_json['espacios'], list) or \
               not isinstance(opciones_respuesta_json['subespacios'], list) or \
               not isinstance(opciones_respuesta_json['objetos'], list):
                return jsonify({"error": "Para 'seleccion_recursos', 'opciones_respuesta_json' debe ser un diccionario con listas de 'espacios', 'subespacios' y 'objetos'."}), 400
            # No validar los IDs de recursos aquí si es una plantilla, solo guardarlos
            # La validación de existencia de recursos se hace en el formulario padre si no es plantilla
        elif tipo_respuesta.nombre_tipo in ['firma', 'dibujo'] and opciones_respuesta_json is not None:
            return jsonify({"error": "Para tipo 'firma' o 'dibujo', 'opciones_respuesta_json' no debe ser proporcionado."}), 400
        elif opciones_respuesta_json is not None: # Para otros tipos que no usan opciones
             return jsonify({"error": f"El tipo de respuesta '{tipo_respuesta.nombre_tipo}' no soporta 'opciones_respuesta_json'."}), 400


        nueva_pregunta = Pregunta(
            id_formulario=form_id,
            texto_pregunta=texto_pregunta,
            tipo_respuesta_id=tipo_respuesta_id,
            orden=orden,
            opciones_respuesta_json=opciones_respuesta_json
        )
        db.session.add(nueva_pregunta)
        db.session.commit()

        pregunta_data = nueva_pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = tipo_respuesta.nombre_tipo

        return jsonify({"message": "Pregunta creada exitosamente.", "pregunta": pregunta_data}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error al crear pregunta: {e}")
        return jsonify({"error": f"Error interno del servidor al crear pregunta: {str(e)}"}), 500

@api.route('/preguntas/<int:pregunta_id>', methods=['GET'])
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_pregunta(pregunta_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.options(joinedload(Usuario.empresa)).get(int(current_user_id)) # Cargar la empresa del usuario

        pregunta = Pregunta.query.options(joinedload(Pregunta.formulario).joinedload(Formulario.empresa), joinedload(Pregunta.tipo_respuesta)).get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = pregunta.formulario # Acceder al formulario cargado
        if not formulario: # Debería existir, pero por seguridad
            return jsonify({"error": "Formulario asociado a la pregunta no encontrado."}), 404
        
        # Control de acceso por empresa del formulario padre (MODIFICADO para incluir plantillas)
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

        # LÓGICA CLAVE: Si es una plantilla y la pregunta es de selección de recursos
        # Se devuelven los recursos de la empresa del usuario que CONSUME la plantilla
        if formulario.es_plantilla and pregunta.tipo_respuesta and pregunta.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            # Obtener todos los espacios, subespacios y objetos de la empresa del usuario actual
            all_espacios_for_current_company = Espacio.query.filter_by(id_empresa=usuario.id_empresa).all()
            all_subespacios_for_current_company = SubEspacio.query.join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()
            all_objetos_for_current_company = Objeto.query.join(SubEspacio).join(Espacio).filter(Espacio.id_empresa == usuario.id_empresa).all()

            pregunta_data['opciones_respuesta_json'] = {
                'espacios': [e.id_espacio for e in all_espacios_for_current_company],
                'subespacios': [s.id_subespacio for s in all_subespacios_for_current_company],
                'objetos': [o.id_objeto for o in all_objetos_for_current_company]
            }

        return jsonify({"pregunta": pregunta_data}), 200

    except Exception as e:
        print(f"Error al obtener pregunta: {e}")
        return jsonify({"error": f"Error interno del servidor al obtener pregunta: {str(e)}"}), 500

@api.route('/preguntas/<int:pregunta_id>', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def update_pregunta(pregunta_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()

        pregunta = Pregunta.query.get(pregunta_id)
        if not pregunta:
            return jsonify({"error": "Pregunta no encontrada."}), 404

        formulario = Formulario.query.get(pregunta.id_formulario)
        if not formulario:
            return jsonify({"error": "Formulario asociado a la pregunta no encontrado."}), 404
        
        # Control de acceso por empresa (MODIFICADO para incluir plantillas)
        if usuario.rol != 'owner':
            is_allowed_template_management = False
            if formulario.es_plantilla:
                # Solo el owner de la empresa de la plantilla puede añadir/modificar preguntas de plantilla
                if usuario.id_empresa == formulario.id_empresa:
                    is_allowed_template_management = True
            
            if not is_allowed_template_management and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para actualizar esta pregunta."}), 403

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        texto_pregunta = data.get('texto_pregunta', '').strip()
        tipo_respuesta_id = data.get('tipo_respuesta_id')
        orden = data.get('orden')
        opciones_respuesta_json = data.get('opciones_respuesta_json')

        if texto_pregunta:
            pregunta.texto_pregunta = texto_pregunta

        if orden is not None:
            pregunta.orden = orden

        # Si el tipo de respuesta cambia, actualiza y luego valida las opciones
        if tipo_respuesta_id is not None:
            tipo_respuesta_nueva = TipoRespuesta.query.get(tipo_respuesta_id)
            if not tipo_respuesta_nueva:
                return jsonify({"error": "Tipo de respuesta no válido."}), 400
            pregunta.tipo_respuesta_id = tipo_respuesta_id
            
            # Si el nuevo tipo no usa opciones, asegúrate de que se limpien
            if tipo_respuesta_nueva.nombre_tipo not in ['seleccion_multiple', 'seleccion_unica', 'seleccion_recursos']:
                pregunta.opciones_respuesta_json = None
        
        # Actualizar opciones de respuesta solo si el tipo actual de la pregunta lo permite
        if pregunta.tipo_respuesta.nombre_tipo in ['seleccion_multiple', 'seleccion_unica']:
            if opciones_respuesta_json is not None:
                if not isinstance(opciones_respuesta_json, list):
                    return jsonify({"error": "Para tipos de selección múltiple/única, 'opciones_respuesta_json' debe ser una lista."}), 400
                pregunta.opciones_respuesta_json = opciones_respuesta_json
            # Si opciones_respuesta_json es None, no se modifica el valor existente
        elif pregunta.tipo_respuesta.nombre_tipo == 'seleccion_recursos':
            if opciones_respuesta_json is not None:
                if not isinstance(opciones_respuesta_json, dict) or \
                   'espacios' not in opciones_respuesta_json or \
                   'subespacios' not in opciones_respuesta_json or \
                   'objetos' not in opciones_respuesta_json or \
                   not isinstance(opciones_respuesta_json['espacios'], list) or \
                   not isinstance(opciones_respuesta_json['subespacios'], list) or \
                   not isinstance(opciones_respuesta_json['objetos'], list):
                    return jsonify({"error": "Para 'seleccion_recursos', 'opciones_respuesta_json' debe ser un diccionario con listas de 'espacios', 'subespacios' y 'objetos'."}), 400
                pregunta.opciones_respuesta_json = opciones_respuesta_json
            # Si opciones_respuesta_json es None, no se modifica el valor existente
        elif opciones_respuesta_json is not None: # Si se envía opciones para un tipo que NO las usa
            return jsonify({"error": f"El tipo de respuesta '{pregunta.tipo_respuesta.nombre_tipo}' no soporta 'opciones_respuesta_json'."}), 400
        # Si el tipo de respuesta NO requiere opciones y no se envió opciones_respuesta_json,
        # y el valor actual no es None, se establece a None.
        elif pregunta.opciones_respuesta_json is not None:
            pregunta.opciones_respuesta_json = None


        db.session.commit()

        pregunta_data = pregunta.serialize()
        pregunta_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo if pregunta.tipo_respuesta else None

        return jsonify({"message": "Pregunta actualizada exitosamente.", "pregunta": pregunta_data}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar pregunta: {e}")
        return jsonify({"error": f"Error interno del servidor al actualizar pregunta: {str(e)}"}), 500

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
        
        # Control de acceso por empresa (MODIFICADO para incluir plantillas)
        if usuario.rol != 'owner':
            is_allowed_template_management = False
            if formulario.es_plantilla:
                if usuario.id_empresa == formulario.id_empresa:
                    is_allowed_template_management = True
            
            if not is_allowed_template_management and formulario.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para eliminar esta pregunta."}), 403

        # --- INICIO DE ELIMINACIÓN EN CASCADA MANUAL PARA PREGUNTA ---

        # 1. Eliminar Respuestas asociadas a esta Pregunta
        respuestas_pregunta = list(pregunta.respuestas) # Copia para iterar
        for respuesta in respuestas_pregunta:
            db.session.delete(respuesta)

        # 2. Finalmente, eliminar la Pregunta
        db.session.delete(pregunta)
        db.session.commit()
        # --- FIN DE ELIMINACIÓN EN CASCADA MANUAL PARA PREGUNTA ---

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
        
        data = request.get_json() # Esperamos un JSON con los datos del envío y las respuestas
        if not data:
            print("DEBUG BACKEND: No se recibieron datos en la solicitud.")
            return jsonify({"error": "No se recibieron datos"}), 400

        id_formulario = data.get('id_formulario')
        respuestas_data = data.get('respuestas', []) # Lista de objetos de respuesta
        espacios_cubiertos_ids = data.get('espacios_cubiertos_ids', [])
        subespacios_cubiertos_ids = data.get('subespacios_cubiertos_ids', [])
        objetos_cubiertos_ids = data.get('objetos_cubiertos_ids', [])

        print(f"DEBUG BACKEND: Payload recibido: id_formulario={id_formulario}, id_usuario={usuario.id_usuario}, respuestas_count={len(respuestas_data)}")
        print(f"DEBUG BACKEND: Contenido de 'respuestas' en el payload:")
        for idx, resp_item in enumerate(respuestas_data):
            print(f"  Respuesta {idx}: pregunta_id={resp_item.get('pregunta_id')}, valor_texto={resp_item.get('valor_texto')}, valor_booleano={resp_item.get('valor_booleano')}, valor_numerico={resp_item.get('valor_numerico')}, valores_multiples_json={resp_item.get('valores_multiples_json')}")


        if not id_formulario:
            print("DEBUG BACKEND: id_formulario es requerido en el payload.")
            return jsonify({"error": "El id_formulario es requerido."}), 400

        formulario = Formulario.query.get(id_formulario)
        if not formulario:
            print(f"DEBUG BACKEND: Formulario {id_formulario} no encontrado.")
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso: el usuario debe pertenecer a la empresa del formulario
        # MODIFICADO: También permite enviar si es una plantilla compartida.
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

        # MODIFICADO: Control de límite de diligencias por período
        # Calcular el inicio del período dinámicamente
        period_start = datetime.utcnow() - timedelta(days=formulario.submission_period_days)

        current_submissions_in_period = EnvioFormulario.query.filter(
            EnvioFormulario.id_formulario == id_formulario,
            EnvioFormulario.id_usuario == usuario.id_usuario,
            EnvioFormulario.fecha_hora_envio >= period_start
        ).count()

        if current_submissions_in_period >= formulario.max_submissions_per_period:
            return jsonify({"error": f"Ya has alcanzado el límite de {formulario.max_submissions_per_period} diligencia(s) para este formulario en los últimos {formulario.submission_period_days} día(s)."}), 400


        # Crear el registro de Envío de Formulario
        nuevo_envio = EnvioFormulario(
            id_formulario=id_formulario,
            id_usuario=int(current_user_id),
            fecha_hora_envio=datetime.utcnow(),
            espacios_cubiertos_ids=espacios_cubiertos_ids,
            subespacios_cubiertos_ids=subespacios_cubiertos_ids,
            objetos_cubiertos_ids=objetos_cubiertos_ids
        )
        db.session.add(nuevo_envio)
        db.session.flush() # Para obtener el id_envio

        print(f"DEBUG BACKEND: Nuevo envío creado con ID: {nuevo_envio.id_envio}")

        # Procesar cada respuesta
        for respuesta_item in respuestas_data:
            pregunta_id = respuesta_item.get('pregunta_id')
            
            # --- VERIFICACIÓN CLAVE AQUÍ ---
            if pregunta_id is None:
                db.session.rollback()
                print("ERROR BACKEND: pregunta_id es None para una respuesta. Abortando envío.")
                return jsonify({"error": "Pregunta con ID None no encontrada o no pertenece a este formulario."}), 400

            valor_texto = respuesta_item.get('valor_texto')
            valor_booleano = respuesta_item.get('valor_booleano')
            valor_numerico = respuesta_item.get('valor_numerico')
            valores_multiples_json = respuesta_item.get('valores_multiples_json')
            
            # MODIFICADO: Ahora puede ser una lista de base64 para el tipo 'dibujo'
            firma_base64_list = respuesta_item.get('firma_base64_list') # Espera una lista de strings base64
            firma_base64_single = respuesta_item.get('firma_base64') # Para compatibilidad si se envía una sola

            pregunta = Pregunta.query.get(pregunta_id)
            if not pregunta or pregunta.id_formulario != id_formulario:
                db.session.rollback()
                print(f"ERROR BACKEND: Pregunta con ID {pregunta_id} no encontrada o no pertenece al formulario {id_formulario}. Abortando envío.")
                return jsonify({"error": f"Pregunta con ID {pregunta_id} no encontrada o no pertenece a este formulario."}), 400

            tipo_respuesta_obj = TipoRespuesta.query.get(pregunta.tipo_respuesta_id)
            valor_firma_url_list = [] # Será una lista de URLs

            if tipo_respuesta_obj:
                if tipo_respuesta_obj.nombre_tipo == 'firma':
                    # Si la pregunta es de tipo 'firma' y el usuario tiene una firma digital guardada
                    if usuario.firma_digital_url:
                        valor_firma_url_list.append(usuario.firma_digital_url)
                        print(f"DEBUG BACKEND: Usando firma digital de perfil para pregunta {pregunta_id}: {usuario.firma_digital_url}")
                    elif firma_base64_single: # Si no tiene firma de perfil, pero envía una en el momento
                        try:
                            upload_result = cloudinary.uploader.upload(firma_base64_single)
                            valor_firma_url_list.append(upload_result['secure_url'])
                            print(f"DEBUG BACKEND: Firma subida para pregunta {pregunta_id}: {upload_result['secure_url']}")
                        except Exception as e:
                            print(f"ERROR BACKEND: Error al subir firma individual a Cloudinary para pregunta {pregunta_id}: {str(e)}")
                
                elif tipo_respuesta_obj.nombre_tipo == 'dibujo':
                    # Para tipo 'dibujo', se esperan múltiples firmas o una sola
                    if firma_base64_list and isinstance(firma_base64_list, list):
                        for b64_signature in firma_base64_list:
                            try:
                                upload_result = cloudinary.uploader.upload(b64_signature)
                                valor_firma_url_list.append(upload_result['secure_url'])
                                print(f"DEBUG BACKEND: Dibujo/firma múltiple subida para pregunta {pregunta_id}: {upload_result['secure_url']}")
                            except Exception as e:
                                print(f"ERROR BACKEND: Error al subir dibujo/firma múltiple a Cloudinary para pregunta {pregunta_id}: {str(e)}")
                    elif firma_base64_single: # Si solo se envía una base64 para dibujo
                         try:
                            upload_result = cloudinary.uploader.upload(firma_base64_single)
                            valor_firma_url_list.append(upload_result['secure_url'])
                            print(f"DEBUG BACKEND: Dibujo/firma única subida para pregunta {pregunta_id}: {str(e)}")
                         except Exception as e:
                            print(f"ERROR BACKEND: Error al subir dibujo/firma única a Cloudinary para pregunta {pregunta_id}: {str(e)}")


            nueva_respuesta = Respuesta(
                id_envio=nuevo_envio.id_envio,
                id_pregunta=pregunta_id,
                valor_texto=valor_texto,
                valor_booleano=valor_booleano,
                valor_numerico=valor_numerico,
                valores_multiples_json=valores_multiples_json,
                valor_firma_url=valor_firma_url_list if valor_firma_url_list else None # Guardar como lista JSON o None
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
@role_required(['owner', 'admin_empresa', 'usuario_formulario'])
def get_envio_formulario(envio_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))

        envio = EnvioFormulario.query.get(envio_id)
        if not envio:
            return jsonify({"error": "Envío de formulario no encontrado."}), 404

        formulario_asociado = Formulario.query.get(envio.id_formulario)
        if not formulario_asociado:
            return jsonify({"error": "Formulario asociado al envío no encontrado."}), 404

        # Control de acceso
        if usuario.rol != 'owner':
            is_allowed_template = False
            if formulario_asociado.es_plantilla:
                if formulario_asociado.es_plantilla_global:
                    is_allowed_template = True
                elif usuario.id_empresa in formulario_asociado.compartir_con_empresas_ids:
                    is_allowed_template = True
            
            if not is_allowed_template and formulario_asociado.id_empresa != usuario.id_empresa:
                return jsonify({"error": "No tienes permisos para acceder a este envío de formulario."}), 403

            # Si es usuario_formulario, solo puede ver sus propios envíos, incluso si es plantilla.
            if usuario.rol == 'usuario_formulario' and envio.id_usuario != usuario.id_usuario:
                return jsonify({"error": "No tienes permisos para acceder a este envío de formulario."}), 403


        envio_data = envio.serialize()
        envio_data['respuestas'] = []
        for respuesta in envio.respuestas:
            res_data = respuesta.serialize()
            pregunta = Pregunta.query.get(respuesta.id_pregunta)
            if pregunta:
                res_data['texto_pregunta'] = pregunta.texto_pregunta
                res_data['tipo_respuesta_nombre'] = pregunta.tipo_respuesta.nombre_tipo if pregunta.tipo_respuesta else None
            envio_data['respuestas'].append(res_data)

        # Opcional: añadir detalles del formulario y usuario que lo envió
        envio_data['formulario_info'] = formulario_asociado.serialize()
        envio_data['usuario_info'] = Usuario.query.get(envio.id_usuario).serialize() if Usuario.query.get(envio.id_usuario) else None


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
@api.route('/formularios/ejecutar-automatizacion', methods=['POST'])
@role_required(['owner', 'admin_empresa']) # Solo roles con permisos para activar la automatización
def ejecutar_automatizacion_formularios():
    """
    Ejecuta la lógica de automatización para formularios con 'automatizacion_activa' en True,
    considerando la hora programada y la última fecha de ejecución.
    Simula un cron job.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario_ejecutor = Usuario.query.get(int(current_user_id))

        # Filtrar formularios que tienen automatización activa
        if usuario_ejecutor.rol == 'owner':
            formularios_a_automatizar = Formulario.query.filter_by(automatizacion_activa=True).all()
        else: # admin_empresa
            formularios_a_automatizar = Formulario.query.filter_by(
                automatizacion_activa=True, 
                id_empresa=usuario_ejecutor.id_empresa
            ).all()

        resultados_automatizacion = []
        # Obtener la hora y fecha actuales en UTC
        now_utc = datetime.utcnow()
        today_utc_date = now_utc.date()
        current_time_utc = now_utc.time()

        for formulario in formularios_a_automatizar:
            # Solo procesar si tiene automatización activa Y una hora programada
            if not formulario.automatizacion_activa:
                resultados_automatizacion.append(f"Formulario '{formulario.nombre_formulario}' (ID: {formulario.id_formulario}) tiene automatización inactiva.")
                continue
            
            if not formulario.scheduled_automation_time:
                resultados_automatizacion.append(f"Formulario '{formulario.nombre_formulario}' (ID: {formulario.id_formulario}) tiene automatización activa pero no tiene una hora programada. Se omitirá.")
                continue
            
            # Verificar si la hora programada ya pasó HOY y si no se ha ejecutado HOY
            # Comparamos solo la hora, y luego la fecha de la última ejecución
            if current_time_utc >= formulario.scheduled_automation_time and \
               (formulario.last_automated_run_date is None or formulario.last_automated_run_date < today_utc_date):
                
                # Encontrar usuarios que deben diligenciar este formulario
                usuarios_para_diligenciar = Usuario.query.filter_by(
                    id_empresa=formulario.id_empresa,
                    rol='usuario_formulario',
                    activo=True
                ).all()

                for target_usuario in usuarios_para_diligenciar:
                    # Obtener el inicio del período dinámicamente para este formulario
                    period_start = datetime.utcnow() - timedelta(days=formulario.submission_period_days) if formulario.submission_period_days > 0 else None

                    # Conteo de envíos en el período definido para el usuario
                    query_envios = EnvioFormulario.query.filter(
                        EnvioFormulario.id_formulario == formulario.id_formulario,
                        EnvioFormulario.id_usuario == target_usuario.id_usuario
                    )
                    if period_start: # Solo aplicar filtro de fecha si hay un período definido
                        query_envios = query_envios.filter(EnvioFormulario.fecha_hora_envio >= period_start)
                    
                    current_submissions_in_period = query_envios.count()

                    # Si el formulario tiene un límite de envíos por período (max_submissions_per_period > 0)
                    # Y no se ha alcanzado ese límite.
                    if formulario.max_submissions_per_period > 0 and \
                       current_submissions_in_period < formulario.max_submissions_per_period:
                        
                        num_diligencias_faltantes = formulario.max_submissions_per_period - current_submissions_in_period
                        
                        for _ in range(num_diligencias_faltantes):
                            # Lógica para generar respuestas automáticas (igual que antes)
                            respuestas_automaticas = []
                            for pregunta in formulario.preguntas:
                                # Obtener respuestas históricas para esta pregunta
                                respuestas_historicas = Respuesta.query.join(EnvioFormulario).filter(
                                    EnvioFormulario.id_formulario == formulario.id_formulario,
                                    Respuesta.id_pregunta == pregunta.id_pregunta,
                                    EnvioFormulario.completado_automaticamente == False # Considerar solo respuestas manuales
                                ).order_by(EnvioFormulario.fecha_hora_envio.desc()).limit(5).all() # Últimos 5 envíos

                                valor_auto = None
                                if pregunta.tipo_respuesta.nombre_tipo == 'numerico':
                                    numeric_values = [r.valor_numerico for r in respuestas_historicas if r.valor_numerico is not None]
                                    if numeric_values:
                                        valor_auto = sum(numeric_values) / len(numeric_values)
                                elif pregunta.tipo_respuesta.nombre_tipo == 'booleano':
                                    boolean_values = [r.valor_booleano for r in respuestas_historicas if r.valor_booleano is not None]
                                    if boolean_values:
                                        true_count = boolean_values.count(True)
                                        false_count = boolean_values.count(False)
                                        valor_auto = true_count >= false_count
                                elif pregunta.tipo_respuesta.nombre_tipo == 'texto':
                                    text_values = [r.valor_texto for r in respuestas_historicas if r.valor_texto is not None]
                                    if text_values:
                                        most_common = Counter(text_values).most_common(1)
                                        if most_common and most_common[0][1] >= 2:
                                            valor_auto = most_common[0][0]
                                elif pregunta.tipo_respuesta.nombre_tipo in ['seleccion_unica', 'seleccion_multiple', 'seleccion_recursos']:
                                    selection_values = []
                                    for r in respuestas_historicas:
                                        if r.valores_multiples_json and isinstance(r.valores_multiples_json, list):
                                            selection_values.extend(r.valores_multiples_json)
                                        elif r.valores_multiples_json and isinstance(r.valores_multiples_json, str):
                                            try:
                                                selection_values.extend(json.loads(r.valores_multiples_json))
                                            except:
                                                pass
                                        elif r.valor_texto:
                                            selection_values.append(r.valor_texto)

                                    if selection_values:
                                        most_common = Counter(selection_values).most_common(1)
                                        if most_common and most_common[0][1] >= 2:
                                            if pregunta.tipo_respuesta.nombre_tipo == 'seleccion_multiple':
                                                valor_auto = [item for item, count in Counter(selection_values).items() if count >= 2]
                                                if not valor_auto:
                                                    valor_auto = [most_common[0][0]]
                                            else:
                                                valor_auto = most_common[0][0]
                                elif pregunta.tipo_respuesta.nombre_tipo in ['firma', 'dibujo']:
                                    valor_auto = None

                                respuestas_automaticas.append(Respuesta(
                                    id_pregunta=pregunta.id_pregunta,
                                    valor_texto=valor_auto if pregunta.tipo_respuesta.nombre_tipo == 'texto' else None,
                                    valor_booleano=valor_auto if pregunta.tipo_respuesta.nombre_tipo == 'booleano' else None,
                                    valor_numerico=valor_auto if pregunta.tipo_respuesta.nombre_tipo == 'numerico' else None,
                                    valores_multiples_json=valor_auto if pregunta.tipo_respuesta.nombre_tipo in ['seleccion_unica', 'seleccion_multiple', 'seleccion_recursos'] else None,
                                    valor_firma_url=valor_auto if pregunta.tipo_respuesta.nombre_tipo in ['firma', 'dibujo'] else None
                                ))

                            # Crear el envío automático
                            nuevo_envio_auto = EnvioFormulario(
                                id_formulario=formulario.id_formulario,
                                id_usuario=target_usuario.id_usuario,
                                fecha_hora_envio=datetime.utcnow(),
                                completado_automaticamente=True,
                                espacios_cubiertos_ids=[e.id_espacio for e in formulario.espacios],
                                subespacios_cubiertos_ids=[s.id_subespacio for s in formulario.sub_espacios],
                                objetos_cubiertos_ids=[o.id_objeto for o in formulario.objetos]
                            )
                            db.session.add(nuevo_envio_auto)
                            db.session.flush()

                            for res_auto in respuestas_automaticas:
                                res_auto.id_envio = nuevo_envio_auto.id_envio
                                db.session.add(res_auto)
                            
                            db.session.commit()
                            resultados_automatizacion.append(f"Formulario '{formulario.nombre_formulario}' automatizado para usuario '{target_usuario.nombre_completo}'.")
                            
                    else:
                        resultados_automatizacion.append(f"Formulario '{formulario.nombre_formulario}' ya alcanzó el límite de {formulario.max_submissions_per_period} diligencias en los últimos {formulario.submission_period_days} día(s) para el usuario '{target_usuario.nombre_completo}'.")
                
                # Marcar el formulario como ejecutado para hoy (solo si se intentó ejecutar para al menos un usuario)
                formulario.last_automated_run_date = today_utc_date
                db.session.commit() # Commit para guardar la fecha de última ejecución
                resultados_automatizacion.append(f"Automatización para formulario '{formulario.nombre_formulario}' marcada como ejecutada para hoy.")

            else:
                status_msg = ""
                if not formulario.automatizacion_activa:
                    status_msg = "automatización inactiva"
                elif formulario.scheduled_automation_time is None:
                    status_msg = "no tiene hora programada"
                elif current_time_utc < formulario.scheduled_automation_time:
                    status_msg = f"hora programada ({formulario.scheduled_automation_time.strftime('%H:%M')}) aún no ha llegado"
                elif formulario.last_automated_run_date == today_utc_date:
                    status_msg = "ya se ejecutó hoy"
                resultados_automatizacion.append(f"Formulario '{formulario.nombre_formulario}' (ID: {formulario.id_formulario}) no se automatizó: {status_msg}.")

        return jsonify({"message": "Proceso de automatización completado.", "resultados": resultados_automatizacion}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error en la ejecución de la automatización: {e}")
        return jsonify({"error": f"Error interno del servidor al ejecutar la automatización: {str(e)}"}), 500

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
@api.route('/formularios/<int:form_id>/set_automation_schedule', methods=['PUT'])
@role_required(['owner', 'admin_empresa'])
def set_formulario_automation_schedule(form_id):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(int(current_user_id))
        data = request.get_json()
        
        if not data or 'scheduled_time' not in data:
            return jsonify({"error": "Hora de automatización requerida."}), 400

        formulario = Formulario.query.get(form_id)
        if not formulario:
            return jsonify({"error": "Formulario no encontrado."}), 404

        # Control de acceso (similar a toggle-automatizacion)
        if usuario.rol != 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "No tienes permisos para modificar la programación de este formulario."}), 403
        
        if usuario.rol == 'owner' and formulario.id_empresa != usuario.id_empresa:
            return jsonify({"error": "Como owner, solo puedes modificar la programación para formularios de tu empresa principal."}), 403

        scheduled_time_str = data['scheduled_time'] # Formato "HH:MM"
        # Convertir string "HH:MM" a objeto datetime.time
        scheduled_time_obj = datetime.strptime(scheduled_time_str, '%H:%M').time()

        formulario.scheduled_automation_time = scheduled_time_obj
        db.session.commit()

        return jsonify({"message": f"Hora de automatización para '{formulario.nombre_formulario}' establecida a las {scheduled_time_str}.", "scheduled_automation_time": scheduled_time_str}), 200

    except ValueError:
        db.session.rollback()
        return jsonify({"error": "Formato de hora inválido. Use HH:MM."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error al establecer la hora de automatización: {e}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
