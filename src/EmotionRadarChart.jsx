// src/EmotionRadarChart.jsx
import React, { useEffect, useState, useRef } from "react";

function SingleRadarChart({ axes, scores, size = 240, radius = 50, color = "#CCFF00" }) {
  if (!scores || !axes) return null; // Error handling: Ensure data exists

  const center = size / 2;
  const angleStep = (Math.PI * 2) / axes.length;
  const [points, setPoints] = useState("");
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    try {
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
    } catch (err) {
      console.error("Error computing radar points", err);
    }
  }, [scores, axes, radius, center, angleStep]);

  return (
    <div className="relative w-full max-w-[240px] aspect-square flex items-center justify-center">
      <svg className="w-full h-auto overflow-visible" viewBox={`0 0 ${size} ${size}`}>
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
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#1A0050]/95 text-[#CCFF00] px-2 py-1 rounded text-[10px] whitespace-nowrap z-10 border border-[#CCFF00]/40"
          style={{
            fontFamily: "'Space Mono', monospace",
            pointerEvents: "none",
            boxShadow: "0 0 8px #CCFF00",
          }}
        >
          {hovered.toUpperCase()}: {Math.round((scores[hovered] ?? 0) * 100)}%
        </div>
      )}
    </div>
  );
}

function DraggableChartGroup({ children, blobWidth = 260, blobHeight = 260 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = (e) => {
    // Only drag on desktop where touch isn't prioritized, but allow touch for mobile
    dragging.current = true;
    setIsDragging(true);
    // Support both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { mx: clientX, my: clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPos({
        x: dragStart.current.px + (clientX - dragStart.current.mx),
        y: dragStart.current.py + (clientY - dragStart.current.my),
      });
    };
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <div
      className="relative z-10 flex justify-center items-center select-none w-full max-w-[260px] mx-auto"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        cursor: isDragging ? "grabbing" : "grab",
        pointerEvents: "auto"
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
    >
      {/* Purple blob background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1A0050] rounded-full z-0 opacity-96 pointer-events-none w-full h-full"
        style={{
          maxWidth: blobWidth,
          maxHeight: blobHeight,
          animation: "float-blob 8s ease-in-out infinite",
        }}
      />
      {/* Chart content on top of blob */}
      <div className="relative z-10 p-4 w-full">
        {children}
      </div>
    </div>
  );
}

export default function EmotionRadarChart({ scores }) {
  if (!scores) return null; // Prevent crash if scores is null

  const triAxes = ["depression", "anxiety", "anger"];
  const sqAxes = ["joy", "stability", "positive_score", "negative_score"];

  const classColors = {
    POSITIVE: "#00FF88",
    NEGATIVE: "#FF3366",
    MIXED: "#FFD54F",
  };
  const classColor = classColors[scores.classification] || "#FFF";

  return (
    <div className="flex flex-col items-center gap-4 mt-2 w-full">
      <div className="flex flex-col md:flex-row gap-10 items-center justify-center p-4 w-full">
        {/* Negative Emotions Draggable Chart */}
        <DraggableChartGroup blobWidth={260} blobHeight={260}>
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="font-['Space_Mono'] text-[12px] text-[#FF3366] tracking-[0.2em] uppercase font-extrabold">
              NEGATIVE EMOTIONS
            </div>
            <SingleRadarChart axes={triAxes} scores={scores} size={240} radius={45} color="#FF3366" />
          </div>
        </DraggableChartGroup>

        {/* Divider */}
        <div className="hidden md:block w-px h-[160px] bg-[#CCFF00]/15 shrink-0" />
        <div className="block md:hidden h-px w-3/4 max-w-[200px] bg-[#CCFF00]/15 shrink-0" />

        {/* Emotional Balance Draggable Chart */}
        <DraggableChartGroup blobWidth={260} blobHeight={260}>
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="font-['Space_Mono'] text-[12px] text-[#00FF88] tracking-[0.2em] uppercase font-extrabold">
              EMOTIONAL BALANCE
            </div>
            <SingleRadarChart axes={sqAxes} scores={scores} size={240} radius={45} color="#00FF88" />
          </div>
        </DraggableChartGroup>
    </div>
  );
}
