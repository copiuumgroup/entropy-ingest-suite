import React from 'react';
import { motion } from 'framer-motion';

const FluidBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 opacity-40 mix-blend-screen">
      <motion.div
        animate={{
          x: [0, 200, -100, 0],
          y: [0, -200, 100, 0],
          rotate: [0, 90, 180, 0],
          scale: [1, 1.8, 0.8, 1],
        }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[40%] -left-[40%] w-[120%] h-[120%] rounded-full bg-white/10 blur-[180px]"
      />
      <motion.div
        animate={{
          x: [0, -300, 200, 0],
          y: [0, 300, -200, 0],
          rotate: [0, -120, -240, 0],
          scale: [1, 2.2, 0.6, 1],
        }}
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-[50%] -right-[50%] w-[140%] h-[140%] rounded-full bg-indigo-500/5 blur-[220px]"
      />
      <motion.div
        animate={{
          scale: [1, 2.5, 1],
          opacity: [0.1, 0.4, 0.1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-white/10 blur-[350px]"
      />
    </div>
  );
};

export default FluidBackground;
