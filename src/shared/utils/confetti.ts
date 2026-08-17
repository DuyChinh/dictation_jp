/**
 * High-performance, zero-dependency canvas confetti & fireworks engine
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: "rect" | "circle" | "star";
  alpha: number;
  gravity: number;
  drag: number;
}

const COLORS = [
  "#22c55e", // Emerald
  "#3b82f6", // Royal Blue
  "#eab308", // Golden Yellow
  "#ec4899", // Pink
  "#a855f7", // Violet
  "#06b6d4", // Cyan
  "#f97316", // Amber Orange
  "#ffffff", // White Sparkle
];

export function triggerConfetti(options?: {
  particleCount?: number;
  origin?: { x: number; y: number };
  spread?: number;
}) {
  if (typeof window === "undefined") return;

  const count = options?.particleCount ?? 90;
  const originX = options?.origin?.x ?? window.innerWidth / 2;
  const originY = options?.origin?.y ?? window.innerHeight * 0.4;
  const spread = options?.spread ?? 70;

  // Create or reuse canvas
  let canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "99999";
    document.body.appendChild(canvas);
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const particles: Particle[] = [];
  const shapes: Array<"rect" | "circle" | "star"> = ["rect", "circle", "star"];

  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * spread - spread / 2 - 90) * (Math.PI / 180);
    const speed = Math.random() * 14 + 6;
    particles.push({
      x: originX + (Math.random() - 0.5) * 40,
      y: originY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      shape: shapes[Math.floor(Math.random() * shapes.length)]!,
      alpha: 1,
      gravity: 0.35 + Math.random() * 0.15,
      drag: 0.96,
    });
  }

  let animationFrameId: number;

  function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeCount = 0;

    for (const p of particles) {
      if (p.alpha <= 0.01) continue;
      activeCount++;

      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;
      p.alpha -= 0.009;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Star shape
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = p.size;
        const innerRadius = p.size / 2;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(0, -outerRadius);
        for (let s = 0; s < spikes; s++) {
          let sx = Math.cos(rot) * outerRadius;
          let sy = Math.sin(rot) * outerRadius;
          ctx.lineTo(sx, sy);
          rot += step;

          sx = Math.cos(rot) * innerRadius;
          sy = Math.sin(rot) * innerRadius;
          ctx.lineTo(sx, sy);
          rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    if (activeCount > 0) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrameId);
    }
  }

  render();
}

/** Double celebratory firework bursts */
export function triggerFireworks() {
  triggerConfetti({
    particleCount: 75,
    origin: { x: window.innerWidth * 0.35, y: window.innerHeight * 0.45 },
  });
  setTimeout(() => {
    triggerConfetti({
      particleCount: 85,
      origin: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.4 },
    });
  }, 200);
}
