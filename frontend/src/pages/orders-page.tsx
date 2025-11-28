import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { useAuth } from "../hooks/use-auth.js";
import type { OrderSummary } from "../types/order.js";

async function fetchOrders(): Promise<OrderSummary[]> {
  const response = await apiClient.get("/orders/me");
  return response.data.data;
}

export function OrdersPage(): JSX.Element {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const focusOrder = searchParams.get("focus");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "me"],
    queryFn: fetchOrders,
    enabled: isAuthenticated
  });

  const ordered = useMemo(() => {
    if (!orders) return [];
    const orderDate = (value: OrderSummary) =>
      value.placedAt ? new Date(value.placedAt).getTime() : 0;
    return orders
      .slice()
      .sort((a: OrderSummary, b: OrderSummary) => orderDate(b) - orderDate(a));
  }, [orders]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h1 className="text-3xl font-semibold text-white">Orders</h1>
        <p className="mt-3">Sign in to track your deliveries and manage upcoming subscriptions.</p>
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

  if (isLoading) {
    return <div className="text-white/70">Loading your orders…</div>;
  }

  if (!ordered || ordered.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h2 className="text-2xl font-semibold text-white">No orders yet</h2>
        <p className="mt-2">Browse the collection to schedule your first delivery.</p>
        <Link to="/products" className="mt-6 inline-flex rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring">
          Explore products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Order history</h1>
        <p className="text-white/60">Detailed snapshots of every Varaaha drop you have booked.</p>
      </header>

      <div className="space-y-4">
        {ordered.map((order) => {
          const highlighted = focusOrder === order.orderNumber;
          const schedule = order.orderType === "scheduled" ? order.deliverySchedule : null;
          const formattedExceptDays = schedule && schedule.exceptDays.length > 0
            ? schedule.exceptDays
                .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
                .join(", ")
            : "None (delivers every day)";
          return (
            <div
              key={order.orderNumber}
              className={`rounded-3xl border px-6 py-6 text-white transition ${
                highlighted
                  ? "border-brand-400 bg-brand-500/10 shadow-neon-ring"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-white/50">Order</p>
                  <p className="text-2xl font-semibold text-white">{order.orderNumber}</p>
                  <p className="text-xs text-white/60">
                    {order.placedAt
                      ? new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        }).format(new Date(order.placedAt))
                      : "Pending confirmation"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm uppercase tracking-widest text-white/50">Total</p>
                  <p className="text-2xl font-semibold text-white">₹{order.total.toFixed(2)}</p>
                  <p className="text-xs uppercase tracking-widest text-white/50">{order.status}</p>
                </div>
              </div>

              {schedule && (
                <div className="mt-4 rounded-2xl border border-brand-400/30 bg-brand-500/5 p-4 text-sm text-white/80">
                  <p className="font-semibold text-white">Scheduled delivery</p>
                  <p className="mt-1">
                    Start: {schedule.startDate ?? "Not set"}
                    {schedule.endDate ? ` · Ends: ${schedule.endDate}` : ""}
                  </p>
                  <p className="mt-1">Skip days: {formattedExceptDays}</p>
                  {schedule.paused && (
                    <p className="mt-1 font-medium text-amber-300">Delivery is currently paused.</p>
                  )}
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-white">{item.productName}</p>
                    <p className="text-xs text-white/60">{item.quantity} × ₹{item.unitPrice.toFixed(2)}</p>
                    <p className="mt-2 text-sm font-semibold text-brand-200">₹{item.totalPrice.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
