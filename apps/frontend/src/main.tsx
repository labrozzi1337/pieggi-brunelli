import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import "@/index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Elemento raiz não encontrado.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

