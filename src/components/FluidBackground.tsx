import React from 'react';
import { motion } from 'framer-motion';

const FluidBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 opacity-20 mix-blend-overlay">
      <motion.div
        animate={{
          x: [0, 200, -100, 0],
          y: [0, -200, 100, 0],
          rotate: [0, 90, 180, 0],
          scale: [1, 1.5, 0.8, 1],
        }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[40%] -left-[40%] w-[120%] h-[120%] rounded-full bg-white/10 blur-[180px]"
      />
      <motion.div
        animate={{
          x: [0, -300, 200, 0],
          y: [0, 300, -200, 0],
          rotate: [0, -120, -240, 0],
          scale: [1, 1.8, 0.6, 1],
        }}
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-[50%] -right-[50%] w-[140%] h-[140%] rounded-full bg-white/5 blur-[200px]"
      />
      <motion.div
        animate={{
          scale: [1, 2, 1],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-white/5 blur-[300px]"
      />
    </div>
  );
};

export default FluidBackground;
