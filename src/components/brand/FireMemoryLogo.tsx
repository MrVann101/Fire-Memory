import type { SVGProps } from "react";

/**
 * Vector emblem for the Fire Memory dashboard sidebar.
 */
export function FireMemoryLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width="100%"
      height="100%"
      {...props}
    >
      <defs>
        {/* Flame / Energy Gradients */}
        <linearGradient id="iconFireGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF3B30" />
          <stop offset="45%" stopColor="#FF6B00" />
          <stop offset="80%" stopColor="#FFA800" />
          <stop offset="100%" stopColor="#FFD600" />
        </linearGradient>

        <linearGradient id="iconFlameCoreGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#FF1E56" />
          <stop offset="60%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#FFF275" />
        </linearGradient>

        {/* Memory Circuit Gradient */}
        <linearGradient id="iconCircuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA800" />
          <stop offset="50%" stopColor="#FF3366" />
          <stop offset="100%" stopColor="#7928CA" />
        </linearGradient>

        {/* App Icon / Canvas Background */}
        <linearGradient id="iconBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14141E" />
          <stop offset="100%" stopColor="#08080C" />
        </linearGradient>

        {/* Border Glow Gradient */}
        <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#7928CA" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>

        {/* Soft Glow Filter */}
        <filter id="iconSubtleGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id="iconAtmosphereGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" result="blur" />
        </filter>
      </defs>

      {/* Squircle / App Icon Container */}
      <rect
        x="8"
        y="8"
        width="240"
        height="240"
        rx="56"
        fill="url(#iconBgGrad)"
        stroke="url(#borderGrad)"
        strokeWidth="1.5"
      />

      {/* Radial Fiery Atmosphere behind the flame */}
      <circle
        cx="128"
        cy="138"
        r="65"
        fill="#FF4500"
        opacity="0.2"
        filter="url(#iconAtmosphereGlow)"
      />
      <circle
        cx="128"
        cy="145"
        r="35"
        fill="#7928CA"
        opacity="0.25"
        filter="url(#iconAtmosphereGlow)"
      />

      {/* EMBLEM GROUP (Centered in the 256x256 frame) */}
      <g transform="translate(33, 28)">
        {/* Circuit grid & Memory traces in flame background */}
        <g
          stroke="url(#iconCircuitGrad)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        >
          <path d="M 60 152 L 60 125 L 75 110 L 75 80" fill="none" />
          <path d="M 130 160 L 130 132 L 115 118 L 115 70" fill="none" />
          <path d="M 95 172 L 95 140" fill="none" />
          <path d="M 45 112 L 60 125" fill="none" />
          <path d="M 145 122 L 130 132" fill="none" />

          {/* Nodes / Memory Chips */}
          <circle cx="75" cy="80" r="3.5" fill="#FFA800" />
          <circle cx="115" cy="70" r="3.5" fill="#FF3366" />
          <circle cx="45" cy="112" r="3" fill="#FFA800" />
          <circle cx="145" cy="122" r="3" fill="#7928CA" />
          <circle cx="60" cy="152" r="3" fill="#FF4500" />
          <circle cx="130" cy="160" r="3" fill="#7928CA" />
        </g>

        {/* Outer Dynamic Flame Wing */}
        <path
          d="M 95 190 C 42 180 20 138 28 96 C 32 75 45 54 58 40 C 56 57 65 69 75 74 C 71 53 79 27 102 8 C 104 25 115 39 111 58 C 121 46 134 38 142 21 C 155 44 168 80 158 120 C 150 158 126 187 95 190 Z"
          fill="url(#iconFireGrad)"
          filter="url(#iconSubtleGlow)"
        />

        {/* Inner Core Flame */}
        <path
          d="M 95 180 C 63 172 50 143 56 114 C 60 95 73 85 81 87 C 78 97 83 106 92 107 C 90 85 100 68 111 51 C 115 66 123 76 121 91 C 129 93 135 107 133 125 C 129 156 112 177 95 180 Z"
          fill="url(#iconFlameCoreGrad)"
        />

        {/* Central Memory Chip in the Heart of Flame */}
        <g transform="translate(95, 138)">
          {/* Microchip Base */}
          <rect
            x="-15"
            y="-15"
            width="30"
            height="30"
            rx="7"
            fill="#12121C"
            stroke="#FFD600"
            strokeWidth="2.2"
          />

          {/* Microchip Pins */}
          <line x1="-10" y1="-19" x2="-10" y2="-15" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="-19" x2="0" y2="-15" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="-19" x2="10" y2="-15" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />

          <line x1="-10" y1="15" x2="-10" y2="19" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="15" x2="0" y2="19" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="15" x2="10" y2="19" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />

          <line x1="-19" y1="-10" x2="-15" y2="-10" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="-19" y1="0" x2="-15" y2="0" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="-19" y1="10" x2="-15" y2="10" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />

          <line x1="15" y1="-10" x2="19" y2="-10" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="0" x2="19" y2="0" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="10" x2="19" y2="10" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" />

          {/* Chip Core Glow Spark */}
          <circle cx="0" cy="0" r="5" fill="#FFF275" filter="url(#iconSubtleGlow)" />
        </g>
      </g>
    </svg>
  );
}
