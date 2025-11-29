import type { NextFunction, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";
import { CouponError, calculatePricing } from "../services/pricing.service.js";
import {
  assertRazorpayConfigured,
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  verifyRazorpaySignature
} from "../services/razorpay.service.js";
import type {
  ConfirmRazorpayPaymentInput,
  CreateRazorpayPaymentInput
} from "../schemas/payment.schema.js";

interface PaymentTransactionRow extends RowDataPacket {
  id: number;
  user_id: number;
  gateway: string;
  status: "created" | "pending" | "paid" | "failed" | "cancelled" | string;
  amount: number;
  amount_paise: number;
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
}

function parseUserId(req: Request): number | null {
  if (!req.user) return null;
  const val = Number.parseInt(req.user.sub, 10);
  return Number.isNaN(val) ? null : val;
}

export async function initiateRazorpayPayment(
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
    assertRazorpayConfigured();
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
    return;
  }

  const payload = req.body as CreateRazorpayPaymentInput;

  let amountPaise: number;
  let amount: number;
  let couponCode: string | null = null;

  try {
    const pricing = await calculatePricing(payload.items, payload.couponCode);
    amount = pricing.total;
    amountPaise = Math.round(pricing.total * 100);
    couponCode = pricing.coupon?.code ?? null;
  } catch (error) {
    if (error instanceof CouponError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    next(error);
    return;
  }

  if (amountPaise <= 0) {
    res.status(400).json({ success: false, error: "Order amount must be greater than zero." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const notes = {
      userId,
      couponCode
    };

    const metadata = {
      items: payload.items
    };

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO payment_transactions (user_id, gateway, status, amount, amount_paise, currency, notes, metadata)
       VALUES (?, 'razorpay', 'created', ?, ?, 'INR', ?, ?)` ,
      [userId, amount, amountPaise, JSON.stringify(notes), JSON.stringify(metadata)]
    );

    const transactionId = result.insertId;
    const receipt = `txn_${transactionId}`;

    const razorpayOrder = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: {
        transactionId: String(transactionId),
        userId: String(userId),
        couponCode: couponCode ?? ""
      }
    });

    await connection.execute(
      `UPDATE payment_transactions
       SET status = 'pending', razorpay_order_id = ?, receipt = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [razorpayOrder.id, razorpayOrder.receipt ?? receipt, transactionId]
    );

    await connection.commit();

    res.json({
      success: true,
      data: {
        transactionId,
        razorpayOrderId: razorpayOrder.id,
        currency: razorpayOrder.currency,
        amount,
        amountPaise,
        keyId: getRazorpayKeyId(),
        couponCode
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function confirmRazorpayPayment(
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
    assertRazorpayConfigured();
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
    return;
  }

  const payload = req.body as ConfirmRazorpayPaymentInput;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<PaymentTransactionRow[]>(
      `SELECT id, user_id, gateway, status, amount, amount_paise, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature
       FROM payment_transactions
       WHERE id = ?
       FOR UPDATE`,
      [payload.transactionId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: "Payment transaction not found." });
      return;
    }

    const transaction = rows[0];

    if (transaction.user_id !== userId) {
      await connection.rollback();
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    if (transaction.gateway !== "razorpay") {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Invalid payment gateway." });
      return;
    }

    if (transaction.status === "paid") {
      await connection.commit();
      res.json({ success: true, data: { transactionId: transaction.id, amount: transaction.amount } });
      return;
    }

    if (!transaction.razorpay_order_id || transaction.razorpay_order_id !== payload.razorpayOrderId) {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Order mismatch for transaction." });
      return;
    }

    const signatureValid = verifyRazorpaySignature({
      orderId: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      signature: payload.razorpaySignature
    });

    if (!signatureValid) {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Invalid payment signature." });
      return;
    }

    const payment = await fetchRazorpayPayment(payload.razorpayPaymentId);

    if (payment.order_id !== payload.razorpayOrderId) {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Payment does not belong to this order." });
      return;
    }

    if (payment.status !== "captured" && payment.status !== "authorized") {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Payment not captured." });
      return;
    }

    if (payment.amount !== transaction.amount_paise) {
      await connection.rollback();
      res.status(400).json({ success: false, error: "Payment amount mismatch." });
      return;
    }

    await connection.execute(
      `UPDATE payment_transactions
       SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payload.razorpayPaymentId, payload.razorpaySignature, transaction.id]
    );

    await connection.commit();

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        amount: transaction.amount
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}
