/**
 * VidClips - AI Inspector Component
 * Multi-tab analysis panel showing scenes, objects, faces, OCR, audio, metadata, etc.
 */
import { useMemo } from "react";
import {
  LayoutDashboard,
  Clapperboard,
  Box,
  ScanFace,
  Type,
  Music,
  Camera,
  Palette,
  Info,
  ChevronRight,
  Clock,
  Hash,
  Eye,
} from "lucide-react";
import Tabs from "../ui/Tabs";
import Badge from "../ui/Badge";
import { useEditor } from "../../context/EditorContext";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "scenes", label: "Scenes", icon: Clapperboard },
  { id: "objects", label: "Objects", icon: Box },
  { id: "faces", label: "Faces", icon: ScanFace },
  { id: "ocr", label: "OCR", icon: Type },
  { id: "audio", label: "Audio", icon: Music },
  { id: "motion", label: "Motion", icon: Camera },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "metadata", label: "Metadata", icon: Info },
];

function formatTime(t) {
  if (!t || !isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Overview Panel ──────────────────────────────────
function OverviewPanel({ data, jobStatus }) {
  if (jobStatus !== "completed" || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-6">
        <Eye size={48} className="mb-4 text-zinc-700" />
        <p className="text-sm text-center">Upload a video and run AI analysis to see results here.</p>
      </div>
    );
  }

  const stats = [
    { label: "Scenes", value: data.scenes?.length || 0, icon: Clapperboard },
    { label: "Objects", value: data.objects?.length || 0, icon: Box },
    { label: "Faces", value: data.faces?.length || 0, icon: ScanFace },
    { label: "Text Items", value: data.ocr?.length || 0, icon: Type },
    { label: "Duration", value: data.duration ? formatTime(data.duration) : "N/A", icon: Clock },
  ];

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">Analysis Summary</h3>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <s.icon size={14} />
              <span className="text-[11px] uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-zinc-100">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scenes Panel ────────────────────────────────────
function ScenesPanel({ scenes, inspectItem }) {
  if (!scenes?.length) {
    return <EmptyPanel message="No scenes detected" />;
  }
  return (
    <div className="p-2 space-y-1">
      {scenes.map((scene, i) => (
        <button
          key={i}
          onClick={() => inspectItem({ type: "scene", time: scene.start_sec, data: scene })}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Clapperboard size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">Scene {scene.scene_index + 1}</p>
            <p className="text-[11px] text-zinc-500">
              {formatTime(scene.start_sec)} - {formatTime(scene.end_sec)}
              <span className="ml-2">({(scene.end_sec - scene.start_sec).toFixed(1)}s)</span>
            </p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── Objects Panel ───────────────────────────────────
function ObjectsPanel({ objects, inspectItem }) {
  if (!objects?.length) {
    return <EmptyPanel message="No objects detected" />;
  }
  return (
    <div className="p-2 space-y-1">
      {objects.map((obj, i) => (
        <button
          key={i}
          onClick={() => inspectItem({ type: "object", time: obj.timestamp_sec, data: obj })}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Box size={16} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate capitalize">{obj.label || obj.class_name || "Object"}</p>
            <p className="text-[11px] text-zinc-500">
              Confidence: {((obj.confidence || obj.score || 0) * 100).toFixed(0)}%
              <span className="ml-2">@{formatTime(obj.timestamp_sec)}</span>
            </p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── Faces Panel ─────────────────────────────────────
function FacesPanel({ faces, inspectItem }) {
  if (!faces?.length) {
    return <EmptyPanel message="No faces detected" />;
  }
  return (
    <div className="p-2 space-y-1">
      {faces.map((face, i) => (
        <button
          key={i}
          onClick={() => inspectItem({ type: "face", time: face.timestamp_sec, data: face })}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <ScanFace size={16} className="text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">Face {i + 1}</p>
            <p className="text-[11px] text-zinc-500">
              {face.emotion ? `${face.emotion} · ` : ""}@{formatTime(face.timestamp_sec)}
            </p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── OCR Panel ───────────────────────────────────────
function OcrPanel({ ocr, inspectItem }) {
  if (!ocr?.length) {
    return <EmptyPanel message="No text detected" />;
  }
  return (
    <div className="p-2 space-y-1">
      {ocr.map((item, i) => (
        <button
          key={i}
          onClick={() => inspectItem({ type: "ocr", time: item.timestamp_sec, data: item })}
          className="w-full p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left group"
        >
          <p className="text-sm text-zinc-200 truncate">"{item.text}"</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">@{formatTime(item.timestamp_sec)}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Audio Panel ─────────────────────────────────────
function AudioPanel({ audio }) {
  if (!audio) {
    return <EmptyPanel message="No audio analysis available" />;
  }
  return (
    <div className="p-3 space-y-3">
      {audio.sample_rate && (
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Sample Rate</p>
          <p className="text-sm text-zinc-200 mt-1">{audio.sample_rate} Hz</p>
        </div>
      )}
      {audio.channels && (
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Channels</p>
          <p className="text-sm text-zinc-200 mt-1">{audio.channels}</p>
        </div>
      )}
      {audio.duration && (
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Duration</p>
          <p className="text-sm text-zinc-200 mt-1">{formatTime(audio.duration)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Motion Panel ────────────────────────────────────
function MotionPanel({ motion, inspectItem }) {
  if (!motion?.frames?.length) {
    return <EmptyPanel message="No motion data available" />;
  }
  return (
    <div className="p-2 space-y-1">
      {motion.frames.slice(0, 50).map((frame, i) => (
        <button
          key={i}
          onClick={() => inspectItem({ type: "motion", time: frame.timestamp_sec, data: frame })}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Camera size={16} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {frame.motion_tags?.join(", ") || "Motion"}
            </p>
            <p className="text-[11px] text-zinc-500">@{formatTime(frame.timestamp_sec)}</p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── Colors Panel ────────────────────────────────────
function ColorsPanel({ colors }) {
  if (!colors) {
    return <EmptyPanel message="No color analysis available" />;
  }
  return (
    <div className="p-3 space-y-3">
      {colors.dominant_colors?.map((color, i) => (
        <div key={i} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
          <div
            className="w-8 h-8 rounded-lg border border-zinc-700"
            style={{ backgroundColor: color.hex || color.rgb || "#000" }}
          />
          <div>
            <p className="text-sm text-zinc-200 capitalize">{color.name || `Color ${i + 1}`}</p>
            <p className="text-[11px] text-zinc-500">{((color.weight || 0) * 100).toFixed(0)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metadata Panel ──────────────────────────────────
function MetadataPanel({ metadata }) {
  if (!metadata) {
    return <EmptyPanel message="No metadata available" />;
  }
  const fields = [
    { label: "Duration", value: metadata.duration ? `${metadata.duration.toFixed(2)}s` : "N/A" },
    { label: "FPS", value: metadata.fps || "N/A" },
    { label: "Width", value: metadata.width || "N/A" },
    { label: "Height", value: metadata.height || "N/A" },
    { label: "Codec", value: metadata.codec || "N/A" },
    { label: "Bitrate", value: metadata.bitrate || "N/A" },
  ];
  return (
    <div className="p-3 space-y-1">
      {fields.map((f) => (
        <div key={f.label} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-900/30">
          <span className="text-xs text-zinc-500">{f.label}</span>
          <span className="text-xs text-zinc-300 font-mono">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────
function EmptyPanel({ message }) {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-600">
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Main Inspector ──────────────────────────────────
export default function Inspector() {
  const {
    activeInspectorTab,
    setActiveInspectorTab,
    analysisData,
    jobStatus,
    inspectItem,
  } = useEditor();

  const data = analysisData || {};

  const renderPanel = () => {
    switch (activeInspectorTab) {
      case "overview":
        return <OverviewPanel data={data} jobStatus={jobStatus} />;
      case "scenes":
        return <ScenesPanel scenes={data.scenes} inspectItem={inspectItem} />;
      case "objects":
        return <ObjectsPanel objects={data.objects} inspectItem={inspectItem} />;
      case "faces":
        return <FacesPanel faces={data.faces} inspectItem={inspectItem} />;
      case "ocr":
        return <OcrPanel ocr={data.ocr} inspectItem={inspectItem} />;
      case "audio":
        return <AudioPanel audio={data.audio} />;
      case "motion":
        return <MotionPanel motion={data.motion} inspectItem={inspectItem} />;
      case "colors":
        return <ColorsPanel colors={data.colors} />;
      case "metadata":
        return <MetadataPanel metadata={data.metadata} />;
      default:
        return <OverviewPanel data={data} jobStatus={jobStatus} />;
    }
  };

  return (
    <aside className="w-80 bg-[#0B1120] border-l border-zinc-800/60 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-[44px] flex items-center px-4 border-b border-zinc-800/40">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Eye size={16} className="text-purple-400" />
          AI Inspector
        </h2>
        {jobStatus === "running" && (
          <div className="ml-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={TABS}
        activeTab={activeInspectorTab}
        onChange={setActiveInspectorTab}
        className="shrink-0"
      />

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {renderPanel()}
      </div>
    </aside>
  );
}