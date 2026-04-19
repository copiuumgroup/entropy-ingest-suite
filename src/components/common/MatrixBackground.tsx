import React, { useEffect, useRef } from 'react';

interface Star {
  x: number; y: number;
  vx: number; vy: number;
  baseVx: number; baseVy: number;
  r: number; phase: number;
  alpha: number;
  points: number;
}

const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let stars: Star[] = [];
    let currentColor = '#ffffff';
    let width = 0, height = 0;

    const updateThemeColor = () => {
      const style = getComputedStyle(document.documentElement);
      currentColor = style.getPropertyValue('--color-on-surface').trim() || '#ffffff';
    };

    const generateStars = () => {
      stars = [];
      // ~1 star per 15000px² — very sparse, elegant look
      const count = Math.floor((width * height) / 15000);
      for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 0.5;
        const vy = (Math.random() - 0.5) * 0.5;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx, vy,
          baseVx: vx, baseVy: vy,
          r: Math.random() * 3 + 1.2,
          phase: Math.random() * Math.PI * 2,
          alpha: Math.random() * 0.4 + 0.15,
          points: 4
        });
      }
    };

    const drawStarShape = (x: number, y: number, radius: number, points: number, inset: number) => {
      ctx.beginPath();
      ctx.save();
      ctx.translate(x, y);
      ctx.moveTo(0, 0 - radius);
      for (let i = 0; i < points; i++) {
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, 0 - (radius * inset));
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, 0 - radius);
      }
      ctx.fill();
      ctx.restore();
    };

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      generateStars();
      updateThemeColor();
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    // React to theme changes without re-running the whole effect
    const observer = new MutationObserver(() => updateThemeColor());
    observer.observe(document.documentElement, { attributes: true });

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    resize();

    const draw = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = currentColor;

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      for (const star of stars) {
        // Interaction: Disturb stars near mouse
        const dx = star.x - mouseX;
        const dy = star.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 100;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          const angle = Math.atan2(dy, dx);
          const pushX = Math.cos(angle) * force * 1.2;
          const pushY = Math.sin(angle) * force * 1.2;
          
          star.vx += pushX;
          star.vy += pushY;
        }

        // Apply friction to return to base velocity
        star.vx += (star.baseVx - star.vx) * 0.05;
        star.vy += (star.baseVy - star.vy) * 0.05;

        // Drift + wrap
        star.x += star.vx;
        star.y += star.vy;
        
        if (star.x < -10) star.x = width + 10;
        if (star.x > width + 10) star.x = -10;
        if (star.y < -10) star.y = height + 10;
        if (star.y > height + 10) star.y = -10;

        // Twinkle
        const twinkle = Math.sin(time * 2 + star.phase) * 0.15;
        ctx.globalAlpha = Math.max(0.1, star.alpha + twinkle);

        drawStarShape(star.x, star.y, star.r, star.points, 0.25);
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ willChange: 'transform' }}
    />
  );
};

export default MatrixBackground;
