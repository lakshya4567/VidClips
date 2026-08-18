/**
 * VidClips - Toast Notification Component
 */
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useEditor } from "../../context/EditorContext";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: "border-emerald-500/30 bg-emerald-500/10",
  error: "border-red-500/30 bg-red-500/10",
  info: "border-blue-500/30 bg-blue-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
};

const iconColors = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-blue-400",
  warning: "text-amber-400",
};

export default function ToastContainer() {
  const { notifications, removeNotification } = useEditor();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const Icon = icons[n.type] || icons.info;
        return (
          <div
            key={n.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl
              backdrop-blur-xl animate-in slide-in-from-right
              ${colors[n.type] || colors.info}
            `}
            style={{
              animation: "slideIn 0.3s ease-out",
            }}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${iconColors[n.type] || iconColors.info}`} />
            <p className="text-sm text-zinc-200 flex-1">{n.message}</p>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}