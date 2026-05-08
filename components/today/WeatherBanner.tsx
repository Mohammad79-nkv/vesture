// Frame 11 · rain reshuffle banner.
// Sits between the header and the outfit cards when the current
// condition is "rain". Copy explains the swaps the recommender
// made — we render whatever the model included in
// recommendations.headline.sub but fall back to a static line so
// the banner never reads empty.

export function WeatherBanner({
  body,
}: {
  body: string;
}) {
  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-2.5 rounded-[14px] bg-secondary/15 px-3.5 py-3 text-secondary">
        <span aria-hidden="true">✦</span>
        <span className="flex-1 text-[11.5px] leading-[1.4]">{body}</span>
      </div>
    </div>
  );
}
