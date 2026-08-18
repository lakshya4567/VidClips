export default function Panel({ title, children }) {
  return (
    <div className="bg-[#111827] rounded-xl border border-zinc-800 overflow-hidden">

      <div className="px-4 py-3 border-b border-zinc-800 font-semibold text-zinc-300">
        {title}
      </div>

      <div className="p-4">
        {children}
      </div>

    </div>
  );
}