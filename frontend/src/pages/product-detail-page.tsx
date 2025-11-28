import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, Transition } from "@headlessui/react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { pushToast } from "../components/toast-rack.js";
import { useAuth } from "../hooks/use-auth.js";
import { useCartStore } from "../store/cart-store.js";
import type { Address } from "../types/address.js";
import type { Product } from "../types/product.js";

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

async function fetchProduct(slug: string): Promise<Product> {
  try {
    const response = await apiClient.get(`/products/${slug}`);
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    throw error;
  }
}

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

interface DeliveryFormValues {
  orderType: OrderTypeOption;
  quantity: number;
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

const createDefaultFormValues = (): DeliveryFormValues => {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    orderType: "one_time",
    quantity: 1,
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

export function ProductDetailPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const cartQuantity = useCartStore((state) =>
    state.items.find((item) => item.productId === product?.id)?.quantity ?? 0
  );

  const {
    data: product,
    isLoading,
    error,
    isError,
    refetch
  } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct(slug ?? ""),
    enabled: Boolean(slug)
  });

  const {
    data: addresses = [],
    isFetching: loadingAddresses
  } = useQuery({
    queryKey: ["addresses"],
    queryFn: fetchAddresses,
    enabled: isDialogOpen && isAuthenticated
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

  const watchOrderType = watch("orderType") ?? "one_time";
  const watchScheduleStart = watch("scheduleStartDate");
  const watchExceptDays = watch("scheduleExceptDays") ?? [];

  useEffect(() => {
    if (!isDialogOpen || addresses.length === 0) {
      return;
    }

    const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
    setValue("quantity", 1, { shouldDirty: false });
    setValue("fullName", preferred.fullName ?? "", { shouldDirty: false });
    setValue("phone", preferred.phone ?? "", { shouldDirty: false });
    setValue("addressLine1", preferred.addressLine1, { shouldDirty: false });
    setValue("addressLine2", preferred.addressLine2 ?? "", { shouldDirty: false });
    setValue("city", preferred.city, { shouldDirty: false });
    setValue("state", preferred.state, { shouldDirty: false });
    setValue("postalCode", preferred.postalCode, { shouldDirty: false });
  }, [addresses, isDialogOpen, setValue]);

  const toggleOrderType = (type: OrderTypeOption) => {
    setValue("orderType", type, { shouldDirty: true });
    if (type === "one_time") {
      setValue("schedulePause", false, { shouldDirty: false });
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

  const primaryImage = useMemo(() => {
    if (!product || !product.images || product.images.length === 0) {
      return null;
    }
    return product.images.find((image) => image.isPrimary) ?? product.images[0];
  }, [product]);

  const handleOpenDialog = () => {
    if (!isAuthenticated) {
      pushToast({ type: "error", message: "Please sign in to schedule a delivery." });
      navigate("/signin", { state: { from: location.pathname } });
      return;
    }
    reset(createDefaultFormValues());
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    reset(createDefaultFormValues());
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      unit: product.unit
    });

    const nextQuantity = cartQuantity + 1;
    pushToast({
      type: "success",
      message:
        nextQuantity === 1
          ? `${product.name} added to cart`
          : `${product.name} quantity updated (${nextQuantity})`
    });
  };

  const onSchedule = handleSubmit(async (values) => {
    if (!product) {
      return;
    }

    if (values.orderType === "scheduled" && !values.scheduleStartDate) {
      pushToast({ type: "error", message: "Choose a start date for scheduled deliveries." });
      return;
    }

    const addressPayload = {
      fullName: values.fullName,
      phone: values.phone,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2 ? values.addressLine2 : undefined,
      city: values.city,
      state: values.state,
      postalCode: values.postalCode,
      country: "India"
    };

    try {
      const basePayload: Record<string, unknown> = {
        orderType: values.orderType,
        items: [
          {
            productId: product.id,
            quantity: values.quantity
          }
        ],
        paymentMethod: "cash_on_delivery",
        shippingAddress: addressPayload,
        billingAddress: addressPayload
      };

      if (values.orderType === "scheduled") {
        basePayload.scheduleStartDate = values.scheduleStartDate;
        if (values.scheduleEndDate) {
          basePayload.scheduleEndDate = values.scheduleEndDate;
        }
        basePayload.scheduleExceptDays = values.scheduleExceptDays ?? [];
        basePayload.schedulePause = values.schedulePause;
      }

      const response = await apiClient.post("/orders", {
        ...basePayload
      });

      const { orderNumber } = response.data.data;
      pushToast({
        type: "success",
        message:
          values.orderType === "scheduled"
            ? "Recurring delivery plan created!"
            : "Delivery booked!"
      });
      closeDialog();
      navigate(`/orders?focus=${orderNumber}`);
    } catch (submitError) {
      const message = axios.isAxiosError(submitError)
        ? submitError.response?.data?.error ?? "Unable to schedule delivery."
        : "Unable to schedule delivery.";
      pushToast({ type: "error", message });
    }
  });

  if (!slug) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h1 className="text-2xl font-semibold text-white">Product not found</h1>
        <p className="mt-3">Try exploring the catalogue to find what you were looking for.</p>
        <Link
          to="/products"
          className="mt-6 inline-flex rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring"
        >
          Back to products
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-72 w-full animate-pulse rounded-3xl bg-white/5" />
        <div className="space-y-4">
          <div className="h-10 w-72 animate-pulse rounded-full bg-white/5" />
          <div className="h-6 w-full animate-pulse rounded-full bg-white/5" />
          <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (isError) {
    const notFound = error instanceof Error && error.message === "PRODUCT_NOT_FOUND";
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
        <h1 className="text-2xl font-semibold text-white">
          {notFound ? "Freshness pending" : "Something went wrong"}
        </h1>
        <p className="mt-3">
          {notFound
            ? "We could not locate that product. It may have been renamed or is not yet available."
            : "We hit a snag while loading this product. Give it another try."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/products"
            className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/80"
          >
            Browse catalogue
          </Link>
          {!notFound && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="text-white/70">No product data available.</div>;
  }

  return (
    <>
      <div className="space-y-12">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              {primaryImage ? (
                <img
                  src={primaryImage.imageUrl}
                  alt={primaryImage.altText ?? product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-72 items-center justify-center text-white/50">
                  Imagery coming soon
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image) => (
                  <img
                    key={image.id}
                    src={image.imageUrl}
                    alt={image.altText ?? product.name}
                    className="h-20 w-20 flex-none rounded-2xl border border-white/10 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-brand-100">
                Varaaha signature
              </div>
              <h1 className="text-4xl font-semibold text-white">{product.name}</h1>
              {product.shortDescription && (
                <p className="text-lg text-white/70">{product.shortDescription}</p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold text-white">₹{product.price.toFixed(2)}</span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
                per {product.unit}
              </span>
            </div>

            <div className="space-y-4 text-white/70">
              {product.description ? (
                product.description.split("\n").map((paragraph, index) => (
                  <p key={index} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p>Sustainably sourced dairy, gently processed to preserve peak nutrition and flavour.</p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAddToCart}
                className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-brand-400"
              >
                {cartQuantity > 0 ? `In cart · ${cartQuantity}` : "Add to cart"}
              </button>
              <button
                type="button"
                onClick={handleOpenDialog}
                className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-neon-ring hover:bg-brand-400"
              >
                Schedule delivery
              </button>
              <Link
                to="/products"
                className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
              >
                Back to catalogue
              </Link>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-semibold text-white">Why Varaaha dairy tastes better</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-sm font-semibold text-white">Cold-chain precision</p>
              <p className="mt-2 text-sm text-white/60">
                Harvested at dawn, chilled instantly, and delivered within hours to preserve raw freshness.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-sm font-semibold text-white">Nutrition forward</p>
              <p className="mt-2 text-sm text-white/60">
                Minimal processing keeps natural fats, proteins, and enzymes intact for a richer glass.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-sm font-semibold text-white">Regenerative sourcing</p>
              <p className="mt-2 text-sm text-white/60">
                Partner farms follow soil-positive practices with zero antibiotics and traceable supply.
              </p>
            </div>
          </div>
        </section>
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
                <Dialog.Panel className="w-full max-w-lg transform rounded-3xl border border-white/10 bg-slate-950/95 p-8 text-left align-middle shadow-frost">
                  <Dialog.Title className="text-2xl font-semibold text-white">Schedule delivery</Dialog.Title>
                  <p className="mt-2 text-sm text-white/60">
                    Confirm quantity and delivery address for this drop. We will send a confirmation once it is processed.
                  </p>

                  <form onSubmit={onSchedule} className="mt-6 space-y-5">
                    <div>
                      <label htmlFor="quantity" className="text-sm font-medium text-white">
                        Quantity
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        min={1}
                        {...register("quantity", { valueAsNumber: true, min: 1, required: true })}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-xs text-rose-300">Enter at least one unit.</p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">Delivery plan</p>
                      <p className="mt-1 text-xs text-white/60">
                        Choose between a single drop or a recurring schedule.
                      </p>
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
                            Perfect for a single drop or gifting.
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
                            Recurring drops with flexible pause and skip days.
                          </span>
                        </button>
                      </div>
                    </div>

                    {watchOrderType === "scheduled" && (
                      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-white">
                        <p className="text-sm font-medium">Schedule details</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <label htmlFor="scheduleStartDate" className="text-xs font-semibold uppercase tracking-widest text-white/50">
                              Start date
                            </label>
                            <input
                              id="scheduleStartDate"
                              type="date"
                              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                              {...register("scheduleStartDate", {
                                validate: (value) => {
                                  if (watchOrderType !== "scheduled") return true;
                                  return value ? true : "Select a start date";
                                }
                              })}
                            />
                            {errors.scheduleStartDate && (
                              <p className="mt-1 text-xs text-rose-300">
                                {errors.scheduleStartDate.message}
                              </p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="scheduleEndDate" className="text-xs font-semibold uppercase tracking-widest text-white/50">
                              End date <span className="text-white/40">(optional)</span>
                            </label>
                            <input
                              id="scheduleEndDate"
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
                              <p className="mt-1 text-xs text-rose-300">
                                {errors.scheduleEndDate.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
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

                        <label className="mt-4 flex items-center gap-3 text-sm text-white">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border border-white/20 bg-slate-950/60"
                            {...register("schedulePause")}
                          />
                          Pause deliveries right after scheduling
                        </label>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label htmlFor="fullName" className="text-sm font-medium text-white">
                          Full name
                        </label>
                        <input
                          id="fullName"
                          type="text"
                          {...register("fullName", { required: "Full name is required" })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.fullName && (
                          <p className="mt-1 text-xs text-rose-300">{errors.fullName.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="phone" className="text-sm font-medium text-white">
                          Phone
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          {...register("phone", {
                            required: "Phone is required",
                            pattern: {
                              value: /^[0-9+\-\s]{8,15}$/,
                              message: "Enter a valid phone number"
                            }
                          })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.phone && (
                          <p className="mt-1 text-xs text-rose-300">{errors.phone.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="postalCode" className="text-sm font-medium text-white">
                          Postal code
                        </label>
                        <input
                          id="postalCode"
                          type="text"
                          {...register("postalCode", { required: "Postal code is required" })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.postalCode && (
                          <p className="mt-1 text-xs text-rose-300">{errors.postalCode.message}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="addressLine1" className="text-sm font-medium text-white">
                          Address line 1
                        </label>
                        <input
                          id="addressLine1"
                          type="text"
                          {...register("addressLine1", { required: "Address is required" })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.addressLine1 && (
                          <p className="mt-1 text-xs text-rose-300">{errors.addressLine1.message}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="addressLine2" className="text-sm font-medium text-white">
                          Address line 2 <span className="text-white/40">(optional)</span>
                        </label>
                        <input
                          id="addressLine2"
                          type="text"
                          {...register("addressLine2")}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="city" className="text-sm font-medium text-white">
                          City
                        </label>
                        <input
                          id="city"
                          type="text"
                          {...register("city", { required: "City is required" })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.city && (
                          <p className="mt-1 text-xs text-rose-300">{errors.city.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="state" className="text-sm font-medium text-white">
                          State
                        </label>
                        <input
                          id="state"
                          type="text"
                          {...register("state", { required: "State is required" })}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
                        />
                        {errors.state && (
                          <p className="mt-1 text-xs text-rose-300">{errors.state.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeDialog}
                        className="rounded-2xl border border-white/15 px-5 py-2 text-sm font-semibold text-white/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || loadingAddresses}
                        className="rounded-2xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-neon-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting ? "Scheduling…" : "Confirm"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
