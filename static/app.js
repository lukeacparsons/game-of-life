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

let cells = new Set();
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
  if (alive) cells.add(id);
  else cells.delete(id);
}

function randomize() {
  cells.clear();
  generation = 0;
  const rect = canvas.getBoundingClientRect();
  const cols = Math.ceil(rect.width / cellSize) + 8;
  const rows = Math.ceil(rect.height / cellSize) + 8;
  const density = Number(ui.density.value) / 100;
  const startX = Math.floor(-cols / 2);
  const startY = Math.floor(-rows / 2);

  for (let y = startY; y < startY + rows; y += 1) {
    for (let x = startX; x < startX + cols; x += 1) {
      if (Math.random() < density) setCell(x, y, true);
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

  for (const id of cells) {
    const { x, y } = parseKey(id);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = key(x + dx, y + dy);
        counts.set(neighbor, (counts.get(neighbor) || 0) + 1);
      }
    }
  }

  const next = new Set();
  for (const [id, count] of counts) {
    if (count === 3 || (count === 2 && cells.has(id))) {
      next.add(id);
    }
  }

  cells = next;
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

function drawCells(width, height) {
  const visiblePadding = cellSize * 2;
  ctx.fillStyle = "#53f4a7";
  ctx.shadowColor = "rgba(83, 244, 167, 0.38)";
  ctx.shadowBlur = Math.max(0, cellSize - 5);

  for (const id of cells) {
    const { x, y } = parseKey(id);
    const sx = pan.x + x * cellSize;
    const sy = pan.y + y * cellSize;
    if (
      sx < -visiblePadding ||
      sy < -visiblePadding ||
      sx > width + visiblePadding ||
      sy > height + visiblePadding
    ) {
      continue;
    }
    const inset = Math.max(1, Math.floor(cellSize * 0.14));
    ctx.fillRect(sx + inset, sy + inset, cellSize - inset * 2, cellSize - inset * 2);
  }

  ctx.shadowBlur = 0;
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
  drawCells(width, height);
}

function tick(now) {
  const fps = Number(ui.speed.value);
  const delay = 1000 / fps;
  if (running && now - lastTick >= delay) {
    step();
    lastTick = now;
  }
  draw();
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
