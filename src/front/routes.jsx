// Import necessary components and functions from react-router-dom.

import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
} from "react-router-dom";
import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Single } from "./pages/Single";
import { Demo } from "./pages/Demo";
import { Login } from "./pages/Login";
import { Register } from "./pages/register";
import { Profile } from "./pages/profile";
import { InitialPasswordChange } from "./components/InitialPasswordChange"; 
import { UserCompanyManagement } from "./components/UserCompanyManagement"; 
import { UsersProfile } from "./pages/UsersProfile";


export const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Layout />} errorElement={<h1>Not found!</h1>} >

        <Route path= "/" element={<Home />} />
        <Route path="/single/:theId" element={ <Single />} />
        <Route path="/demo" element={<Demo />} />
        {/* AÑADE LA RUTA PARA TU PÁGINA DE LOGIN AQUÍ */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/cambiar-contrasena-inicial" element={<InitialPasswordChange />} /> // Cambia el path a minúsculas 
        <Route path="/user-company-management" element={<UserCompanyManagement />} />
         <Route path="/usersprofile" element={<UsersProfile />} /> {/* Asegúrate de que este sea el path al que redirige Login */}

       
      </Route>
    )
);