import { useState, useEffect, useRef } from 'react';

/**
 * Hook to monitor CPU usage and performance
 * Uses Performance API to track frame timing and estimate CPU load
 * 
 * @returns {Object} { cpuUsage: number, isHighLoad: boolean, frameTime: number }
 */
export function useCPUMonitor() {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [isHighLoad, setIsHighLoad] = useState(false);
  const [frameTime, setFrameTime] = useState(0);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const frameTimesRef = useRef([]);

  useEffect(() => {
    let animationFrameId;
    let lastCheckTime = performance.now();
    const checkInterval = 1000; // Check every second

    const measureFrame = () => {
      const now = performance.now();
      const frameTime = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Track frame times (keep last 60 frames for 1 second at 60fps)
      frameTimesRef.current.push(frameTime);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate average frame time
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      setFrameTime(avgFrameTime);

      // Estimate CPU usage based on frame time
      // At 60fps, frame time should be ~16.67ms
      // If frame time is higher, CPU is working harder
      const targetFrameTime = 16.67; // 60fps
      const estimatedCPU = Math.min(100, (avgFrameTime / targetFrameTime) * 100);
      setCpuUsage(estimatedCPU);

      // High load threshold: >70% CPU or frame time >30ms
      setIsHighLoad(estimatedCPU > 70 || avgFrameTime > 30);

      // Periodic detailed check
      if (now - lastCheckTime > checkInterval) {
        lastCheckTime = now;
        
        // Log warning if high load detected
        if (estimatedCPU > 70) {
          console.warn(`[CPUMonitor] High CPU usage detected: ${estimatedCPU.toFixed(1)}% (avg frame time: ${avgFrameTime.toFixed(2)}ms)`);
        }
      }

      animationFrameId = requestAnimationFrame(measureFrame);
    };

    animationFrameId = requestAnimationFrame(measureFrame);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return {
    cpuUsage: Math.round(cpuUsage),
    isHighLoad,
    frameTime: Math.round(frameTime * 100) / 100, // Round to 2 decimals
  };
}

