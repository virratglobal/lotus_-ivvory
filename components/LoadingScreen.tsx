"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface LoadingScreenProps {
  visible: boolean;
  progress: number; // 0–100
}

export default function LoadingScreen({ visible, progress }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-screen"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ivory"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center gap-10"
          >
            {/* Logo mark */}
            <div className="relative w-16 h-16 opacity-80">
              <Image
                src="/ivory-lotus-logo.svg"
                alt="Ivory Lotus"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Brand name */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] tracking-[0.35em] text-charcoal/70 font-light uppercase">
                Ivory Lotus
              </span>
              <span className="text-[9px] tracking-[0.28em] text-charcoal/35 font-light uppercase">
                Luxury Hospitality
              </span>
            </div>

            {/* Progress area */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[8px] tracking-[0.3em] text-charcoal/30 font-light uppercase">
                Presentation Loading
              </span>
              {/* Thin progress bar */}
              <div className="w-36 h-px bg-charcoal/8 relative overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-charcoal/25 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.max(5, progress)}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
