export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export type OrderType = "one_time" | "scheduled";

export interface OrderDeliverySchedule {
  startDate: string | null;
  endDate: string | null;
  exceptDays: string[];
  paused: boolean;
}

export interface OrderSummary {
  orderNumber: string;
  orderType: OrderType;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  placedAt: string | null;
  deliverySchedule: OrderDeliverySchedule | null;
  items: OrderItem[];
}
