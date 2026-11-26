/** A heart and the number of likes, shown over a photo once it has any. */
export function LikeBadge({ count, large = false }: { count?: number; large?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={`absolute top-[0.6vw] right-[0.6vw] flex items-center gap-[0.4vw] rounded-full bg-black/70 font-bold text-white tabular-nums ${
        large
          ? 'px-[1.2vw] py-[0.6vw] text-[clamp(1.2rem,2.4vw,3.4rem)]'
          : 'px-[0.8vw] py-[0.3vw] text-[clamp(0.9rem,1.4vw,2.2rem)]'
      }`}
    >
      <span aria-hidden="true" className="text-rose-400">
        ♥
      </span>
      <span>
        {count}
        <span className="sr-only"> likes</span>
      </span>
    </span>
  );
}
