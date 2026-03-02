/**
 * SplashScreen Component - User gesture wrapper for Web Audio API
 * Displays a beautiful splash screen that requires user click to initialize audio
 */

"use client";

import { Headphones, Mic, Music2, Play, Volume2 } from "lucide-react";
import { useState } from "react";

interface SplashScreenProps {
  onStart: () => void;
}

export function SplashScreen({ onStart }: SplashScreenProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating music notes */}
        <div className="absolute top-1/4 left-1/4 animate-float-slow opacity-20">
          <Music2 className="w-16 h-16 text-purple-400" />
        </div>
        <div className="absolute top-1/3 right-1/4 animate-float-medium opacity-20">
          <Mic className="w-20 h-20 text-blue-400" />
        </div>
        <div className="absolute bottom-1/3 left-1/3 animate-float-fast opacity-20">
          <Headphones className="w-14 h-14 text-pink-400" />
        </div>
        <div className="absolute bottom-1/4 right-1/3 animate-float-slow opacity-20">
          <Volume2 className="w-12 h-12 text-cyan-400" />
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center space-y-8 px-4">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-full">
              <Headphones className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Audio Mixer
          </h1>
          <p className="text-gray-400 text-lg">
            Layer tracks, record audio, and create amazing mixes
          </p>
        </div>

        {/* Start button */}
        <button
          onClick={onStart}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="group relative inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white transition-all duration-300"
        >
          {/* Button background with gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-[2px] bg-gray-900 rounded-full group-hover:bg-gray-800 transition-colors" />

          {/* Button content */}
          <div className="relative flex items-center gap-3">
            <div className={`transition-transform duration-300 ${isHovering ? "scale-110" : ""}`}>
              <Play className="w-6 h-6 fill-current" />
            </div>
            <span>Click to Start</span>
          </div>

          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 blur-lg opacity-0 group-hover:opacity-50 transition-opacity -z-10" />
        </button>

        {/* Hint text */}
        <p className="text-gray-500 text-sm">Audio requires user interaction to play</p>

        {/* Keyboard shortcuts hint */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700/50">
            <span className="text-gray-400 text-sm">Press</span>
            <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 font-mono">?</kbd>
            <span className="text-gray-400 text-sm">for keyboard shortcuts</span>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>
        {`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        :global(.animate-float-slow) {
          animation: float-slow 6s ease-in-out infinite;
        }
        :global(.animate-float-medium) {
          animation: float-medium 4s ease-in-out infinite;
        }
        :global(.animate-float-fast) {
          animation: float-fast 3s ease-in-out infinite;
        }
      `}
      </style>
    </div>
  );
}
