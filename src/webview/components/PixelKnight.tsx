// 10x10 pixel-art knight; each string is a row, '#' is a filled pixel.
const ROWS = [
  '...##.....',
  '..####....',
  '.######...',
  '.###.###..',
  '########..',
  '###.####..',
  '...#####..',
  '..######..',
  '.########.',
  '.########.',
];

export function PixelKnight({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => (cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)),
      )}
    </svg>
  );
}
