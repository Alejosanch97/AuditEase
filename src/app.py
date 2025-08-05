"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
import os
from flask import Flask, request, jsonify, url_for, send_from_directory
from flask_migrate import Migrate
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
from dotenv import load_dotenv # <--- Para cargar variables de entorno desde .env

# *** IMPORTACIÓN NECESARIA PARA CORS ***
from flask_cors import CORS # <--- AÑADE ESTA LÍNEA

# *** NUEVAS IMPORTACIONES PARA CORREO Y TOKEN ***
from flask_mail import Mail
from itsdangerous import URLSafeTimedSerializer

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

# *** CONFIGURACIÓN DE CORREO Y SERIALIZADOR ***
# ⚠️ ADVERTENCIA DE SEGURIDAD: Usas una clave secreta débil. Para producción,
# usa una clave larga y aleatoria.
app.config['SECRET_KEY'] = 'CREAR1997'
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'sgsstflow@gmail.com'
app.config['MAIL_PASSWORD'] = 'ofut rtrw kiqk lzpr'
# ----------------------------------------------


# *** INICIALIZACIÓN DE EXTENSIONES ***
jwt = JWTManager(app)
mail = Mail(app) # <--- Inicialización de Flask-Mail

# *** CONFIGURACIÓN DE CLOUDINARY ***
cloudinary.config(
  cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
  api_key = os.getenv('CLOUDINARY_API_KEY'),
  api_secret = os.getenv('CLOUDINARY_API_SECRET'),
  secure = True
)


# database condiguration
db_url = os.getenv("DATABASE_URL")
if db_url is not None:
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace(
        "postgres://", "postgresql://")
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:////tmp/test.db"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
MIGRATE = Migrate(app, db, compare_type=True)
db.init_app(app)

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

# this only runs if `$ python src/main.py` is executed
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=PORT, debug=True)