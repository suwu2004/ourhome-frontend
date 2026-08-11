export default function HomeCatFrame() {
  return (
    <svg className="home-cat-frame" viewBox="0 0 72 58" aria-hidden="true">
      <path
        className="home-cat-frame__face"
        d="M13 23C11 18 11 11 15 5l9 8c3.8-2 7.8-3 12-3s8.2 1 12 3l9-8c4 6 4 13 2 18 5.6 3.7 8 10.6 6 18-2.6 9-13.6 13-29 13S9.6 50 7 41c-2-7.4.4-14.3 6-18Z"
      />
      <path className="home-cat-frame__ear home-cat-frame__ear--left" d="m15.7 7.7 6.7 5.8" />
      <path className="home-cat-frame__ear home-cat-frame__ear--right" d="m56.3 7.7-6.7 5.8" />
      <path className="home-cat-frame__whiskers" d="M9 30 1.5 28M8 35l-7.5 1M63 30l7.5-2M64 35l7.5 1" />
    </svg>
  );
}
