import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'full';
  opacity?: number;
  animate?: boolean;
}

export const StudioGlow: React.FC<Props> = ({ 
  className = "", 
  size = 'md', 
  opacity = 0.15,
  animate = true
}) => {
  const sizeMap = {
    xs: 'w-16 h-16 blur-xl',
    sm: 'w-32 h-32 blur-2xl',
    md: 'w-64 h-64 blur-3xl',
    lg: 'w-96 h-96 blur-[100px]',
    full: 'w-full h-full blur-[120px]'
  };

  return (
    <motion.div
      initial={animate ? { opacity: 0, scale: 0.5 } : { opacity }}
      animate={animate ? { 
        opacity: [opacity * 0.5, opacity, opacity * 0.7, opacity, opacity * 0.5],
        scale: [0.9, 1.1, 0.95, 1.05, 0.9],
      } : {}}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.2, 0.5, 0.8, 1]
      }}
      className={`pointer-events-none absolute rounded-full bg-[var(--color-primary)] ${sizeMap[size]} ${className}`}
      style={{ 
        opacity,
        filter: `blur(${size === 'xs' ? '20px' : size === 'sm' ? '40px' : size === 'md' ? '80px' : '150px'})`
      }}
    />
  );
};
