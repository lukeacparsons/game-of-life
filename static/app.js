const canvas = document.querySelector("#life");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  play: document.querySelector("#play"),
  step: document.querySelector("#step"),
  random: document.querySelector("#random"),
  clear: document.querySelector("#clear"),
  speed: document.querySelector("#speed"),
  density: document.querySelector("#density"),
  scale: document.querySelector("#scale"),
  generation: document.querySelector("#generation"),
  population: document.querySelector("#population"),
  mode: document.querySelector("#mode"),
};

let cells = new Map();
let trails = new Map();
let running = true;
let generation = 0;
let cellSize = Number(ui.scale.value);
let lastTick = 0;
let pointerDown = false;
let drawAlive = true;
let pan = { x: 0, y: 0 };
let drag = null;

const patterns = {
  glider: [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  acorn: [
    [1, 0],
    [3, 1],
    [0, 2],
    [1, 2],
    [4, 2],
    [5, 2],
    [6, 2],
  ],
  pulsar: [
    [2, 0],
    [3, 0],
    [4, 0],
    [8, 0],
    [9, 0],
    [10, 0],
    [0, 2],
    [5, 2],
    [7, 2],
    [12, 2],
    [0, 3],
    [5, 3],
    [7, 3],
    [12, 3],
    [0, 4],
    [5, 4],
    [7, 4],
    [12, 4],
    [2, 5],
    [3, 5],
    [4, 5],
    [8, 5],
    [9, 5],
    [10, 5],
    [2, 7],
    [3, 7],
    [4, 7],
    [8, 7],
    [9, 7],
    [10, 7],
    [0, 8],
    [5, 8],
    [7, 8],
    [12, 8],
    [0, 9],
    [5, 9],
    [7, 9],
    [12, 9],
    [0, 10],
    [5, 10],
    [7, 10],
    [12, 10],
    [2, 12],
    [3, 12],
    [4, 12],
    [8, 12],
    [9, 12],
    [10, 12],
  ],
  gosper: [
    [24, 0],
    [22, 1],
    [24, 1],
    [12, 2],
    [13, 2],
    [20, 2],
    [21, 2],
    [34, 2],
    [35, 2],
    [11, 3],
    [15, 3],
    [20, 3],
    [21, 3],
    [34, 3],
    [35, 3],
    [0, 4],
    [1, 4],
    [10, 4],
    [16, 4],
    [20, 4],
    [21, 4],
    [0, 5],
    [1, 5],
    [10, 5],
    [14, 5],
    [16, 5],
    [17, 5],
    [22, 5],
    [24, 5],
    [10, 6],
    [16, 6],
    [24, 6],
    [11, 7],
    [15, 7],
    [12, 8],
    [13, 8],
  ],
};

function key(x, y) {
  return `${x},${y}`;
}

function parseKey(value) {
  const [x, y] = value.split(",").map(Number);
  return { x, y };
}

function noise(x, y, seed = 0) {
  const raw = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return raw - Math.floor(raw);
}

function blendColor(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function rgba(color, alpha) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function screenToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((clientX - rect.left - pan.x) / cellSize),
    y: Math.floor((clientY - rect.top - pan.y) / cellSize),
  };
}

function setCell(x, y, alive) {
  const id = key(x, y);
  if (alive) {
    const age = cells.get(id) || 0;
    cells.set(id, Math.max(1, age));
    trails.delete(id);
  } else {
    const age = cells.get(id) || 1;
    cells.delete(id);
    trails.set(id, Math.min(1, 0.34 + age / 80));
  }
}

function randomize() {
  cells.clear();
  trails.clear();
  generation = 0;
  const rect = canvas.getBoundingClientRect();
  const cols = Math.ceil(rect.width / cellSize) + 8;
  const rows = Math.ceil(rect.height / cellSize) + 8;
  const density = Number(ui.density.value) / 100;
  const startX = Math.floor(-cols / 2);
  const startY = Math.floor(-rows / 2);
  const colonyCount = Math.max(5, Math.min(16, Math.round((cols * rows) / 420)));
  const colonies = Array.from({ length: colonyCount }, () => ({
    x: startX + Math.random() * cols,
    y: startY + Math.random() * rows,
    rx: 3 + Math.random() * 8,
    ry: 3 + Math.random() * 8,
    strength: density * (0.75 + Math.random() * 1.65),
  }));

  for (let y = startY; y < startY + rows; y += 1) {
    for (let x = startX; x < startX + cols; x += 1) {
      let chance = density * 0.018;
      for (const colony of colonies) {
        const dx = (x - colony.x) / colony.rx;
        const dy = (y - colony.y) / colony.ry;
        chance += colony.strength * Math.exp(-(dx * dx + dy * dy));
      }
      if (Math.random() < Math.min(0.62, chance)) setCell(x, y, true);
    }
  }
  updateStats();
  draw();
}

function placePattern(name) {
  const pattern = patterns[name];
  if (!pattern) return;

  const rect = canvas.getBoundingClientRect();
  const center = screenToCell(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const width = Math.max(...pattern.map(([x]) => x));
  const height = Math.max(...pattern.map(([, y]) => y));
  const offsetX = center.x - Math.floor(width / 2);
  const offsetY = center.y - Math.floor(height / 2);

  for (const [x, y] of pattern) {
    setCell(offsetX + x, offsetY + y, true);
  }
  updateStats();
  draw();
}

function step() {
  const counts = new Map();

  for (const id of cells.keys()) {
    const { x, y } = parseKey(id);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = key(x + dx, y + dy);
        counts.set(neighbor, (counts.get(neighbor) || 0) + 1);
      }
    }
  }

  const next = new Map();
  const touched = new Set([...counts.keys(), ...cells.keys()]);
  for (const id of touched) {
    const count = counts.get(id) || 0;
    const age = cells.get(id) || 0;
    if (count === 3 || (count === 2 && age > 0)) {
      next.set(id, age > 0 ? age + 1 : 1);
      trails.delete(id);
    } else if (age > 0) {
      trails.set(id, Math.min(1, 0.42 + age / 64));
    }
  }

  cells = next;
  decayTrails(0.9);
  generation += 1;
  updateStats();
}

function updateStats() {
  ui.generation.textContent = generation.toLocaleString();
  ui.population.textContent = cells.size.toLocaleString();
}

function drawGrid(width, height) {
  const left = Math.floor(-pan.x / cellSize) - 1;
  const top = Math.floor(-pan.y / cellSize) - 1;
  const right = left + Math.ceil(width / cellSize) + 3;
  const bottom = top + Math.ceil(height / cellSize) + 3;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;

  for (let x = left; x <= right; x += 1) {
    const sx = Math.floor(pan.x + x * cellSize) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }

  for (let y = top; y <= bottom; y += 1) {
    const sy = Math.floor(pan.y + y * cellSize) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }

  ctx.stroke();
}

function decayTrails(amount = 0.975) {
  for (const [id, value] of trails) {
    const next = value * amount;
    if (next < 0.025) trails.delete(id);
    else trails.set(id, next);
  }
}

function cellScreenBox(x, y) {
  return {
    x: pan.x + x * cellSize,
    y: pan.y + y * cellSize,
    centerX: pan.x + (x + 0.5) * cellSize,
    centerY: pan.y + (y + 0.5) * cellSize,
  };
}

function isVisible(sx, sy, width, height, padding) {
  return sx >= -padding && sy >= -padding && sx <= width + padding && sy <= height + padding;
}

function drawTrails(width, height) {
  const visiblePadding = cellSize * 3;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const [id, heat] of trails) {
    const { x, y } = parseKey(id);
    const box = cellScreenBox(x, y);
    if (!isVisible(box.x, box.y, width, height, visiblePadding)) continue;

    const radius = cellSize * (0.18 + heat * 0.42);
    const wobble = (noise(x, y, generation * 0.02) - 0.5) * cellSize * 0.18;
    const color = blendColor([31, 92, 122], [126, 78, 180], heat);
    ctx.fillStyle = rgba(color, heat * 0.16);
    ctx.beginPath();
    ctx.ellipse(
      box.centerX + wobble,
      box.centerY - wobble,
      radius * 1.24,
      radius,
      noise(x, y, 12) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawTissue(width, height) {
  const visiblePadding = cellSize * 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const [id, age] of cells) {
    const { x, y } = parseKey(id);
    const box = cellScreenBox(x, y);
    if (!isVisible(box.x, box.y, width, height, visiblePadding)) continue;

    const vitality = Math.min(1, age / 22);
    const neighbors = [
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
      [x - 1, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      const neighborAge = cells.get(key(nx, ny));
      if (!neighborAge) continue;
      const nextBox = cellScreenBox(nx, ny);
      const strength = Math.min(1, (age + neighborAge) / 50);
      const color = blendColor([35, 151, 176], [88, 244, 167], strength);
      ctx.strokeStyle = rgba(color, 0.08 + vitality * 0.16);
      ctx.lineWidth = Math.max(1.2, cellSize * (0.18 + strength * 0.08));
      ctx.beginPath();
      ctx.moveTo(box.centerX, box.centerY);
      ctx.lineTo(nextBox.centerX, nextBox.centerY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCells(width, height) {
  const visiblePadding = cellSize * 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const [id, age] of cells) {
    const { x, y } = parseKey(id);
    const box = cellScreenBox(x, y);
    if (!isVisible(box.x, box.y, width, height, visiblePadding)) continue;

    const maturity = Math.min(1, age / 32);
    const pulse = 0.96 + Math.sin(generation * 0.16 + x * 0.8 + y * 0.42) * 0.04;
    const jitterX = (noise(x, y, 2) - 0.5) * cellSize * 0.12;
    const jitterY = (noise(x, y, 7) - 0.5) * cellSize * 0.12;
    const radius = cellSize * (0.36 + maturity * 0.12) * pulse;
    const color = blendColor([242, 193, 92], [83, 244, 167], maturity);
    const core = blendColor([255, 235, 180], [191, 255, 225], maturity);

    ctx.fillStyle = rgba(color, 0.38);
    ctx.beginPath();
    ctx.ellipse(
      box.centerX + jitterX,
      box.centerY + jitterY,
      radius * (1 + (noise(x, y, 9) - 0.5) * 0.28),
      radius * (0.86 + noise(x, y, 11) * 0.22),
      noise(x, y, 15) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.fillStyle = rgba(core, 0.56);
    ctx.beginPath();
    ctx.ellipse(
      box.centerX + jitterX * 0.7,
      box.centerY + jitterY * 0.7,
      radius * 0.42,
      radius * 0.34,
      noise(x, y, 17) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#080b0f");
  gradient.addColorStop(0.54, "#0b1015");
  gradient.addColorStop(1, "#0f1519");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);
  drawTrails(width, height);
  drawTissue(width, height);
  drawCells(width, height);
}

function tick(now) {
  const fps = Number(ui.speed.value);
  const delay = 1000 / fps;
  if (running && now - lastTick >= delay) {
    step();
    lastTick = now;
    draw();
  }
  requestAnimationFrame(tick);
}

function paint(event) {
  const { x, y } = screenToCell(event.clientX, event.clientY);
  setCell(x, y, drawAlive);
  updateStats();
  draw();
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  const cell = screenToCell(event.clientX, event.clientY);
  if (event.shiftKey || event.button === 1) {
    drag = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    ui.mode.textContent = "Pan";
    return;
  }
  pointerDown = true;
  drawAlive = !cells.has(key(cell.x, cell.y));
  ui.mode.textContent = drawAlive ? "Draw" : "Erase";
  paint(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (drag) {
    pan.x = drag.panX + event.clientX - drag.x;
    pan.y = drag.panY + event.clientY - drag.y;
    draw();
    return;
  }
  if (pointerDown) paint(event);
});

canvas.addEventListener("pointerup", () => {
  pointerDown = false;
  drag = null;
  ui.mode.textContent = "Draw";
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const before = screenToCell(event.clientX, event.clientY);
    const delta = event.deltaY > 0 ? -1 : 1;
    cellSize = Math.max(6, Math.min(24, cellSize + delta));
    ui.scale.value = String(cellSize);
    const rect = canvas.getBoundingClientRect();
    pan.x = event.clientX - rect.left - before.x * cellSize;
    pan.y = event.clientY - rect.top - before.y * cellSize;
    draw();
  },
  { passive: false },
);

ui.play.addEventListener("click", () => {
  running = !running;
  ui.play.textContent = running ? "Pause" : "Run";
  ui.play.setAttribute("aria-pressed", String(running));
});

ui.step.addEventListener("click", () => {
  step();
  draw();
});

ui.random.addEventListener("click", randomize);
ui.clear.addEventListener("click", () => {
  cells.clear();
  trails.clear();
  generation = 0;
  updateStats();
  draw();
});

ui.scale.addEventListener("input", () => {
  cellSize = Number(ui.scale.value);
  draw();
});

document.querySelectorAll("[data-pattern]").forEach((button) => {
  button.addEventListener("click", () => placePattern(button.dataset.pattern));
});

window.addEventListener("resize", resize);

resize();
randomize();
requestAnimationFrame(tick);
