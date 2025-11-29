declare module "razorpay" {
  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  interface OrderCreateParams {
    amount: number;
    currency?: string;
    receipt?: string;
    payment_capture?: number;
    notes?: Record<string, unknown>;
  }

  namespace Razorpay {
    interface Order {
      id: string;
      entity: "order";
      amount: number;
      amount_paid: number;
      amount_due: number;
      currency: string;
      receipt: string | null;
      offer_id: string | null;
      status: string;
      attempts: number;
      notes?: Record<string, unknown>;
      created_at: number;
    }

    interface Payment {
      id: string;
      entity: "payment";
      amount: number;
      currency: string;
      status: string;
      order_id: string | null;
      invoice_id: string | null;
      international: boolean;
      method: string;
      amount_refunded: number;
      captured: boolean;
      description: string | null;
      card_id: string | null;
      bank: string | null;
      wallet: string | null;
      vpa: string | null;
      email: string | null;
      contact: string | null;
      notes?: Record<string, unknown>;
      fee: number | null;
      tax: number | null;
      error_code: string | null;
      error_description: string | null;
      error_reason: string | null;
      created_at: number;
    }
  }

  class Razorpay {
    constructor(options: RazorpayOptions);

    orders: {
      create(params: OrderCreateParams): Promise<Razorpay.Order>;
    };

    payments: {
      fetch(id: string): Promise<Razorpay.Payment>;
    };
  }

  export default Razorpay;
}
