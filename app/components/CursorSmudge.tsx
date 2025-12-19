"use client";

import { useEffect, useRef, useState } from "react";

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  intensity: number;
  vx: number;
  vy: number;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  radius: number;
  intensity: number;
}

export default function CursorSmudge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const trailsRef = useRef<TrailPoint[]>([]);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const [zoom, setZoom] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [blurRegions, setBlurRegions] = useState<Array<{ x: number; y: number; size: number; blur: number; vx: number; vy: number }>>([]);
  const bodyRef = useRef<HTMLBodyElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const isMobileRef = useRef(false);
  const randomMovementRef = useRef<{ x: number; y: number; targetX: number; targetY: number; lastMove: number } | null>(null);
  const blurRegionsRef = useRef<Array<{ x: number; y: number; size: number; blur: number; vx: number; vy: number }>>([]);

  useEffect(() => {
    // Detect mobile device
    isMobileRef.current = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          (typeof window !== 'undefined' && window.innerWidth <= 768);
    
    // Get body element to apply gravity lens transform
    bodyRef.current = document.body as HTMLBodyElement;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    
    // Initialize random movement for mobile
    if (isMobileRef.current) {
      randomMovementRef.current = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        lastMove: Date.now(),
      };
      setMousePos({ x: randomMovementRef.current.x, y: randomMovementRef.current.y });
    }
    
    // Initialize blur regions - create multiple regions with different blur levels
    const numRegions = 8;
    const initialRegions = Array.from({ length: numRegions }, (_, i) => ({
      x: (window.innerWidth / numRegions) * i + Math.random() * (window.innerWidth / numRegions),
      y: Math.random() * window.innerHeight,
      size: 200 + Math.random() * 300,
      blur: 1 + Math.random() * 8, // Blur between 1-9px
      vx: (Math.random() - 0.5) * 0.5, // Horizontal velocity
      vy: (Math.random() - 0.5) * 0.5, // Vertical velocity
    }));
    blurRegionsRef.current = initialRegions;
    setBlurRegions(initialRegions);

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Track mouse position with velocity and create continuous ripples
    let lastRippleTime = 0;
    const rippleInterval = 150; // Create new ripple every 150ms
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const vx = e.clientX - lastMousePosRef.current.x;
      const vy = e.clientY - lastMousePosRef.current.y;
      
      setMousePos({ x: e.clientX, y: e.clientY });
      trailsRef.current.push({
        x: e.clientX,
        y: e.clientY,
        time: now,
        intensity: 1.0,
        vx,
        vy,
      });
      
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Keep only recent trails (last 30 points for smoother effect)
      if (trailsRef.current.length > 30) {
        trailsRef.current.shift();
      }
      
      // Create continuous ripples on mouse movement
      if (now - lastRippleTime > rippleInterval) {
        ripplesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          startTime: now,
          radius: 0,
          intensity: 1.0,
        });
        
        lastRippleTime = now;
        
        // Limit number of simultaneous ripples (allow more for continuous effect)
        if (ripplesRef.current.length > 15) {
          ripplesRef.current.shift();
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Handle click/touch to create water ripples
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      
      if (clientX !== undefined && clientY !== undefined) {
        const now = Date.now();
        ripplesRef.current.push({
          x: clientX,
          y: clientY,
          startTime: now,
          radius: 0,
          intensity: 1.0,
        });
        
        // Limit number of simultaneous ripples
        if (ripplesRef.current.length > 5) {
          ripplesRef.current.shift();
        }
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleClick, { passive: true });

    // Animation loop
    const animate = (timestamp: number) => {
      timeRef.current = timestamp * 0.001;
      const now = Date.now();
      
      // Random movement for mobile (decorative only)
      if (isMobileRef.current && randomMovementRef.current) {
        const timeSinceLastMove = now - randomMovementRef.current.lastMove;
        const moveInterval = 2500 + Math.random() * 2500; // 2.5-5 seconds between moves
        const moveDuration = 1000 + Math.random() * 500; // 1-1.5 seconds to reach target
        
        // Check if it's time to set a new target
        if (timeSinceLastMove > moveInterval) {
          // Set new random target position
          const padding = 150;
          randomMovementRef.current.targetX = padding + Math.random() * (window.innerWidth - padding * 2);
          randomMovementRef.current.targetY = padding + Math.random() * (window.innerHeight - padding * 2);
          randomMovementRef.current.lastMove = now;
        }
        
        // Smoothly move towards target
        const timeSinceTargetSet = now - randomMovementRef.current.lastMove;
        if (timeSinceTargetSet < moveDuration) {
          const progress = Math.min(1, timeSinceTargetSet / moveDuration);
          // Smooth ease-in-out curve
          const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          // Interpolate between current and target position
          const startX = randomMovementRef.current.x;
          const startY = randomMovementRef.current.y;
          randomMovementRef.current.x = startX + (randomMovementRef.current.targetX - startX) * easeProgress;
          randomMovementRef.current.y = startY + (randomMovementRef.current.targetY - startY) * easeProgress;
          
          setMousePos({ 
            x: randomMovementRef.current.x, 
            y: randomMovementRef.current.y 
          });
        } else {
          // Reached target, stay there (stopped) until next move interval
          randomMovementRef.current.x = randomMovementRef.current.targetX;
          randomMovementRef.current.y = randomMovementRef.current.targetY;
          setMousePos({ 
            x: randomMovementRef.current.x, 
            y: randomMovementRef.current.y 
          });
        }
      }
      
      // Create pulsing zoom effect (gravity lens zooms in and out)
      // Zoom pulses between 1.0 and 1.6 with smooth sine wave
      const currentZoom = 1.0 + Math.sin(timeRef.current * 1.5) * 0.3; // 1.0 to 1.3 zoom range
      setZoom(currentZoom);
      setCurrentTime(timeRef.current);
      
      // Animate blur regions - move them around and change blur levels
      const updatedRegions = blurRegionsRef.current.map((region, index) => {
        // Update position
        let newX = region.x + region.vx;
        let newY = region.y + region.vy;
        let newVx = region.vx;
        let newVy = region.vy;
        
        // Bounce off edges
        if (newX < 0 || newX > window.innerWidth) {
          newVx *= -1;
          newX = Math.max(0, Math.min(window.innerWidth, newX));
        }
        if (newY < 0 || newY > window.innerHeight) {
          newVy *= -1;
          newY = Math.max(0, Math.min(window.innerHeight, newY));
        }
        
        // Animate blur level (changes over time)
        let newBlur = 1 + Math.sin(timeRef.current * 0.8 + index * 0.5) * 4 + Math.cos(timeRef.current * 0.6 + index) * 3;
        newBlur = Math.max(0.5, Math.min(12, newBlur)); // Clamp between 0.5-12px
        
        let newSize = region.size;
        // Occasionally change size
        if (Math.random() < 0.01) {
          newSize = 150 + Math.random() * 400;
        }
        
        // Occasionally reverse direction (creates more chaotic movement)
        if (Math.random() < 0.005) {
          newVx = (Math.random() - 0.5) * 0.8;
          newVy = (Math.random() - 0.5) * 0.8;
        }
        
        return {
          x: newX,
          y: newY,
          size: newSize,
          blur: newBlur,
          vx: newVx,
          vy: newVy,
        };
      });
      
      blurRegionsRef.current = updatedRegions;
      // Update state every few frames for performance
      if (Math.floor(timestamp) % 16 < 8) { // Update roughly every other frame
        setBlurRegions([...updatedRegions]);
      }
      
      // Update and apply water ripples to SVG elements
      const rippleDuration = 2000; // 2 seconds for longer visibility
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const age = now - ripple.startTime;
        if (age > rippleDuration) return false;
        
        // Calculate ripple expansion
        const progress = age / rippleDuration; // 0 to 1
        ripple.radius = progress * 500; // Max radius 500px for larger circles
        ripple.intensity = Math.max(0, 1 - progress * 0.8); // Slower fade for better visibility
        
        return true;
      });

      // Apply gravity lens and water ripple effects to SVG elements
      if (mousePos.x > 0 && mousePos.y > 0) {
        const lensRadius = 250;
        const lensRadiusSquared = lensRadius * lensRadius;
        
        // Find all SVG containers and apply effects
        const svgContainers = document.querySelectorAll('.hyperlinksImageContainer');
        svgContainers.forEach((container) => {
          const rect = container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          let totalDistortionX = 0;
          let totalDistortionY = 0;
          let totalScale = 1;
          
          // Apply gravity lens effect
          const dx = mousePos.x - centerX;
          const dy = mousePos.y - centerY;
          const distanceSquared = dx * dx + dy * dy;
          
          if (distanceSquared < lensRadiusSquared) {
            const distance = Math.sqrt(distanceSquared);
            const normalizedDistance = distance / lensRadius;
            const falloff = 1 - normalizedDistance;
            const localZoom = 1 + (currentZoom - 1) * falloff * 0.8;
            totalScale = localZoom;
          }
          
          // Apply water ripple effects
          ripplesRef.current.forEach((ripple) => {
            const rippleDx = ripple.x - centerX;
            const rippleDy = ripple.y - centerY;
            const rippleDistance = Math.sqrt(rippleDx * rippleDx + rippleDy * rippleDy);
            
            // Check if this point is within the ripple's influence
            const rippleInfluenceRadius = ripple.radius + 150; // Extend influence for continuous effect
            if (rippleDistance < rippleInfluenceRadius && rippleDistance > Math.max(0, ripple.radius - 80)) {
              // Calculate ripple wave effect - multiple wave frequencies for concentric circles
              const wavePhase1 = (rippleDistance - ripple.radius) / 40; // Primary wave
              const wavePhase2 = (rippleDistance - ripple.radius) / 20; // Secondary wave
              const waveAmplitude1 = Math.sin(wavePhase1 * Math.PI * 2) * ripple.intensity;
              const waveAmplitude2 = Math.sin(wavePhase2 * Math.PI * 2) * ripple.intensity * 0.5;
              const waveAmplitude = waveAmplitude1 + waveAmplitude2;
              
              // Create distortion that pushes content outward (like water)
              const angle = Math.atan2(rippleDy, rippleDx);
              const distortionStrength = waveAmplitude * 20 * ripple.intensity; // Increased distortion
              
              totalDistortionX += Math.cos(angle) * distortionStrength;
              totalDistortionY += Math.sin(angle) * distortionStrength;
              
              // Add scale effect from ripple (creates depth)
              const scaleEffect = 1 + waveAmplitude * 0.08 * ripple.intensity;
              totalScale *= scaleEffect;
            }
          });
          
          // Apply combined transform
          if (totalDistortionX !== 0 || totalDistortionY !== 0 || totalScale !== 1) {
            (container as HTMLElement).style.transform = 
              `translate(${totalDistortionX}px, ${totalDistortionY}px) scale(${totalScale})`;
            (container as HTMLElement).style.transformOrigin = 'center center';
            (container as HTMLElement).style.transition = 'transform 0.15s ease-out';
          } else {
            (container as HTMLElement).style.transform = 'translate(0, 0) scale(1)';
            (container as HTMLElement).style.transition = 'transform 0.3s ease-out';
          }
        });
      }
      
      // Clear with slow fade effect (creates smudge trail)
      ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw trails with wave effect
      trailsRef.current = trailsRef.current.filter((trail, index) => {
        const age = (now - trail.time) / 1000; // Age in seconds
        trail.intensity = Math.max(0, 1 - age * 1.5); // Fade over ~0.67 seconds
        
        if (trail.intensity <= 0) return false;

        // Add wave distortion based on time and position
        const waveX = Math.sin(timeRef.current * 2 + trail.x * 0.01) * 5 * trail.intensity;
        const waveY = Math.cos(timeRef.current * 1.5 + trail.y * 0.01) * 5 * trail.intensity;
        
        const x = trail.x + waveX;
        const y = trail.y + waveY;
        
        // Draw smudge effect with prism colors
        const radius = 120 * trail.intensity;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        
        // Ocean-inspired color mixing - blues and teals
        const baseHue = 200 + Math.sin(timeRef.current * 0.5 + index * 0.3) * 30; // 170-230 (blues/teals)
        const hue1 = baseHue;
        const hue2 = baseHue + 20; // Slightly different blue
        const hue3 = baseHue + 40; // Teal variant
        
        gradient.addColorStop(0, `hsla(${hue1}, 70%, 60%, ${0.4 * trail.intensity})`);
        gradient.addColorStop(0.33, `hsla(${hue2}, 70%, 60%, ${0.3 * trail.intensity})`);
        gradient.addColorStop(0.66, `hsla(${hue3}, 70%, 60%, ${0.25 * trail.intensity})`);
        gradient.addColorStop(1, `hsla(${hue1}, 70%, 60%, ${0.05 * trail.intensity})`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Draw water ripples on canvas - always show concentric circles
      ripplesRef.current.forEach((ripple, index) => {
        const age = now - ripple.startTime;
        const progress = age / rippleDuration;
        
        if (progress < 1) {
          // Draw multiple concentric circles for each ripple
          const numRings = 5; // More rings for better visibility
          const ringSpacing = 40; // Spacing between rings
          
          for (let ring = 0; ring < numRings; ring++) {
            const ringRadius = ripple.radius - ring * ringSpacing;
            
            // Only draw if ring is positive radius and visible
            if (ringRadius > 0) {
              // Calculate opacity based on distance from center and time
              const ringProgress = ring / numRings;
              const ringOpacity = (1 - ringProgress) * ripple.intensity * 0.6;
              
              // Alternate between blue and cyan for better visibility
              const hue = 200 + (ring % 2) * 20; // 200 (blue) or 220 (cyan)
              
              ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${ringOpacity})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
              ctx.stroke();
              
              // Add glow effect
              ctx.shadowBlur = 10;
              ctx.shadowColor = `hsla(${hue}, 70%, 60%, ${ringOpacity * 0.5})`;
              ctx.stroke();
              ctx.shadowBlur = 0;
            }
          }
        }
      });

      // Draw current cursor position with stronger wave effect
      if (mousePos.x > 0 && mousePos.y > 0) {
        const waveX = Math.sin(timeRef.current * 3) * 8;
        const waveY = Math.cos(timeRef.current * 2.5) * 8;
        
        const cursorRadius = 150;
        const cursorGradient = ctx.createRadialGradient(
          mousePos.x + waveX,
          mousePos.y + waveY,
          0,
          mousePos.x + waveX,
          mousePos.y + waveY,
          cursorRadius
        );
        
        // Ocean-inspired colors - blues, teals, and cyan
        const baseHue = 200 + Math.sin(timeRef.current * 0.4) * 40; // 160-240 (blues/teals/cyan)
        cursorGradient.addColorStop(0, `hsla(${baseHue}, 80%, 65%, 0.5)`);
        cursorGradient.addColorStop(0.2, `hsla(${baseHue + 15}, 80%, 65%, 0.4)`);
        cursorGradient.addColorStop(0.4, `hsla(${baseHue + 30}, 80%, 65%, 0.35)`);
        cursorGradient.addColorStop(0.6, `hsla(${baseHue + 45}, 80%, 65%, 0.3)`);
        cursorGradient.addColorStop(0.8, `hsla(${baseHue + 60}, 80%, 65%, 0.2)`);
        cursorGradient.addColorStop(1, `hsla(${baseHue + 75}, 80%, 65%, 0.1)`);

        ctx.fillStyle = cursorGradient;
        ctx.beginPath();
        ctx.arc(mousePos.x + waveX, mousePos.y + waveY, cursorRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add additional wave rings
        for (let i = 1; i <= 3; i++) {
          const ringRadius = cursorRadius + i * 30;
          const ringIntensity = 0.2 / i;
          const ringWave = Math.sin(timeRef.current * 2 + i) * 5;
          
          ctx.strokeStyle = `hsla(${baseHue + i * 15}, 70%, 60%, ${ringIntensity})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            mousePos.x + waveX,
            mousePos.y + waveY + ringWave,
            ringRadius,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleClick);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clean up CSS custom properties
      if (bodyRef.current) {
        bodyRef.current.style.removeProperty('--lens-x');
        bodyRef.current.style.removeProperty('--lens-y');
        bodyRef.current.style.removeProperty('--lens-zoom');
        bodyRef.current.style.removeProperty('--lens-radius');
      }
    };
  }, [mousePos]);

  return (
    <>
      {/* Canvas for color smudge effect */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
          mixBlendMode: "multiply",
        }}
      />
      {/* Gravity lens effect - pulsing rings that zoom in and out */}
      {mousePos.x > 0 && mousePos.y > 0 && (
        <>
          {/* Gravity lens rings that pulse */}
          {[0, 1, 2, 3].map((i) => {
            const ringDelay = i * 0.2;
            const ringScale = zoom + i * 0.1;
            const ringRadius = 150 + i * 40;
            const ringOpacity = (0.3 - i * 0.08) * (1 - Math.abs(zoom - 1.0) * 0.5);
            
            return (
              <div
                key={i}
                style={{
                  position: "fixed",
                  left: `${mousePos.x}px`,
                  top: `${mousePos.y}px`,
                  width: `${ringRadius * 2}px`,
                  height: `${ringRadius * 2}px`,
                  marginLeft: `-${ringRadius}px`,
                  marginTop: `-${ringRadius}px`,
                  borderRadius: "50%",
                  border: `2px solid hsla(${200 + Math.sin(currentTime * 0.3 + i) * 40 + i * 10}, 70%, 60%, ${ringOpacity})`,
                  pointerEvents: "none",
                  zIndex: 10001,
                  transform: `scale(${ringScale})`,
                  transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
                  boxShadow: `0 0 ${ringRadius * 0.5}px hsla(${200 + Math.sin(currentTime * 0.3 + i) * 40 + i * 10}, 70%, 60%, ${ringOpacity * 0.5})`,
                }}
              />
            );
          })}
          
          {/* Gravity lens overlay - creates localized zoom effect on underlying content */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 10000,
              clipPath: `circle(${200 * zoom}px at ${mousePos.x}px ${mousePos.y}px)`,
              transform: `scale(${zoom})`,
              transformOrigin: `${mousePos.x}px ${mousePos.y}px`,
              transition: "transform 0.1s ease-out, clip-path 0.1s ease-out",
            }}
          >
            {/* This creates the magnifying effect by scaling content within the clip-path */}
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `scale(${1 / zoom})`,
                transformOrigin: `${mousePos.x}px ${mousePos.y}px`,
                background: "transparent",
              }}
            />
          </div>
        </>
      )}
      {/* Animated blur regions - create inconsistent blur areas */}
      {blurRegions.map((region, index) => (
        <div
          key={index}
          style={{
            position: "fixed",
            left: `${region.x}px`,
            top: `${region.y}px`,
            width: `${region.size}px`,
            height: `${region.size}px`,
            marginLeft: `-${region.size / 2}px`,
            marginTop: `-${region.size / 2}px`,
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 9998,
            backdropFilter: `blur(${region.blur}px)`,
            WebkitBackdropFilter: `blur(${region.blur}px)`,
            transition: "backdrop-filter 0.1s linear",
            mixBlendMode: "normal",
            opacity: 0.6,
          }}
        />
      ))}
      {/* Prism overlay that distorts the view */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9997,
          background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, 
            rgba(50, 150, 255, 0.1) 0%,
            rgba(100, 200, 255, 0.08) 25%,
            rgba(150, 220, 255, 0.06) 50%,
            rgba(200, 240, 255, 0.04) 75%,
            transparent 100%)`,
          mixBlendMode: "overlay",
        }}
      />
    </>
  );
}

