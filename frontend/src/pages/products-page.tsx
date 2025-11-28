import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "@heroicons/react/24/outline";

import { apiClient } from "../api/client.js";
import { pushToast } from "../components/toast-rack.js";
import type { Product } from "../types/product.js";
import { useCartStore } from "../store/cart-store.js";

async function fetchProducts(): Promise<Product[]> {
  const response = await apiClient.get("/products", {
    params: { pageSize: 12 }
  });
  return response.data.data.items;
}

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps): JSX.Element {
  const addItem = useCartStore((state) => state.addItem);
  const quantity = useCartStore((state) =>
    state.items.find((item) => item.productId === product.id)?.quantity ?? 0
  );

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      unit: product.unit
    });

    const nextQuantity = quantity + 1;
    pushToast({
      type: "success",
      message:
        nextQuantity === 1
          ? `${product.name} added to cart`
          : `${product.name} quantity updated (${nextQuantity})`
    });
  };

  const initials = useMemo(() => product.name.slice(0, 2).toUpperCase(), [product.name]);

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-frost transition-transform hover:-translate-y-1">
      <button
        type="button"
        aria-label="Add to cart"
        onClick={handleAddToCart}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white transition hover:border-brand-400 hover:bg-brand-500"
      >
        {quantity > 0 ? (
          <span className="text-sm font-semibold">{quantity}</span>
        ) : (
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div className="space-y-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20 text-white">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{product.name}</h2>
          <p className="mt-2 h-14 text-sm text-white/70 line-clamp-3">
            {product.shortDescription ?? "Farm fresh dairy crafted for balanced nutrition."}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between text-white">
          <p className="text-lg font-semibold">₹{product.price.toFixed(2)}</p>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
            {product.unit}
          </span>
        </div>
      </div>
    </article>
  );
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
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
