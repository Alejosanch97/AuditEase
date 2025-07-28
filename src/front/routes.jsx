import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
} from "react-router-dom";

// Importa tus layouts desde sus nuevas ubicaciones
import { Layout } from "./pages/Layout"; // Tu layout público
import { DashboardLayout } from "./pages/DashboardLayout"; // Tu layout del dashboard

// Importa tus páginas
import { Home } from "./pages/Home";
import { Single } from "./pages/Single";
import { Demo } from "./pages/Demo";
import { Login } from "./pages/Login";
import { Register } from "./pages/register";
import { Profile } from "./pages/profile";
import { InitialPasswordChange } from "./components/InitialPasswordChange"; 
import { UserCompanyManagement } from "./components/UserCompanyManagement"; 
import { UsersProfile } from "./pages/UsersProfile";
import { SpaceManagement } from './components/SpaceManagement';
import { CreateForms } from "./pages/CreateForms";
import { AnswerForms } from "./pages/AnswerForms"; // Asumo que esta es la lista de formularios
import { AnswerFormPage} from "./pages/AnswerFormPage"; // La página para responder un formulario específico


export const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        {/* Rutas Públicas - Envueltas por el Layout (con Navbar y Footer) */}
        <Route element={<Layout />} errorElement={<h1>Not found!</h1>}>
            <Route path= "/" element={<Home />} />
            <Route path="/single/:theId" element={ <Single />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cambiar-contrasena-inicial" element={<InitialPasswordChange />} />
            {/* Si tienes otras rutas públicas, añádelas aquí */}
        </Route>

        {/* Rutas Protegidas - Envueltas por DashboardLayout (con Sidebar, sin Navbar) */}
        {/* DashboardLayout manejará la autenticación y la carga global de datos */}
        <Route element={<DashboardLayout />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/user-company-management" element={<UserCompanyManagement />} />
            <Route path="/usersprofile" element={<UsersProfile />} />
            <Route path="/manage-spaces" element={<SpaceManagement />} /> 
            <Route path="/CreateForms" element={<CreateForms />} />
            <Route path="/Answerforms" element={<AnswerForms />} /> {/* Lista de formularios para contestar */}
            <Route path="/answer-form/:formId" element={<AnswerFormPage />} /> {/* Página para contestar un formulario específico */}
            {/* Si tienes otras rutas protegidas, añádelas aquí */}
        </Route>
      </>
    )
);
