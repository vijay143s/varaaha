import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { pushToast } from "../components/toast-rack.js";
import { useAuth } from "../hooks/use-auth.js";
import type { SignInPayload } from "../types/auth.js";

export function SignInPage(): JSX.Element {
  const navigate = useNavigate();
  const { signin } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignInPayload>({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values: SignInPayload) => {
    try {
      await signin(values);
      pushToast({ type: "success", message: "Welcome back!" });
      navigate("/account");
    } catch (error) {
      console.error(error);
      pushToast({ type: "error", message: "Sign in failed. Check your credentials." });
    }
  });

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-white/70">
          Enter your credentials to access your Varaaha account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-frost">
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
          <label htmlFor="password" className="text-sm font-medium text-white">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password", { required: "Password is required" })}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-500 focus:outline-none"
          />
          {errors.password && <p className="text-xs text-rose-300">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-neon-ring hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-white/60">
          No account yet? {" "}
          <Link to="/signup" className="text-brand-300 hover:text-brand-200">
            Create one now
          </Link>
        </p>
      </form>
    </div>
  );
}
