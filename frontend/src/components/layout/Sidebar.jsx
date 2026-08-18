/**
 * VidClips - Sidebar Component
 * Navigation sidebar with project info and tool panels.
 */
import {
  FolderOpen,
  Clapperboard,
  Box,
  ScanFace,
  Palette,
  Music,
  Settings,
  Camera,
  Type,
  AudioWaveform,
  LayoutDashboard,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";

const navItems = [
  { id: "project", icon: FolderOpen, label: "Project" },
  { id: "scenes", icon: Clapperboard, label: "Scenes" },
  { id: "objects", icon: Box, label: "Objects" },
  { id: "faces", icon: ScanFace, label: "Faces" },
  { id: "colors", icon: Palette, label: "Colors" },
  { id: "audio", icon: Music, label: "Audio" },
  { id: "motion", icon: Camera, label: "Motion" },
  { id: "ocr", icon: Type, label: "OCR Text" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const { activeSidebarTab, setActiveSidebarTab, videoName, jobStatus } = useEditor();

  return (
    <aside className="w-56 bg-[#0B1120] border-r border-zinc-800/60 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-[44px] flex items-center px-4 border-b border-zinc-800/40">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">
          Workspace
        </h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activeSidebarTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveSidebarTab(id)}
              className={`
                w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150
                ${isActive
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                }
              `}
            >
              <Icon size={16} className={isActive ? "text-blue-400" : "text-zinc-500"} />
              <span className="font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Project Info */}
      <div className="p-3 border-t border-zinc-800/40">
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Project</p>
          <h3 className="text-sm font-semibold text-zinc-200 truncate">
            {videoName || "VidClips"}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1">
            {jobStatus === "completed" ? "Analysis ready" : jobStatus === "running" ? "Analyzing..." : "AI Video Intelligence"}
          </p>
        </div>
      </div>
    </aside>
  );
}