/**
 * Layout Optimizer for Video Wall Display
 *
 * Calculates the optimal grid layout (rows × cols) for displaying multiple video feeds
 * on a display, maximizing the total video area while maintaining aspect ratios.
 */

interface GridLayout {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  videoWidth: number;
  videoHeight: number;
  totalArea: number;
}

interface LayoutOptions {
  displayWidth: number;
  displayHeight: number;
  numClients: number;
  videoAspectRatio?: number; // Default 16:9
  minCellPadding?: number; // Padding between cells in pixels
}

/**
 * Calculates the optimal grid layout for displaying video feeds
 *
 * Algorithm:
 * 1. Try all possible grid configurations (rows × cols) that can fit numClients
 * 2. For each configuration:
 *    - Calculate cell dimensions (display divided by grid)
 *    - Calculate video dimensions that fit in cell while maintaining aspect ratio
 *    - Calculate total usable video area
 * 3. Return the configuration with maximum total video area
 *
 * @param options - Layout configuration options
 * @returns Optimal grid layout configuration
 */
export function calculateOptimalLayout(options: LayoutOptions): GridLayout {
  const {
    displayWidth,
    displayHeight,
    numClients,
    videoAspectRatio = 16 / 9,
    minCellPadding = 8,
  } = options;

  if (numClients <= 0) {
    return {
      rows: 0,
      cols: 0,
      cellWidth: 0,
      cellHeight: 0,
      videoWidth: 0,
      videoHeight: 0,
      totalArea: 0,
    };
  }

  let bestLayout: GridLayout | null = null;
  let maxArea = 0;

  // Try all possible grid configurations
  // For N clients, rows can be from 1 to N, and cols = ceil(N / rows)
  for (let rows = 1; rows <= numClients; rows++) {
    const cols = Math.ceil(numClients / rows);

    // Calculate cell dimensions (including padding)
    const cellWidth = displayWidth / cols;
    const cellHeight = displayHeight / rows;

    // Calculate usable dimensions (subtract padding)
    const usableWidth = cellWidth - minCellPadding * 2;
    const usableHeight = cellHeight - minCellPadding * 2;

    if (usableWidth <= 0 || usableHeight <= 0) {
      continue;
    }

    // Calculate video dimensions that fit in cell while maintaining aspect ratio
    let videoWidth: number;
    let videoHeight: number;

    const cellAspectRatio = usableWidth / usableHeight;

    if (cellAspectRatio > videoAspectRatio) {
      // Cell is wider than video aspect ratio - constrain by height
      videoHeight = usableHeight;
      videoWidth = videoHeight * videoAspectRatio;
    } else {
      // Cell is taller than video aspect ratio - constrain by width
      videoWidth = usableWidth;
      videoHeight = videoWidth / videoAspectRatio;
    }

    // Calculate total video area
    const totalArea = videoWidth * videoHeight * numClients;

    // Track best layout
    if (totalArea > maxArea) {
      maxArea = totalArea;
      bestLayout = {
        rows,
        cols,
        cellWidth,
        cellHeight,
        videoWidth,
        videoHeight,
        totalArea,
      };
    }
  }

  return (
    bestLayout || {
      rows: 1,
      cols: 1,
      cellWidth: displayWidth,
      cellHeight: displayHeight,
      videoWidth: displayWidth - minCellPadding * 2,
      videoHeight: displayHeight - minCellPadding * 2,
      totalArea: (displayWidth - minCellPadding * 2) * (displayHeight - minCellPadding * 2),
    }
  );
}

/**
 * Gets common grid configurations for specific client counts
 * This provides quick lookup for typical scenarios
 */
export function getCommonGridConfig(numClients: number): { rows: number; cols: number } {
  const configs: Record<number, { rows: number; cols: number }> = {
    1: { rows: 1, cols: 1 },
    2: { rows: 1, cols: 2 },
    3: { rows: 1, cols: 3 },
    4: { rows: 2, cols: 2 },
    5: { rows: 2, cols: 3 },
    6: { rows: 2, cols: 3 },
    7: { rows: 3, cols: 3 },
    8: { rows: 3, cols: 3 },
    9: { rows: 3, cols: 3 },
    10: { rows: 3, cols: 4 },
    12: { rows: 3, cols: 4 },
    15: { rows: 3, cols: 5 },
    16: { rows: 4, cols: 4 },
    20: { rows: 4, cols: 5 },
  };

  return (
    configs[numClients] || {
      rows: Math.ceil(Math.sqrt(numClients)),
      cols: Math.ceil(numClients / Math.ceil(Math.sqrt(numClients))),
    }
  );
}
