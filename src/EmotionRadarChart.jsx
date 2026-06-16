// src/EmotionRadarChart.jsx
import { useState, useEffect, useRef } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
const colorMap = {
  happy: "#34A853",
  confident: "#FF5F2A",
  angry: "#BF1111",
  sad: "#6139FF",
  lonely: "#BEB729",
  love: "#FF06EA",
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = colorMap[data.subject] || "#CCFF00";
    // Divide by 2 because the charted value is doubled for visual prominence
    const originalValue = data.value / 2;
    return (
      <div
        style={{
          background: "rgba(26, 0, 80, 0.95)",
          color: color,
          padding: "6px 10px",
          border: `1px solid ${color}66`,
          borderRadius: "6px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          boxShadow: `0 0 12px ${color}55`,
          textTransform: "uppercase",
        }}
      >
        {data.subject}: {Math.round(originalValue * 100)}%
      </div>
    );
  }
  return null;
};

const renderPolarAngleAxisTick = ({ payload, x, y, cx, cy, ...rest }) => {
  const labelColor = colorMap[payload.value] || "#CCFF00";
  
  // Dynamic offset calculation for labels around the hexagon
  let textAnchor = "middle";
  if (x > cx + 15) {
    textAnchor = "start";
  } else if (x < cx - 15) {
    textAnchor = "end";
  }

  // Adjust y position slightly based on position relative to center
  const yOffset = y > cy ? 6 : y < cy ? -6 : 0;

  return (
    <text
      {...rest}
      x={x}
      y={y + yOffset}
      textAnchor={textAnchor}
      fill={labelColor}
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "10px",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {payload.value}
    </text>
  );
};

function DraggableChartGroup({ children, blobWidth = 260, blobHeight = 260 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = (e) => {
    dragging.current = true;
    setIsDragging(true);
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
        pointerEvents: "auto",
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
      <div className="relative z-10 p-4 w-full flex justify-center items-center">
        {children}
      </div>
    </div>
  );
}

export default function EmotionRadarChart({ scores }) {
  if (!scores) return null;

  // Chart labels sequence strictly in (happy-confident-angry-sad-lonely-love) order for symmetry
  // Values are doubled for visual prominence (and will be clamped in drawing or plotted against PolarRadiusAxis)
  const data = [
    { subject: "happy", value: (scores.happy ?? 0) * 2 },
    { subject: "confident", value: (scores.confident ?? 0) * 2 },
    { subject: "angry", value: (scores.angry ?? 0) * 2 },
    { subject: "sad", value: (scores.sad ?? 0) * 2 },
    { subject: "lonely", value: (scores.lonely ?? 0) * 2 },
    { subject: "love", value: (scores.love ?? 0) * 2 },
  ];

  return (
    <div className="flex flex-col items-center gap-4 mt-2 w-full">
      <div className="flex flex-col items-center justify-center p-4 w-full">
        <DraggableChartGroup blobWidth={285} blobHeight={285}>
          <div className="flex flex-col items-center w-full" style={{ pointerEvents: "auto" }}>
            <div className="font-['Space_Mono'] text-[14px] text-[#CCFF00] tracking-[0.2em] uppercase font-extrabold mb-2 text-center">
              EMOTION LANDSCAPE
            </div>
            
            <div className="w-[260px] h-[260px] flex items-center justify-center relative">
              <RadarChart width={260} height={260} cx="50%" cy="50%" outerRadius={70} data={data}>
                <defs>
                  <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#34A853" />       {/* happy */}
                    <stop offset="20%" stopColor="#FF5F2A" />      {/* confident */}
                    <stop offset="40%" stopColor="#BF1111" />      {/* angry */}
                    <stop offset="60%" stopColor="#6139FF" />      {/* sad */}
                    <stop offset="80%" stopColor="#BEB729" />      {/* lonely */}
                    <stop offset="100%" stopColor="#FF06EA" />     {/* love */}
                  </linearGradient>
                </defs>
                
                {/* Hexagonal grid configuration */}
                <PolarGrid gridType="polygon" stroke="rgba(204,255,0,0.18)" strokeWidth={0.8} />
                
                {/* Axis settings for 6 points */}
                <PolarAngleAxis dataKey="subject" tick={renderPolarAngleAxisTick} />
                
                {/* Fixed PolarRadiusAxis domain [0, 0.6] to zoom and size relative to chart space */}
                <PolarRadiusAxis domain={[0, 0.6]} tick={false} axisLine={false} />
                
                {/* Tooltip to view percentages */}
                <Tooltip content={<CustomTooltip />} cursor={false} />
                
                {/* Radar shape definition */}
                <Radar
                  name="Emotion"
                  dataKey="value"
                  stroke="url(#radarGradient)"
                  strokeWidth={2}
                  fill="url(#radarGradient)"
                  fillOpacity={0.25}
                  isAnimationActive={false}
                />
              </RadarChart>
            </div>
          </div>
        </DraggableChartGroup>
      </div>
    </div>
  );
}