// src/EmotionRadarChart.jsx
import React, { useEffect, useState, useRef } from "react";

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
              stroke="rgba(204,255,0,0.18)"
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
            stroke="rgba(204,255,0,0.25)"
            strokeWidth={0.6}
          />
        ))}
        {/* data polygon */}
        <polygon
          points={points}
          fill={`${color}33`}
          stroke={color}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "points 0.4s" }}
        />
        {/* dot at each vertex */}
        {axes.map((key, i) => {
          const v = Math.min(Math.max(scores[key] ?? 0, 0), 1);
          const r = v * radius;
          const x = center + r * Math.sin(i * angleStep);
          const y = center - r * Math.cos(i * angleStep);
          return (
            <circle
              key={key + "_dot"}
              cx={x}
              cy={y}
              r={3}
              fill={color}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          );
        })}
        {/* labels */}
        {axes.map((key, i) => {
          const labelR = radius + 22;
          const x = center + labelR * Math.sin(i * angleStep);
          const y = center - labelR * Math.cos(i * angleStep);
          return (
            <text
              key={key}
              x={x}
              y={y}
              fill="#CCFF00"
              fontFamily="'Space Mono', monospace"
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="central"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", userSelect: "none", fontWeight: 700 }}
            >
              {key.replace("_", " ").toUpperCase()}
            </text>
          );
        })}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: -24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(26,0,80,0.95)",
            color: "#CCFF00",
            padding: "3px 8px",
            borderRadius: 4,
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            pointerEvents: "none",
            boxShadow: "0 0 8px #CCFF00",
            zIndex: 10,
            whiteSpace: "nowrap",
            border: "1px solid rgba(204,255,0,0.4)",
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

  // Draggable blob state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = (e) => {
    dragging.current = true;
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const onMouseUp = () => { 
      dragging.current = false; 
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const classColors = {
    POSITIVE: "#00FF88",
    NEGATIVE: "#FF3366",
    MIXED: "#FFD54F",
  };
  const classColor = classColors[scores.classification] || "#FFF";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 10 }}>

      {/* Draggable group: blob + charts together */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onMouseDown={onMouseDown}
      >
        {/* Purple blob background — same as album cover */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 500,
            height: 280,
            background: "#1A0050",
            borderRadius: "50%",
            animation: "float-blob 8s ease-in-out infinite",
            zIndex: 0,
            opacity: 0.96,
            pointerEvents: "none",
            boxShadow: "0 0 40px rgba(26,0,80,0.8), 0 0 80px rgba(26,0,80,0.4)",
          }}
        />

        {/* Charts row on top of blob */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 56,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "24px 32px",
          }}
        >
          {/* Triangle chart label */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 8,
              color: "rgba(255,51,102,0.8)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}>
              NEGATIVE EMOTIONS
            </div>
            <SingleRadarChart axes={triAxes} scores={scores} size={160} radius={45} color="#FF3366" />
          </div>

          {/* Divider */}
          <div style={{
            width: 1,
            height: 120,
            background: "rgba(204,255,0,0.15)",
            flexShrink: 0,
          }} />

          {/* Quad chart label */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 8,
              color: "rgba(0,255,136,0.8)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}>
              EMOTIONAL BALANCE
            </div>
            <SingleRadarChart axes={sqAxes} scores={scores} size={160} radius={45} color="#00FF88" />
          </div>
        </div>
      </div>

      {/* Classification badge — stays fixed below */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div
          style={{
            color: classColor,
            fontFamily: "'Space Mono', monospace",
            fontWeight: 800,
            fontSize: 14,
            textShadow: `0 0 8px ${classColor}`,
            letterSpacing: "0.1em",
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
            opacity: 0.8,
          }}
        >
          Emotion Confidence {Math.round(scores.confidence * 100)}%
        </div>
      </div>
    </div>
  );
}
