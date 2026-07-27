import { ReactNode } from "react";
import { cn } from "../../../lib/utils";

type ButtonSize = "xs" | "sm" | "md" | "lg";
type ButtonVariant =
  | "primary"
  | "success"
  | "outline"
  | "secondary"
  | "danger"
  | "ghost";

interface ButtonProps {
  children?: ReactNode; // Button text or content
  size?: ButtonSize;
  variant?: ButtonVariant;
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  /** HTML button type attribute */
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Renders a spinner and blocks interaction */
  loading?: boolean;
  /** Stretch to the full width of the parent */
  fullWidth?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
}

// Size Classes
const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1.5 text-xs",
  sm: "px-3.5 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

// Variant Classes
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus-visible:ring-brand-300 disabled:bg-brand-300",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-300 disabled:bg-emerald-300",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-300 disabled:bg-red-300",
  outline:
    "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-brand-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/[0.06]",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-300 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.12]",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-300 dark:text-gray-300 dark:hover:bg-white/[0.06]",
};

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  loading = false,
  fullWidth = false,
  title,
  "aria-label": ariaLabel,
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && "w-full",
        isDisabled ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]",
        className
      )}
      onClick={onClick}
      disabled={isDisabled}
    >
      {loading ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        startIcon && <span className="flex shrink-0 items-center">{startIcon}</span>
      )}
      {children}
      {!loading && endIcon && <span className="flex shrink-0 items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;
