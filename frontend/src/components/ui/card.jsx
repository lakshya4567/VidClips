export default function Card({ children }) {
  return (
    <div className="rounded-xl bg-[#1A1F2E] border border-zinc-800 p-4 shadow-lg">
      {children}
    </div>
  );
}