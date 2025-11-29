import crypto from "node:crypto";
import Razorpay from "razorpay";

import { env } from "../config/env.js";

const isConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!isConfigured || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.");
  }

  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }

  return client;
}

export function assertRazorpayConfigured(): void {
  if (!isConfigured) {
    throw new Error("Razorpay credentials are missing. Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
}

interface CreateOrderInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string | number | boolean | null | undefined>;
}

export async function createRazorpayOrder({
  amountPaise,
  currency = "INR",
  receipt,
  notes = {}
}: CreateOrderInput): Promise<Razorpay.Order> {
  const instance = getClient();

  const order = await instance.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    payment_capture: 1,
    notes
  });

  return order;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<Razorpay.Payment> {
  const instance = getClient();
  const payment = await instance.payments.fetch(paymentId);
  return payment;
}

interface VerifySignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature
}: VerifySignatureInput): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expectedSignature === signature;
}

export function getRazorpayKeyId(): string | null {
  return env.RAZORPAY_KEY_ID ?? null;
}
