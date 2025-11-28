import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import ReactDOM from "react-dom/client";

import "./styles/tailwind.css";

import { router } from "./routes/index.js";
import { AuthProvider } from "./store/auth-context.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const queryClient = new QueryClient();

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </QueryClientProvider>
);
