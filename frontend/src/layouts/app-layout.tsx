import { Outlet } from "react-router-dom";

import { Navbar } from "../components/navbar.js";
import { ToastRack } from "../components/toast-rack.js";

export function AppLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-grid-glow" aria-hidden />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-24">
        <Outlet />
      </main>
      <ToastRack />
    </div>
  );
}
