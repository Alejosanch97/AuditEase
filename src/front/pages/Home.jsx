import React, { useEffect, useRef, useState } from "react";
import "aos/dist/aos.css";
import AOS from "aos";
import "../styles/home.css";
import "bootstrap/dist/css/bootstrap.min.css";

export const Home = () => {
  // Estado para controlar la visibilidad del modal
  const [showModal, setShowModal] = useState(false);

  // Funciones para abrir y cerrar el modal
  const handleCloseModal = () => setShowModal(false);
  const handleShowModal = () => setShowModal(true);

  // Manejador para el envío del formulario del modal (puedes añadir tu lógica de envío aquí)
  const handleFormSubmit = (event) => {
    event.preventDefault(); // Previene el comportamiento por defecto del formulario
    // Aquí puedes añadir la lógica para enviar los datos del formulario
    console.log("Formulario enviado");
    handleCloseModal(); // Cierra el modal después de enviar
  };

  useEffect(() => {
    AOS.init({ duration: 1000 });
    window.scrollTo(0, 0);
  }, []);

  // Referencias para los carruseles
  const clientsCarouselRef = useRef(null);
  const testimonialsCarouselRef = useRef(null);

  // Data para los testimonios (¡NO DUPLICADA!)
  const testimonialsData = [
    { text: "“Antes todo era papel y caos. Ahora con SGSST Flow tenemos control y alertas para no olvidar llenar nada.”", author: "Natalia R.", role: "Coordinadora HSEQ, colegio privado", avatar: "/avatar-natalia.png" },
    { text: "“Nos ayudó a pasar la inspección sin problemas, y tenemos todo con firma digital. ¡Una solución que realmente funciona!”", author: "Luis D.", role: "Administrador de gimnasio", avatar: "/avatar-luis.png" },
    { text: "“La interfaz es súper amigable, incluso para quienes no son expertos en tecnología. Ahorramos muchísimo tiempo.”", author: "Carolina S.", role: "Gerente de RRHH, empresa manufacturera", avatar: "/avatar-carolina.png" },
    { text: "“Las notificaciones de la IA son un salvavidas. Nunca más se nos pasa un plazo importante de seguridad.”", author: "Pedro M.", role: "Jefe de Producción, industria alimenticia", avatar: "/avatar-pedro.png" },
    { text: "“Tener todos los formatos y reportes centralizados nos ha permitido tomar decisiones más rápidas y efectivas.”", author: "Ana G.", role: "Directora General, cadena de restaurantes", avatar: "/avatar-ana.png" }
  ];

  // Data para los clientes/sectores (¡NO DUPLICADA!)
  const clientsData = [
    { icon: "🏋️‍♀️", title: "Gimnasios y centros deportivos", desc: "Simplifica el control de seguridad para equipos, protocolos de emergencia y bienestar de usuarios." },
    { icon: "🏫", title: "Colegios y jardines", desc: "Digitaliza inspecciones de infraestructura, planes de evacuación y registros de capacitaciones para personal y alumnos." },
    { icon: "🍔", title: "Restaurantes y cocina industrial", desc: "Optimiza la gestión de riesgos en cocinas, manejo de alimentos y cumplimiento de normativas de higiene y seguridad." },
    { icon: "🎬", title: "Cines y entretenimiento", desc: "Asegura la seguridad en instalaciones, eventos masivos y equipos, garantizando la protección de empleados y visitantes." },
    { icon: "🏢", title: "Empresas de todos los tamaños", desc: "Adaptable a cualquier industria, SGSST Flow centraliza y automatiza la gestión de seguridad y salud en el trabajo." }
  ];


  const scrollCarousel = (ref, direction) => {
    if (!ref.current) return;

    const container = ref.current;
    const item = container.querySelector('.carousel-card-item');
    if (!item) return;

    const itemWidth = item.offsetWidth;
    const gap = parseFloat(getComputedStyle(item).marginRight) + parseFloat(getComputedStyle(item).marginLeft); // Get total horizontal margin
    const scrollAmount = itemWidth + gap;

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === 'right') {
      if (currentScroll + scrollAmount < maxScroll + 1) { // +1 to account for potential sub-pixel rendering
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      } else {
        // Optionally, scroll to the very end if close, or just stop
        container.scrollTo({ left: maxScroll, behavior: 'smooth' });
      }
    } else { // direction === 'left'
      if (currentScroll - scrollAmount > -1) { // -1 to account for potential sub-pixel rendering
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        // Optionally, scroll to the very beginning if close, or just stop
        container.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  };


  return (
    <div>
      {/* Hero Section */}
      <section className="hero-wrapper text-center d-flex align-items-center justify-content-center">
        <div className="hero-content container py-5 px-4">
          <h1 className="display-3 fw-bold text-white mb-4">
            Digitaliza tu <span className="highlight">SGSST</span> con SGSST Flow
          </h1>
          <p className="lead text-white-75 mb-5">
            Transforma la gestión de Seguridad y Salud en el Trabajo en tu empresa con una plataforma intuitiva, segura y sin papeles.
          </p>

          <div className="hero-features-new mb-5">
            <div className="feature-item-new">
              <span className="feature-icon-new">✅</span> Llena todos tus formatos en línea
            </div>
            <div className="feature-item-new">
              <span className="feature-icon-new">✍️</span> Firma digital y exportación en PDF
            </div>
            <div className="feature-item-new">
              <span className="feature-icon-new">🧠</span> IA que te recuerda cuándo llenar tus formatos
            </div>
            <div className="feature-item-new">
              <span className="feature-icon-new">📊</span> Reportes automáticos y estadísticas en tiempo real
            </div>
          </div>

          <button className="btn btn-primary btn-lg custom-btn-hero-new" onClick={handleShowModal}>
            🚀 Registrar mi empresa
          </button>
        </div>
      </section>

      {/* Beneficios */}
      <section className="container py-5" id="beneficios">
        <h2 className="text-center mb-5 fw-bold" data-aos="fade-up">
          Todo lo que tu <span className="highlight">SGSST</span> necesita, en un solo lugar
        </h2>
        <div className="row g-4">
          {[
            { icon: "🗃️", title: "Centraliza tus formatos", desc: "Desde inspecciones hasta planillas de capacitación, todo digitalizado y organizado." },
            { icon: "🛠️", title: "Crea tus propios formularios", desc: "¿Tienes formatos propios o cambió la ley? Personalízalos fácilmente." },
            { icon: "📈", title: "Panel de control inteligente", desc: "Visualiza indicadores, estadísticas y cumple con la norma sin perder tiempo." },
            { icon: "🧠", title: "Asistente con IA", desc: "Recibe alertas automáticas y recomendaciones para mantener tu SGSST al día." },
            { icon: "🖋️", title: "Firma digital + PDF", desc: "Exporta tus formatos, fírmalo desde la plataforma y envíalo por correo en segundos." }
          ].map((card, idx) => (
            <div key={idx} className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm benefit-card" data-aos="fade-up" data-aos-delay={idx * 100}>
                <div className="card-body text-center">
                  <div className="benefit-icon">{card.icon}</div>
                  <h5 className="card-title mt-3 fw-bold">{card.title}</h5>
                  <p className="card-text">{card.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Así funciona - Full-Screen Section "Gestionar tu SGSST nunca fue tan fácil" */}
      <section className="full-screen-manage-sgsst-section" id="funciona">
        <div className="container manage-sgsst-content">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h2 className="fw-bold"><span className="highlight">Gestionar tu SGSST</span> nunca fue tan fácil.</h2>
              <p>
                Con SGSST Flow, simplifica y automatiza todos los procesos relacionados con la Seguridad y Salud en el Trabajo, desde la gestión de documentos hasta la programación de inspecciones y la capacitación de personal. Nuestra plataforma intuitiva te permite mantener todo bajo control y al día con la normativa vigente.
              </p>
              <ul className="feature-list">
                <li><span>✅</span> Digitalización completa de todos tus documentos.</li>
                <li><span>✅</span> Automatización de notificaciones y recordatorios.</li>
                <li><span>✅</span> Acceso en tiempo real a indicadores clave.</li>
                <li><span>✅</span> Capacitaciones interactivas para tu equipo.</li>
              </ul>
            </div>
            <div className="col-md-6 text-center">
              <img src="/sgsst.svg" alt="Digital forms on a monitor" className="img-fluid" />
            </div>
          </div>
        </div>
      </section>

      {/* Clientes - Carrusel */}
      <section className="container py-5" id="clientes">
        <h2 className="text-center fw-bold mb-5">Ideal para empresas de <span className="highlight">todos los sectores</span></h2>
        <div className="carousel-container-wrapper clients-carousel-wrapper">
          <button className="carousel-control-prev" onClick={() => scrollCarousel(clientsCarouselRef, 'left')}>
            <span className="carousel-control-prev-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Previous</span>
          </button>
          <div className="carousel-inner-custom" ref={clientsCarouselRef}>
            {clientsData.map((sector, idx) => ( // Using original clientsData
              <div key={idx} className="carousel-card-item">
                <div className="card h-100 shadow-sm client-card" data-aos="fade-up" data-aos-delay={idx * 100}>
                  <div className="card-body text-center">
                    <div className="client-icon">{sector.icon}</div>
                    <h5 className="fw-bold mt-3">{sector.title}</h5>
                    <p>{sector.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="carousel-control-next" onClick={() => scrollCarousel(clientsCarouselRef, 'right')}>
            <span className="carousel-control-next-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Next</span>
          </button>
        </div>
      </section>

      {/* Cumple la norma & IA - Diseño de dos columnas */}
      <section className="py-5 bg-light feature-section">
        <div className="container">
          <div className="row align-items-center mb-5 feature-row">
            <div className="col-md-6" data-aos="fade-right">
              <h2 className="fw-bold mb-4">SGSST Flow cumple con la normativa colombiana</h2>
              <ul className="feature-list">
                <li data-aos="fade-up" data-aos-delay="100"><span>✔️</span> Accesos con roles diferenciados</li>
                <li data-aos="fade-up" data-aos-delay="200"><span>✔️</span> Firma digital válida</li>
                <li data-aos="fade-up" data-aos-delay="300"><span>✔️</span> Historial de versiones</li>
                <li data-aos="fade-up" data-aos-delay="400"><span>✔️</span> Exportación en PDF</li>
                <li data-aos="fade-up" data-aos-delay="500"><span>✔️</span> Envío automático por correo a entes de control</li>
              </ul>
            </div>
            <div className="col-md-6 text-center" data-aos="fade-left">
              <img src="/form.svg" alt="Compliance checklist on screen" className="img-fluid" />
            </div>
          </div>

          <hr className="my-5" />

          <div className="row align-items-center flex-row-reverse feature-row">
            <div className="col-md-6 order-md-2" data-aos="fade-left">
              <h2 className="fw-bold mb-4">La IA que te ayuda a no olvidar ningún formato</h2>
              <p className="lead">
                SGSST Flow analiza tus registros y te envía notificaciones sobre los formularios que debes llenar, con qué frecuencia y qué campos no debes dejar incompletos.
              </p>
            </div>
            <div className="col-md-6 text-center order-md-1" data-aos="fade-right">
              <img src="/ai.svg" alt="AI assistant icon" className="img-fluid" />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios - Carrusel Full-Screen "Lo que nuestros usuarios dicen" */}
      <section className="full-screen-testimonials-section" id="testimonios">
        <h2 className="text-center fw-bold mb-5"><span className="highlight">Lo que nuestros usuarios dicen</span></h2>
        <div className="carousel-container-wrapper testimonials-carousel-wrapper">
          <button className="carousel-control-prev" onClick={() => scrollCarousel(testimonialsCarouselRef, 'left')}>
            <span className="carousel-control-prev-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Previous</span>
          </button>
          <div className="carousel-inner-custom" ref={testimonialsCarouselRef}>
            {testimonialsData.map((testimonial, idx) => ( // Using original testimonialsData
              <div key={idx} className="carousel-card-item">
                <div className="card h-100 shadow-sm client-card testimonial-override">
                  <div className="card-body">
                    <p className="blockquote-text">{testimonial.text}</p>
                    <div className="d-flex align-items-center mt-4">
                      <div>
                        <h6 className="mb-0 fw-bold">{testimonial.author}</h6>
                        <small className="text-muted">{testimonial.role}</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="carousel-control-next" onClick={() => scrollCarousel(testimonialsCarouselRef, 'right')}>
            <span className="carousel-control-next-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Next</span>
          </button>
        </div>
      </section>

      <footer className="text-center py-4 bg-dark text-white">
        <h5 className="mb-1">SGSST Flow</h5>
        <p>Tecnología para transformar tu sistema de Seguridad y Salud en el Trabajo.</p>
        <p className="small mb-0">📧 sgsstflow@gmail.com | 📱 WhatsApp: +57 3173769865</p>
      </footer>

      {/* Modal Personalizado */}
      {showModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="custom-modal-header">
              <h5 className="custom-modal-title">¡Digitaliza tu SGSST hoy!</h5>
              <button type="button" className="custom-modal-close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>
            <div className="custom-modal-body">
              <p className="text-center text-muted mb-4">
                Recibe toda la información por WhatsApp o correo en menos de 24 horas.
              </p>
              <form onSubmit={handleFormSubmit}>
                <div className="mb-3">
                  <label htmlFor="companyName" className="form-label">Nombre de la empresa</label>
                  <input type="text" className="form-control custom-input-field" id="companyName" placeholder="Tu empresa" required />
                </div>
                <div className="mb-3">
                  <label htmlFor="responsibleName" className="form-label">Nombre del responsable</label>
                  <input type="text" className="form-control custom-input-field" id="responsibleName" placeholder="Tu nombre" required />
                </div>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Correo electrónico</label>
                  <input type="email" className="form-control custom-input-field" id="email" placeholder="ejemplo@empresa.com" required />
                </div>
                <div className="mb-4">
                  <label htmlFor="whatsapp" className="form-label">WhatsApp</label>
                  <input type="text" className="form-control custom-input-field" id="whatsapp" placeholder="+57 3XX XXX XXXX" />
                </div>
                <div className="custom-modal-footer d-flex justify-content-center">
                  <button type="submit" className="custom-btn-modal-submit">
                    Enviar mi solicitud
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};