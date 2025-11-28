import type { NextFunction, Request, Response } from "express";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";
import type {
  CreateOrderInput,
  UpdateOrderStatusInput
} from "../schemas/order.schema.js";
import type { AddressInput } from "../schemas/address.schema.js";
import { generateOrderNumber } from "../utils/order-number.js";
import {
  CouponError,
  calculatePricing,
  type PricingSummary
} from "../services/pricing.service.js";

interface OrderRow extends RowDataPacket {
  id: number;
  order_number: string;
  user_id: number;
  order_type: "one_time" | "scheduled" | string;
  schedule_start_date: Date | string | null;
  schedule_end_date: Date | string | null;
  schedule_except_days: string | null;
  schedule_paused: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  discount_amount: number;
  coupon_code: string | null;
  placed_at: Date;
  created_at: Date;
  updated_at: Date;
  billing_address_id: number | null;
  shipping_address_id: number | null;
}

interface OrderItemRow extends RowDataPacket {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

function parseUserId(req: Request): number | null {
  if (!req.user) return null;
  const val = Number.parseInt(req.user.sub, 10);
  return Number.isNaN(val) ? null : val;
}

function mapOrderResponse(order: OrderRow, items: OrderItemRow[]) {
  const parseScheduleExceptDays = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === "string");
      }
      return [];
    } catch {
      return [];
    }
  };

  const dateToIso = (value: Date | string | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const exceptDays = parseScheduleExceptDays(order.schedule_except_days);
  const deliverySchedule =
    order.order_type === "scheduled"
      ? {
          startDate: dateToIso(order.schedule_start_date),
          endDate: dateToIso(order.schedule_end_date),
          exceptDays,
          paused: order.schedule_paused === 1
        }
      : null;

  return {
    orderNumber: order.order_number,
    orderType: (order.order_type as "one_time" | "scheduled") ?? "one_time",
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    subtotal: Number(order.subtotal_amount),
  discount: Number(order.discount_amount ?? 0),
    tax: Number(order.tax_amount),
    shipping: Number(order.shipping_amount),
    total: Number(order.total_amount),
  couponCode: order.coupon_code ?? null,
    placedAt: order.placed_at,
    deliverySchedule,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      totalPrice: Number(item.total_price)
    }))
  };
}

async function upsertAddress(
  userId: number,
  addressId: number | undefined,
  address: AddressInput | undefined,
  connection: PoolConnection
): Promise<number> {
  if (addressId) {
    return addressId;
  }

  if (!address) {
    throw new Error("Address information missing");
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      userId,
      address.fullName,
      address.phone,
      address.addressLine1,
      address.addressLine2 ?? null,
      address.city,
      address.state,
      address.postalCode,
      address.country ?? "India"
    ]
  );

  return result.insertId;
}

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = parseUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const payload = req.body as CreateOrderInput;

  const isScheduled = payload.orderType === "scheduled";
  const formatDateOnly = (input: Date | undefined): string | null => {
    if (!input) return null;
    const year = input.getUTCFullYear();
    const month = String(input.getUTCMonth() + 1).padStart(2, "0");
    const day = String(input.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const scheduleStartDate = isScheduled ? formatDateOnly(payload.scheduleStartDate) : null;
  const scheduleEndDate =
    isScheduled && payload.scheduleEndDate ? formatDateOnly(payload.scheduleEndDate) : null;

  const scheduleExceptDays = isScheduled
    ? (() => {
        const days = Array.from(new Set(payload.scheduleExceptDays ?? []));
        return days.length > 0 ? JSON.stringify(days) : null;
      })()
    : null;

  const schedulePaused = isScheduled && payload.schedulePause ? 1 : 0;

  try {
    let pricing: PricingSummary;
    try {
      pricing = await calculatePricing(payload.items, payload.couponCode);
    } catch (error) {
      if (error instanceof CouponError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }

    const itemsPayload = pricing.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      total: item.lineTotal
    }));

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const shippingAddressId = await upsertAddress(
        userId,
        payload.shippingAddressId,
        payload.shippingAddress,
        connection
      );

      const billingAddressId = await upsertAddress(
        userId,
        payload.billingAddressId ?? payload.shippingAddressId,
        payload.billingAddress ?? payload.shippingAddress,
        connection
      );

      const orderNumber = generateOrderNumber();

      const [orderResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO orders (
           order_number,
           user_id,
           billing_address_id,
           shipping_address_id,
           order_type,
           schedule_start_date,
           schedule_end_date,
           schedule_except_days,
           schedule_paused,
           status,
           payment_status,
           payment_method,
           coupon_code,
           subtotal_amount,
           discount_amount,
           tax_amount,
           shipping_amount,
           total_amount
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          userId,
          billingAddressId,
          shippingAddressId,
          payload.orderType ?? "one_time",
          scheduleStartDate,
          scheduleEndDate,
          scheduleExceptDays,
          schedulePaused,
          payload.paymentMethod ?? "cash_on_delivery",
          pricing.coupon?.code ?? null,
          pricing.subtotal,
          pricing.discount,
          pricing.tax,
          pricing.shipping,
          pricing.total
        ]
      );

      const orderId = orderResult.insertId;

      const orderItemValues = itemsPayload.map((item) => [
        orderId,
        item.product.id,
        item.product.name,
        item.product.price,
        item.quantity,
        item.total
      ]);

      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
         VALUES ${orderItemValues.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
        orderItemValues.flat()
      );

      await connection.query(
        `INSERT INTO inventory_movements (product_id, change_type, quantity, note)
         VALUES ${itemsPayload
           .map(() => "(?, 'stock_out', ?, 'Order deduction')")
           .join(", ")}`,
        itemsPayload.flatMap((item) => [item.product.id, item.quantity])
      );

      if (pricing.coupon?.id) {
        await connection.execute(
          `UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE id = ?`,
          [pricing.coupon.id]
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          orderNumber,
          totalAmount: pricing.total,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          couponCode: pricing.coupon?.code ?? null
        }
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

export async function listMyOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = parseUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const [orders] = await pool.query<OrderRow[]>(
      `SELECT id, order_number, order_type, schedule_start_date, schedule_end_date, schedule_except_days, schedule_paused, status, payment_status, payment_method, coupon_code, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, placed_at, created_at, updated_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    if (orders.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const orderIds = orders.map((order) => order.id);
    const [items] = await pool.query<OrderItemRow[]>(
      `SELECT id, order_id, product_id, product_name, unit_price, quantity, total_price
       FROM order_items
       WHERE order_id IN (${orderIds.map(() => "?").join(", ")})
       ORDER BY id ASC`,
      orderIds
    );

    const itemMap = new Map<number, OrderItemRow[]>();
    for (const item of items) {
      const list = itemMap.get(item.order_id) ?? [];
      list.push(item);
      itemMap.set(item.order_id, list);
    }

    res.json({
      success: true,
      data: orders.map((order) =>
        mapOrderResponse(order, itemMap.get(order.id) ?? [])
      )
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderByNumber(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = parseUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const { orderNumber } = req.params;

  try {
    const [orders] = await pool.query<OrderRow[]>(
      `SELECT id, order_number, order_type, schedule_start_date, schedule_end_date, schedule_except_days, schedule_paused, status, payment_status, payment_method, coupon_code, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, placed_at, created_at, updated_at, user_id
       FROM orders
       WHERE order_number = ?
       LIMIT 1`,
      [orderNumber]
    );

    if (orders.length === 0) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    const order = orders[0];

    if (order.user_id !== userId && req.user?.role !== "admin") {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    const [items] = await pool.query<OrderItemRow[]>(
      `SELECT id, order_id, product_id, product_name, unit_price, quantity, total_price
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [order.id]
    );

    res.json({ success: true, data: mapOrderResponse(order, items) });
  } catch (error) {
    next(error);
  }
}

export async function adminListOrders(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [orders] = await pool.query<OrderRow[]>(
      `SELECT id, order_number, order_type, schedule_start_date, schedule_end_date, schedule_except_days, schedule_paused, status, payment_status, payment_method, coupon_code, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, placed_at, created_at, updated_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 100`
    );

    if (orders.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const orderIds = orders.map((order) => order.id);
    const [items] = await pool.query<OrderItemRow[]>(
      `SELECT id, order_id, product_id, product_name, unit_price, quantity, total_price
       FROM order_items
       WHERE order_id IN (${orderIds.map(() => "?").join(", ")})
       ORDER BY id ASC`,
      orderIds
    );

    const itemMap = new Map<number, OrderItemRow[]>();
    for (const item of items) {
      const list = itemMap.get(item.order_id) ?? [];
      list.push(item);
      itemMap.set(item.order_id, list);
    }

    res.json({
      success: true,
      data: orders.map((order) =>
        mapOrderResponse(order, itemMap.get(order.id) ?? [])
      )
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { orderNumber } = req.params;
  const payload = req.body as UpdateOrderStatusInput;

  try {
    const [orders] = await pool.query<OrderRow[]>(
      `SELECT id FROM orders WHERE order_number = ? LIMIT 1`,
      [orderNumber]
    );

    if (orders.length === 0) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    const order = orders[0];

    const fields = ["status = ?"];
    const values: Array<string> = [payload.status];

    if (payload.paymentStatus) {
      fields.push("payment_status = ?");
      values.push(payload.paymentStatus);
    }

    await pool.execute(
      `UPDATE orders SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, order.id]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
