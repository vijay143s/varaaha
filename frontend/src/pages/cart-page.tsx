import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MinusIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useForm } from "react-hook-form";

import { pushToast } from "../components/toast-rack.js";
import { useCartStore } from "../store/cart-store.js";
import { apiClient } from "../api/client.js";
import { useAuth } from "../hooks/use-auth.js";
import type { Address } from "../types/address.js";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }

  interface RazorpayInstance {
    open: () => void;
    close: () => void;
    on: (event: string, handler: (response: any) => void) => void;
  }
}

const WEEKDAY_OPTIONS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

type WeekdayOption = (typeof WEEKDAY_OPTIONS)[number];
type OrderTypeOption = "one_time" | "scheduled";

interface DeliveryFormValues {
  orderType: OrderTypeOption;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  scheduleStartDate: string;
  scheduleEndDate?: string;
  scheduleExceptDays: WeekdayOption[];
  schedulePause: boolean;
}

interface AppliedCouponState {
  code: string;
  description: string | null;
  discountAmount: number;
  subtotal: number;
  total: number;
  signature: string;
}

const PAYMENT_METHOD_OPTIONS = [
  {
    value: "cash_on_delivery" as const,
    title: "Cash on delivery",
    description: "Pay the delivery partner with cash or UPI when you receive your order."
  },
  {
    value: "razorpay" as const,
    title: "Pay online (UPI/cards)",
    description: "Complete a secure Razorpay payment before placing the order."
  }
];

const createDefaultFormValues = (): DeliveryFormValues => {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    orderType: "one_time",
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    scheduleStartDate: todayIso,
    scheduleEndDate: "",
    scheduleExceptDays: [],
    schedulePause: false
  };
};

async function fetchAddresses(): Promise<Address[]> {
  try {
    const response = await apiClient.get("/account/addresses");
    return response.data.data ?? [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return [];
    }
    throw error;
  }
}

async function loadRazorpayCheckout(): Promise<boolean> {
  if (window.Razorpay) {
    return true;
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CartPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useCartStore((state) => state.items);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);
  const { isAuthenticated, user } = useAuth();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new" | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponState | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "razorpay">(
    "cash_on_delivery"
  );
  const [isProcessingPayment, setProcessingPayment] = useState(false);
  const queryClient = useQueryClient();

  const cartSignature = useMemo(
    () =>
      items
        .map((item) => `${item.productId}:${item.quantity}`)
        .sort()
        .join("|"),
    [items]
  );

  const { data: addresses = [], isFetching: loadingAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: fetchAddresses,
    enabled: isDialogOpen && isAuthenticated
  });

  interface CreateAddressInput {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    isDefault?: boolean;
  }

  const createAddressMutation = useMutation({
    mutationFn: async (payload: CreateAddressInput) => {
      const response = await apiClient.post("/account/addresses", payload);
      return response.data.data as { id: number };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
    }
  });

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiClient.post("/coupons/validate", {
        code,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });
      return response.data.data as {
        code: string;
        description: string | null;
        discountAmount: number;
        subtotal: number;
        total: number;
      };
    },
    onSuccess: (data) => {
      setCouponCodeInput(data.code);
      setAppliedCoupon({
        code: data.code,
        description: data.description ?? null,
        discountAmount: data.discountAmount,
        subtotal: data.subtotal,
        total: data.total,
        signature: cartSignature
      });
      pushToast({ type: "success", message: `Coupon ${data.code} applied.` });
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error ?? "Unable to apply coupon."
        : "Unable to apply coupon.";
      pushToast({ type: "error", message });
    }
  });

  const createRazorpayOrderMutation = useMutation({
    mutationFn: async (payload: {
      items: Array<{ productId: number; quantity: number }>;
      couponCode?: string;
    }) => {
      const response = await apiClient.post("/payments/razorpay/order", payload);
      return response.data.data as {
        transactionId: number;
        razorpayOrderId: string;
        currency: string;
        amount: number;
        amountPaise: number;
        keyId: string | null;
      };
    }
  });

  const confirmRazorpayPaymentMutation = useMutation({
    mutationFn: async (payload: {
      transactionId: number;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const response = await apiClient.post("/payments/razorpay/confirm", payload);
      return response.data.data as {
        transactionId: number;
        amount: number;
      };
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<DeliveryFormValues>({
    defaultValues: createDefaultFormValues()
  });

  useEffect(() => {
    register("orderType");
    register("scheduleExceptDays");
  }, [register]);

  useEffect(() => {
    if (appliedCoupon && appliedCoupon.signature !== cartSignature) {
      setAppliedCoupon(null);
      setCouponCodeInput("");
    }
  }, [appliedCoupon, cartSignature]);

  const watchOrderType = watch("orderType") ?? "one_time";
  const watchScheduleStart = watch("scheduleStartDate");
  const watchExceptDays = watch("scheduleExceptDays") ?? [];
  const requiresManualAddress = selectedAddressId === "new" || addresses.length === 0;

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    if (selectedAddressId === null) {
      if (addresses.length > 0) {
        const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
        setSelectedAddressId(preferred.id);
      } else {
        setSelectedAddressId("new");
      }
    }
  }, [addresses, isDialogOpen, selectedAddressId]);

  useEffect(() => {
    if (!isDialogOpen || selectedAddressId === null) {
      return;
    }

    if (selectedAddressId === "new") {
      setValue("fullName", "", { shouldDirty: false });
      setValue("phone", "", { shouldDirty: false });
      setValue("addressLine1", "", { shouldDirty: false });
      setValue("addressLine2", "", { shouldDirty: false });
      setValue("city", "", { shouldDirty: false });
      setValue("state", "", { shouldDirty: false });
      setValue("postalCode", "", { shouldDirty: false });
      return;
    }

    const selected = addresses.find((address) => address.id === selectedAddressId);
    if (!selected) {
      return;
    }

    setValue("fullName", selected.fullName ?? "", { shouldDirty: false });
    setValue("phone", selected.phone ?? "", { shouldDirty: false });
    setValue("addressLine1", selected.addressLine1, { shouldDirty: false });
    setValue("addressLine2", selected.addressLine2 ?? "", { shouldDirty: false });
    setValue("city", selected.city, { shouldDirty: false });
    setValue("state", selected.state, { shouldDirty: false });
    setValue("postalCode", selected.postalCode, { shouldDirty: false });
  }, [addresses, isDialogOpen, selectedAddressId, setValue]);

  const handleOpenDialog = () => {
    if (!isAuthenticated) {
      pushToast({ type: "error", message: "Sign in to checkout." });
      navigate("/signin", { state: { from: location.pathname } });
      return;
    }
    if (items.length === 0) {
      pushToast({ type: "error", message: "Add items to your cart first." });
      return;
    }
    reset(createDefaultFormValues());
    setSelectedAddressId(null);
    setProcessingPayment(false);
    setPaymentMethod("cash_on_delivery");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    reset(createDefaultFormValues());
    setSelectedAddressId(null);
    setProcessingPayment(false);
    setPaymentMethod("cash_on_delivery");
  };

  const toggleOrderType = (type: OrderTypeOption) => {
    setValue("orderType", type, { shouldDirty: true });
    if (type === "one_time") {
      setValue("schedulePause", false, { shouldDirty: false });
      setValue("scheduleExceptDays", [], { shouldDirty: false });
      setValue("scheduleEndDate", "", { shouldDirty: false });
    }
  };

  const toggleExceptDay = (day: WeekdayOption) => {
    const current = new Set(watchExceptDays);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    setValue("scheduleExceptDays", Array.from(current) as WeekdayOption[], {
      shouldDirty: true
    });
  };

  const handleCheckout = handleSubmit(async (values) => {
    if (items.length === 0) {
      pushToast({ type: "error", message: "Cart is empty." });
      return;
    }

    if (values.orderType === "scheduled" && !values.scheduleStartDate) {
      pushToast({ type: "error", message: "Choose a start date for scheduled deliveries." });
      return;
    }

    let addressPayload = {
      fullName: values.fullName,
      phone: values.phone,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2 ? values.addressLine2 : undefined,
      city: values.city,
      state: values.state,
      postalCode: values.postalCode,
      country: "India"
    };

    let shippingAddressIdForOrder: number | undefined;
    let billingAddressIdForOrder: number | undefined;

    if (!requiresManualAddress && typeof selectedAddressId === "number") {
      const selected = addresses.find((address) => address.id === selectedAddressId);
      if (!selected) {
        pushToast({ type: "error", message: "Select a delivery address to continue." });
        return;
      }
      addressPayload = {
        fullName: selected.fullName,
        phone: selected.phone ?? values.phone,
        addressLine1: selected.addressLine1,
        addressLine2: selected.addressLine2 ?? undefined,
        city: selected.city,
        state: selected.state,
        postalCode: selected.postalCode,
        country: selected.country ?? "India"
      };
      shippingAddressIdForOrder = selected.id;
      billingAddressIdForOrder = selected.id;
    }

    if (!addressPayload.phone || !/^[0-9+\-\s]{8,15}$/.test(addressPayload.phone)) {
      pushToast({ type: "error", message: "Add a valid phone number for delivery." });
      return;
    }

    if (requiresManualAddress) {
      try {
        await createAddressMutation.mutateAsync({
          ...addressPayload,
          phone: addressPayload.phone,
          isDefault: addresses.length === 0
        });
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error ?? "Unable to save address."
          : "Unable to save address.";
        pushToast({ type: "error", message });
        return;
      }
    }

    try {
      const orderItemsPayload = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      }));

      const payload: Record<string, unknown> = {
        orderType: values.orderType,
        items: orderItemsPayload,
        paymentMethod
      };

      if (shippingAddressIdForOrder) {
        payload.shippingAddressId = shippingAddressIdForOrder;
      } else {
        payload.shippingAddress = addressPayload;
      }

      if (billingAddressIdForOrder) {
        payload.billingAddressId = billingAddressIdForOrder;
      } else {
        payload.billingAddress = addressPayload;
      }

      const trimmedCoupon = couponCodeInput.trim() || appliedCoupon?.code || "";
      if (trimmedCoupon) {
        payload.couponCode = trimmedCoupon;
      }

      if (values.orderType === "scheduled") {
        payload.scheduleStartDate = values.scheduleStartDate;
        if (values.scheduleEndDate) {
          payload.scheduleEndDate = values.scheduleEndDate;
        }
        payload.scheduleExceptDays = values.scheduleExceptDays ?? [];
        payload.schedulePause = values.schedulePause;
      }

      const finalizeOrder = async (orderPayload: Record<string, unknown>) => {
        const response = await apiClient.post("/orders", orderPayload);
        const { orderNumber } = response.data.data;

        pushToast({
          type: "success",
          message:
            values.orderType === "scheduled"
              ? "Recurring delivery plan created!"
              : "Order placed successfully!"
        });
        clear();
        setAppliedCoupon(null);
        setCouponCodeInput("");
        setPaymentMethod("cash_on_delivery");
        closeDialog();
        navigate(`/orders?focus=${orderNumber}`);
      };

      if (paymentMethod === "razorpay") {
        const couponCodeForPayment = trimmedCoupon || undefined;

        try {
          setProcessingPayment(true);
          const paymentInit = await createRazorpayOrderMutation.mutateAsync({
            items: orderItemsPayload,
            couponCode: couponCodeForPayment
          });

          if (!paymentInit.keyId) {
            throw new Error("Payment gateway misconfigured. Contact support.");
          }

          const scriptReady = await loadRazorpayCheckout();
          if (!scriptReady || !window.Razorpay) {
            throw new Error("Unable to load payment window. Please try again.");
          }

          const checkoutResult = await new Promise<{
            paymentId: string;
            orderId: string;
            signature: string;
          }>((resolve, reject) => {
            const instance = new window.Razorpay!({
              key: paymentInit.keyId,
              amount: paymentInit.amountPaise,
              currency: paymentInit.currency,
              name: "Varaaha Milk",
              description: "Order payment",
              order_id: paymentInit.razorpayOrderId,
              notes: {
                transactionId: String(paymentInit.transactionId)
              },
              prefill: {
                name: addressPayload.fullName || user?.fullName || "",
                email: user?.email || "",
                contact: addressPayload.phone || user?.phone || ""
              },
              theme: {
                color: "#0f172a"
              },
              handler: (response: any) => {
                resolve({
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  signature: response.razorpay_signature
                });
              },
              modal: {
                ondismiss: () => {
                  reject(new Error("Payment cancelled."));
                }
              }
            });

            instance.on("payment.failed", (response: any) => {
              reject(new Error(response?.error?.description ?? "Payment failed."));
            });

            instance.open();
          });

          const confirmation = await confirmRazorpayPaymentMutation.mutateAsync({
            transactionId: paymentInit.transactionId,
            razorpayOrderId: checkoutResult.orderId,
            razorpayPaymentId: checkoutResult.paymentId,
            razorpaySignature: checkoutResult.signature
          });

          payload.paymentTransactionId = confirmation.transactionId;
          payload.paymentMethod = "razorpay";

          await finalizeOrder(payload);
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.error ?? "Payment could not be completed."
            : error instanceof Error
              ? error.message
              : "Payment could not be completed.";
          pushToast({ type: "error", message });
        } finally {
          setProcessingPayment(false);
        }

        return;
      }

      payload.paymentMethod = "cash_on_delivery";
      await finalizeOrder(payload);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error ?? "Unable to process order."
        : "Unable to process order.";
      pushToast({ type: "error", message });
    }
  });

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const effectiveSubtotal = appliedCoupon?.subtotal ?? subtotal;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const estimatedTotal = appliedCoupon?.total ?? effectiveSubtotal;
  const hasAppliedCoupon = Boolean(appliedCoupon && discountAmount > 0);
  const isOnlinePayment = paymentMethod === "razorpay";
  const isPaymentMutationPending =
    createRazorpayOrderMutation.isPending || confirmRazorpayPaymentMutation.isPending;
  const isCheckoutBusy =
    isSubmitting ||
    loadingAddresses ||
    createAddressMutation.isPending ||
    isProcessingPayment ||
    isPaymentMutationPending;
  const submitLabel = isCheckoutBusy
    ? isOnlinePayment
      ? "Finishing payment…"
      : "Processing…"
    : isOnlinePayment
      ? "Pay & place order"
      : "Confirm order";

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h1 className="text-3xl font-semibold text-white">Your cart is empty</h1>
        <p className="mt-2 text-sm">Add a few farm-fresh staples to start planning your next drop.</p>
        <Link
          to="/products"
          className="mt-6 inline-flex rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Your cart</h1>
        <p className="text-white/60">Review items before completing checkout.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-white md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">{item.name}</h2>
                <p className="text-sm text-white/60">
                  ₹{item.price.toFixed(2)} · {item.unit}
                </p>
              </div>

              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => {
                      decrement(item.productId);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white hover:border-brand-400"
                  >
                    <MinusIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => {
                      increment(item.productId);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white hover:border-brand-400"
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <p className="text-sm font-semibold text-white">
                  Line total: ₹{(item.price * item.quantity).toFixed(2)}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    remove(item.productId);
                    pushToast({ type: "success", message: `${item.name} removed from cart.` });
                  }}
                  className="flex items-center gap-2 rounded-full border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
          <h2 className="text-xl font-semibold">Summary</h2>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>Items</span>
              <span>{totalQuantity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>₹{effectiveSubtotal.toFixed(2)}</span>
            </div>
            {hasAppliedCoupon && (
              <div className="flex items-center justify-between text-emerald-300">
                <span>Coupon savings</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
              <span>Total</span>
              <span>₹{estimatedTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-white/50">Delivery and taxes calculated at checkout.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              clear();
              setAppliedCoupon(null);
              setCouponCodeInput("");
              pushToast({ type: "success", message: "Cart cleared." });
            }}
            className="w-full rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:border-red-400 hover:text-white"
          >
            Clear cart
          </button>

          <button
            type="button"
            onClick={() => {
              navigate("/products");
            }}
            className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-neon-ring hover:bg-brand-400"
          >
            Continue shopping
          </button>

          <button
            type="button"
            onClick={handleOpenDialog}
            className="w-full rounded-2xl bg-brand-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-neon-ring hover:bg-brand-300"
          >
            Checkout
          </button>
        </aside>
      </div>

      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeDialog}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-3xl border border-white/10 bg-slate-950/95 p-8 text-left align-middle shadow-frost">
                  <Dialog.Title className="text-2xl font-semibold text-white">Checkout</Dialog.Title>
                  <p className="mt-2 text-sm text-white/60">Confirm your delivery plan and address for this order.</p>

                  <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-widest text-white/50">Items</p>
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between">
                        <span>{item.name}</span>
                        <span className="text-white/60">
                          {item.quantity} × ₹{item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2 text-white/80">
                      <span>Subtotal</span>
                      <span>₹{effectiveSubtotal.toFixed(2)}</span>
                    </div>
                    {hasAppliedCoupon && (
                      <div className="flex items-center justify-between text-sm text-emerald-300">
                        <span>Coupon savings ({appliedCoupon?.code})</span>
                        <span>-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-white">
                      <span className="font-semibold">Amount due</span>
                      <span className="text-lg font-semibold">₹{estimatedTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-widest text-white/50">Coupon</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(event) => setCouponCodeInput(event.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = couponCodeInput.trim();
                          if (!trimmed) {
                            pushToast({ type: "error", message: "Enter a coupon code." });
                            return;
                          }
                          const normalized = trimmed.toUpperCase();
                          setCouponCodeInput(normalized);
                          applyCouponMutation.mutate(normalized);
                        }}
                        disabled={applyCouponMutation.isPending}
                        className="flex w-full items-center justify-center rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-neon-ring transition hover:bg-brand-400 disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
                      >
                        {applyCouponMutation.isPending ? "Applying..." : "Apply"}
                      </button>
                    </div>
                    {appliedCoupon && (
                      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{appliedCoupon.code}</p>
                          {appliedCoupon.description && (
                            <p className="text-xs text-emerald-200/80">{appliedCoupon.description}</p>
                          )}
                          <p className="text-xs text-emerald-200/70">
                            Savings ₹{discountAmount.toFixed(2)} · New total ₹{estimatedTotal.toFixed(2)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCodeInput("");
                          }}
                          className="self-start rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 sm:self-auto"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleCheckout} className="mt-6 space-y-6 text-white">
                    <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                      <p className="text-sm font-medium">Delivery plan</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => toggleOrderType("one_time")}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            watchOrderType === "one_time"
                              ? "border-brand-400 bg-brand-500/10 text-white"
                              : "border-white/15 bg-slate-900/40 text-white/70"
                          }`}
                        >
                          <span className="block font-semibold">One-time delivery</span>
                          <span className="block text-xs text-white/60">
                            Perfect for sending this cart as a single drop.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleOrderType("scheduled")}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            watchOrderType === "scheduled"
                              ? "border-brand-400 bg-brand-500/10 text-white"
                              : "border-white/15 bg-slate-900/40 text-white/70"
                          }`}
                        >
                          <span className="block font-semibold">Scheduled delivery</span>
                          <span className="block text-xs text-white/60">
                            Repeat deliveries with optional pause and skip days.
                          </span>
                        </button>
                      </div>

                      {watchOrderType === "scheduled" && (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-xs font-semibold uppercase tracking-widest text-white/50">
                              Start date
                              <input
                                type="date"
                                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                                {...register("scheduleStartDate", {
                                  validate: (value) => (watchOrderType !== "scheduled" || value ? true : "Select a start date")
                                })}
                              />
                              {errors.scheduleStartDate && (
                                <span className="mt-1 block text-xs text-rose-300">
                                  {errors.scheduleStartDate.message}
                                </span>
                              )}
                            </label>
                            <label className="text-xs font-semibold uppercase tracking-widest text-white/50">
                              End date <span className="text-white/40">(optional)</span>
                              <input
                                type="date"
                                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                                {...register("scheduleEndDate", {
                                  validate: (value) => {
                                    if (watchOrderType !== "scheduled" || !value || !watchScheduleStart) {
                                      return true;
                                    }
                                    return value >= watchScheduleStart
                                      ? true
                                      : "End date cannot be before start date";
                                  }
                                })}
                              />
                              {errors.scheduleEndDate && (
                                <span className="mt-1 block text-xs text-rose-300">
                                  {errors.scheduleEndDate.message}
                                </span>
                              )}
                            </label>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                              Skip deliveries on
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {WEEKDAY_OPTIONS.map((day) => {
                                const isSelected = watchExceptDays.includes(day);
                                const label = day.charAt(0).toUpperCase() + day.slice(1);
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    onClick={() => toggleExceptDay(day)}
                                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                                      isSelected
                                        ? "bg-brand-500 text-white shadow-neon-ring"
                                        : "border border-white/20 bg-slate-950/60 text-white/70"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-1 text-xs text-white/50">
                              Deliveries will run daily except the days you choose above.
                            </p>
                          </div>

                          <label className="flex items-center gap-3 text-sm text-white">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-white/20 bg-slate-950/60"
                              {...register("schedulePause")}
                            />
                            Pause deliveries immediately after scheduling
                          </label>
                        </div>
                      )}
                    </section>
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">Delivery address</p>
                        {addresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedAddressId("new")}
                            className="self-start rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 hover:border-brand-400 hover:text-white"
                          >
                            Add new address
                          </button>
                        )}
                      </div>

                      {addresses.length === 0 ? (
                        <p className="text-sm text-white/60">No saved addresses yet. Add one below.</p>
                      ) : (
                        <ul className="space-y-2">
                          {addresses.map((address) => (
                            <li key={address.id}>
                              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                selectedAddressId === address.id
                                  ? "border-brand-400 bg-brand-500/10 text-white"
                                  : "border-white/15 bg-slate-950/40 text-white/70 hover:border-white/30"
                              }`}>
                                <input
                                  type="radio"
                                  name="deliveryAddress"
                                  value={address.id}
                                  checked={selectedAddressId === address.id}
                                  onChange={() => setSelectedAddressId(address.id)}
                                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950/60"
                                />
                                <span>
                                  <span className="block text-sm font-semibold text-white">{address.fullName}</span>
                                  <span className="block text-xs text-white/60">{address.phone}</span>
                                  <span className="mt-1 block text-xs text-white/60">
                                    {address.addressLine1}, {address.city}, {address.state} - {address.postalCode}
                                  </span>
                                  {address.isDefault && (
                                    <span className="mt-2 inline-flex rounded-full border border-brand-400/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-200">
                                      Default
                                    </span>
                                  )}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}

                      {requiresManualAddress && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="md:col-span-2 text-sm">
                            <span className="text-sm font-medium text-white">Full name</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("fullName", {
                                validate: (value) =>
                                  requiresManualAddress && !value
                                    ? "Full name is required"
                                    : true
                              })}
                            />
                            {errors.fullName && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.fullName.message}</span>
                            )}
                          </label>

                          <label className="text-sm">
                            <span className="text-sm font-medium text-white">Phone</span>
                            <input
                              type="tel"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("phone", {
                                validate: (value) => {
                                  if (!requiresManualAddress) {
                                    return true;
                                  }
                                  if (!value) {
                                    return "Phone is required";
                                  }
                                  return /^[0-9+\-\s]{8,15}$/.test(value)
                                    ? true
                                    : "Enter a valid phone number";
                                }
                              })}
                            />
                            {errors.phone && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.phone.message}</span>
                            )}
                          </label>

                          <label className="text-sm">
                            <span className="text-sm font-medium text-white">Postal code</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("postalCode", {
                                validate: (value) =>
                                  requiresManualAddress && !value
                                    ? "Postal code is required"
                                    : true
                              })}
                            />
                            {errors.postalCode && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.postalCode.message}</span>
                            )}
                          </label>

                          <label className="md:col-span-2 text-sm">
                            <span className="text-sm font-medium text-white">Address line 1</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("addressLine1", {
                                validate: (value) =>
                                  requiresManualAddress && !value
                                    ? "Address is required"
                                    : true
                              })}
                            />
                            {errors.addressLine1 && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.addressLine1.message}</span>
                            )}
                          </label>

                          <label className="md:col-span-2 text-sm">
                            <span className="text-sm font-medium text-white">Address line 2</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("addressLine2")}
                            />
                          </label>

                          <label className="text-sm">
                            <span className="text-sm font-medium text-white">City</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("city", {
                                validate: (value) =>
                                  requiresManualAddress && !value
                                    ? "City is required"
                                    : true
                              })}
                            />
                            {errors.city && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.city.message}</span>
                            )}
                          </label>

                          <label className="text-sm">
                            <span className="text-sm font-medium text-white">State</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                              {...register("state", {
                                validate: (value) =>
                                  requiresManualAddress && !value
                                    ? "State is required"
                                    : true
                              })}
                            />
                            {errors.state && (
                              <span className="mt-1 block text-xs text-rose-300">{errors.state.message}</span>
                            )}
                          </label>
                        </div>
                      )}
                    </section>

                    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                      <p className="text-sm font-medium text-white">Payment method</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {PAYMENT_METHOD_OPTIONS.map((method) => {
                          const isSelected = paymentMethod === method.value;
                          return (
                            <button
                              type="button"
                              key={method.value}
                              onClick={() => setPaymentMethod(method.value)}
                              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                                isSelected
                                  ? "border-brand-400 bg-brand-500/10 text-white"
                                  : "border-white/15 bg-slate-900/60 text-white/70 hover:border-white/30"
                              }`}
                              disabled={isProcessingPayment || createRazorpayOrderMutation.isPending || confirmRazorpayPaymentMutation.isPending}
                            >
                              <span className="block font-semibold">{method.title}</span>
                              <span className="mt-1 block text-xs text-white/60">{method.description}</span>
                              {method.value === "razorpay" && (
                                <span className="mt-2 inline-flex rounded-full border border-brand-400/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-200">
                                  UPI · Card · Netbanking
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {paymentMethod === "razorpay" && (
                        <p className="text-xs text-white/60">
                          You will be redirected to Razorpay to complete the payment. Your order will be
                          confirmed automatically after a successful payment.
                        </p>
                      )}
                    </section>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeDialog}
                        className="rounded-2xl border border-white/20 px-5 py-2 text-sm font-semibold text-white/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCheckoutBusy}
                        className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitLabel}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
