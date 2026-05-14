"use client";

interface Props {
  score: number; // 0-100
  size?: number;
}

function riskColor(score: number) {
  if (score <= 30) return "#2D7A3C";
  if (score <= 60) return "#B45309";
  return "#C0392B";
}

function riskLabel(score: number) {
  if (score <= 30) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "High";
  return "Critical";
}

export function RiskGauge({ score, size = 160 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.78;
  const strokeWidth = size * 0.1;

  const startAngle = Math.PI;
  const endAngle = 0;
  const totalArc = Math.PI;

  const toCoords = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const bgStart = toCoords(startAngle);
  const bgEnd = toCoords(endAngle);

  const fillAngle = startAngle - (score / 100) * totalArc;
  const fillEnd = toCoords(fillAngle);
  const largeArc = (score / 100) * totalArc > Math.PI ? 1 : 0;

  const color = riskColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
        {/* Track */}
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none"
          stroke="#E3DDD5"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fill */}
        {score > 0 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy * 0.85}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="700"
          fontFamily="var(--font-sora)"
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy * 1.05}
          textAnchor="middle"
          fill="#9C9890"
          fontSize={size * 0.09}
          fontFamily="var(--font-dm-sans)"
        >
          {riskLabel(score)}
        </text>
      </svg>
      <div className="flex justify-between w-full px-2 -mt-1">
        <span className="text-xs text-text-muted">0</span>
        <span className="text-xs text-text-muted font-medium">Risk Score</span>
        <span className="text-xs text-text-muted">100</span>
      </div>
    </div>
  );
}
