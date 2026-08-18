/**
 * VidClips - TopBar Component
 * Professional toolbar with menu bar, actions, and status.
 */
import { useRef, useState } from "react";
import {
  FolderOpen,
  Save,
  Play,
  Square,
  Download,
  Search,
  Settings,
  Bell,
  User,
  Cpu,
  Wifi,
  Upload,
  Sparkles,
} from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { useEditor } from "../../context/EditorContext";

export default function TopBar() {
  const fileInputRef = useRef(null);
  const [search, setSearch] = useState("");

  const {
    videoName,
    handleUploadVideo,
    jobStatus,
    jobProgress,
    duration,
    backendOnline,
    addNotification,
  } = useEditor();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) handleUploadVideo(file);
    e.target.value = "";
  };

  const handleExport = () => {
    addNotification("info", "Export feature coming soon");
  };

  const handleSave = () => {
    addNotification("info", "Project saved");
  };

  const getStatusBadge = () => {
    switch (jobStatus) {
      case "uploading": return { label: `Uploading ${jobProgress}%`, variant: "info" };
      case "queued": return { label: "Queued", variant: "warning" };
      case "running": return { label: "Analyzing...", variant: "info" };
      case "completed": return { label: "Completed", variant: "success" };
      case "failed": return { label: "Failed", variant: "error" };
      default: return { label: "Ready", variant: "neutral" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <header className="bg-[#0B1220] border-b border-zinc-800/60 select-none shrink-0">
      {/* Main Toolbar */}
      <div className="h-16 px-5 flex items-center justify-between">
        {/* Left - Brand */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight">VidClips</h1>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">AI Video Intelligence</p>
          </div>
        </div>

        {/* Center - Actions */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            icon={FolderOpen}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
          >
            Open
          </Button>
          <Button
            icon={Upload}
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <Button
            icon={Play}
            variant="success"
            size="sm"
            disabled={!videoName || jobStatus === "running"}
          >
            Analyze
          </Button>
          <Button
            icon={Square}
            variant="danger"
            size="sm"
            disabled={jobStatus !== "running"}
          >
            Stop
          </Button>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <Button
            icon={Download}
            variant="accent"
            size="sm"
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            icon={Save}
            variant="secondary"
            size="sm"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>

        {/* Right - Status & Tools */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-44 bg-zinc-900 border border-zinc-700/60 rounded-lg py-1.5 pl-9 pr-3 outline-none text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Backend Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60">
            <div className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-red-500"}`} />
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>

          {/* CPU Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-500">
            <Cpu size={14} />
            <span className="text-[11px]">CPU</span>
          </div>

          {/* Network */}
          <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${backendOnline ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
            <Wifi size={14} />
            <span className="text-[11px]">{backendOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Notifications */}
          <button className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700/60 hover:border-zinc-600 transition-colors flex items-center justify-center text-zinc-400 hover:text-zinc-200">
            <Bell size={16} />
          </button>

          {/* Settings */}
          <button className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700/60 hover:border-zinc-600 transition-colors flex items-center justify-center text-zinc-400 hover:text-zinc-200">
            <Settings size={16} />
          </button>

          {/* User */}
          <button className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 transition-all flex items-center justify-center shadow-lg">
            <User size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="h-9 border-t border-zinc-800/40 bg-[#0F172A] flex items-center px-5 gap-6 text-xs">
        {["File", "Edit", "View", "AI", "Timeline", "Export", "Help"].map((item) => (
          <button
            key={item}
            className="text-zinc-500 hover:text-blue-400 transition-colors font-medium tracking-wide"
          >
            {item}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-zinc-600">
          {videoName && (
            <>
              <span className="text-zinc-400">{videoName}</span>
              <span className="text-zinc-600">|</span>
            </>
          )}
          <span className="text-zinc-500">
            {duration > 0 ? `${duration.toFixed(1)}s` : "No video"}
          </span>
        </div>
      </div>
    </header>
  );
}