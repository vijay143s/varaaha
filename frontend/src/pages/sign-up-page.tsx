import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { pushToast } from "../components/toast-rack.js";
import { useAuth } from "../hooks/use-auth.js";
import type { SignUpPayload } from "../types/auth.js";

export function SignUpPage(): JSX.Element {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignUpPayload>({
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      phone: ""
    }
  });

  const onSubmit = handleSubmit(async (values: SignUpPayload) => {
    try {
      await signup(values);
      pushToast({ type: "success", message: "Account created!" });
      navigate("/account");
    } catch (error) {
      console.error(error);
      pushToast({ type: "error", message: "Unable to sign up. Try again." });
    }
  });

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Create account</h1>
        <p className="mt-2 text-sm text-white/70">
          Experience fresh Varaaha dairy delivered to your door.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-frost">
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium text-white">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            {...register("fullName", { required: "Full name is required" })}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-500 focus:outline-none"
          />
          {errors.fullName && <p className="text-xs text-rose-300">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-white">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email", { required: "Email is required" })}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-500 focus:outline-none"
          />
          {errors.email && <p className="text-xs text-rose-300">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-white">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            {...register("phone", {
              pattern: {
                value: /^[0-9+\-\s]{8,15}$/,
                message: "Enter a valid phone number"
              }
            })}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-500 focus:outline-none"
          />
          {errors.phone && <p className="text-xs text-rose-300">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-white">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password", { required: "Password is required", minLength: { value: 8, message: "Use at least 8 characters" } })}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-500 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-rose-300">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-neon-ring hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-center text-sm text-white/60">
          Already a member? {" "}
          <Link to="/signin" className="text-brand-300 hover:text-brand-200">
            Sign in here
          </Link>
        </p>
      </form>
    </div>
  );
}
