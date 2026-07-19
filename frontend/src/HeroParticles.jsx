import { useEffect, useRef } from 'react';

export default function HeroParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Sparse floating orbs
    const orbs = Array.from({ length: 18 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      r:   Math.random() * 2 + 0.8,
      vx:  (Math.random() - 0.5) * 0.25,
      vy:  (Math.random() - 0.5) * 0.25,
      a:   Math.random() * 0.5 + 0.2,
      hue: Math.random() > 0.5 ? 238 : 263,  // indigo / violet
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      orbs.forEach(o => {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < 0 || o.x > canvas.width)  o.vx *= -1;
        if (o.y < 0 || o.y > canvas.height) o.vy *= -1;

        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${o.hue}, 80%, 65%, ${o.a})`;
        ctx.fill();
      });

      // Subtle connection lines between close orbs
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const dx = orbs[i].x - orbs[j].x;
          const dy = orbs[i].y - orbs[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.moveTo(orbs[i].x, orbs[i].y);
            ctx.lineTo(orbs[j].x, orbs[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - d / 140)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
