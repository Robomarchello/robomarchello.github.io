/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight, high-performance 2D physics simulation for the Projects page.
 * - Frozen "Projects" text acts as an immovable rigidbody obstacle.
 * - Shapes (circle, rounded square, rounded diamond, rounded pill) use active palette accent color.
 * - Dynamic gravitational attraction toward mouse cursor when inside canvas; natural gravity when outside.
 * - Rigid stop line at the bottom boundary.
 * - Higher speed cap with responsive acceleration and zero memory leaks or duplicate RAF loops.
 */
export function initProjectsPhysics() {
  const canvas = document.getElementById('physics-canvas');
  const stage = document.getElementById('physics-stage');
  const titleEl = document.getElementById('projects-title');
  const toggleBtn = document.getElementById('physics-toggle-btn');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');

  if (!canvas || !stage || !titleEl) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;
  let isPaused = false;
  let isVisible = true;
  let isRunning = false;
  let animId = null;
  let lastTimestamp = 0;

  // Cached layout bounds to avoid synchronous layout reflow during animation ticks
  let obstacle = { left: 0, right: 0, top: 0, bottom: 0 };
  let stageBoundingRect = { left: 0, top: 0, width: 0, height: 0 };

  // Track mouse coordinates & hover/pressed state
  const mouse = {
    x: 0,
    y: 0,
    inside: false,
    pressed: false
  };

  // Draw rounded rectangle helper
  function drawRoundedRect(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(x, y, w, h, radius);
    } else {
      context.moveTo(x + radius, y);
      context.lineTo(x + w - radius, y);
      context.quadraticCurveTo(x + w, y, x + w, y + radius);
      context.lineTo(x + w, y + h - radius);
      context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      context.lineTo(x + radius, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
    }
  }

  // Draw rounded regular hexagon helper
  function drawRoundedHexagon(context, cx, cy, radius, rotation, cornerRadius) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angle = rotation + (i * Math.PI) / 3;
      corners.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      });
    }
    context.beginPath();
    const startX = (corners[5].x + corners[0].x) / 2;
    const startY = (corners[5].y + corners[0].y) / 2;
    context.moveTo(startX, startY);
    for (let i = 0; i < 6; i++) {
      const next = corners[(i + 1) % 6];
      context.arcTo(corners[i].x, corners[i].y, next.x, next.y, cornerRadius);
    }
    context.closePath();
  }

  /**
   * Precise shape extents along X and Y axes for bounding-box and wall collisions.
   */
  function getShapeExtents(b) {
    if (b.type === 'circle') {
      return { x: b.radius, y: b.radius };
    }
    const v = b.vertices;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < v.length; i++) {
      const dx = Math.abs(v[i].x - b.x);
      const dy = Math.abs(v[i].y - b.y);
      if (dx > maxX) maxX = dx;
      if (dy > maxY) maxY = dy;
    }
    return { x: maxX, y: maxY };
  }

  /**
   * Shape definitions: circles, rounded squares, rounded diamond, rounded hexagons
   */
  const shapeConfigs = [
    { type: 'circle', radius: 24, mass: 1.8 },
    { type: 'circle', radius: 31, mass: 2.3 },
    { type: 'circle', radius: 21, mass: 1.4 },
    { type: 'square', width: 46, height: 46, radius: 27, mass: 2.2, cornerRadius: 11 },
    { type: 'square', width: 39, height: 39, radius: 23, mass: 1.8, cornerRadius: 9 },
    { type: 'square', width: 50, height: 50, radius: 30, mass: 2.4, cornerRadius: 12 },
    { type: 'diamond', width: 42, height: 42, radius: 27, mass: 2.0, cornerRadius: 10 },
    { type: 'diamond', width: 39, height: 39, radius: 24, mass: 1.8, cornerRadius: 9 },
    { type: 'hexagon', radius: 29, mass: 2.2, cornerRadius: 6 },
    { type: 'hexagon', radius: 24, mass: 1.8, cornerRadius: 5 }
  ];

  // Initial stage measurements
  const initialRect = stage.getBoundingClientRect();
  width = initialRect.width || window.innerWidth;
  height = initialRect.height || 258;

  let currentScale = 1.0;

  /**
   * Calculates proportional shape scale based on current viewport width and height.
   * On mobile screens (width <= 640px down to 320px), shapes scale down gracefully (~0.45 - 0.60)
   * so their visual weight matches phone screens, preventing crowded jamming and letting them
   * bounce freely past the title obstacle and through the reduced vertical space.
   */
  function calculateShapeScale(currentWidth, currentHeight) {
    let scale = 1.0;

    if (currentWidth <= 380) {
      scale = 0.51;
    } else if (currentWidth <= 480) {
      scale = 0.58;
    } else if (currentWidth <= 640) {
      scale = 0.66;
    } else if (currentWidth <= 768) {
      scale = 0.78;
    } else if (currentWidth <= 1024) {
      scale = 0.88;
    } else {
      scale = 1.0;
    }

    // Height-based refinement if vertical animation space is compact
    if (currentHeight && currentHeight < 250) {
      const heightFactor = Math.max(0.86, currentHeight / 250);
      scale *= heightFactor;
    }

    return Math.max(0.45, Math.min(1.0, scale));
  }

  currentScale = calculateShapeScale(width, height);

  const shapes = shapeConfigs.map((cfg, idx) => {
    const colCount = shapeConfigs.length;
    const sideMargin = Math.max(20, Math.min(64, width * 0.1));
    const availableWidth = width - sideMargin * 2;
    const spacing = colCount > 1 ? availableWidth / (colCount - 1) : 0;
    const w = cfg.width || cfg.radius * 2;
    const h = cfg.height || cfg.radius * 2;
    let maxRadius = cfg.radius;
    let vertCount = 0;
    if (cfg.type === 'hexagon') {
      maxRadius = cfg.radius;
      vertCount = 6;
    } else if (cfg.type === 'square' || cfg.type === 'diamond') {
      maxRadius = Math.hypot(w / 2, h / 2);
      vertCount = 4;
    }

    const vertices = vertCount > 0 ? Array.from({ length: vertCount }, () => ({ x: 0, y: 0 })) : null;

    const scaledRadius = cfg.radius * currentScale;
    const scaledW = w * currentScale;
    const scaledH = h * currentScale;
    const scaledCorner = (cfg.cornerRadius || 10) * currentScale;
    const scaledMass = cfg.mass * (currentScale * currentScale);
    let scaledMaxRadius = scaledRadius;
    if (cfg.type === 'hexagon') {
      scaledMaxRadius = scaledRadius;
    } else if (cfg.type === 'square' || cfg.type === 'diamond') {
      scaledMaxRadius = Math.hypot(scaledW / 2, scaledH / 2);
    }

    const spawnY = Math.min(height * 0.28, 42) + (idx % 2) * Math.min(height * 0.20, 32);

    return {
      type: cfg.type,
      x: sideMargin + idx * spacing + (Math.random() - 0.5) * 8,
      y: spawnY + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 1.5,
      vy: Math.random() * 0.5,
      baseRadius: cfg.radius,
      baseWidth: w,
      baseHeight: h,
      baseCornerRadius: cfg.cornerRadius || 10,
      baseMass: cfg.mass,
      radius: scaledRadius,
      width: scaledW,
      height: scaledH,
      cornerRadius: scaledCorner,
      maxRadius: scaledMaxRadius,
      mass: scaledMass,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.02,
      vertices: vertices
    };
  });

  /**
   * Updates shape oriented boundary vertices in-place with zero memory allocation
   */
  function updateShapeVertices(b) {
    if (b.type === 'circle') return;

    if (b.type === 'square' || b.type === 'diamond') {
      const angle = b.type === 'diamond' ? b.rotation + Math.PI / 4 : b.rotation;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hw = b.width / 2;
      const hh = b.height / 2;

      const v = b.vertices;
      v[0].x = b.x + hw * cos - hh * sin;
      v[0].y = b.y + hw * sin + hh * cos;

      v[1].x = b.x - hw * cos - hh * sin;
      v[1].y = b.y - hw * sin + hh * cos;

      v[2].x = b.x - hw * cos + hh * sin;
      v[2].y = b.y - hw * sin - hh * cos;

      v[3].x = b.x + hw * cos + hh * sin;
      v[3].y = b.y + hw * sin - hh * cos;
      return;
    }

    if (b.type === 'hexagon') {
      const v = b.vertices;
      const r = b.radius;
      for (let k = 0; k < 6; k++) {
        const a = b.rotation + (k * Math.PI) / 3;
        v[k].x = b.x + r * Math.cos(a);
        v[k].y = b.y + r * Math.sin(a);
      }
    }
  }

  // Initialize vertices immediately
  shapes.forEach(updateShapeVertices);

  /**
   * Responsive shape sizing across mobile, tablet, and desktop
   */
  function updateShapeSizes(currentWidth, currentHeight) {
    currentScale = calculateShapeScale(currentWidth, currentHeight);

    shapes.forEach((b) => {
      b.radius = b.baseRadius * currentScale;
      b.width = b.baseWidth * currentScale;
      b.height = b.baseHeight * currentScale;
      b.cornerRadius = b.baseCornerRadius * currentScale;
      b.mass = b.baseMass * (currentScale * currentScale);

      if (b.type === 'hexagon') {
        b.maxRadius = b.radius;
      } else if (b.type === 'square' || b.type === 'diamond') {
        b.maxRadius = Math.hypot(b.width / 2, b.height / 2);
      } else {
        b.maxRadius = b.radius;
      }
      updateShapeVertices(b);
    });
  }

  // Static obstacle representations for title segments ("P", "ro", "j", "ec", "ts")
  let obstacleBodies = [];

  /**
   * Positions the "Projects" title lower on computers (below navbar) and centered to canvas on mobile.
   */
  function positionTitle() {
    if (!titleEl || !stage) return;

    const w = window.innerWidth;
    const stageRect = stage.getBoundingClientRect();
    const stageH = stageRect.height || (w <= 380 ? 202 : w <= 640 ? 216 : w <= 768 ? 232 : 258);

    let centerY;
    if (w > 768) {
      // On computers: positioned lower in the canvas section below the navbar
      const navWrapper = document.querySelector('.nav-wrapper');
      const header = document.getElementById('site-header');
      let navbarEffectiveBottom = 79;
      if (header && navWrapper) {
        const padTop = parseFloat(window.getComputedStyle(header).paddingTop) || 24;
        navbarEffectiveBottom = padTop + navWrapper.offsetHeight;
      } else if (navWrapper) {
        navbarEffectiveBottom = navWrapper.getBoundingClientRect().bottom;
      }
      centerY = Math.round((stageH + navbarEffectiveBottom) / 2) - 8;
    } else {
      // On mobile: cleanly centered to canvas
      centerY = Math.round(stageH / 2);
    }

    const currentTop = parseFloat(titleEl.style.top);
    if (!currentTop || Math.abs(currentTop - centerY) > 0.5) {
      titleEl.style.top = `${centerY}px`;
    }
    titleEl.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Updates cached obstacle bounds for each individual title character segment ("P", "r", "o", "j", "e", "c", "t", "s").
   * Each character receives its own tailored, precise rectangular collision body:
   * - "P": cap-height (0.14) down to baseline (0.07)
   * - "r", "o", "e", "c", "s": lower x-height (0.33) down to baseline (0.07), leaving empty air above open
   * - "j": dot at cap-height (0.14), extending through descender hook below baseline (-0.08)
   * - "t": 't' ascender (0.22) down to baseline (0.07)
   */
  function updateObstacleBounds() {
    positionTitle();

    const stageRect = canvas.getBoundingClientRect();
    stageBoundingRect = stageRect;

    const segmentEls = document.querySelectorAll('.title-segment');
    if (segmentEls && segmentEls.length > 0) {
      obstacleBodies = [];
      segmentEls.forEach((segEl) => {
        const segName = segEl.getAttribute('data-segment') || segEl.textContent.trim();
        const segRect = segEl.getBoundingClientRect();
        const textH = segRect.height;
        if (textH <= 0 || segRect.width <= 0) return;

        let topTrim = textH * 0.14;
        let bottomTrim = textH * 0.07;

        if (segName === 'r' || segName === 'o' || segName === 'ro' || segName === 'e' || segName === 'c' || segName === 'ec' || segName === 's') {
          // Lowercase letters without ascenders (x-height) - open headroom above letters
          topTrim = textH * 0.33;
          bottomTrim = textH * 0.07;
        } else if (segName === 'j') {
          // 'j' with dot at top and hook descender extending below baseline
          topTrim = textH * 0.14;
          bottomTrim = -textH * 0.08;
        } else if (segName === 't' || segName === 'ts') {
          // 't' ascender and crossbar
          topTrim = textH * 0.22;
          bottomTrim = textH * 0.07;
        } else if (segName === 'P') {
          // Capital 'P'
          topTrim = textH * 0.14;
          bottomTrim = textH * 0.07;
        }

        const left = segRect.left - stageRect.left - 0.2;
        const right = segRect.right - stageRect.left + 0.2;
        const top = segRect.top - stageRect.top + topTrim;
        const bottom = segRect.bottom - stageRect.top - bottomTrim;

        if (right > left && bottom > top) {
          obstacleBodies.push({
            type: 'obstacle',
            name: segName,
            left: left,
            right: right,
            top: top,
            bottom: bottom,
            x: (left + right) / 2,
            y: (top + bottom) / 2,
            vertices: [
              { x: left, y: top },
              { x: right, y: top },
              { x: right, y: bottom },
              { x: left, y: bottom }
            ]
          });
        }
      });
    }

    // Fallback if segments are missing
    if (obstacleBodies.length === 0) {
      const textEl = document.getElementById('projects-title-text') || titleEl;
      if (!textEl) return;
      const titleRect = textEl.getBoundingClientRect();
      const textH = titleRect.height;
      const topTrim = textH * 0.15;
      const bottomTrim = textH * 0.07;

      const left = titleRect.left - stageRect.left + 1;
      const right = titleRect.right - stageRect.left - 1;
      const top = titleRect.top - stageRect.top + topTrim;
      const bottom = titleRect.bottom - stageRect.top - bottomTrim;

      obstacleBodies = [{
        type: 'obstacle',
        name: 'all',
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        vertices: [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom }
        ]
      }];
    }

    obstacle = obstacleBodies.length > 0 ? obstacleBodies[0] : null;
  }

  /**
   * Separating Axis Theorem (SAT) collision routines
   */
  function testCircleCircle(c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const distSq = dx * dx + dy * dy;
    const targetDist = c1.radius + c2.radius;
    if (distSq >= targetDist * targetDist) return null;

    const dist = Math.sqrt(distSq) || 0.001;
    return {
      overlap: targetDist - dist,
      nx: dx / dist,
      ny: dy / dist
    };
  }

  function testPolygonPolygon(p1, p2) {
    const v1 = p1.vertices;
    const v2 = p2.vertices;

    let minOverlap = Infinity;
    let bestNx = 0;
    let bestNy = 0;

    // Normals of polygon 1
    for (let i = 0; i < v1.length; i++) {
      const nextIdx = (i + 1) % v1.length;
      const edgeX = v1[nextIdx].x - v1[i].x;
      const edgeY = v1[nextIdx].y - v1[i].y;
      let nx = -edgeY;
      let ny = edgeX;
      const len = Math.hypot(nx, ny);
      if (len < 0.0001) continue;
      nx /= len;
      ny /= len;

      let min1 = v1[0].x * nx + v1[0].y * ny;
      let max1 = min1;
      for (let k = 1; k < v1.length; k++) {
        const p = v1[k].x * nx + v1[k].y * ny;
        if (p < min1) min1 = p;
        if (p > max1) max1 = p;
      }

      let min2 = v2[0].x * nx + v2[0].y * ny;
      let max2 = min2;
      for (let k = 1; k < v2.length; k++) {
        const p = v2[k].x * nx + v2[k].y * ny;
        if (p < min2) min2 = p;
        if (p > max2) max2 = p;
      }

      if (min1 >= max2 || min2 >= max1) return null;

      const overlap = Math.min(max1 - min2, max2 - min1);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = nx;
        bestNy = ny;
      }
    }

    // Normals of polygon 2
    for (let i = 0; i < v2.length; i++) {
      const nextIdx = (i + 1) % v2.length;
      const edgeX = v2[nextIdx].x - v2[i].x;
      const edgeY = v2[nextIdx].y - v2[i].y;
      let nx = -edgeY;
      let ny = edgeX;
      const len = Math.hypot(nx, ny);
      if (len < 0.0001) continue;
      nx /= len;
      ny /= len;

      let min1 = v1[0].x * nx + v1[0].y * ny;
      let max1 = min1;
      for (let k = 1; k < v1.length; k++) {
        const p = v1[k].x * nx + v1[k].y * ny;
        if (p < min1) min1 = p;
        if (p > max1) max1 = p;
      }

      let min2 = v2[0].x * nx + v2[0].y * ny;
      let max2 = min2;
      for (let k = 1; k < v2.length; k++) {
        const p = v2[k].x * nx + v2[k].y * ny;
        if (p < min2) min2 = p;
        if (p > max2) max2 = p;
      }

      if (min1 >= max2 || min2 >= max1) return null;

      const overlap = Math.min(max1 - min2, max2 - min1);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = nx;
        bestNy = ny;
      }
    }

    const centerDx = p2.x - p1.x;
    const centerDy = p2.y - p1.y;
    if (centerDx * bestNx + centerDy * bestNy < 0) {
      bestNx = -bestNx;
      bestNy = -bestNy;
    }

    return {
      overlap: minOverlap,
      nx: bestNx,
      ny: bestNy
    };
  }

  function testPolygonCircle(poly, circ) {
    const v = poly.vertices;
    let minOverlap = Infinity;
    let bestNx = 0;
    let bestNy = 0;

    // 1. Polygon edge normals
    for (let i = 0; i < v.length; i++) {
      const nextIdx = (i + 1) % v.length;
      const edgeX = v[nextIdx].x - v[i].x;
      const edgeY = v[nextIdx].y - v[i].y;
      let nx = -edgeY;
      let ny = edgeX;
      const len = Math.hypot(nx, ny);
      if (len < 0.0001) continue;
      nx /= len;
      ny /= len;

      let minPoly = v[0].x * nx + v[0].y * ny;
      let maxPoly = minPoly;
      for (let k = 1; k < v.length; k++) {
        const p = v[k].x * nx + v[k].y * ny;
        if (p < minPoly) minPoly = p;
        if (p > maxPoly) maxPoly = p;
      }

      const circProj = circ.x * nx + circ.y * ny;
      const minCirc = circProj - circ.radius;
      const maxCirc = circProj + circ.radius;

      if (minPoly >= maxCirc || minCirc >= maxPoly) return null;

      const overlap = Math.min(maxPoly - minCirc, maxCirc - minPoly);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = nx;
        bestNy = ny;
      }
    }

    // 2. Axis from closest vertex to circle center
    let closestDistSq = Infinity;
    let closestVx = v[0].x;
    let closestVy = v[0].y;
    for (let i = 0; i < v.length; i++) {
      const dSq = (circ.x - v[i].x) ** 2 + (circ.y - v[i].y) ** 2;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestVx = v[i].x;
        closestVy = v[i].y;
      }
    }

    let nx = circ.x - closestVx;
    let ny = circ.y - closestVy;
    const len = Math.hypot(nx, ny);
    if (len > 0.0001) {
      nx /= len;
      ny /= len;

      let minPoly = v[0].x * nx + v[0].y * ny;
      let maxPoly = minPoly;
      for (let k = 1; k < v.length; k++) {
        const p = v[k].x * nx + v[k].y * ny;
        if (p < minPoly) minPoly = p;
        if (p > maxPoly) maxPoly = p;
      }

      const circProj = circ.x * nx + circ.y * ny;
      const minCirc = circProj - circ.radius;
      const maxCirc = circProj + circ.radius;

      if (minPoly >= maxCirc || minCirc >= maxPoly) return null;

      const overlap = Math.min(maxPoly - minCirc, maxCirc - minPoly);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = nx;
        bestNy = ny;
      }
    }

    const centerDx = circ.x - poly.x;
    const centerDy = circ.y - poly.y;
    if (centerDx * bestNx + centerDy * bestNy < 0) {
      bestNx = -bestNx;
      bestNy = -bestNy;
    }

    return {
      overlap: minOverlap,
      nx: bestNx,
      ny: bestNy
    };
  }

  function testCollision(b1, b2) {
    if (b1.type === 'circle' && b2.type === 'circle') {
      return testCircleCircle(b1, b2);
    }
    if (b1.type === 'circle') {
      const col = testPolygonCircle(b2, b1);
      if (!col) return null;
      return {
        overlap: col.overlap,
        nx: -col.nx,
        ny: -col.ny
      };
    }
    if (b2.type === 'circle') {
      return testPolygonCircle(b1, b2);
    }
    return testPolygonPolygon(b1, b2);
  }

  /**
   * Resize canvas to container with device pixel ratio scaling
   */
  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = window.devicePixelRatio || 1;

    updateShapeSizes(width, height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    updateObstacleBounds();

    // Keep shapes within bounds if container shrank
    shapes.forEach((b) => {
      const ext = getShapeExtents(b);
      b.x = Math.max(ext.x + 1, Math.min(width - ext.x - 1, b.x));
      b.y = Math.max(ext.y + 1, Math.min(height - ext.y - 1, b.y));
    });
  }

  resize();
  window.addEventListener('resize', resize);

  // Recalculate obstacle bounds if custom web fonts load late
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      updateObstacleBounds();
    });
  }

  // Ensure hitboxes are accurately refreshed once layout and fonts stabilize
  setTimeout(updateObstacleBounds, 50);
  setTimeout(updateObstacleBounds, 200);

  // Burst impulse on initial press
  function triggerBurstImpulse(cx, cy) {
    if (isPaused) return;

    // Apply immediate outward impulse away from cursor for instantaneous responsiveness
    for (let i = 0; i < shapes.length; i++) {
      const b = shapes[i];
      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.hypot(dx, dy) || 0.1;
      let nx = dx / dist;
      let ny = dy / dist;
      if (dist < 1) {
        nx = (Math.random() - 0.5) || 1;
        ny = (Math.random() - 0.5) || -1;
      }

      // Responsive burst impulse accelerating outward cleanly
      const impulse = Math.min(8.0, Math.max(2.5, 480 / (dist + 40)));
      b.vx += nx * impulse;
      b.vy += ny * impulse;
      b.vRot += (Math.random() - 0.5) * 0.035;
    }
  }

  // Mouse event listeners on the physics stage
  function updateMouse(e) {
    const rect = stageBoundingRect.width > 0 ? stageBoundingRect : canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.inside = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
    if (e.buttons !== undefined) {
      mouse.pressed = (e.buttons & 1) === 1;
    }
  }

  stage.addEventListener('mouseenter', (e) => {
    stageBoundingRect = canvas.getBoundingClientRect();
    updateMouse(e);
  });
  stage.addEventListener('mousemove', updateMouse);
  stage.addEventListener('pointermove', updateMouse);
  stage.addEventListener('mouseleave', () => {
    mouse.inside = false;
    mouse.pressed = false;
  });

  // Continuous push away on pointer press / hold
  stage.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest('#physics-controls-bar')) return;
    stageBoundingRect = canvas.getBoundingClientRect();
    updateMouse(e);
    mouse.pressed = true;
    triggerBurstImpulse(mouse.x, mouse.y);
  });

  stage.addEventListener('pointerup', () => {
    mouse.pressed = false;
  });
  window.addEventListener('pointerup', () => {
    mouse.pressed = false;
  });
  window.addEventListener('mouseup', () => {
    mouse.pressed = false;
  });
  stage.addEventListener('pointercancel', () => {
    mouse.pressed = false;
  });

  // Touch support for mobile devices
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      stageBoundingRect = canvas.getBoundingClientRect();
      const rect = stageBoundingRect;
      mouse.x = e.touches[0].clientX - rect.left;
      mouse.y = e.touches[0].clientY - rect.top;
      mouse.inside = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
      mouse.pressed = true;
      triggerBurstImpulse(mouse.x, mouse.y);
    }
  }, { passive: true });

  stage.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = stageBoundingRect.width > 0 ? stageBoundingRect : canvas.getBoundingClientRect();
      mouse.x = e.touches[0].clientX - rect.left;
      mouse.y = e.touches[0].clientY - rect.top;
      mouse.inside = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
      mouse.pressed = true;
    }
  }, { passive: true });

  stage.addEventListener('touchend', () => {
    mouse.inside = false;
    mouse.pressed = false;
  }, { passive: true });

  stage.addEventListener('touchcancel', () => {
    mouse.inside = false;
    mouse.pressed = false;
  }, { passive: true });

  /**
   * Main Physics & Render Tick
   */
  function tick(timestamp) {
    if (!isRunning || isPaused || !isVisible) {
      isRunning = false;
      animId = null;
      return;
    }

    // Schedule next frame immediately
    animId = requestAnimationFrame(tick);

    // Delta time calculation normalized to 60fps (16.667ms)
    // Clamped strictly to prevent any physics explosions or stalls during tab lag
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const timeScale = Math.min(Math.max(elapsed / 16.667, 0.4), 1.6);

    // Get active theme accent color dynamically
    const currentAccent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-color')
      .trim() || '#0284C7';

    // Physics parameters: higher speed cap and higher acceleration
    const MAX_VROT = 0.075; // Allows lively, expressive roll
    const MAX_SPEED = 20.0; // Higher speed cap (increased from 6.2) for fast acceleration

    // 1. Integration & Forces
    for (let i = 0; i < shapes.length; i++) {
      const b = shapes[i];
      const ext = getShapeExtents(b);
      const isRestingOnFloor = b.y >= height - ext.y - 0.8 && Math.abs(b.vy) < 0.25;

      if (mouse.inside && mouse.pressed) {
        // Continuous repulsion / move away while mouse button is pressed
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 0.1;
        let nx = dx / dist;
        let ny = dy / dist;
        if (dist < 1) {
          nx = (Math.random() - 0.5) || 1;
          ny = (Math.random() - 0.5) || -1;
        }

        // Repulsion force pushing shapes continuously away from cursor
        const repelForce = Math.min(850 / (dist + 35), 2.2);
        b.vx += nx * repelForce * timeScale;
        b.vy += ny * repelForce * timeScale;
        b.vRot += (Math.random() - 0.5) * 0.02 * timeScale;
      } else if (mouse.inside) {
        // Dynamic attraction towards cursor (normal behaviour when not clicked)
        const dx = mouse.x - b.x;
        const dy = mouse.y - b.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 1) {
          // Smooth attraction force: responsive from afar, smoothly attenuates to 0 at cursor center
          // This stops shapes from violently fighting and competing over the single center point
          let pullForce = 0;
          if (dist > 55) {
            pullForce = Math.min(650 / (dist + 45), 1.45);
          } else {
            pullForce = 1.45 * (dist / 55);
          }
          b.vx += (dx / dist) * pullForce * timeScale;
          b.vy += (dy / dist) * pullForce * timeScale;

          // Viscous cushion when near cursor so shapes decelerate gracefully into a stable cluster
          const cushionThreshold = Math.max(45, 80 * currentScale);
          if (dist < cushionThreshold) {
            const proximityFactor = dist / cushionThreshold; // 0 at core, 1 at edge
            const cushionDamp = 0.86 + 0.12 * proximityFactor;
            b.vx *= Math.pow(cushionDamp, timeScale);
            b.vy *= Math.pow(cushionDamp, timeScale);
            b.vRot *= Math.pow(0.85, timeScale);
          }
        }
      } else {
        // Natural gravity applies when not resting on floor
        if (!isRestingOnFloor) {
          b.vy += 0.32 * timeScale;
        }
        b.vx *= Math.pow(0.985, timeScale);
      }

      // Air resistance (much less damping than before so momentum is preserved)
      const airDrag = Math.pow(0.988, timeScale);
      b.vx *= airDrag;
      b.vy *= airDrag;
      b.vRot *= Math.pow(0.94, timeScale);

      // Settle negligible drift only when speed is near zero
      if (Math.abs(b.vx) < 0.015) b.vx = 0;
      if (Math.abs(b.vy) < 0.015) b.vy = 0;
      if (Math.abs(b.vRot) < 0.0002) b.vRot = 0;

      // Clamp angular velocity
      if (b.vRot > MAX_VROT) b.vRot = MAX_VROT;
      else if (b.vRot < -MAX_VROT) b.vRot = -MAX_VROT;

      // Clamp linear speed to the higher speed cap
      const curSpeed = Math.hypot(b.vx, b.vy);
      if (curSpeed > MAX_SPEED) {
        b.vx = (b.vx / curSpeed) * MAX_SPEED;
        b.vy = (b.vy / curSpeed) * MAX_SPEED;
      }

      b.x += b.vx * timeScale;
      b.y += b.vy * timeScale;
      b.rotation += b.vRot * timeScale;
      updateShapeVertices(b);
    }

    // 2. Multi-pass Constraint Solver (Eliminates all shape interpenetration)
    const SOLVER_ITERATIONS = 4;
    for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
      // A. Boundary constraints (Floor, ceiling, walls)
      for (let i = 0; i < shapes.length; i++) {
        const b = shapes[i];
        const ext = getShapeExtents(b);

        // Floor collision
        if (b.y > height - ext.y) {
          b.y = height - ext.y;
          if (b.vy > 0) {
            b.vy = Math.abs(b.vy) < 0.35 ? 0 : -b.vy * 0.45;
            b.vx *= 0.88;
            b.vRot *= 0.80;
            if (Math.abs(b.vx) < 0.03) b.vx = 0;
            if (Math.abs(b.vRot) < 0.0004) b.vRot = 0;
          }
          updateShapeVertices(b);
        }

        // Ceiling collision
        if (b.y < ext.y) {
          b.y = ext.y;
          if (b.vy < 0) b.vy = -b.vy * 0.45;
          b.vRot *= 0.85;
          updateShapeVertices(b);
        }

        // Left wall collision
        if (b.x < ext.x) {
          b.x = ext.x;
          if (b.vx < 0) b.vx = -b.vx * 0.50;
          b.vRot *= 0.85;
          updateShapeVertices(b);
        }

        // Right wall collision
        if (b.x > width - ext.x) {
          b.x = width - ext.x;
          if (b.vx > 0) b.vx = -b.vx * 0.50;
          b.vRot *= 0.85;
          updateShapeVertices(b);
        }

        // Static obstacle ("P", "ro", "j", "ec", "ts") collisions
        for (let k = 0; k < obstacleBodies.length; k++) {
          const obs = obstacleBodies[k];
          const maxR = b.maxRadius;

          // AABB broadphase rejection
          if (
            b.x + maxR < obs.left ||
            b.x - maxR > obs.right ||
            b.y + maxR < obs.top ||
            b.y - maxR > obs.bottom
          ) {
            continue;
          }

          const obsCol = b.type === 'circle'
            ? testPolygonCircle(obs, b)
            : testPolygonPolygon(obs, b);

          if (obsCol && obsCol.overlap > 0.0001) {
            b.x += obsCol.nx * obsCol.overlap;
            b.y += obsCol.ny * obsCol.overlap;
            updateShapeVertices(b);

            const dot = b.vx * obsCol.nx + b.vy * obsCol.ny;
            if (dot < 0) {
              const restitution = Math.abs(dot) < 0.4 ? 0.08 : 0.40;
              b.vx -= (1 + restitution) * dot * obsCol.nx;
              b.vy -= (1 + restitution) * dot * obsCol.ny;
              b.vRot *= 0.82;
            }
          }
        }
      }

      // B. Pairwise shape-to-shape non-penetration constraints
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const b1 = shapes[i];
          const b2 = shapes[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const broadDist = b1.maxRadius + b2.maxRadius;
          if (dx * dx + dy * dy >= broadDist * broadDist) {
            continue;
          }

          const col = testCollision(b1, b2);
          if (col && col.overlap > 0.0001) {
            const nx = col.nx;
            const ny = col.ny;

            // Mass-weighted position correction resolves 100% of penetration
            const invM1 = 1 / b1.mass;
            const invM2 = 1 / b2.mass;
            const totalInvM = invM1 + invM2;

            const sep1 = col.overlap * (invM1 / totalInvM);
            const sep2 = col.overlap * (invM2 / totalInvM);

            b1.x -= nx * sep1;
            b1.y -= ny * sep1;
            b2.x += nx * sep2;
            b2.y += ny * sep2;

            updateShapeVertices(b1);
            updateShapeVertices(b2);

            // Relative velocity impulse
            const relVx = b1.vx - b2.vx;
            const relVy = b1.vy - b2.vy;
            const relSpeed = relVx * nx + relVy * ny;

            if (relSpeed > 0) {
              const mDist1 = mouse.inside ? Math.hypot(mouse.x - b1.x, mouse.y - b1.y) : 999;
              const mDist2 = mouse.inside ? Math.hypot(mouse.x - b2.x, mouse.y - b2.y) : 999;
              const clusterRadius = Math.max(50, 95 * currentScale);
              const isClustered = mouse.inside && mDist1 < clusterRadius && mDist2 < clusterRadius;

              const restitution = isClustered ? 0.0 : (relSpeed < 0.4 ? 0.10 : 0.45);
              const impulse = (1 + restitution) * relSpeed / totalInvM;

              b1.vx -= impulse * invM1 * nx;
              b1.vy -= impulse * invM1 * ny;
              b2.vx += impulse * invM2 * nx;
              b2.vy += impulse * invM2 * ny;

              const friction = isClustered ? 0.88 : 0.96;
              b1.vx *= friction;
              b1.vy *= friction;
              b2.vx *= friction;
              b2.vy *= friction;

              if (!isClustered && relSpeed >= 0.4) {
                const rx1 = (b2.x - b1.x) * 0.5;
                const ry1 = (b2.y - b1.y) * 0.5;
                const rx2 = (b1.x - b2.x) * 0.5;
                const ry2 = (b1.y - b2.y) * 0.5;
                const torque1 = (rx1 * ny - ry1 * nx) * 0.0015;
                const torque2 = (rx2 * -ny - ry2 * -nx) * 0.0015;
                b1.vRot = Math.max(-MAX_VROT, Math.min(MAX_VROT, b1.vRot + torque1));
                b2.vRot = Math.max(-MAX_VROT, Math.min(MAX_VROT, b2.vRot + torque2));
              }
            }
          }
        }
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Render shapes with current accent color
    ctx.fillStyle = currentAccent;

    for (let i = 0; i < shapes.length; i++) {
      const b = shapes[i];

      if (b.type === 'circle') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'square') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation);
        drawRoundedRect(ctx, -b.width / 2, -b.height / 2, b.width, b.height, b.cornerRadius);
        ctx.fill();
        ctx.restore();
      } else if (b.type === 'diamond') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation + Math.PI / 4);
        drawRoundedRect(ctx, -b.width / 2, -b.height / 2, b.width, b.height, b.cornerRadius);
        ctx.fill();
        ctx.restore();
      } else if (b.type === 'hexagon') {
        drawRoundedHexagon(ctx, b.x, b.y, b.radius, b.rotation, b.cornerRadius);
        ctx.fill();
      }
    }
  }

  // Animation lifecycle control with single-loop guarantee
  function startAnimation() {
    if (isRunning || isPaused || !isVisible) return;
    isRunning = true;
    lastTimestamp = 0;
    animId = requestAnimationFrame(tick);
  }

  function stopAnimation() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // SVG icons for physics pause / play controls
  const PAUSE_SVG = '<svg class="physics-btn-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"></rect><rect x="14" y="5" width="4" height="14" rx="1.5"></rect></svg>';
  const PLAY_SVG = '<svg class="physics-btn-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="7,5 19,12 7,19"></polygon></svg>';

  // Start single animation loop
  startAnimation();

  /**
   * Toggle pause/resume button for performance
   */
  function togglePhysics() {
    isPaused = !isPaused;
    if (isPaused) {
      stopAnimation();
      if (toggleIcon) toggleIcon.innerHTML = PLAY_SVG;
      if (toggleText) toggleText.textContent = 'Resume physics';
      toggleBtn?.setAttribute('aria-label', 'Resume physics simulation');
      toggleBtn?.setAttribute('title', 'Resume physics simulation');
    } else {
      if (toggleIcon) toggleIcon.innerHTML = PAUSE_SVG;
      if (toggleText) toggleText.textContent = 'Pause physics';
      toggleBtn?.setAttribute('aria-label', 'Pause physics simulation');
      toggleBtn?.setAttribute('title', 'Pause physics simulation');
      startAnimation();
    }
  }

  if (toggleIcon) {
    toggleIcon.innerHTML = PAUSE_SVG;
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', togglePhysics);
  }

  /**
   * Viewport & Visibility Performance Optimizations
   */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  // Pause when scrolled out of view using IntersectionObserver
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
        if (!isVisible) {
          stopAnimation();
        } else {
          startAnimation();
        }
      });
    }, { threshold: 0.05 });
    observer.observe(stage);
  }
}
