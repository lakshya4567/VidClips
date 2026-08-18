/**
 * VidClips - Tabs Component
 */
export default function Tabs({ tabs, activeTab, onChange, className = "" }) {
  return (
    <div className={`flex border-b border-zinc-800 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors relative
              ${isActive ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"}
            `}
          >
            <div className="flex items-center gap-2">
              {tab.icon && <tab.icon size={14} />}
              <span>{tab.label}</span>
            </div>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}