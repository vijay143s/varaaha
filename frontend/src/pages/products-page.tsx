import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import type { Product } from "../types/product.js";

async function fetchProducts(): Promise<Product[]> {
  const response = await apiClient.get("/products", {
    params: { pageSize: 12 }
  });
  return response.data.data.items;
}

export function ProductsPage(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  if (isLoading) {
    return <div className="text-white/80">Loading products…</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <p className="text-lg">No products found yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Our Products</h1>
          <p className="text-sm text-white/70">Crafted in small batches. Delivered fresh every dawn.</p>
        </div>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.slug}`}
            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-frost transition-transform hover:-translate-y-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20 text-white">
              {product.name.slice(0, 2)}
            </div>
            <h2 className="mt-6 text-xl font-semibold text-white group-hover:text-white">
              {product.name}
            </h2>
            <p className="mt-2 h-14 text-sm text-white/70 line-clamp-3">
              {product.shortDescription ?? "Farm fresh dairy crafted for balanced nutrition."}
            </p>
            <div className="mt-6 flex items-center justify-between text-white">
              <p className="text-lg font-semibold">₹{product.price.toFixed(2)}</p>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
                {product.unit}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
