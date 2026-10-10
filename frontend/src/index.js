import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "katex/dist/katex.min.css";
import "@/index.css";
import App from "@/App";
import { initPwa } from "@/lib/pwa";
import { loadSite, hideBootLoader } from "@/lib/site";

initPwa();
hideBootLoader(loadSite());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});


// Bisa di-override saat self-host lewat REACT_APP_GOOGLE_CLIENT_ID (saat build frontend).
const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "261009463558-etnl0oihtrnuhb8sob3hrbmgbe0a4ves.apps.googleusercontent.com";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);