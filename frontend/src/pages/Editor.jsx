/**
 * VidClips - Editor Page
 * Main editor layout with sidebar-driven workspace.
 */

import { useEditor } from "../context/EditorContext";
import { useAnalysisData } from "../hooks/useAnalysisData";

import TopBar from "../components/layout/TopBar";
import Sidebar from "../components/layout/Sidebar";
import VideoPlayer from "../components/player/VideoPlayer";
import Inspector from "../components/inspector/Inspector";
import Timeline from "../components/timeline/Timeline";
import StatusBar from "../components/layout/StatusBar";
import ToastContainer from "../components/ui/Toast";

import {
  FolderOpen,
  Clapperboard,
  Box,
  ScanFace,
  Palette,
  Music,
  Camera,
  Type,
  Settings,
} from "lucide-react";


function WorkspacePanel({ tab }) {
  const panels = {
    project: {
      icon: FolderOpen,
      title: "Project",
      description: "Manage your video project and imported media.",
    },

    scenes: {
      icon: Clapperboard,
      title: "Scenes",
      description: "Browse detected scenes and jump directly to any scene.",
    },

    objects: {
      icon: Box,
      title: "Objects",
      description: "View objects detected by the AI analysis.",
    },

    faces: {
      icon: ScanFace,
      title: "Faces",
      description: "View detected faces and facial tracking information.",
    },

    colors: {
      icon: Palette,
      title: "Colors",
      description: "Explore color analysis and visual characteristics.",
    },

    audio: {
      icon: Music,
      title: "Audio",
      description: "Explore audio and speech analysis.",
    },

    motion: {
      icon: Camera,
      title: "Motion",
      description: "View camera movement and motion analysis.",
    },

    ocr: {
      icon: Type,
      title: "OCR Text",
      description: "View text detected inside the video.",
    },

    settings: {
      icon: Settings,
      title: "Settings",
      description: "Configure VidClips editor settings.",
    },
  };

  const panel = panels[tab] || panels.project;
  const Icon = panel.icon;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0B1120]">
      
      {/* Workspace header */}
      <div className="h-11 shrink-0 border-b border-zinc-800/50 bg-[#0F172A] flex items-center px-5">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-blue-400" />

          <h2 className="text-sm font-semibold text-zinc-200">
            {panel.title}
          </h2>
        </div>
      </div>

      {/* Workspace content */}
      <div className="flex-1 overflow-auto p-6">

        <div className="max-w-4xl">

          <div className="rounded-xl border border-zinc-800/60 bg-[#0F172A] p-6">

            <div className="flex items-start gap-4">

              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-blue-400" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-zinc-200">
                  {panel.title}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {panel.description}
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}


export default function Editor() {

  // Load analysis data
  useAnalysisData();

  const {
    activeSidebarTab,
  } = useEditor();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0B1120] flex flex-col">

      {/* Top Toolbar */}
      <TopBar />


      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar />


        {/* Center Workspace */}
        {activeSidebarTab === "project" ? (

          <div className="flex-1 min-w-0 flex flex-col">

            <div className="flex-1 min-h-0 flex">

              {/* Video */}
              <div className="flex-1 min-w-0">
                <VideoPlayer />
              </div>

              {/* Inspector */}
              <Inspector />

            </div>

            {/* Timeline */}
            <Timeline />

          </div>

        ) : (

          /* Other Sidebar Sections */
          <WorkspacePanel tab={activeSidebarTab} />

        )}

      </div>


      {/* Status Bar */}
      <StatusBar />


      {/* Notifications */}
      <ToastContainer />

    </div>
  );
}