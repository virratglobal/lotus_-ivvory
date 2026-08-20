"use client";

import { useRef, useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useAudio
//
// Manages a SINGLE HTMLAudioElement for the lifetime of the component that
// mounts it. The element is created once on mount and destroyed on unmount.
//
// Guarantees:
//  • Page changes, PDF switches, fullscreen toggles → audio is NEVER restarted
//  • Volume is fixed at creation (not exposed to the user)
//  • Toggle resumes from current position rather than rewinding to 0
//  • Gracefully handles browser autoplay policy (logs warning, stays OFF)
// ─────────────────────────────────────────────────────────────────────────────
export function useAudio(src: string, volume: number = 0.18) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ref mirrors state so the stable `toggle` callback never has stale reads
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Create the audio element exactly once
  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    // Preload metadata only — do not auto-buffer the whole file
    audio.preload = "none";

    audioRef.current = audio;

    // Sync React state if audio stops unexpectedly (e.g. network error)
    const handlePause = () => {
      if (isPlayingRef.current) {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("pause", handlePause);
      audio.pause();
      // Detach src so the browser releases the media resource
      audio.src = "";
      audioRef.current = null;
    };
  }, []); // ← intentionally empty: single lifetime, src/volume are stable

  // Stable toggle — empty dep array, reads via refs
  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingRef.current) {
      // Turn OFF: pause in-place (preserves currentTime for resume)
      audio.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      // Turn ON: resume from current position
      try {
        await audio.play();
        isPlayingRef.current = true;
        setIsPlaying(true);
      } catch (err) {
        // Browser autoplay policy blocked playback — stay OFF gracefully
        console.warn("[Ivory Lotus Audio] Playback blocked by browser:", err);
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    }
  }, []); // ← stable: no deps, uses refs only

  return { isPlaying, toggle } as const;
}
