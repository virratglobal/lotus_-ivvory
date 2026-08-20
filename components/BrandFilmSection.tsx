"use client";

import React, { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

export default function BrandFilmSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <section
      id="stitch-section-final-video"
      className="w-full relative bg-[#0d1e1a] text-surface-bright py-16 md:py-24 border-t border-outline-variant/20 overflow-hidden"
    >
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex flex-col items-center">
        {/* Header Label */}
        <div className="text-center mb-8 max-w-2xl">
          <p className="font-label-lg text-label-lg text-sage uppercase tracking-[0.3em] mb-3">
            FINAL CHAPTER — BRAND FILM
          </p>
          <h2 className="font-display-md text-headline-lg-mobile md:text-display-md text-gold italic font-light tracking-wide">
            The Ivory Lotus Vision in Motion.
          </h2>
        </div>

        {/* Video Container */}
        <div className="relative w-full aspect-[16/9] max-h-[85vh] bg-[#0d1e1a] rounded-xl overflow-hidden shadow-2xl border border-outline-variant/20 group flex items-center justify-center">
          <video
            ref={videoRef}
            src="/video/brand-film.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain object-center bg-[#0d1e1a]"
          />

          {/* Vignette Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

          {/* Minimal Controls Bar */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="w-10 h-10 rounded-full bg-ivory/90 hover:bg-white text-charcoal flex items-center justify-center backdrop-blur-md transition-all duration-300 shadow-md focus-visible:outline-none"
              >
                {isPlaying ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} className="ml-0.5" fill="currentColor" />
                )}
              </button>

              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                className="w-10 h-10 rounded-full bg-ivory/20 hover:bg-ivory/30 text-white flex items-center justify-center backdrop-blur-md transition-all duration-300 border border-white/20 focus-visible:outline-none"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>

            <span className="font-label-sm text-label-sm text-ivory/70 uppercase tracking-[0.25em]">
              Ivory Lotus Cinematic Film
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
