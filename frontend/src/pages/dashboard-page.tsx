import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { useAuth } from "../hooks/use-auth.js";
import type { OrderSummary } from "../types/order.js";

async function fetchOrders(): Promise<OrderSummary[]> {
  const response = await apiClient.get("/orders/me");
  return response.data.data;
}

export function DashboardPage(): JSX.Element {
  const { user, isAuthenticated } = useAuth();

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", "me"],
    queryFn: fetchOrders,
    enabled: isAuthenticated
  });

  const metrics = useMemo(() => {
    const list = orders ?? [];

    if (list.length === 0) {
      return { totalOrders: 0, totalSpent: 0, pendingOrders: 0 };
    }

    const totalOrders = list.length;
    const totalSpent = list.reduce((sum: number, order: OrderSummary) => sum + order.total, 0);
    const pendingOrders = list.filter((order: OrderSummary) => order.status === "pending").length;

    return { totalOrders, totalSpent, pendingOrders };
  }, [orders]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h1 className="text-3xl font-semibold text-white">Your Varaaha space awaits</h1>
        <p className="mt-3">
          Sign in to manage subscriptions, review orders, and track deliveries in real time.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/signin" className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring">
            Sign in
          </Link>
          <Link to="/signup" className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/80">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 text-white/70">
        <p>We had trouble loading your data.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-2xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.2em] text-brand-200/80">Welcome back</p>
        <h1 className="text-4xl font-semibold text-white">{user?.fullName ?? user?.email}</h1>
        <p className="text-white/60">Here is a quick look at your Varaaha journey.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">Total orders</p>
          <p className="mt-3 text-3xl font-semibold text-white">{metrics.totalOrders}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">Lifetime spend</p>
          <p className="mt-3 text-3xl font-semibold text-white">₹{metrics.totalSpent.toFixed(2)}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">Pending deliveries</p>
          <p className="mt-3 text-3xl font-semibold text-white">{metrics.pendingOrders}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Recent orders</h2>
          <Link to="/orders" className="text-sm font-medium text-brand-200 hover:text-brand-100">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/70">Loading…</div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.slice(0, 3).map((order) => (
              <Link
                key={order.orderNumber}
                to={`/orders?focus=${order.orderNumber}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white/80 hover:border-brand-400"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Order {order.orderNumber}</p>
                  <p className="text-xs text-white/60">
                    {order.placedAt
                      ? new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        }).format(new Date(order.placedAt))
                      : "Processing"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">₹{order.total.toFixed(2)}</p>
                  <p className="text-xs uppercase tracking-wide text-white/50">{order.status}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/70">
            <p>No orders yet. Your first delivery is just a tap away.</p>
          </div>
        )}
      </section>
    </div>
  );
}
