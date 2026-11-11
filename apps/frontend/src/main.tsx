import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import "@/index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Elemento raiz não encontrado.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider><App /></AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

