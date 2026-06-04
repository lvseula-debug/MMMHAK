// src/EmotionRadarChart.jsx
import React, { useEffect, useState } from "react";

function SingleRadarChart({ axes, scores, size = 160, radius = 50, color = "#CCFF00" }) {
  const center = size / 2;
  const angleStep = (Math.PI * 2) / axes.length;
  const [points, setPoints] = useState("");
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const pts = axes
      .map((key, i) => {
        const v = Math.min(Math.max(scores[key] ?? 0, 0), 1);
        const r = v * radius;
        const x = center + r * Math.sin(i * angleStep);
        const y = center - r * Math.cos(i * angleStep);
        return `${x},${y}`;
      })
      .join(" ");
    setPoints(pts);
  }, [scores, axes, radius, center, angleStep]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* concentric grid */}
        {[...Array(5)].map((_, idx) => {
          const r = (radius / 5) * (idx + 1);
          const pts = axes
            .map((_, i) => {
              const x = center + r * Math.sin(i * angleStep);
              const y = center - r * Math.cos(i * angleStep);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke="rgba(204,255,0,0.12)"
              strokeWidth={0.8}
            />
          );
        })}
        {/* axes */}
        {axes.map((_, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + (radius + 12) * Math.sin(i * angleStep)}
            y2={center - (radius + 12) * Math.cos(i * angleStep)}
            stroke="rgba(204,255,0,0.2)"
            strokeWidth={0.6}
          />
        ))}
        {/* data polygon */}
        <polygon
          points={points}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "points 0.4s" }}
        />
        {/* labels */}
        {axes.map((key, i) => {
          const labelR = radius + 20;
          const x = center + labelR * Math.sin(i * angleStep);
          const y = center - labelR * Math.cos(i * angleStep);
          return (
            <text
              key={key}
              x={x}
              y={y}
              fill="#CCFF00"
              fontFamily="'Space Mono', monospace"
              fontSize={10}
              textAnchor="middle"
              dominantBaseline="central"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", userSelect: "none" }}
            >
              {key.replace("_", " ")}
            </text>
          );
        })}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(26,0,80,0.9)",
            color: "#CCFF00",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            pointerEvents: "none",
            boxShadow: "0 0 6px #CCFF00",
            zIndex: 10,
          }}
        >
          {hovered.toUpperCase()}: {Math.round((scores[hovered] ?? 0) * 100)}%
        </div>
      )}
    </div>
  );
}

export default function EmotionRadarChart({ scores }) {
  const triAxes = ["depression", "anxiety", "anger"];
  const sqAxes = ["joy", "stability", "positive_score", "negative_score"];

  const classColors = {
    POSITIVE: "#00FF88",
    NEGATIVE: "#FF3366",
    MIXED: "#FFD54F",
  };
  const classColor = classColors[scores.classification] || "#FFF";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <SingleRadarChart axes={triAxes} scores={scores} size={160} radius={45} color="#FF3366" />
        <SingleRadarChart axes={sqAxes} scores={scores} size={160} radius={45} color="#00FF88" />
      </div>

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <div
          style={{
            color: classColor,
            fontFamily: "'Space Mono', monospace",
            fontWeight: 800,
            fontSize: 14,
            textShadow: `0 0 8px ${classColor}`,
          }}
        >
          {scores.classification}
        </div>
        <div
          style={{
            color: "#CCFF00",
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            marginTop: 4,
          }}
        >
          Emotion Confidence {Math.round(scores.confidence * 100)}%
        </div>
      </div>
    </div>
  );
}
