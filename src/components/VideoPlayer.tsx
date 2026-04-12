import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  src: string;
  currentTime: number;
  isPlaying: boolean;
  muted?: boolean;
}

const VideoPlayer: React.FC<Props> = ({ src, currentTime, isPlaying, muted = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Frame-lock synchronization
  useEffect(() => {
    if (videoRef.current) {
      const diff = Math.abs(videoRef.current.currentTime - currentTime);
      // Only seek if de-sync exceeds threshold for performance
      if (diff > 0.15) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  // Playback state synchronization
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full aspect-video bg-black rounded-[32px] overflow-hidden shadow-2xl border border-white/5"
    >
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
      />
      
      {/* MONOCHROME OVERLAYS */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40" />
      <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-[32px]" />
    </motion.div>
  );
};

export default VideoPlayer;
