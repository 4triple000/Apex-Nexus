const COLORS = [
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#10b981", "#047857"],
  ["#f59e0b", "#b45309"],
  ["#3b82f6", "#1d4ed8"],
  ["#ef4444", "#b91c1c"],
  ["#A29BFE", "#d97706"],
];

export function ContactAvatar({
  name,
  size = 48,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colorIdx = name.charCodeAt(0) % COLORS.length;
  const [bg1, bg2] = COLORS[colorIdx]!;
  const fontSize = size * 0.38;
  const id = `grad-${name.replace(/\s/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`rounded-full flex-shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bg1} />
          <stop offset="100%" stopColor={bg2} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill={`url(#${id})`} />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="white"
        letterSpacing="0.5"
      >
        {initials || "?"}
      </text>
    </svg>
  );
}
