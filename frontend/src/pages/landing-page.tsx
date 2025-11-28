import { Link } from "react-router-dom";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

import { useAuth } from "../hooks/use-auth.js";

export function LandingPage(): JSX.Element {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-24">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 px-8 py-16 shadow-frost">
        <div className="absolute inset-px -z-10 rounded-[calc(theme(borderRadius.3xl)-1px)] bg-gradient-to-br from-brand-500/40 via-transparent to-slate-900" />
        <div className="grid gap-12 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-widest text-white/80">
              Farm to Table • Sustainably Delivered
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Elevate your day with futuristic dairy crafted for modern living.
            </h1>
            <p className="mt-6 text-lg text-white/80">
              Varaaha brings ethically sourced milk, curd, paneer, and more straight from our farms to your smart fridge.
              Experience nutrient-rich goodness wrapped in a seamless digital journey.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring hover:bg-brand-400"
              >
                Explore products
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:border-white/40"
                >
                  Start subscription
                </Link>
              )}
            </div>
          </motion.div>
          <motion.div
            className="relative flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="relative h-80 w-full max-w-md rounded-[2.5rem] bg-gradient-to-br from-brand-500/30 via-slate-900 to-slate-950 p-1 shadow-neon-ring">
              <div className="absolute inset-3 rounded-[2rem] border border-white/10" />
              <div className="absolute inset-8 rounded-3xl bg-white/10" />
              <div className="absolute inset-16 flex flex-col justify-between rounded-3xl bg-slate-950/90 p-8">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/50">Daily drop</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Organic Whole Milk</h2>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-white/60">Ultra-fresh • 4.5% fat • A2 verified</p>
                  <p className="text-4xl font-bold text-white">₹65</p>
                  <button
                    type="button"
                    className="w-full rounded-full bg-white/90 px-4 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    Schedule delivery
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid gap-10 md:grid-cols-3">
        {["Nutrient Optimized", "Temperature Controlled", "Zero-Waste Logistics"].map((title) => (
          <div
            key={title}
            className="rounded-2xl border border-white/5 bg-white/5 p-6 shadow-lg shadow-brand-900/20 backdrop-blur"
          >
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="mt-3 text-sm text-white/70">
              Cutting-edge processing with smart tracking ensures every Varaaha product stays pure, potent, and planet-friendly.
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
