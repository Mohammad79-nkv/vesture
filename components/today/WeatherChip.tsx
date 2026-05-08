import type { WeatherCondition } from "@/lib/adapters/weather";

// Top-bar weather chip — temperature + a tiny dot whose color hints at
// the condition. Frame 02 uses a teal dot for clear evening, frame 11
// swaps to a darker blue for rain, frame 12 to a slate dot for cold.
//
// We deliberately keep this tiny: just temp + condition. A future
// "tonight will rain" preview pulls from the same weather payload but
// belongs in a separate component (the why-line / weather-shift banner
// that frame 11 introduces).

const CONDITION_DOT: Record<WeatherCondition, string> = {
  clear: "#34889E",
  cloudy: "#8A8FA0",
  rain: "#256776",
  snow: "#9DCAD4",
  fog: "#C9CDD6",
  storm: "#3A4055",
};

export function WeatherChip({
  tempC,
  condition,
  label,
}: {
  tempC: number;
  condition: WeatherCondition;
  // City name (or coarser region) from reverse geocoding —
  // shown after the temperature so the chip reads "17° ·
  // RIYADH". Null when label resolution failed; chip then shows
  // just the temperature.
  label?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 shadow-[0_1px_0_rgba(33,39,57,0.04)]">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: CONDITION_DOT[condition] }}
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink">
        {Math.round(tempC)}°{label ? ` · ${label}` : ""}
      </span>
    </span>
  );
}
