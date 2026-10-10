import React, { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  depth: number; // 0.6 (distant background) to 1.4 (foreground)
  label?: string;
  type?: 'invariant' | 'breaking' | 'warning' | 'data';
  pulse: number;
  alpha: number;
  // Computed projected screen coordinates
  projX: number;
  projY: number;
}

interface ContractPath {
  fromIndex: number;
  toIndex: number;
  packetProgress: number;
  speed: number;
  status: 'stable' | 'breaking' | 'warning';
  active: boolean;
}

interface JsonFragment {
  x: number;
  y: number;
  depth: number;
  text: string;
  alpha: number;
  targetAlpha: number;
  life: number;
  maxLife: number;
}

const FRAGMENT_POOL = [
  '{ "order_id": "ord_4921" }',
  '/customer/email :: dropped',
  '/total_cents → /total/amount',
  'type ItemPrice = number → object',
  'cardinality: 1..N [invariant]',
  'RFC 7386: merge-patch delta',
  'AST node: StringLiteral',
  '{ "status": "confirmed" }',
  '/shipping/tracking → /tracking_number',
  'nullability: false → true (warning)',
  'exit: 1 (contract broken)'
];

export const DriftBackgroundSystem: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });
  const scrollRef = useRef<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    // Pause the loop while the page is hidden or the canvas is scrolled far off-screen.
    let canvasOnScreen = true;
    let running = false;

    const startLoop = () => {
      if (running || prefersReducedMotion) return;
      running = true;
      animationFrameId = requestAnimationFrame(render);
    };

    const stopLoop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(animationFrameId);
    };

    const evaluateLoopState = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden || !canvasOnScreen) stopLoop();
      else startLoop();
    };

    const handleVisibilityChange = () => { evaluateLoopState(); };

    const handleScrollPaused = () => {
      const rect = canvas.getBoundingClientRect();
      canvasOnScreen = rect.bottom > 0 && rect.top < window.innerHeight;
      evaluateLoopState();
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initTopology();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleScroll = () => {
      scrollRef.current = window.scrollY;
      handleScrollPaused();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // State collections
    let nodes: Point[] = [];
    let paths: ContractPath[] = [];
    let fragments: JsonFragment[] = [];
    let timer = 0;
    let smoothScrollY = 0;
    let smoothScrollNorm = 0;

    const initTopology = () => {
      nodes = [];
      paths = [];
      fragments = [];

      // Create structured network nodes representing an AST contract topology
      const cols = Math.max(4, Math.floor(width / 320));
      const rows = Math.max(5, Math.floor(height / 220));

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jitterX = (Math.random() - 0.5) * 80;
          const jitterY = (Math.random() - 0.5) * 60;
          const x = (c + 0.5) * (width / cols) + jitterX;
          const y = (r + 0.5) * (height / rows) + jitterY;

          let type: Point['type'] = 'data';
          let label = undefined;

          // Parallax depth distribution (0.6 to 1.35)
          const depth = 0.65 + ((r * cols + c) % 5) * 0.17;

          // Special nodes in contract topology
          if ((r === 1 && c === 1) || (r === 2 && c === 2)) {
            type = 'breaking';
            label = r === 1 ? '/total_cents' : '/customer/email';
          } else if (r === 3 && c === 1) {
            type = 'warning';
            label = '/shipping/tracking';
          } else if (r === 0 && c === 2) {
            type = 'invariant';
            label = '/order/id';
          }

          nodes.push({
            x,
            y,
            vx: 0,
            vy: 0,
            baseX: x,
            baseY: y,
            depth,
            label,
            type,
            pulse: 0,
            alpha: 0.11 + Math.random() * 0.14,
            projX: x,
            projY: y
          });
        }
      }

      // Connect nodes into topological contract trees
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].baseX - nodes[j].baseX;
          const dy = nodes[i].baseY - nodes[j].baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Connect nearest structural neighbours within sensible spatial range
          if (dist < (width / cols) * 1.35) {
            let status: ContractPath['status'] = 'stable';
            if (nodes[i].type === 'breaking' || nodes[j].type === 'breaking') {
              status = 'breaking';
            } else if (nodes[i].type === 'warning' || nodes[j].type === 'warning') {
              status = 'warning';
            }

            paths.push({
              fromIndex: i,
              toIndex: j,
              packetProgress: Math.random(),
              speed: 0.0015 + Math.random() * 0.003,
              status,
              active: true
            });
          }
        }
      }

      // Initialize faint JSON data fragments with parallax depth
      for (let k = 0; k < 6; k++) {
        spawnFragment();
      }
    };

    const spawnFragment = () => {
      if (fragments.length >= 8) return;
      const text = FRAGMENT_POOL[Math.floor(Math.random() * FRAGMENT_POOL.length)];
      fragments.push({
        x: Math.random() * (width - 240) + 40,
        y: Math.random() * (height - 120) + 60,
        depth: 0.7 + Math.random() * 0.6,
        text,
        alpha: 0,
        targetAlpha: 0.035 + Math.random() * 0.045, // very faint (3.5% - 8%)
        life: 0,
        maxLife: 300 + Math.random() * 400
      });
    };

    initTopology();

    // Render loop
    const render = () => {
      timer++;

      ctx.clearRect(0, 0, width, height);

      const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      const targetScrollNorm = Math.min(1, Math.max(0, scrollRef.current / maxScroll));

      // Smooth lerping for scroll & zoom transitions
      smoothScrollY += (scrollRef.current - smoothScrollY) * 0.06;
      smoothScrollNorm += (targetScrollNorm - smoothScrollNorm) * 0.06;

      // Scroll-linked zoom factor (Subtle 1.0 -> 1.14x scaling)
      const baseZoom = prefersReducedMotion ? 1.0 : 1.0 + smoothScrollNorm * 0.14;
      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // Atmospheric background glow translation
      if (glowRef.current && !prefersReducedMotion) {
        const glowOffsetY = smoothScrollNorm * 180;
        const glowScale = 1.0 + smoothScrollNorm * 0.18;
        glowRef.current.style.transform = `translate(-50%, calc(-50% + ${glowOffsetY}px)) scale(${glowScale})`;
      }

      const mouse = mouseRef.current;

      // 1. UPDATE AND DRAW JSON TELEMETRY FRAGMENTS WITH PARALLAX DEPTH
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let f = fragments.length - 1; f >= 0; f--) {
        const frag = fragments[f];
        frag.life++;

        if (frag.life < 80) {
          frag.alpha += (frag.targetAlpha - frag.alpha) * 0.05;
        } else if (frag.life > frag.maxLife - 80) {
          frag.alpha += (0 - frag.alpha) * 0.05;
        }

        if (frag.life >= frag.maxLife) {
          fragments.splice(f, 1);
          if (Math.random() < 0.4) spawnFragment();
          continue;
        }

        // Parallax offset for data fragments
        const fragParallaxY = prefersReducedMotion ? 0 : (smoothScrollY * 0.05) * (frag.depth - 1.0);
        const fragProjY = frag.y + fragParallaxY;

        ctx.fillStyle = `rgba(137, 147, 165, ${frag.alpha})`;
        ctx.fillText(frag.text, frag.x, fragProjY);
      }

      if (fragments.length < 5 && Math.random() < 0.015) {
        spawnFragment();
      }

      // 2. UPDATE NODES WITH SUBTLE MOUSE DEFLECTION & SCROLL-LINKED ZOOM / PARALLAX
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Mouse reaction
        if (mouse.active) {
          const dx = mouse.x - node.projX;
          const dy = mouse.y - node.projY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140;

          if (dist < maxDist && dist > 0) {
            const force = (maxDist - dist) / maxDist;
            const pushX = (dx / dist) * force * 14;
            const pushY = (dy / dist) * force * 14;
            node.vx += (-pushX - node.vx) * 0.08;
            node.vy += (-pushY - node.vy) * 0.08;
          } else {
            node.vx += (0 - node.vx) * 0.06;
            node.vy += (0 - node.vy) * 0.06;
          }
        } else {
          node.vx += (0 - node.vx) * 0.06;
          node.vy += (0 - node.vy) * 0.06;
        }

        // Extremely slow natural drifting breathing motion
        const driftAngle = timer * 0.005 + i;
        const subtleDriftX = Math.cos(driftAngle) * 2.8;
        const subtleDriftY = Math.sin(driftAngle) * 2.2;

        node.x = node.baseX + node.vx + subtleDriftX;
        node.y = node.baseY + node.vy + subtleDriftY;

        // SCROLL-LINKED ZOOM & MULTI-LAYER PARALLAX CALCULATION
        if (prefersReducedMotion) {
          node.projX = node.x;
          node.projY = node.y;
        } else {
          // Perspective scale based on depth plane and scroll-linked zoom
          const nodeZoom = baseZoom * (0.92 + node.depth * 0.12);
          // Vertical parallax displacement: foreground nodes shift faster than background
          const parallaxOffset = (smoothScrollY * 0.09) * (node.depth - 0.95);

          node.projX = centerX + (node.x - centerX) * nodeZoom;
          node.projY = centerY + (node.y - centerY) * nodeZoom - parallaxOffset;
        }

        // Decay pulse
        if (node.pulse > 0) {
          node.pulse = Math.max(0, node.pulse - 0.02);
        }
      }

      // 3. DRAW CONNECTING CONTRACT PATHS & MOVING PACKETS (Using Projected Coordinates)
      for (let p = 0; p < paths.length; p++) {
        const path = paths[p];
        const n1 = nodes[path.fromIndex];
        const n2 = nodes[path.toIndex];

        // Periodic cycle: BREAKING paths fade/break, WARNING paths re-route
        const cycle = (timer * 0.001 + p * 0.3) % 1;
        let pathAlpha = 0.05; // baseline faint opacity

        if (path.status === 'breaking') {
          // Path periodically breaks and node pulses red
          if (cycle > 0.65 && cycle < 0.85) {
            pathAlpha = 0.015; // faint broken state
            n1.pulse = Math.max(n1.pulse, 0.4);
          } else {
            pathAlpha = 0.065;
          }
        } else if (path.status === 'warning') {
          if (cycle > 0.4 && cycle < 0.6) {
            n2.pulse = Math.max(n2.pulse, 0.3);
            pathAlpha = 0.06;
          }
        }

        // Draw thin connecting path between projected coordinates
        ctx.beginPath();
        ctx.moveTo(n1.projX, n1.projY);
        ctx.lineTo(n2.projX, n2.projY);

        if (path.status === 'breaking' && n1.pulse > 0.1) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.05 + n1.pulse * 0.08})`;
        } else if (path.status === 'warning' && n2.pulse > 0.1) {
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.05 + n2.pulse * 0.08})`;
        } else {
          ctx.strokeStyle = `rgba(59, 130, 246, ${pathAlpha})`;
        }
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // Animate tiny packet of data traveling along path
        if (!prefersReducedMotion) {
          path.packetProgress += path.speed;
          if (path.packetProgress >= 1) {
            path.packetProgress = 0;
            n2.pulse = Math.max(n2.pulse, 0.35); // Illuminates on arrival
          }

          const packetX = n1.projX + (n2.projX - n1.projX) * path.packetProgress;
          const packetY = n1.projY + (n2.projY - n1.projY) * path.packetProgress;

          ctx.beginPath();
          ctx.arc(packetX, packetY, 1.2 * n1.depth, 0, Math.PI * 2);

          if (path.status === 'breaking') {
            ctx.fillStyle = `rgba(239, 68, 68, 0.35)`;
          } else if (path.status === 'warning') {
            ctx.fillStyle = `rgba(245, 158, 11, 0.35)`;
          } else {
            ctx.fillStyle = `rgba(59, 130, 246, 0.45)`;
          }
          ctx.fill();
        }
      }

      // 4. DRAW NODES (Using Projected Coordinates & Depth Scaling)
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const baseRadius = node.type && node.type !== 'data' ? 2.5 : 1.5;
        const radius = baseRadius * (prefersReducedMotion ? 1.0 : 0.85 + node.depth * 0.2);

        ctx.beginPath();
        ctx.arc(node.projX, node.projY, radius, 0, Math.PI * 2);

        if (node.type === 'breaking') {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + node.pulse * 0.4})`;
        } else if (node.type === 'warning') {
          ctx.fillStyle = `rgba(245, 158, 11, ${0.25 + node.pulse * 0.4})`;
        } else if (node.type === 'invariant') {
          ctx.fillStyle = `rgba(16, 185, 129, ${0.25 + node.pulse * 0.35})`;
        } else {
          ctx.fillStyle = `rgba(137, 147, 165, ${node.alpha + node.pulse * 0.25})`;
        }
        ctx.fill();

        // Faint node label if present (e.g. /customer/email)
        if (node.label && (node.pulse > 0.05 || mouse.active)) {
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(137, 147, 165, ${0.15 + node.pulse * 0.25})`;
          ctx.fillText(node.label, node.projX + 6, node.projY + 3);
        }
      }

      if (running) animationFrameId = requestAnimationFrame(render);
    };

    // Everything above is now defined; attach the remaining listeners and kick off.
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleScrollPaused();
    startLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopLoop();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Dynamic atmospheric radial illumination that softly tracks scroll parallax */}
      <div
        ref={glowRef}
        className="absolute w-[800px] h-[600px] rounded-full blur-[180px] opacity-40 transition-transform duration-300 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(30, 58, 138, 0.03) 60%, transparent 100%)',
          top: '18%',
          left: '48%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Living Contract Topology Canvas with Parallax Depth and Scroll-Linked Zoom */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    </div>
  );
};
