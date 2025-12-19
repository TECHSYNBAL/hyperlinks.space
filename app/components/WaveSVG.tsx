"use client";

import { useEffect, useRef } from "react";

interface WaveSVGProps {
  svgContent: string;
  width?: number;
  height?: number;
}

// Parse SVG path and apply ocean wave effect
const applyOceanWave = (
  pathData: string,
  time: number,
  waveIntensity: number = 1,
  pathIndex: number = 0
): string => {
  // Extract all numbers from the path
  const numberRegex = /(-?\d+\.?\d*)/g;
  const matches: Array<{ value: number; index: number; length: number }> = [];
  let match;

  while ((match = numberRegex.exec(pathData)) !== null) {
    matches.push({
      value: parseFloat(match[0]),
      index: match.index,
      length: match[0].length,
    });
  }

  if (matches.length === 0) return pathData;

  // Build new path with ocean wave distortion
  let result = "";
  let lastIndex = 0;

  matches.forEach((num, numIndex) => {
    // Add text before this number
    result += pathData.substring(lastIndex, num.index);

    const isY = numIndex % 2 === 1;
    const x = numIndex % 2 === 0 ? num.value : (matches[numIndex - 1]?.value || 0);
    const y = isY ? num.value : (matches[numIndex + 1]?.value || 0);
    
    // Create smooth ocean waves using sine/cosine
    // Multiple wave frequencies for realistic ocean effect
    const waveLength1 = 200; // Long, slow waves
    const waveLength2 = 120; // Medium waves
    const waveLength3 = 80;  // Short, rippling waves
    
    // Wave speeds (how fast they travel)
    const speed1 = 0.3;
    const speed2 = 0.5;
    const speed3 = 0.7;
    
    // Phase offsets for each path (so they don't all wave the same)
    const phase1 = pathIndex * 0.5;
    const phase2 = pathIndex * 0.8;
    const phase3 = pathIndex * 1.2;
    
    // Calculate wave displacement
    // Horizontal waves (affect Y coordinates more)
    const wave1 = Math.sin((x / waveLength1 + time * speed1 + phase1) * Math.PI * 2);
    const wave2 = Math.sin((x / waveLength2 + time * speed2 + phase2) * Math.PI * 2);
    const wave3 = Math.sin((x / waveLength3 + time * speed3 + phase3) * Math.PI * 2);
    
    // Vertical waves (affect X coordinates)
    const waveX1 = Math.cos((y / waveLength1 + time * speed1 * 0.7 + phase1) * Math.PI * 2);
    const waveX2 = Math.cos((y / waveLength2 + time * speed2 * 0.7 + phase2) * Math.PI * 2);
    
    // Combine waves with different amplitudes
    const combinedWaveY = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
    const combinedWaveX = (waveX1 * 0.4 + waveX2 * 0.3);
    
    // Add random narrowing/widening effect
    // Create regions for scaling (narrowing/widening)
    const scaleGridSize = 100;
    const scaleGridX = Math.floor(x / scaleGridSize);
    const scaleGridY = Math.floor(y / scaleGridSize);
    const scaleRegionId = pathIndex * 1000 + scaleGridX * 50 + scaleGridY;
    
    // Random scaling that changes over time (narrowing/widening)
    const scaleTimeSlot = Math.floor(time / 4); // Changes every 4 seconds
    const scaleSeed = scaleRegionId + scaleTimeSlot * 10000;
    const scaleValue = Math.sin(scaleSeed) * 0.2 + 1.0; // 0.8 to 1.2 (20% narrowing/widening)
    
    // Smooth transition between scale changes
    const scaleProgress = (time % 4) / 4;
    const smoothScaleProgress = scaleProgress * scaleProgress * (3 - 2 * scaleProgress);
    const nextScaleSeed = scaleSeed + 10000;
    const nextScaleValue = Math.sin(nextScaleSeed) * 0.2 + 1.0;
    const currentScale = scaleValue + (nextScaleValue - scaleValue) * smoothScaleProgress;
    
    // Calculate approximate center from current coordinates
    // Use a simple approach: scale relative to the coordinate itself
    // For narrowing/widening: scale the coordinate value
    const scaleFactor = (currentScale - 1.0) * 0.4; // 40% of scale change
    
    // Apply ocean wave distortion
    const waveDistortion = isY
      ? combinedWaveY * waveIntensity
      : combinedWaveX * waveIntensity * 0.6;
    
    // Apply scaling distortion (narrowing/widening)
    // This creates the effect of the shape getting wider or narrower
    const scaleDistortion = isY
      ? num.value * scaleFactor // Vertical scaling (stretch/compress)
      : num.value * scaleFactor * 0.7; // Horizontal scaling (widen/narrow)
    
    // Combine ocean waves with narrowing/widening
    const distortion = waveDistortion + scaleDistortion;

    const newValue = num.value + distortion;
    
    // Keep precision for smooth curves
    result += Math.round(newValue * 100) / 100;

    lastIndex = num.index + num.length;
  });

  // Add remaining text
  result += pathData.substring(lastIndex);

  return result;
};

export default function WaveSVG({
  svgContent,
  width = 400,
  height = 400,
}: WaveSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const originalPathsRef = useRef<Map<SVGPathElement, string>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    // Parse and inject SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
      console.error("No SVG element found");
      return;
    }

    // Clone and inject SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    // Set SVG to fill container
    clonedSvg.setAttribute("width", "100%");
    clonedSvg.setAttribute("height", "100%");
    clonedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    clonedSvg.style.width = "100%";
    clonedSvg.style.height = "100%";
    clonedSvg.style.display = "block";
    clonedSvg.style.overflow = "visible";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(clonedSvg);
    svgRef.current = clonedSvg;

    // Get all paths and store original path data
    const paths = clonedSvg.querySelectorAll("path");
    paths.forEach((path) => {
      const originalPath = path.getAttribute("d");
      if (originalPath) {
        originalPathsRef.current.set(path, originalPath);
      }
    });

    // Animation loop for wave effect
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) * 0.001;

      paths.forEach((path, index) => {
        const originalPath = originalPathsRef.current.get(path);
        if (!originalPath) return;

        // Ocean wave intensity - reduced pulsation
        const baseIntensity = 3; // Reduced base wave strength
        const variation = Math.sin(elapsed * 0.4 + index * 0.3) * 1; // Smaller variation
        const waveIntensity = baseIntensity + variation; // 2-4 range (much less pulsation)
        
        const distortedPath = applyOceanWave(
          originalPath, 
          elapsed, 
          waveIntensity,
          index
        );
        path.setAttribute("d", distortedPath);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      originalPathsRef.current.clear();
    };
  }, [svgContent]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    />
  );
}
