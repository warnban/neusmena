/** Золотая метка Premium рядом с названием сети */
export function SeatNetworkLabel({ name, premium }: { name: string; premium?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">{name}</span>
      {premium && (
        <span
          className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            color: "#b8944f",
            background: "linear-gradient(135deg, rgba(212,175,106,0.2), rgba(212,175,106,0.08))",
            border: "1px solid rgba(212,175,106,0.35)",
          }}
        >
          Premium
        </span>
      )}
    </span>
  );
}
