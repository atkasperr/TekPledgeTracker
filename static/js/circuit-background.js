/**
 * Full-viewport circuit-board style background: orthogonal traces, traveling pulses, sparks.
 * Expects <canvas id="circuit-canvas"> and runs only when present.
 */
(function () {
	const GRID = 40;
	const TRACE_COUNT = 22;
	const PULSE_COUNT = 14;
	const COLORS = {
		bg0: '#04080f',
		bg1: '#0a1628',
		trace: 'rgba(45, 95, 140, 0.42)',
		traceBright: 'rgba(70, 140, 190, 0.2)',
		junction: 'rgba(90, 180, 220, 0.35)',
		pulse: '#6ef0ff',
		pulseGlow: 'rgba(120, 235, 255, 0.55)',
		sparkCore: '#ffffff',
		sparkHue: 'rgba(180, 240, 255,',
	};

	function prefersReducedMotion() {
		return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function snap(n) {
		return Math.round(n / GRID) * GRID;
	}

	function buildTrace(w, h) {
		const pad = GRID * 8;
		let gx = snap(Math.random() * (w + pad * 2) - pad);
		let gy = snap(Math.random() * (h + pad * 2) - pad);
		const points = [{ x: gx, y: gy }];
		let dir = Math.floor(Math.random() * 4);
		const maxSeg = 28;
		const dx = [0, 1, 0, -1];
		const dy = [-1, 0, 1, 0];

		for (let s = 0; s < maxSeg; s++) {
			if (Math.random() < 0.26) {
				dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
			}
			const cells = 2 + Math.floor(Math.random() * 7);
			const len = cells * GRID;
			gx += dx[dir] * len;
			gy += dy[dir] * len;
			points.push({ x: gx, y: gy });
			if (gx < -pad * 2 || gx > w + pad * 2 || gy < -pad * 2 || gy > h + pad * 2) {
				break;
			}
		}
		return points;
	}

	function wireFromPoints(points) {
		const segs = [];
		let totalLen = 0;
		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i];
			const b = points[i + 1];
			const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
			if (len < 1) continue;
			segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, len });
			totalLen += len;
		}
		const cum = [0];
		for (const s of segs) {
			cum.push(cum[cum.length - 1] + s.len);
		}
		return { segs, cum, totalLen };
	}

	function posAlongWire(wire, dist) {
		if (wire.totalLen <= 0) return { x: 0, y: 0 };
		let d = dist % wire.totalLen;
		if (d < 0) d += wire.totalLen;
		let i = 0;
		while (i < wire.segs.length && wire.cum[i + 1] < d) i++;
		const seg = wire.segs[i];
		const t = (d - wire.cum[i]) / seg.len;
		return {
			x: seg.x1 + (seg.x2 - seg.x1) * t,
			y: seg.y1 + (seg.y2 - seg.y1) * t,
		};
	}

	function randomPointOnWire(wire) {
		const d = Math.random() * wire.totalLen;
		return posAlongWire(wire, d);
	}

	function generateWires(w, h) {
		const wires = [];
		for (let n = 0; n < TRACE_COUNT; n++) {
			const pts = buildTrace(w, h);
			const wire = wireFromPoints(pts);
			if (wire.segs.length > 0) wires.push(wire);
		}
		return wires;
	}

	function init() {
		const canvas = document.getElementById('circuit-canvas');
		if (!canvas || !canvas.getContext) return;

		const ctx = canvas.getContext('2d');
		let wires = [];
		let pulses = [];
		let sparks = [];
		let nextSpark = 0;
		let dpr = 1;
		let cw = 0;
		let ch = 0;
		let raf = 0;
		const reduced = prefersReducedMotion();

		function resize() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			cw = window.innerWidth;
			ch = window.innerHeight;
			canvas.width = Math.floor(cw * dpr);
			canvas.height = Math.floor(ch * dpr);
			canvas.style.width = `${cw}px`;
			canvas.style.height = `${ch}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			wires = generateWires(cw, ch);
			pulses = [];
			for (let i = 0; i < PULSE_COUNT; i++) {
				const w = wires[Math.floor(Math.random() * wires.length)];
				if (w && w.totalLen > 0) {
					pulses.push({
						wire: w,
						dist: Math.random() * w.totalLen,
						speed: 1.2 + Math.random() * 2.8,
					});
				}
			}
			sparks = [];
			nextSpark = performance.now() + 400 + Math.random() * 1200;
		}

		function drawBackground() {
			const g = ctx.createLinearGradient(0, 0, cw, ch);
			g.addColorStop(0, COLORS.bg0);
			g.addColorStop(0.55, COLORS.bg1);
			g.addColorStop(1, '#061018');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, cw, ch);
		}

		function drawTraces() {
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			for (const wire of wires) {
				for (const s of wire.segs) {
					ctx.strokeStyle = COLORS.trace;
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(s.x1, s.y1);
					ctx.lineTo(s.x2, s.y2);
					ctx.stroke();
					ctx.strokeStyle = COLORS.traceBright;
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(s.x1, s.y1);
					ctx.lineTo(s.x2, s.y2);
					ctx.stroke();
				}
			}
			// Small pads at segment corners (subtle)
			ctx.fillStyle = COLORS.junction;
			for (const wire of wires) {
				for (const s of wire.segs) {
					ctx.beginPath();
					ctx.arc(s.x1, s.y1, 2.2, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}

		function drawPulse(px, py, intensity) {
			const r = 4 + intensity * 5;
			const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
			grad.addColorStop(0, COLORS.pulseGlow);
			grad.addColorStop(0.35, 'rgba(80, 200, 255, 0.2)');
			grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(px, py, r * 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = COLORS.pulse;
			ctx.beginPath();
			ctx.arc(px, py, 2.2, 0, Math.PI * 2);
			ctx.fill();
		}

		function drawSparks() {
			for (const sp of sparks) {
				const t = sp.t / sp.maxT;
				const alpha = (1 - t) * (1 - t);
				const size = 4 + t * 28;
				ctx.save();
				ctx.translate(sp.x, sp.y);
				ctx.rotate(sp.rot);
				for (let i = 0; i < 6; i++) {
					const ang = (i / 6) * Math.PI * 2;
					ctx.strokeStyle = `${COLORS.sparkHue}${alpha * 0.9})`;
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.moveTo(0, 0);
					ctx.lineTo(Math.cos(ang) * size, Math.sin(ang) * size);
					ctx.stroke();
				}
				ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
				ctx.beginPath();
				ctx.arc(0, 0, 2 * (1 - t), 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
				sp.t += 1;
			}
			sparks = sparks.filter((s) => s.t < s.maxT);
		}

		function addSpark() {
			if (!wires.length) return;
			const wire = wires[Math.floor(Math.random() * wires.length)];
			const p = randomPointOnWire(wire);
			sparks.push({
				x: p.x,
				y: p.y,
				t: 0,
				maxT: 10 + Math.floor(Math.random() * 8),
				rot: Math.random() * Math.PI * 2,
			});
		}

		function tick(now) {
			drawBackground();
			drawTraces();

			if (!reduced) {
				for (const p of pulses) {
					p.dist += p.speed;
					if (p.dist >= p.wire.totalLen) p.dist -= p.wire.totalLen;
					const pos = posAlongWire(p.wire, p.dist);
					drawPulse(pos.x, pos.y, 0.7);
				}
				if (now >= nextSpark) {
					addSpark();
					nextSpark = now + 500 + Math.random() * 2200;
					if (Math.random() < 0.35) {
						addSpark();
						nextSpark = now + 200 + Math.random() * 400;
					}
				}
				drawSparks();
			}

			ctx.fillStyle = 'rgba(2, 6, 12, 0.35)';
			ctx.fillRect(0, 0, cw, ch);

			if (!reduced) {
				raf = requestAnimationFrame(tick);
			}
		}

		function drawStatic() {
			drawBackground();
			drawTraces();
			ctx.fillStyle = 'rgba(2, 6, 12, 0.35)';
			ctx.fillRect(0, 0, cw, ch);
		}

		resize();
		window.addEventListener('resize', () => {
			clearTimeout(resize._t);
			resize._t = setTimeout(() => {
				resize();
				if (reduced) drawStatic();
			}, 120);
		});

		if (reduced) {
			drawStatic();
			return;
		}

		raf = requestAnimationFrame(tick);

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				cancelAnimationFrame(raf);
				raf = 0;
			} else if (!raf) {
				raf = requestAnimationFrame(tick);
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
