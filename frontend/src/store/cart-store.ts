import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  increment: (productId: number) => void;
  decrement: (productId: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const MAX_QUANTITY = 99;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) => {
        if (quantity <= 0) return;
        set((state) => {
          const existing = state.items.find((entry) => entry.productId === item.productId);
          if (existing) {
            const nextQuantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
            return {
              items: state.items.map((entry) =>
                entry.productId === item.productId ? { ...entry, quantity: nextQuantity } : entry
              )
            };
          }
          return {
            items: [...state.items, { ...item, quantity: Math.min(quantity, MAX_QUANTITY) }]
          };
        });
      },
      increment: (productId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) }
              : item
          )
        }));
      },
      decrement: (productId) => {
        set((state) => ({
          items: state.items
            .map((item) =>
              item.productId === productId
                ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
                : item
            )
            .filter((item) => item.quantity > 0)
        }));
      },
      remove: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId)
        }));
      },
      clear: () => set({ items: [] })
    }),
    {
      name: "varaaha-cart",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
