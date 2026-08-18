/**
 * VidClips - Button Component
 * Reusable button with variants, sizes, and icon support.
 */
import { forwardRef } from "react";

const variants = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700",
  success: "bg-emerald-600 hover:bg-emerald-500 text-white",
  danger: "bg-red-600 hover:bg-red-500 text-white",
  ghost: "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200",
  accent: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2.5",
  icon: "p-2",
};

const Button = forwardRef(function Button(
  {
    children,
    icon: Icon,
    onClick,
    variant = "primary",
    size = "md",
    disabled = false,
    className = "",
    title,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center rounded-xl font-medium
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {Icon && <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 18} />}
      {children && <span>{children}</span>}
    </button>
  );
});

export default Button;
