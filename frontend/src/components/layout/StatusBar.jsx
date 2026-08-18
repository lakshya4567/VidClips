/**
 * VidClips - StatusBar Component
 * Bottom status bar showing project info, system stats, and actions.
 */
import { useEditor } from "../../context/EditorContext";
import { Clock, HardDrive, Cpu, Wifi, Circle } from "lucide-react";

export default function StatusBar() {
  const {
    currentTime,
    duration,
    videoName,
    jobStatus,
    backendOnline,
    videoRef,
  } = useEditor();

  const formatTime = (t) => {
    if (!t || !isFinite(t)) return "0:00:00";
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
    switch (jobStatus) {
      case "completed": return "text-emerald-400";
      case "failed": return "text-red-400";
      case "running":
      case "uploading": return "text-blue-400";
      default: return "text-zinc-500";
    }
  };

  const getStatusText = () => {
    switch (jobStatus) {
      case "idle": return "Ready";
      case "uploading": return "Uploading...";
      case "queued": return "Queued";
      case "running": return "Analyzing...";
      case "completed": return "Analysis complete";
      case "failed": return "Analysis failed";
      default: return jobStatus;
    }
  };

  const fps = videoRef.current ? Math.round(videoRef.current.mozDecodedFramesPerSecond || 0) : 0;

  return (
    <footer className="h-7 bg-[#0A0F1A] border-t border-zinc-800/60 flex items-center justify-between px-4 shrink-0 select-none">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-zinc-500">
          <Clock size={12} />
          <span className="text-[11px] tabular-nums font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {videoName && (
          <>
            <div className="w-px h-3 bg-zinc-800" />
            <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">
              {videoName}
            </span>
          </>
        )}
      </div>

      {/* Center */}
      <div className={`flex items-center gap-1.5 text-[11px] ${getStatusColor()}`}>
        <Circle size={6} className="fill-current" />
        <span>{getStatusText()}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Wifi size={11} />
          <span className={`text-[11px] ${backendOnline ? "text-emerald-400" : "text-red-400"}`}>
            {backendOnline ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </footer>
  );
}