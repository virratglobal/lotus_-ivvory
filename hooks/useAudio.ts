"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/**
 * useAudio
 * ────────
 * Global Audio Controller for background jingle audio.
 * Preloads audio gracefully and guarantees instant playback on user click.
 */
export function useAudio(src: string, volume: number = 0.20) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.preload = "auto";

    audioRef.current = audio;

    const handleEnded = () => {
      if (isPlayingRef.current) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src, volume]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingRef.current) {
      audio.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      try {
        if (audio.readyState === 0) {
          audio.load();
        }
        await audio.play();
        isPlayingRef.current = true;
        setIsPlaying(true);
      } catch (err) {
        console.warn("[Ivorry Lotus Audio] Playback failed or blocked by browser:", err);
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    }
  }, []);

  return { isPlaying, toggle } as const;
}
