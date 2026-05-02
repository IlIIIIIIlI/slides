export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface FocusCropOptions {
  tileSize?: number;
  backgroundTolerance?: number;
  tileOccupancyThreshold?: number;
  minAreaRatio?: number;
  maxAreaRatio?: number;
  margin?: number;
}

function isForeground(data: Uint8ClampedArray | Uint8Array, offset: number, tolerance: number): boolean {
  const alpha = data[offset + 3];
  if (alpha < 20) return false;
  return data[offset] < 255 - tolerance || data[offset + 1] < 255 - tolerance || data[offset + 2] < 255 - tolerance;
}

function expandBounds(bounds: CropBounds, width: number, height: number, margin: number): CropBounds {
  const x = Math.max(0, bounds.x - margin);
  const y = Math.max(0, bounds.y - margin);
  const right = Math.min(width, bounds.x + bounds.width + margin);
  const bottom = Math.min(height, bounds.y + bounds.height + margin);
  return { x, y, width: right - x, height: bottom - y };
}

function fullContentBounds(source: PixelSource, tolerance: number, margin: number): CropBounds | null {
  const { data, width, height } = source;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      if (!isForeground(data, offset, tolerance)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return expandBounds({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, width, height, margin);
}

export function findFocusedCropBounds(source: PixelSource, options: FocusCropOptions = {}): CropBounds | null {
  const {
    tileSize = 24,
    backgroundTolerance = 18,
    tileOccupancyThreshold = 0.08,
    minAreaRatio = 0.015,
    maxAreaRatio = 0.88,
    margin = 28,
  } = options;
  const { data, width, height } = source;
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null;

  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  const occupied = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const startX = col * tileSize;
      const startY = row * tileSize;
      const endX = Math.min(width, startX + tileSize);
      const endY = Math.min(height, startY + tileSize);
      let foreground = 0;
      let total = 0;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          total++;
          const offset = (y * width + x) * 4;
          if (isForeground(data, offset, backgroundTolerance)) foreground++;
        }
      }

      if (total > 0 && foreground / total >= tileOccupancyThreshold) {
        occupied[row * cols + col] = 1;
      }
    }
  }

  const visited = new Uint8Array(cols * rows);
  const pageArea = width * height;
  let best: { bounds: CropBounds; score: number } | null = null;
  const queue: number[] = [];

  for (let start = 0; start < occupied.length; start++) {
    if (!occupied[start] || visited[start]) continue;

    queue.length = 0;
    queue.push(start);
    visited[start] = 1;
    let minCol = cols;
    let minRow = rows;
    let maxCol = -1;
    let maxRow = -1;
    let tiles = 0;

    for (let q = 0; q < queue.length; q++) {
      const current = queue[q];
      const row = Math.floor(current / cols);
      const col = current % cols;
      tiles++;
      minCol = Math.min(minCol, col);
      minRow = Math.min(minRow, row);
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);

      const neighbours = [
        row > 0 ? current - cols : -1,
        row < rows - 1 ? current + cols : -1,
        col > 0 ? current - 1 : -1,
        col < cols - 1 ? current + 1 : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || visited[next] || !occupied[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    const bounds = expandBounds({
      x: minCol * tileSize,
      y: minRow * tileSize,
      width: Math.min(width, (maxCol + 1) * tileSize) - minCol * tileSize,
      height: Math.min(height, (maxRow + 1) * tileSize) - minRow * tileSize,
    }, width, height, margin);
    const areaRatio = (bounds.width * bounds.height) / pageArea;
    if (areaRatio < minAreaRatio || areaRatio > maxAreaRatio) continue;

    const score = bounds.width * bounds.height + tiles * tileSize * tileSize;
    if (!best || score > best.score) best = { bounds, score };
  }

  if (best) return best.bounds;

  const content = fullContentBounds(source, backgroundTolerance, margin);
  if (!content) return null;
  const contentRatio = (content.width * content.height) / pageArea;
  return contentRatio <= maxAreaRatio ? content : null;
}
