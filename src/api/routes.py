# src/api/routes.py

# ... (tus otras importaciones existentes)
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, Usuario, Empresa # Asegúrate de que User no está duplicado si Usuario es tu modelo de usuario principal
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, JWTManager
from datetime import datetime, timedelta
import re

# *** IMPORTACIONES NECESARIAS PARA CLOUDINARY ***
import cloudinary
import cloudinary.uploader

api = Blueprint('api', __name__)

# Allow CORS requests to this API
CORS(api)

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

        if not usuario.activo:
            return jsonify({"error": "Usuario inactivo. Contacta al administrador."}), 403

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

        if not usuario.activo: # Verificar si el usuario está activo
            return jsonify({"valid": False, "error": "Usuario inactivo"}), 403

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
            data = request.form

            nombre_completo = data.get('nombre_completo')
            email = data.get('email')
            telefono_personal = data.get('telefono_personal')
            cargo = data.get('cargo')

            print(f"DEBUG_UPDATE_PROFILE: Datos de formulario recibidos: {data}")

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

            if 'imagen_perfil' in request.files:
                imagen_perfil = request.files['imagen_perfil']
                if imagen_perfil.filename == '':
                    pass
                elif not imagen_perfil.content_type.startswith('image/'):
                    return jsonify({"error": "El archivo de imagen de perfil debe ser una imagen."}), 400
                else:
                    try:
                        upload_result = cloudinary.uploader.upload(imagen_perfil)
                        usuario.imagen_perfil_url = upload_result['secure_url']
                    except Exception as e:
                        print(f"Error al subir la imagen de perfil a Cloudinary: {str(e)}")
                        return jsonify({"error": f"Error al subir la imagen de perfil a Cloudinary: {str(e)}"}), 500

            db.session.commit()
            return jsonify({"message": "Perfil actualizado exitosamente", "usuario": usuario.serialize()}), 200

        except Exception as e:
            db.session.rollback()
            print(f"Error interno del servidor al actualizar el perfil: {str(e)}")
            return jsonify({"error": f"Error interno del servidor al actualizar el perfil: {str(e)}"}), 500


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

        return jsonify({
            "message": f"Bienvenido al dashboard, {usuario.nombre_completo}!",
            "usuario": usuario.serialize()
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@api.route('/empresas', methods=['GET'])
@role_required(['owner', 'admin_empresa']) # Admin_empresa también podría necesitar listar sus empresas (aunque sería solo la suya)
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

    # Si es admin_empresa, solo puede gestionar su empresa
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
@role_required(['owner']) # Asegúrate de que role_required esté definido e importado
@jwt_required() # También necesitas jwt_required para obtener la identidad del usuario, aunque role_required ya lo haga
def actualizar_empresa_por_owner(empresa_id):
    """
    Permite al OWNER actualizar los datos de cualquier empresa, incluyendo su estado 'activo' y logo.
    Ahora espera FormData.
    """
    try:
        empresa = Empresa.query.get(empresa_id)
        if not empresa:
            return jsonify({"error": "Empresa no encontrada."}), 404

        # CAMBIO CLAVE: Usa request.form para datos de texto y request.files para archivos
        data = request.form

        # Puedes depurar los datos recibidos
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

        # Actualiza campos si se proporcionan
        if direccion is not None:
            empresa.direccion = direccion if direccion else None
        if telefono is not None:
            empresa.telefono = telefono if telefono else None
        if email_contacto is not None:
            if email_contacto and not validate_email(email_contacto):
                return jsonify({"error": "El formato del email de contacto de la empresa no es válido."}), 400
            empresa.email_contacto = email_contacto if email_contacto else None

        # El owner puede activar/desactivar la empresa (convertir string a booleano)
        if activo_str is not None:
            empresa.activo = activo_str.lower() == 'true'
            print(f"DEBUG_OWNER_UPDATE: Activo recibido '{activo_str}', convertido a {empresa.activo}")


        # Manejo del logo de la empresa
        if 'logo_empresa' in request.files:
            logo_empresa = request.files['logo_empresa']
            if logo_empresa.filename == '':
                # Archivo vacío, ignorar o manejar como "no cambio de logo"
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

        # Si no se envió 'logo_empresa' en request.files, el logo actual se mantiene.
        # Si quisieras una opción para 'eliminar logo', necesitarías un campo adicional
        # en el FormData para indicarlo.

        db.session.commit()
        return jsonify({"message": "Empresa actualizada exitosamente.", "empresa": empresa.serialize()}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar empresa por owner: {e}")
        # Retorna el error específico en modo de depuración para entender mejor
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
            activo=True # Se activa por defecto
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