import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ELITE DRUM KIT - Flagship Studio Quality
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Design Spec:
 * - Dark studio aesthetic with deep charcoal/black background
 * - Photorealistic drum shells with wood lacquer finish
 * - Brushed bronze B20 cymbals with concentric lathe grooves
 * - Chrome triple-flanged hoops and professional hardware
 * - Soft ambient occlusion shadows and rim lighting
 * - Drummer's POV perspective (seated behind kit)
 * 
 * Technical:
 * - CSS containment for zero layout shift
 * - Hardware-accelerated transforms only
 * - Touch-optimized hit zones
 * - Velocity-responsive animations
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DRUM KIT LAYOUT DATA - Realistic Positions & Z-Index
// ═══════════════════════════════════════════════════════════════════════════════

const DRUM_LAYOUT = {
  kick: {
    id: 'kick',
    type: 'kick',
    label: 'Kick',
    key: 'b',
    note: 36,
    position: { x: 50, y: 78 },
    size: { w: 180, h: 95 },
    zIndex: 5,
    hitZone: { cx: 50, cy: 78, rx: 12, ry: 8 },
  },
  snare: {
    id: 'snare',
    type: 'snare',
    label: 'Snare',
    key: 'v',
    note: 38,
    position: { x: 35, y: 62 },
    size: { w: 100, h: 55 },
    zIndex: 30,
    hitZone: { cx: 35, cy: 62, rx: 7, ry: 5 },
  },
  hihat: {
    id: 'hihat',
    type: 'cymbal',
    label: 'Hi-Hat',
    key: 'g',
    note: 42,
    position: { x: 18, y: 48 },
    size: { w: 95, h: 28 },
    zIndex: 50,
    hitZone: { cx: 18, cy: 48, rx: 7, ry: 3 },
  },
  openHat: {
    id: 'openHat',
    type: 'cymbal',
    label: 'Open HH',
    key: 'h',
    note: 46,
    position: { x: 18, y: 38 },
    size: { w: 95, h: 28 },
    zIndex: 52,
    hitZone: { cx: 18, cy: 38, rx: 7, ry: 3 },
  },
  tom1: {
    id: 'tom1',
    type: 'tom',
    label: 'Hi Tom',
    key: 'r',
    note: 48,
    position: { x: 42, y: 42 },
    size: { w: 80, h: 50 },
    zIndex: 40,
    hitZone: { cx: 42, cy: 42, rx: 6, ry: 4 },
  },
  tom2: {
    id: 'tom2',
    type: 'tom',
    label: 'Mid Tom',
    key: 't',
    note: 47,
    position: { x: 58, y: 42 },
    size: { w: 88, h: 55 },
    zIndex: 38,
    hitZone: { cx: 58, cy: 42, rx: 6.5, ry: 4.5 },
  },
  tom3: {
    id: 'tom3',
    type: 'floortom',
    label: 'Floor Tom',
    key: 'y',
    note: 45,
    position: { x: 75, y: 62 },
    size: { w: 110, h: 65 },
    zIndex: 25,
    hitZone: { cx: 75, cy: 62, rx: 8, ry: 5.5 },
  },
  crash: {
    id: 'crash',
    type: 'cymbal',
    label: 'Crash',
    key: 'u',
    note: 49,
    position: { x: 26, y: 26 },
    size: { w: 115, h: 32 },
    zIndex: 60,
    hitZone: { cx: 26, cy: 26, rx: 8.5, ry: 3.5 },
  },
  ride: {
    id: 'ride',
    type: 'cymbal',
    label: 'Ride',
    key: 'i',
    note: 51,
    position: { x: 78, y: 32 },
    size: { w: 130, h: 36 },
    zIndex: 55,
    hitZone: { cx: 78, cy: 32, rx: 10, ry: 4 },
  },
  clap: {
    id: 'clap',
    type: 'pad',
    label: 'Clap',
    key: 'c',
    note: 39,
    position: { x: 8, y: 78 },
    size: { w: 55, h: 55 },
    zIndex: 10,
    hitZone: { cx: 8, cy: 78, rx: 4, ry: 4 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DEFINITIONS - Elite Materials & Textures
// ═══════════════════════════════════════════════════════════════════════════════

const EliteSvgDefs = memo(() => (
  <svg 
    width="0" 
    height="0" 
    style={{ position: 'absolute', pointerEvents: 'none' }}
    aria-hidden="true"
  >
    <defs>
      {/* ════════ CYMBAL MATERIALS ════════ */}
      
      {/* B20 Bronze - Main cymbal surface */}
      <radialGradient id="elite-cymbal-bronze" cx="25%" cy="25%" r="85%" fx="20%" fy="20%">
        <stop offset="0%" stopColor="#F7E8C8" />
        <stop offset="12%" stopColor="#E5C878" />
        <stop offset="28%" stopColor="#D4A53A" />
        <stop offset="45%" stopColor="#B8860B" />
        <stop offset="62%" stopColor="#9A7209" />
        <stop offset="78%" stopColor="#7D5A06" />
        <stop offset="100%" stopColor="#5C4004" />
      </radialGradient>
      
      {/* Cymbal bell - polished bronze dome */}
      <radialGradient id="elite-cymbal-bell" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FFF8E7" />
        <stop offset="25%" stopColor="#FFD700" />
        <stop offset="55%" stopColor="#DAA520" />
        <stop offset="100%" stopColor="#B8860B" />
      </radialGradient>
      
      {/* Hi-hat specific - tighter bronze */}
      <radialGradient id="elite-hihat-bronze" cx="30%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#E8D8B0" />
        <stop offset="20%" stopColor="#CCA030" />
        <stop offset="45%" stopColor="#A67C00" />
        <stop offset="70%" stopColor="#7A5800" />
        <stop offset="100%" stopColor="#503800" />
      </radialGradient>
      
      {/* ════════ DRUM SHELL MATERIALS ════════ */}
      
      {/* Premium maple shell - piano black lacquer */}
      <linearGradient id="elite-shell-black" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0A0908" />
        <stop offset="15%" stopColor="#1A1614" />
        <stop offset="35%" stopColor="#0D0B0A" />
        <stop offset="55%" stopColor="#1A1614" />
        <stop offset="75%" stopColor="#0A0908" />
        <stop offset="100%" stopColor="#151210" />
      </linearGradient>
      
      {/* Shell lacquer highlight */}
      <linearGradient id="elite-shell-shine" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
        <stop offset="25%" stopColor="rgba(255,255,255,0.05)" />
        <stop offset="75%" stopColor="rgba(0,0,0,0.1)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
      </linearGradient>
      
      {/* Wood grain pattern */}
      <pattern id="elite-wood-grain" patternUnits="userSpaceOnUse" width="120" height="6" patternTransform="rotate(0)">
        <rect width="120" height="6" fill="transparent"/>
        <path d="M0,1.5 Q30,0.5 60,1.5 T120,1.5" stroke="rgba(80,60,40,0.12)" strokeWidth="0.4" fill="none"/>
        <path d="M0,3.5 Q30,4.5 60,3.5 T120,3.5" stroke="rgba(60,45,30,0.08)" strokeWidth="0.3" fill="none"/>
        <path d="M0,5 Q30,4.2 60,5 T120,5" stroke="rgba(70,50,35,0.06)" strokeWidth="0.2" fill="none"/>
      </pattern>
      
      {/* ════════ DRUM HEAD MATERIALS ════════ */}
      
      {/* Remo coated head - snare */}
      <radialGradient id="elite-head-coated" cx="38%" cy="32%" r="72%">
        <stop offset="0%" stopColor="#FEFEFE" />
        <stop offset="25%" stopColor="#F5F5F5" />
        <stop offset="55%" stopColor="#EBEBEB" />
        <stop offset="85%" stopColor="#DDDDDD" />
        <stop offset="100%" stopColor="#CCCCCC" />
      </radialGradient>
      
      {/* Evans black chrome head - toms */}
      <radialGradient id="elite-head-black" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#2A2A2A" />
        <stop offset="35%" stopColor="#1C1C1C" />
        <stop offset="70%" stopColor="#121212" />
        <stop offset="100%" stopColor="#0A0A0A" />
      </radialGradient>
      
      {/* Kick resonant head */}
      <radialGradient id="elite-head-kick" cx="50%" cy="50%" r="52%">
        <stop offset="0%" stopColor="#0F0F0F" />
        <stop offset="60%" stopColor="#080808" />
        <stop offset="100%" stopColor="#030303" />
      </radialGradient>
      
      {/* ════════ CHROME HARDWARE ════════ */}
      
      {/* Triple-flanged hoop */}
      <linearGradient id="elite-chrome-hoop" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="12%" stopColor="#E8E8E8" />
        <stop offset="28%" stopColor="#A8A8A8" />
        <stop offset="45%" stopColor="#D8D8D8" />
        <stop offset="62%" stopColor="#989898" />
        <stop offset="78%" stopColor="#C0C0C0" />
        <stop offset="100%" stopColor="#808080" />
      </linearGradient>
      
      {/* Chrome lug casing */}
      <linearGradient id="elite-chrome-lug" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F5F5F5" />
        <stop offset="30%" stopColor="#D0D0D0" />
        <stop offset="50%" stopColor="#FAFAFA" />
        <stop offset="70%" stopColor="#B8B8B8" />
        <stop offset="100%" stopColor="#909090" />
      </linearGradient>
      
      {/* Hardware stand pipe */}
      <linearGradient id="elite-chrome-stand" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#A0A0A0" />
        <stop offset="25%" stopColor="#E0E0E0" />
        <stop offset="50%" stopColor="#F8F8F8" />
        <stop offset="75%" stopColor="#D0D0D0" />
        <stop offset="100%" stopColor="#909090" />
      </linearGradient>
      
      {/* ════════ SHADOWS & EFFECTS ════════ */}
      
      {/* Drum piece shadow */}
      <filter id="elite-shadow-drum" x="-50%" y="-30%" width="200%" height="200%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(0,0,0,0.55)" floodOpacity="1"/>
      </filter>
      
      {/* Cymbal shadow - softer, elevated */}
      <filter id="elite-shadow-cymbal" x="-60%" y="-40%" width="220%" height="220%">
        <feDropShadow dx="3" dy="12" stdDeviation="8" floodColor="rgba(0,0,0,0.4)" floodOpacity="1"/>
      </filter>
      
      {/* Hit glow - warm */}
      <filter id="elite-glow-warm" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="1.2 0 0 0 0.3  0 0.9 0 0 0.15  0 0 0.6 0 0  0 0 0 1 0"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      {/* Hit glow - cymbal gold */}
      <filter id="elite-glow-cymbal" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="1.3 0 0 0 0.2  1.1 0 0 0 0.1  0 0 0.4 0 0  0 0 0 1 0"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      {/* Hit glow - snare bright */}
      <filter id="elite-glow-snare" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="1.2 0 0 0 0.1  1.2 0 0 0 0.1  1.2 0 0 0 0.1  0 0 0 1 0"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  </svg>
));

// ═══════════════════════════════════════════════════════════════════════════════
// ELITE CYMBAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EliteCymbal = memo(({ width, height, type, isHit, velocity = 1 }) => {
  const isHihat = type === 'hihat' || type === 'openhat';
  const isRide = type === 'ride';
  const grooveCount = isRide ? 18 : isHihat ? 12 : 15;
  const gradientId = isHihat ? 'elite-hihat-bronze' : 'elite-cymbal-bronze';
  
  return (
    <svg 
      width={width} 
      height={height}
      viewBox="0 0 100 28"
      style={{ 
        overflow: 'visible',
        filter: isHit ? 'url(#elite-glow-cymbal)' : 'url(#elite-shadow-cymbal)',
        transition: 'filter 0.08s ease-out',
      }}
      aria-hidden="true"
    >
      {/* Cymbal body - elliptical shape */}
      <ellipse
        cx="50"
        cy="14"
        rx="48"
        ry="12"
        fill={`url(#${gradientId})`}
        style={{
          filter: isHit ? `brightness(${1.15 + velocity * 0.15})` : 'none',
          transition: 'filter 0.06s ease-out',
        }}
      />
      
      {/* Lathing grooves - concentric rings */}
      {[...Array(grooveCount)].map((_, i) => {
        const progress = (i + 1) / grooveCount;
        const rx = 6 + progress * 40;
        const ry = 1.8 + progress * 9.5;
        const opacity = 0.08 + progress * 0.12;
        return (
          <ellipse
            key={i}
            cx="50"
            cy="14"
            rx={rx}
            ry={ry}
            fill="none"
            stroke={`rgba(92,64,4,${opacity})`}
            strokeWidth="0.35"
          />
        );
      })}
      
      {/* Edge hammering texture */}
      {[...Array(24)].map((_, i) => {
        const angle = (i * 15) * (Math.PI / 180);
        const r = 44;
        const x = 50 + Math.cos(angle) * r;
        const y = 14 + Math.sin(angle) * (r * 0.25);
        return (
          <circle
            key={`h${i}`}
            cx={x}
            cy={y}
            r="0.8"
            fill="rgba(139,115,50,0.15)"
          />
        );
      })}
      
      {/* Bell dome */}
      <ellipse
        cx="50"
        cy="14"
        rx="7"
        ry="3.2"
        fill="url(#elite-cymbal-bell)"
      />
      
      {/* Bell top highlight */}
      <ellipse
        cx="48"
        cy="12.5"
        rx="3.5"
        ry="1.4"
        fill="rgba(255,255,255,0.45)"
      />
      
      {/* Center mounting hole */}
      <circle cx="50" cy="14" r="1.2" fill="#151515" />
      <circle cx="50" cy="14" r="0.8" fill="#0A0A0A" />
      
      {/* Primary specular highlight */}
      <ellipse
        cx="32"
        cy="10"
        rx="16"
        ry="4.5"
        fill="rgba(255,255,255,0.12)"
      />
      
      {/* Secondary rim highlight */}
      <ellipse
        cx="50"
        cy="14"
        rx="47"
        ry="11.5"
        fill="none"
        stroke="rgba(255,248,220,0.25)"
        strokeWidth="0.6"
      />
      
      {/* Hit flash */}
      {isHit && (
        <ellipse
          cx="50"
          cy="14"
          rx="45"
          ry="10.5"
          fill={`rgba(255,220,100,${0.25 * velocity})`}
        />
      )}
    </svg>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ELITE DRUM SHELL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EliteDrumShell = memo(({ width, height, type, isHit, velocity = 1 }) => {
  const isSnare = type === 'snare';
  const isKick = type === 'kick';
  const isFloorTom = type === 'floortom';
  
  const shellDepth = isKick ? 28 : isFloorTom ? 22 : isSnare ? 14 : 16;
  const headGradient = isSnare ? 'elite-head-coated' : isKick ? 'elite-head-kick' : 'elite-head-black';
  const viewHeight = shellDepth + 38;
  
  const glowFilter = isSnare ? 'elite-glow-snare' : 'elite-glow-warm';
  
  return (
    <svg 
      width={width} 
      height={height}
      viewBox={`0 0 100 ${viewHeight}`}
      style={{ 
        overflow: 'visible',
        filter: isHit ? `url(#${glowFilter})` : 'url(#elite-shadow-drum)',
        transition: 'filter 0.06s ease-out',
      }}
      aria-hidden="true"
    >
      {/* Shell bottom edge (visible depth) */}
      <ellipse
        cx="50"
        cy={shellDepth + 24}
        rx="46"
        ry="11"
        fill="url(#elite-shell-black)"
      />
      
      {/* Shell cylinder body */}
      <rect
        x="4"
        y="24"
        width="92"
        height={shellDepth}
        fill="url(#elite-shell-black)"
      />
      
      {/* Wood grain texture overlay */}
      <rect
        x="4"
        y="24"
        width="92"
        height={shellDepth}
        fill="url(#elite-wood-grain)"
        opacity="0.5"
      />
      
      {/* Lacquer shine reflection */}
      <rect
        x="4"
        y="24"
        width="92"
        height={shellDepth}
        fill="url(#elite-shell-shine)"
      />
      
      {/* Shell badge (kick only) */}
      {isKick && (
        <g opacity="0.6">
          <rect
            x="40"
            y="28"
            width="20"
            height={shellDepth - 8}
            rx="2"
            fill="rgba(180,140,80,0.1)"
            stroke="rgba(180,140,80,0.2)"
            strokeWidth="0.4"
          />
        </g>
      )}
      
      {/* Bottom chrome hoop */}
      <ellipse
        cx="50"
        cy={shellDepth + 24}
        rx="48"
        ry="12.5"
        fill="none"
        stroke="url(#elite-chrome-hoop)"
        strokeWidth="3.5"
      />
      
      {/* Drum head */}
      <ellipse
        cx="50"
        cy="24"
        rx="46"
        ry="11"
        fill={`url(#${headGradient})`}
        style={{
          filter: isHit ? `brightness(${1.12 + velocity * 0.12})` : 'none',
          transition: 'filter 0.05s ease-out',
        }}
      />
      
      {/* Head texture - subtle ring */}
      <ellipse
        cx="50"
        cy="24"
        rx="44"
        ry="10"
        fill="none"
        stroke={isSnare ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'}
        strokeWidth="0.5"
      />
      
      {/* Top chrome hoop */}
      <ellipse
        cx="50"
        cy="24"
        rx="48"
        ry="12.5"
        fill="none"
        stroke="url(#elite-chrome-hoop)"
        strokeWidth="3.5"
      />
      
      {/* Hoop top highlight */}
      <ellipse
        cx="50"
        cy="22"
        rx="47"
        ry="11"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.8"
      />
      
      {/* Tension lugs - distributed around */}
      {!isKick && [...Array(8)].map((_, i) => {
        const angle = (i * 45 + 22.5) * (Math.PI / 180);
        const x = 50 + Math.cos(angle) * 43;
        const yBase = 24 + shellDepth / 2;
        return (
          <g key={i}>
            {/* Lug casing */}
            <rect
              x={x - 2.5}
              y={yBase - 5}
              width="5"
              height="10"
              rx="1"
              fill="url(#elite-chrome-lug)"
            />
            {/* Tension rod top */}
            <circle cx={x} cy={yBase - 7} r="1.5" fill="#D0D0D0" />
            <circle cx={x} cy={yBase - 7} r="0.8" fill="#A0A0A0" />
          </g>
        );
      })}
      
      {/* Kick drum specific elements */}
      {isKick && (
        <>
          {/* Port hole */}
          <ellipse
            cx="50"
            cy="24"
            rx="14"
            ry="5.5"
            fill="#050505"
          />
          <ellipse
            cx="50"
            cy="24"
            rx="13"
            ry="5"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="0.8"
          />
          
          {/* Bass drum legs */}
          <rect x="12" y={shellDepth + 30} width="4" height="14" rx="1" fill="url(#elite-chrome-stand)" />
          <rect x="84" y={shellDepth + 30} width="4" height="14" rx="1" fill="url(#elite-chrome-stand)" />
          <ellipse cx="14" cy={shellDepth + 44} rx="4" ry="1.5" fill="#1A1A1A" />
          <ellipse cx="86" cy={shellDepth + 44} rx="4" ry="1.5" fill="#1A1A1A" />
        </>
      )}
      
      {/* Snare wires visible at bottom */}
      {isSnare && (
        <g opacity="0.5">
          {[...Array(16)].map((_, i) => (
            <line
              key={i}
              x1={18 + i * 4}
              y1={shellDepth + 27}
              x2={18 + i * 4}
              y2={shellDepth + 30}
              stroke="#C8C8C8"
              strokeWidth="0.25"
            />
          ))}
          {/* Snare strainer */}
          <rect x="8" y={shellDepth + 18} width="4" height="8" rx="0.5" fill="url(#elite-chrome-lug)" />
        </g>
      )}
      
      {/* Hit flash overlay */}
      {isHit && (
        <ellipse
          cx="50"
          cy="24"
          rx="44"
          ry="10"
          fill={isSnare 
            ? `rgba(255,255,255,${0.35 * velocity})` 
            : `rgba(255,200,120,${0.3 * velocity})`
          }
        />
      )}
    </svg>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ELITE ELECTRONIC PAD
// ═══════════════════════════════════════════════════════════════════════════════

const ElitePad = memo(({ size, isHit, velocity = 1, label }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '14px',
      background: isHit 
        ? `linear-gradient(145deg, #A855F7 0%, #7C3AED 100%)`
        : `linear-gradient(145deg, #581C87 0%, #3B0764 100%)`,
      boxShadow: isHit
        ? `0 0 ${18 + velocity * 12}px rgba(168,85,247,${0.5 + velocity * 0.3}),
           inset 0 1px 0 rgba(255,255,255,0.3),
           inset 0 -1px 0 rgba(0,0,0,0.3)`
        : `0 6px 20px rgba(0,0,0,0.5),
           inset 0 1px 0 rgba(255,255,255,0.1),
           inset 0 -2px 0 rgba(0,0,0,0.3)`,
      transform: isHit ? 'scale(0.95)' : 'scale(1)',
      transition: 'all 0.08s ease-out',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}
    aria-hidden="true"
  >
    {/* Grid texture */}
    <div 
      style={{
        position: 'absolute',
        inset: '8px',
        borderRadius: '8px',
        opacity: 0.2,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '5px 5px',
      }}
    />
    
    {/* Inner glow border */}
    <div 
      style={{
        position: 'absolute',
        inset: '4px',
        borderRadius: '10px',
        border: `1.5px solid ${isHit ? 'rgba(255,255,255,0.5)' : 'rgba(168,85,247,0.25)'}`,
        transition: 'border-color 0.08s',
      }}
    />
    
    {/* Label */}
    <span 
      style={{
        color: isHit ? '#FFF' : 'rgba(255,255,255,0.85)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        zIndex: 1,
      }}
    >
      {label}
    </span>
  </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
// ELITE DRUM PIECE - Main Interactive Component
// ═══════════════════════════════════════════════════════════════════════════════

const EliteDrumPiece = memo(({ config, isHit, onHit, onRelease }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [hitVelocity, setHitVelocity] = useState(0);
  const activeHit = isHit || isPressed;
  
  // Velocity decay
  useEffect(() => {
    if (hitVelocity > 0 && !activeHit) {
      const decay = setTimeout(() => setHitVelocity(0), 120);
      return () => clearTimeout(decay);
    }
  }, [hitVelocity, activeHit]);
  
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const velocity = e.pressure > 0 ? Math.min(127, Math.round(e.pressure * 150)) : 100;
    setIsPressed(true);
    setHitVelocity(velocity / 127);
    onHit(config.note, velocity);
    
    // Haptic
    if (navigator.vibrate) {
      navigator.vibrate(config.type === 'kick' ? 35 : config.type === 'snare' ? 25 : 15);
    }
  }, [config.note, config.type, onHit]);
  
  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    onRelease?.(config.note);
  }, [config.note, onRelease]);
  
  const handlePointerLeave = useCallback(() => {
    if (isPressed) {
      setIsPressed(false);
      onRelease?.(config.note);
    }
  }, [isPressed, config.note, onRelease]);
  
  // Animation based on type
  const getHitAnimation = () => {
    if (!activeHit) return {};
    const v = hitVelocity || 0.8;
    
    switch (config.type) {
      case 'cymbal':
        return {
          rotateX: [0, -15 * v, 10 * v, -5 * v, 2 * v, 0],
          rotateZ: [0, -3 * v, 2 * v, -1 * v, 0],
          y: [0, -4 * v, 2 * v, 0],
        };
      case 'kick':
        return { scale: [1, 0.97, 1.01, 1] };
      case 'snare':
        return { 
          scale: [1, 0.96, 1.02, 0.99, 1],
          y: [0, 2 * v, -1 * v, 0],
        };
      case 'pad':
        return { scale: [1, 0.93, 1.02, 1] };
      default:
        return { 
          scale: [1, 0.97, 1.01, 1],
          y: [0, 1.5 * v, -0.5 * v, 0],
        };
    }
  };
  
  const renderContent = () => {
    const { size, type, label } = config;
    
    if (type === 'cymbal') {
      return <EliteCymbal width={size.w} height={size.h} type={config.id} isHit={activeHit} velocity={hitVelocity} />;
    }
    if (type === 'pad') {
      return <ElitePad size={size.w} isHit={activeHit} velocity={hitVelocity} label={label} />;
    }
    return <EliteDrumShell width={size.w} height={size.h} type={type} isHit={activeHit} velocity={hitVelocity} />;
  };
  
  return (
    <motion.div
      role="button"
      aria-label={`${config.label} drum, press ${config.key.toUpperCase()} key`}
      tabIndex={0}
      className="elite-drum-piece"
      style={{
        position: 'absolute',
        left: `${config.position.x}%`,
        top: `${config.position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: config.zIndex,
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      animate={getHitAnimation()}
      transition={{
        duration: config.type === 'cymbal' ? 0.55 : 0.14,
        ease: [0.22, 0.03, 0.26, 1],
      }}
    >
      {renderContent()}
      
      {/* Minimal label */}
      <div 
        style={{
          position: 'absolute',
          left: '50%',
          bottom: config.type === 'pad' ? '-20px' : '-16px',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.4px',
          color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          pointerEvents: 'none',
        }}
      >
        {config.label}
        <span style={{ 
          marginLeft: '4px',
          fontSize: '8px',
          color: config.type === 'cymbal' ? 'rgba(255,200,80,0.65)' : 'rgba(120,180,255,0.65)',
        }}>
          [{config.key.toUpperCase()}]
        </span>
      </div>
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// HARDWARE STANDS - Visual Realism Layer
// ═══════════════════════════════════════════════════════════════════════════════

const HardwareLayer = memo(() => (
  <svg 
    className="elite-hardware-layer"
    viewBox="0 0 100 100"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      opacity: 0.75,
    }}
    aria-hidden="true"
  >
    {/* Hi-hat stand */}
    <line x1="18" y1="52" x2="18" y2="94" stroke="url(#elite-chrome-stand)" strokeWidth="0.7" />
    <line x1="18" y1="45" x2="18" y2="52" stroke="#888" strokeWidth="0.5" />
    <ellipse cx="18" cy="94" rx="5" ry="1.5" fill="#1A1A1A" />
    
    {/* Crash stand */}
    <line x1="26" y1="32" x2="24" y2="92" stroke="url(#elite-chrome-stand)" strokeWidth="0.55" />
    <ellipse cx="24" cy="92" rx="4" ry="1.2" fill="#1A1A1A" />
    
    {/* Ride stand */}
    <line x1="78" y1="38" x2="80" y2="93" stroke="url(#elite-chrome-stand)" strokeWidth="0.55" />
    <ellipse cx="80" cy="93" rx="4" ry="1.2" fill="#1A1A1A" />
    
    {/* Snare stand tripod */}
    <line x1="33" y1="68" x2="30" y2="93" stroke="url(#elite-chrome-stand)" strokeWidth="0.4" />
    <line x1="37" y1="68" x2="40" y2="93" stroke="url(#elite-chrome-stand)" strokeWidth="0.4" />
    <line x1="35" y1="68" x2="35" y2="93" stroke="url(#elite-chrome-stand)" strokeWidth="0.4" />
    
    {/* Tom mounting arm */}
    <path d="M 48 72 Q 46 58 44 48" stroke="url(#elite-chrome-stand)" strokeWidth="0.6" fill="none" />
    <path d="M 52 72 Q 54 58 56 48" stroke="url(#elite-chrome-stand)" strokeWidth="0.6" fill="none" />
    
    {/* Floor tom legs */}
    <line x1="70" y1="70" x2="67" y2="94" stroke="url(#elite-chrome-stand)" strokeWidth="0.45" />
    <line x1="80" y1="70" x2="83" y2="94" stroke="url(#elite-chrome-stand)" strokeWidth="0.45" />
    <line x1="75" y1="70" x2="75" y2="94" stroke="url(#elite-chrome-stand)" strokeWidth="0.45" />
  </svg>
));

// ═══════════════════════════════════════════════════════════════════════════════
// STUDIO ENVIRONMENT - Premium Background
// ═══════════════════════════════════════════════════════════════════════════════

const StudioEnvironment = memo(() => (
  <div 
    className="elite-studio-env"
    style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      borderRadius: '16px',
    }}
    aria-hidden="true"
  >
    {/* Deep studio black base */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(175deg, 
        #0C0A09 0%, 
        #121010 35%, 
        #161412 65%,
        #0E0C0B 100%)`,
    }} />
    
    {/* Wooden stage floor with perspective */}
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '45%',
      background: `
        repeating-linear-gradient(
          90deg,
          rgba(45,35,28,0.25) 0px,
          rgba(45,35,28,0.25) 1px,
          transparent 1px,
          transparent 45px
        ),
        linear-gradient(180deg, 
          rgba(32,26,22,0.7) 0%, 
          rgba(22,18,14,0.9) 60%,
          rgba(14,11,9,1) 100%)
      `,
      transform: 'perspective(500px) rotateX(52deg)',
      transformOrigin: 'center bottom',
    }} />
    
    {/* Main spotlight - warm top */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(
        ellipse 65% 45% at 50% 10%, 
        rgba(255,235,200,0.06) 0%, 
        transparent 60%
      )`,
    }} />
    
    {/* Fill lights - sides */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `
        radial-gradient(ellipse 25% 40% at 10% 55%, rgba(180,160,220,0.025) 0%, transparent 55%),
        radial-gradient(ellipse 25% 40% at 90% 55%, rgba(220,180,160,0.025) 0%, transparent 55%)
      `,
    }} />
    
    {/* Floor reflection hint */}
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '20%',
      background: `radial-gradient(
        ellipse 80% 100% at 50% 100%,
        rgba(255,220,180,0.02) 0%,
        transparent 70%
      )`,
    }} />
    
    {/* Vignette */}
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius: '16px',
      boxShadow: 'inset 0 0 100px 30px rgba(0,0,0,0.7)',
    }} />
    
    {/* Subtle film grain */}
    <div style={{
      position: 'absolute',
      inset: 0,
      opacity: 0.015,
      mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT - DrumSetView
// ═══════════════════════════════════════════════════════════════════════════════

export default function DrumSetView({ onNoteOn, onNoteOff }) {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [activeNotes, setActiveNotes] = useState(new Set());
  const initializedRef = useRef(false);
  
  // CRITICAL: Prevent layout shift by pre-measuring
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Force synchronous layout calculation
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Touch the computed style to force layout
      void containerRef.current.offsetHeight;
    }
    
    // Use requestAnimationFrame to ensure paint is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    });
  }, []);
  
  const handleHit = useCallback((note, velocity = 100) => {
    onNoteOn?.(note, velocity);
    setActiveNotes(prev => new Set(prev).add(note));
    
    // Visual auto-release
    setTimeout(() => {
      setActiveNotes(prev => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
    }, 100);
  }, [onNoteOn]);
  
  const handleRelease = useCallback((note) => {
    onNoteOff?.(note);
  }, [onNoteOff]);
  
  // Keyboard controls
  useEffect(() => {
    const keyMap = {};
    Object.values(DRUM_LAYOUT).forEach(drum => {
      keyMap[drum.key.toLowerCase()] = drum;
    });
    
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const drum = keyMap[e.key.toLowerCase()];
      if (drum) {
        e.preventDefault();
        handleHit(drum.note, 100);
      }
    };
    
    const handleKeyUp = (e) => {
      const drum = keyMap[e.key.toLowerCase()];
      if (drum) {
        handleRelease(drum.note);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleHit, handleRelease]);
  
  return (
    <div 
      ref={containerRef}
      className="elite-drumset-container"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'hidden',
        // CRITICAL: CSS containment prevents layout shift
        contain: 'strict',
        // Ensure stable dimensions before render
        opacity: isReady ? 1 : 0,
        visibility: isReady ? 'visible' : 'hidden',
        transition: 'opacity 0.12s ease-out',
      }}
    >
      {/* SVG Definitions */}
      <EliteSvgDefs />
      
      {/* Main drum kit */}
      <div 
        className="elite-drumkit"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          aspectRatio: '16 / 10',
          // Prevent any layout calculation changes
          contain: 'layout size style',
        }}
      >
        {/* Studio environment */}
        <StudioEnvironment />
        
        {/* Hardware stands layer */}
        <HardwareLayer />
        
        {/* Drum pieces */}
        {Object.entries(DRUM_LAYOUT).map(([id, config]) => (
          <EliteDrumPiece
            key={id}
            config={config}
            isHit={activeNotes.has(config.note)}
            onHit={handleHit}
            onRelease={handleRelease}
          />
        ))}
        
        {/* Top atmosphere */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '16px',
            background: `linear-gradient(180deg, 
              rgba(0,0,0,0) 0%, 
              rgba(0,0,0,0) 65%,
              rgba(0,0,0,0.2) 100%)`,
          }}
          aria-hidden="true"
        />
      </div>
      
      {/* Instruction bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: isReady ? 1 : 0, y: isReady ? 0 : 12 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        style={{
          marginTop: '20px',
          padding: '10px 24px',
          borderRadius: '100px',
          background: 'linear-gradient(180deg, rgba(22,20,18,0.9) 0%, rgba(14,12,10,0.95) 100%)',
          boxShadow: '0 3px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <p style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.45)',
          fontWeight: 500,
          letterSpacing: '0.3px',
          textAlign: 'center',
          margin: 0,
        }}>
          <span style={{ color: 'rgba(120,180,255,0.8)' }}>Tap</span>
          {' drums or '}
          <span style={{ color: 'rgba(255,200,120,0.8)' }}>press</span>
          {' '}
          <span style={{ opacity: 0.5 }}>B V G H R T Y U I C</span>
        </p>
      </motion.div>
    </div>
  );
}
