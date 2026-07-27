import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Lock, LogIn, User } from "lucide-react";
import { toast } from "../../lib/toast";

import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import api from "../../lib/axios";
import { resetAppData } from "../../context/AppDataContext";
import { cn } from "../../lib/utils";

/**
 * Staff sign-in for the POS.
 *
 * One credential set, one terminal: the form is deliberately short so a cashier
 * can be on the till in a couple of keystrokes.
 */
export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const fieldClasses = cn(
    "h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-900 shadow-sm transition-all duration-200",
    "placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100",
    "dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-brand-500/20"
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The seeded admin uses an email address; accept a bare username too.
      const email = username.includes("@") ? username : `${username}@example.com`;

      // Laravel Sanctum expects a CSRF cookie before the login POST.
      try {
        await fetch("/sanctum/csrf-cookie", { credentials: "include" });
      } catch {
        // Not every deployment requires CSRF cookies.
      }

      const response = await api.post("/login", { email, password });
      const token = response?.data?.token;
      if (token) {
        localStorage.setItem("api_token", token);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      // Start the session with an empty cache so the dashboard runs its
      // one-time initial data load (and skeleton) after login.
      resetAppData();

      try {
        toast.success("Signed in — opening your workspace…");
      } catch {
        // Toast failures must never block navigation.
      }

      const from = (location.state as any)?.from?.pathname || "/dashboard";
      setTimeout(() => navigate(from), 300);
    } catch (caught: unknown) {
      let message = "Sign in failed. Please check your credentials.";
      if (caught && typeof caught === "object") {
        message = (caught as any)?.response?.data?.message || (caught as any)?.message || message;
      } else if (typeof caught === "string") {
        message = caught;
      }

      if (String(message).toLowerCase().includes("network error")) {
        message =
          "Cannot reach the server. Make sure the backend is running at http://127.0.0.1:8000 and the dev server proxy is active.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="animate-in fade-in slide-in-from-bottom-4 rounded-3xl border border-gray-200/80 bg-white/95 p-7 shadow-xl backdrop-blur duration-500 dark:border-gray-800 dark:bg-gray-900/90 sm:p-9">
        {/* Brand — visible on small screens where the side panel is hidden */}
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <img
            src="/images/logo/MKB.jpg"
            alt="MKB logo"
            width={44}
            height={44}
            className="rounded-xl shadow-sm"
          />
          <div>
            <p className="text-lg font-bold leading-tight text-gray-900 dark:text-white">MKB</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Point of Sale</p>
          </div>
        </div>

        <header className="mb-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            Staff access
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Sign in to the terminal
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Enter your credentials to open the register and start selling.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="username">
              Username <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="admin"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={fieldClasses}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(fieldClasses, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeIcon className="size-5 fill-current" />
                ) : (
                  <EyeCloseIcon className="size-5 fill-current" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={keepSignedIn} onChange={setKeepSignedIn} />
            <span className="text-sm text-gray-600 dark:text-gray-400">Keep me signed in</span>
          </div>

          {error && (
            <div
              role="alert"
              className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 duration-300 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            startIcon={<LogIn className="h-4 w-4" />}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        MKB Order and Sales Inventory Management System
      </p>
    </div>
  );
}
