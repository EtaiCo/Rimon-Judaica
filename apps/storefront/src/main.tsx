import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "@rimon/design-system/tokens.css";
import "./styles/global.css";
import { AuthProvider } from "./auth/AuthContext";
import { BootstrapProvider } from "./context/BootstrapContext";
import { CartProvider } from "./cart/CartContext";
import { WishlistProvider } from "./wishlist/WishlistContext";
import { App } from "./App";

const routerBaseName =
  import.meta.env.BASE_URL === "./" ? "/" : import.meta.env.BASE_URL;

const rootEl = document.getElementById("root");

createRoot(rootEl!).render(
  <StrictMode>
    <BrowserRouter basename={routerBaseName}>
      <AuthProvider>
        <BootstrapProvider>
          <CartProvider>
            <WishlistProvider>
              <App />
              <Toaster
                richColors
                dir="rtl"
                position="top-center"
                closeButton
              />
            </WishlistProvider>
          </CartProvider>
        </BootstrapProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
