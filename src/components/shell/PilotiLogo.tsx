import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Symbolic Piloti icon:
 * A modernist stilt-house (lucide-style home) with 3 small square pilotis (stilts) underneath.
 */
export function PilotiSymbolicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden="true"
    >
      {/* Roof */}
      <path d="M3 10.5L12 3l9 7.5" />
      {/* Elevated House Body */}
      <path d="M5 10v6h14v-6" />
      {/* 3 small squares (pilotis/stilts) underneath */}
      <rect x="5.5" y="18.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="10.75" y="18.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="16" y="18.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Full-color brand illustration for About dialogs and splash views.
 */
export function PilotiBrandIllustration({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      className={cn("size-12 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="64"
          y1="12"
          x2="64"
          y2="116"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2c4466" />
          <stop offset="62%" stopColor="#1c273b" />
          <stop offset="100%" stopColor="#152c3f" />
        </linearGradient>
        <linearGradient
          id={`${id}-water`}
          x1="64"
          y1="88"
          x2="64"
          y2="116"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2190a4" />
          <stop offset="100%" stopColor="#185d75" />
        </linearGradient>
        <linearGradient id={`${id}-stilt`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9a9996" />
          <stop offset="40%" stopColor="#f6f5f4" />
          <stop offset="100%" stopColor="#77767b" />
        </linearGradient>
        <linearGradient
          id={`${id}-wall`}
          x1="64"
          y1="36"
          x2="64"
          y2="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#deddda" />
        </linearGradient>
        <linearGradient
          id={`${id}-roof`}
          x1="64"
          y1="18"
          x2="64"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ff8e3c" />
          <stop offset="100%" stopColor="#e66100" />
        </linearGradient>
        <linearGradient
          id={`${id}-screen`}
          x1="34"
          y1="42"
          x2="94"
          y2="76"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#1c71d8" />
          <stop offset="55%" stopColor="#3584e4" />
          <stop offset="100%" stopColor="#613583" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="12" y="12" width="104" height="104" rx="24" />
        </clipPath>
      </defs>

      <rect x="12" y="15" width="104" height="104" rx="24" fill="#0f141d" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="12" y="12" width="104" height="104" rx="24" fill={`url(#${id}-bg)`} />
        <circle cx="34" cy="30" r="18" fill="#62a0ea" fillOpacity="0.16" />
        <circle cx="32" cy="28" r="5" fill="#99c1f1" fillOpacity="0.45" />

        <rect x="12" y="90" width="104" height="26" fill={`url(#${id}-water)`} />
        <rect x="12" y="90" width="104" height="2" fill="#62d2e3" fillOpacity="0.45" />
        <ellipse cx="38" cy="100" rx="8" ry="2.2" fill="#99e5f0" fillOpacity="0.35" />
        <ellipse cx="64" cy="102" rx="7" ry="2" fill="#99e5f0" fillOpacity="0.3" />
        <ellipse cx="90" cy="100" rx="8" ry="2.2" fill="#99e5f0" fillOpacity="0.35" />

        <rect x="34" y="79" width="8" height="21" rx="2" fill={`url(#${id}-stilt)`} />
        <rect x="61" y="79" width="6" height="23" rx="2" fill="#77767b" />
        <rect x="86" y="79" width="8" height="21" rx="2" fill={`url(#${id}-stilt)`} />
        <rect x="36" y="88" width="56" height="3.5" rx="1.5" fill="#9a9996" fillOpacity="0.85" />

        <rect x="24" y="76" width="80" height="6" rx="3" fill="#9a9996" />
        <rect x="24" y="74" width="80" height="5" rx="2.5" fill="#f6f5f4" />

        <rect x="28" y="38" width="72" height="38" rx="6" fill={`url(#${id}-wall)`} />
        <rect x="33" y="42" width="62" height="30" rx="4.5" fill={`url(#${id}-screen)`} />

        <rect x="33" y="42" width="62" height="5" rx="2" fill="#1e1e24" fillOpacity="0.65" />
        <circle cx="37" cy="44.5" r="1.1" fill="#62a0ea" />
        <rect x="84" y="43.6" width="7" height="1.8" rx="0.9" fill="#ffffff" fillOpacity="0.75" />

        <rect x="37" y="49.5" width="31" height="16" rx="3" fill="#242429" fillOpacity="0.96" />
        <rect x="37" y="49.5" width="9" height="16" rx="2" fill="#323238" />
        <circle cx="65" cy="52" r="1.2" fill="#ffffff" fillOpacity="0.55" />
        <rect x="49" y="54" width="15" height="2.4" rx="1.2" fill="#3584e4" />
        <rect x="49" y="58.5" width="12" height="2.2" rx="1.1" fill="#ffffff" fillOpacity="0.35" />

        <rect x="64" y="53" width="27" height="14" rx="3" fill="#f6f5f4" />
        <rect x="67" y="56.5" width="14" height="2.2" rx="1.1" fill="#3d3846" fillOpacity="0.75" />
        <rect x="67" y="60.5" width="18" height="2.2" rx="1.1" fill="#9a9996" fillOpacity="0.6" />
        <circle cx="87.5" cy="55.5" r="1.1" fill="#77767b" />

        <rect x="50" y="67.5" width="28" height="3.2" rx="1.6" fill="#1e1e24" fillOpacity="0.75" />
        <circle cx="55.5" cy="69.1" r="1" fill="#62a0ea" />
        <circle cx="61" cy="69.1" r="1" fill="#ff7800" />
        <circle cx="66.5" cy="69.1" r="1" fill="#57e389" />
        <circle cx="72" cy="69.1" r="1" fill="#ffffff" />

        <path d="M19 42L64 20L109 42L106 46L64 25L22 46L19 42Z" fill="#c64600" />
        <path d="M18 40L64 17L110 40L106 43.5L64 22.5L22 43.5L18 40Z" fill={`url(#${id}-roof)`} />
        <path
          d="M19 39.5L64 17.2L109 39.5"
          stroke="#ffbe6f"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <rect x="12.5" y="12.5" width="103" height="103" rx="23.5" stroke="#ffffff" strokeOpacity="0.14" />
    </svg>
  );
}

export { PilotiSymbolicIcon as PilotiLogo };
