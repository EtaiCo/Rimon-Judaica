import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "@rimon/design-tokens/tokens.css";
import "./styles/global.css";
import { AuthProvider } from "./auth/AuthContext";
import { CartProvider } from "./cart/CartContext";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <CartProvider>
          <App />
          <Toaster
            richColors
            dir="rtl"
            position="top-center"
            closeButton
          />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
