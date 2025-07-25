import click
from api.models import db, Usuario # ¡Cambiado de 'User' a 'Usuario'!
from werkzeug.security import generate_password_hash # Importa esto para hashear contraseñas
from datetime import datetime # Necesario para fecha_creacion

"""
In this file, you can add as many commands as you want using the @app.cli.command decorator
Flask commands are usefull to run cronjobs or tasks outside of the API but still in integration 
with your database, for example: Import the price of bitcoin every night as 12am
"""
def setup_commands(app):
    
    """ 
    This is an example command "insert-test-users" that you can run from the command line
    by typing: $ flask insert-test-users 5
    Note: 5 is the number of users to add
    """
    @app.cli.command("insert-test-users") # name of our command
    @click.argument("count") # argument of our command
    def insert_test_users(count):
        print("Creando usuarios de prueba...")
        for x in range(1, int(count) + 1):
            # Crea una instancia del modelo Usuario, no User
            usuario = Usuario(
                email="test_user" + str(x) + "@test.com",
                # Genera un hash para la contraseña por seguridad
                contrasena_hash=generate_password_hash("123456"), 
                nombre_completo=f"Usuario de Prueba {x}", # Añade un nombre completo
                rol="usuario_formulario", # Asigna un rol por defecto, puedes ajustarlo
                fecha_creacion=datetime.utcnow() # Asigna la fecha de creación
            )
            # is_active no es un campo en tu modelo Usuario, se elimina
            
            db.session.add(usuario)
            db.session.commit()
            print("Usuario:", usuario.email, "creado.")

        print("Todos los usuarios de prueba creados.")

    @app.cli.command("insert-test-data")
    def insert_test_data():
        # Aquí puedes añadir lógica para insertar otros tipos de datos de prueba
        # como empresas, espacios, formularios, etc.
        print("Insertando datos de prueba adicionales (vacío por ahora)...")
        pass