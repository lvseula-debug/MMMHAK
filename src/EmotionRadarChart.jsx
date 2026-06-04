// src/EmotionRadarChart.jsx
import React, { useEffect, useState } from "react";

/**
 * Radar chart that visualises the 7 emotion metrics.
 * Expected scores object shape:
 *   { depression, anxiety, anger, joy, stability,
 *     positive_score, negative_score,
 *     classification, confidence }
 */
export default function EmotionRadarChart({ scores }) {
  const axes = [
    "depression",
    "anxiety",
    "anger",
    "joy",
    "stability",
    "positive_score",
    "negative_score",
  ];

  const size = 200; // SVG width/height
  const radius = 80; // max radius for the data polygon
  const center = size / 2;
  const angleStep = (Math.PI * 2) / axes.length;

  const [points, setPoints] = useState("");

  // recompute polygon when scores change
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
  }, [scores]);

  // Outer balance ring (green for positive, red for negative)
  const circumference = 2 * Math.PI * (radius + 12);
  const posPortion = scores.positive_score / (scores.positive_score + scores.negative_score || 1);
  const dashArray = `${circumference * posPortion} ${circumference * (1 - posPortion)}`;

  const classColors = {
    POSITIVE: "#00FF88",
    NEGATIVE: "#FF3366",
    MIXED: "#FFD54F",
  };
  const classColor = classColors[scores.classification] || "#FFF";

  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: "relative", width: size, height: size + 60, margin: "auto" }}>
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
        {/* outer balance ring */}
        <circle
          cx={center}
          cy={center}
          r={radius + 12}
          fill="none"
          stroke="#00FF88"
          strokeWidth={4}
          strokeDasharray={dashArray}
          style={{ filter: "drop-shadow(0 0 6px #00FF88)", transition: "stroke-dasharray 0.5s" }}
        />
        <circle
          cx={center}
          cy={center}
          r={radius + 12}
          fill="none"
          stroke="#FF3366"
          strokeWidth={4}
          strokeDasharray={dashArray}
          strokeDashoffset={-circumference * posPortion}
          style={{ filter: "drop-shadow(0 0 6px #FF3366)", transition: "stroke-dashoffset 0.5s" }}
        />
        {/* data polygon */}
        <polygon
          points={points}
          fill="rgba(0,255,136,0.12)"
          stroke="rgba(0,255,136,0.8)"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 8px #00FF88)", transition: "points 0.4s" }}
        />
        {/* labels */}
        {axes.map((key, i) => {
          const labelR = radius + 24;
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
      {/* central classification */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%)",
          textAlign: "center",
          color: classColor,
          fontFamily: "'Space Mono', monospace",
          fontWeight: 800,
          fontSize: 14,
          textShadow: `0 0 8px ${classColor}`,
        }}
      >
        {scores.classification}
      </div>
      {/* confidence */}
      <div
        style={{
          position: "absolute",
          top: "calc(50% + 30px)",
          left: "50%",
          transform: "translateX(-50%)",
          color: "#CCFF00",
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
        }}
      >
        Emotion Confidence {Math.round(scores.confidence * 100)}%
      </div>
      {/* tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
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
          }}
        >
          {hovered.toUpperCase()}: {Math.round((scores[hovered] ?? 0) * 100)}%
        </div>
      )}
    </div>
  );
}
