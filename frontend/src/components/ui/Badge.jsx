/**
 * VidClips - Badge Component
 * Status and label badges.
 */
const variants = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  neutral: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  accent: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export default function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        border ${variants[variant] || variants.neutral} ${className}
      `}
    >
      {children}
    </span>
  );
}