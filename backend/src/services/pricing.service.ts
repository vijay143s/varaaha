import type { RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";

export class CouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponError";
  }
}

interface ProductPricingRow extends RowDataPacket {
  id: number;
  name: string;
  price: number;
  unit: string;
  is_active: number;
}

interface CouponRow extends RowDataPacket {
  id: number;
  code: string;
  description: string | null;
  discount_type: "percentage" | "amount" | string;
  discount_value: number;
  min_subtotal: number;
  max_redemptions: number | null;
  times_redeemed: number;
  is_active: number;
  starts_at: Date | null;
  expires_at: Date | null;
}

export interface PricingItemInput {
  productId: number;
  quantity: number;
}

export interface PricingItemDetail {
  product: ProductPricingRow;
  quantity: number;
  lineTotal: number;
}

export interface PricingSummary {
  items: PricingItemDetail[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  coupon?: {
    id: number;
    code: string;
    description: string | null;
    discountType: "percentage" | "amount";
    discountValue: number;
  };
  couponRow?: CouponRow;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function assertProductsActive(rows: ProductPricingRow[], expectedCount: number): void {
  if (rows.length !== expectedCount) {
    throw new Error("One or more products not found");
  }

  const inactive = rows.filter((row) => row.is_active === 0);
  if (inactive.length > 0) {
    throw new Error("Some products are inactive");
  }
}

async function fetchProducts(productIds: number[]): Promise<Map<number, ProductPricingRow>> {
  if (productIds.length === 0) {
    throw new Error("No products supplied");
  }

  const placeholders = productIds.map(() => "?").join(", ");
  const [productRows] = await pool.query<ProductPricingRow[]>(
    `SELECT id, name, price, unit, is_active FROM products WHERE id IN (${placeholders})`,
    productIds
  );

  assertProductsActive(productRows, productIds.length);

  const productMap = new Map<number, ProductPricingRow>();
  for (const row of productRows) {
    productMap.set(row.id, row);
  }

  return productMap;
}

async function fetchCoupon(code: string): Promise<CouponRow | null> {
  const [rows] = await pool.query<CouponRow[]>(
    `SELECT id, code, description, discount_type, discount_value, min_subtotal, max_redemptions, times_redeemed, is_active, starts_at, expires_at
     FROM coupons
     WHERE code = ?
     LIMIT 1`,
    [code]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

function evaluateCoupon(coupon: CouponRow, subtotal: number): { discount: number } {
  if (coupon.is_active === 0) {
    throw new CouponError("Coupon is not active");
  }

  const now = new Date();
  if (coupon.starts_at && now < coupon.starts_at) {
    throw new CouponError("Coupon is not yet active");
  }
  if (coupon.expires_at && now > coupon.expires_at) {
    throw new CouponError("Coupon has expired");
  }

  if (subtotal < Number(coupon.min_subtotal ?? 0)) {
    throw new CouponError("Order does not meet the minimum subtotal for this coupon");
  }

  if (coupon.max_redemptions !== null && coupon.times_redeemed >= coupon.max_redemptions) {
    throw new CouponError("Coupon redemption limit reached");
  }

  const type = coupon.discount_type === "percentage" ? "percentage" : "amount";
  const value = Number(coupon.discount_value ?? 0);

  if (value <= 0) {
    throw new CouponError("Coupon discount is invalid");
  }

  let discount = 0;
  if (type === "percentage") {
    discount = roundCurrency((subtotal * value) / 100);
  } else {
    discount = roundCurrency(value);
  }

  if (discount > subtotal) {
    discount = subtotal;
  }

  return { discount };
}

export async function calculatePricing(
  items: PricingItemInput[],
  couponCode?: string | null
): Promise<PricingSummary> {
  if (items.length === 0) {
    throw new Error("No items to price");
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const productMap = await fetchProducts(productIds);

  let subtotal = 0;
  const detailedItems: PricingItemDetail[] = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("Product not found during calculation");
    }
    const lineTotal = roundCurrency(Number(product.price) * item.quantity);
    subtotal += lineTotal;
    return {
      product,
      quantity: item.quantity,
      lineTotal
    };
  });

  subtotal = roundCurrency(subtotal);

  let couponRow: CouponRow | undefined;
  let discount = 0;
  if (couponCode) {
    const fetchedCoupon = await fetchCoupon(couponCode);
    if (!fetchedCoupon) {
      throw new CouponError("Coupon not found");
    }
    const { discount: computed } = evaluateCoupon(fetchedCoupon, subtotal);
    discount = roundCurrency(computed);
    couponRow = fetchedCoupon;
  }

  const tax = 0;
  const shipping = 0;
  const total = roundCurrency(Math.max(subtotal - discount, 0) + tax + shipping);

  return {
    items: detailedItems,
    subtotal,
    discount,
    tax,
    shipping,
    total,
    coupon: couponRow
      ? {
          id: couponRow.id,
          code: couponRow.code,
          description: couponRow.description,
          discountType: couponRow.discount_type === "percentage" ? "percentage" : "amount",
          discountValue: Number(couponRow.discount_value)
        }
      : undefined,
    couponRow
  };
}
