import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Layout from "./components/Layout";
import StrategiesPage from "./pages/StrategiesPage";
import DeployPage from "./pages/DeployPage";
import PlaygroundPage from "./pages/PlaygroundPage";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/Dashboard";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/deploy/:id" element={<DeployPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
);
