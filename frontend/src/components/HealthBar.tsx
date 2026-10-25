type HealthBarProps = {
  value: number;
  health: number;
  align: 'left' | 'right';
  accent: 'red' | 'green';
};

export function HealthBar({ value, health, align, accent }: HealthBarProps) {
  const gradient =
    accent === 'red'
      ? 'from-red-700 via-red-500 to-amber-300'
      : 'from-emerald-700 via-emerald-500 to-lime-300';

  return (
    <div className="w-full">
      <div className="mb-1 flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
        <span>{align === 'left' ? 'Energia eleitoral' : `${health.toFixed(2)} HP`}</span>
        <span>{align === 'left' ? `${health.toFixed(2)} HP` : 'Energia eleitoral'}</span>
      </div>
      <div className="health-shell relative h-5 overflow-hidden rounded-sm border-2 border-white/70 bg-black/80 p-[2px] shadow-[0_0_20px_rgba(255,255,255,0.08)] sm:h-7">
        <div
          className={`h-full bg-gradient-to-r ${gradient} transition-[width] duration-700 ease-out ${
            align === 'right' ? 'ml-auto' : ''
          }`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
        <div className="health-segments pointer-events-none absolute inset-0 opacity-25" />
      </div>
    </div>
  );
}
