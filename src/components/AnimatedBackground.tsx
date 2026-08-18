import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'square' | 'triangle' | 'line' | 'logo';
}

export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animFrameRef = useRef<number>(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load official logo image asset
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/logo.png';
    logoImgRef.current = logoImg;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create 45 particles — every 3rd particle is a floating rotating logo!
    const count = Math.floor((window.innerWidth * window.innerHeight) / 18000);
    particlesRef.current = Array.from({ length: Math.min(count, 50) }, (_, i) => {
      const isLogo = i % 3 === 0;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: isLogo ? Math.random() * 35 + 28 : Math.random() * 26 + 12,
        speedX: (Math.random() - 0.5) * 0.7,
        speedY: (Math.random() - 0.5) * 0.7,
        opacity: isLogo ? Math.random() * 0.4 + 0.25 : Math.random() * 0.35 + 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.015, // Smooth spinning rotation
        shape: isLogo
          ? ('logo' as const)
          : (['circle', 'square', 'triangle', 'line'] as const)[Math.floor(Math.random() * 4)],
      };
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = theme === 'dark';

      // Logo Cyan/Blue in Dark Mode (#0099FF / #0B99B7), Deep Turquoise in Light Mode
      const baseColor = isDark ? '0, 153, 255' : '31, 182, 168';

      // Update & Draw Particles
      particlesRef.current.forEach((p) => {
        // Interactive Mouse Repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          const force = (160 - dist) / 160;
          p.x += (dx / dist) * force * 2.0;
          p.y += (dy / dist) * force * 2.0;
        }

        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // Wrap around boundaries
        if (p.x < -60) p.x = canvas.width + 60;
        if (p.x > canvas.width + 60) p.x = -60;
        if (p.y < -60) p.y = canvas.height + 60;
        if (p.y > canvas.height + 60) p.y = -60;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'logo') {
          ctx.globalAlpha = p.opacity * (isDark ? 1.2 : 0.9);
          if (logoImgRef.current && logoImgRef.current.complete) {
            ctx.drawImage(logoImgRef.current, -p.size / 2, -p.size / 2, p.size, p.size);
          } else {
            // Draw vibrant logo crest fallback if image is still loading
            ctx.fillStyle = `rgba(${baseColor}, ${p.opacity})`;
            ctx.beginPath();
            ctx.moveTo(0, -p.size / 2);
            ctx.lineTo(p.size / 2, p.size / 2);
            ctx.lineTo(0, p.size / 4);
            ctx.lineTo(-p.size / 2, p.size / 2);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          ctx.globalAlpha = p.opacity;
          const color = `rgba(${baseColor}, ${p.opacity})`;
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;

          switch (p.shape) {
            case 'circle':
              ctx.beginPath();
              ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
              ctx.fill();
              break;
            case 'square':
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
              break;
            case 'triangle':
              ctx.beginPath();
              ctx.moveTo(0, -p.size / 2);
              ctx.lineTo(p.size / 2, p.size / 2);
              ctx.lineTo(-p.size / 2, p.size / 2);
              ctx.closePath();
              ctx.fill();
              break;
            case 'line':
              ctx.beginPath();
              ctx.moveTo(-p.size, 0);
              ctx.lineTo(p.size, 0);
              ctx.stroke();
              break;
          }
        }

        ctx.restore();
      });

      // Draw connecting lines between nearby floating particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx2 = particles[i].x - particles[j].x;
          const dy2 = particles[i].y - particles[j].y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < 200) {
            const opacity = ((200 - dist2) / 200) * 0.22;
            ctx.strokeStyle = `rgba(${baseColor}, ${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 1 }}
    />
  );
};
