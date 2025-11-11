"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
import os
from flask import Flask, request, jsonify, url_for, send_from_directory
from flask_migrate import Migrate, upgrade
from flask_swagger import swagger
from api.utils import APIException, generate_sitemap
from api.models import db
from api.routes import api
from api.admin import setup_admin
from api.commands import setup_commands

# *** IMPORTACIONES NECESARIAS PARA JWT ***
from flask_jwt_extended import JWTManager
from datetime import timedelta

# *** IMPORTACIONES NECESARIAS PARA CLOUDINARY ***
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv  # <--- Para cargar variables de entorno desde .env

# *** IMPORTACIÓN NECESARIA PARA CORS ***
from flask_cors import CORS  # <--- AÑADE ESTA LÍNEA

# *** NUEVAS IMPORTACIONES PARA CORREO Y TOKEN ***
from flask_mail import Mail
from itsdangerous import URLSafeTimedSerializer

# *** IMPORTACIÓN NECESARIA PARA FLASK-APSCHEDULER ***
from flask_apscheduler import APScheduler # <- IMPORTACIÓN CLAVE

# Cargar variables de entorno desde el archivo .env
load_dotenv()

ENV = "development" if os.getenv("FLASK_DEBUG") == "1" else "production"
static_file_dir = os.path.join(os.path.dirname(
    os.path.realpath(__file__)), '../dist/')
app = Flask(__name__)
app.url_map.strict_slashes = False

# --- CORRECCIÓN CLAVE AQUÍ: Habilitar CORS para TODA la aplicación ---
CORS(app)

# *** CONFIGURACIÓN DE JWT ***
app.config["JWT_SECRET_KEY"] = os.getenv("FLASK_APP_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

# *** CONFIGURACIÓN DE CORREO Y SERIALIZADOR (CORREGIDO PARA SSL/465) ***
# Ahora lee de os.getenv primero (para Render), y usa los valores cableados como fallback (para Codespace)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'CREAR1997'
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER') or 'smtp.gmail.com'

# Es vital asegurar que el puerto sea un entero. Usamos 465 como fallback.
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT')) if os.getenv('MAIL_PORT') else 465

# CAMBIO CRÍTICO 1: Configuración de seguridad para SSL/465. Se desactiva TLS por defecto.
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS') in ('True', 'true', '1') if os.getenv('MAIL_USE_TLS') else False
# CAMBIO CRÍTICO 2: Se añade y activa MAIL_USE_SSL por defecto. Esto resuelve el error de protocolo.
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL') in ('True', 'true', '1') if os.getenv('MAIL_USE_SSL') else True


# CRÍTICO: Lee las credenciales de Render
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME') or 'sgsstflow@gmail.com'
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD') or 'ofut rtrw kiqk lzpr'

# *** CONFIGURACIÓN Y TAREAS DEL SCHEDULER ***
class SchedulerConfig:
    SCHEDULER_API_ENABLED = True
    # Revisa cada 5 minutos si hay formularios a automatizar
    SCHEDULER_JOB_INTERVAL = 300 # en segundos (5 minutos)

app.config.from_object(SchedulerConfig())
scheduler = APScheduler()

# *** INICIALIZACIÓN DE EXTENSIONES ***
jwt = JWTManager(app)
mail = Mail(app)  # <--- Inicialización de Flask-Mail

# *** CONFIGURACIÓN DE CLOUDINARY ***
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

# *** CONFIGURACIÓN DE BASE DE DATOS ***
db_url = os.getenv("DATABASE_URL")
if db_url is not None:
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace(
        "postgres://", "postgresql://")
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:////tmp/test.db"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
MIGRATE = Migrate(app, db, compare_type=True)
db.init_app(app)

# 🔹 Ejecutar migraciones automáticamente al iniciar (para Render plan gratis)
with app.app_context():
    try:
        upgrade()
        print("✅ Migraciones aplicadas correctamente")
    except Exception as e:
        print(f"⚠️ Error al aplicar migraciones: {e}")

# add the admin
setup_admin(app)

# add the commands
setup_commands(app)

# Add all endpoints form the API with a "api" prefix
app.register_blueprint(api, url_prefix='/api')

# Handle/serialize errors like a JSON object
@app.errorhandler(APIException)
def handle_invalid_usage(error):
    return jsonify(error.to_dict()), error.status_code

# generate sitemap with all your endpoints
@app.route('/')
def sitemap():
    if ENV == "development":
        return generate_sitemap(app)
    return send_from_directory(static_file_dir, 'index.html')

# any other endpoint will try to serve it like a static file
@app.route('/<path:path>', methods=['GET'])
def serve_any_other_file(path):
    if not os.path.isfile(os.path.join(static_file_dir, path)):
        path = 'index.html'
    response = send_from_directory(static_file_dir, path)
    response.cache_control.max_age = 0  # avoid cache memory
    return response

# Esta función se ejecutará por el scheduler
# Debe estar fuera del if __name__ == '__main__': para que el scheduler la encuentre
# y necesita un `with app.app_context()` si accede a la base de datos
def ejecutar_tareas_de_automatizacion():
    with app.app_context():
        print("✅ Scheduler: Ejecutando tarea de automatización...")
        # Llama a la lógica de tu API para ejecutar la automatización.
        # Asume que la función está en api.routes.
        # Si tu función se llama 'ejecutar_automatizacion_formularios', la llamas así.
        try:
            from api.routes import ejecutar_automatizacion_formularios
            result = ejecutar_automatizacion_formularios()
            print(f"✅ Scheduler: Tarea de automatización completada. Resultado: {result.json}")
        except Exception as e:
            print(f"⚠️ Scheduler: Error en la tarea de automatización: {e}")


# this only runs if `$ python src/main.py` is executed
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3001))
    
    # === Inicia el scheduler solo en el entorno de producción ===
    # En desarrollo, esto puede causar que la tarea se ejecute dos veces
    # si el reloader de Flask está activo.
    if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        scheduler.init_app(app)
        scheduler.start()
        
        # Agrega la tarea al scheduler.
        # Usamos `interval` para que revise cada 5 minutos.
        # Tu lógica interna de la API decidirá si es la hora correcta para ejecutar.
        scheduler.add_job(
            id='ejecutar_automatizacion_formularios_job',
            func=ejecutar_tareas_de_automatizacion,
            trigger='interval',
            minutes=5
        )

    app.run(host='0.0.0.0', port=PORT, debug=True)