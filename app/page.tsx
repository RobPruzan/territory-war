"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const COLS = 20;
const ROWS = 12;

type Team = "left" | "right";
type PowerUpType = "split" | "giant" | "speed" | "freeze" | "magnet";

interface TeamColors {
  tile: string;
  ball: string;
  trailRgb: string;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  radius: number;
  baseRadius: number;
  trail: { x: number; y: number }[];
  frozen: number;
  giant: number;
  speed: number;
  isClone: boolean;
  cloneExpires: number;
}

interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: PowerUpType;
  spawnTime: number;
}

interface Tile {
  team: Team;
}

const TRAIL_LENGTH = 12;
const BASE_SPEED = 4;
const POWERUP_DURATION = 180; // frames (~3 seconds)
const POWERUP_SPAWN_INTERVAL = 300; // frames (~5 seconds)
const HIGHSCORE_DELAY = 600; // frames (~10 seconds) before tracking high scores

// Color palettes - each has a light and dark variant
const COLOR_PALETTES: { left: TeamColors; right: TeamColors }[] = [
  // White vs Forest Green
  {
    left: { tile: "#e8e8e8", ball: "#ffffff", trailRgb: "255, 255, 255" },
    right: { tile: "#1a3d2e", ball: "#3d8b6a", trailRgb: "61, 139, 106" },
  },
  // Coral vs Teal
  {
    left: { tile: "#4a1f1f", ball: "#e87070", trailRgb: "232, 112, 112" },
    right: { tile: "#1a3d3d", ball: "#4ecdc4", trailRgb: "78, 205, 196" },
  },
  // Purple vs Gold
  {
    left: { tile: "#2d1f4a", ball: "#9b7beb", trailRgb: "155, 123, 235" },
    right: { tile: "#3d3520", ball: "#f0c850", trailRgb: "240, 200, 80" },
  },
  // Blue vs Orange
  {
    left: { tile: "#1a2d4a", ball: "#5b9bd5", trailRgb: "91, 155, 213" },
    right: { tile: "#4a2d1a", ball: "#e8914f", trailRgb: "232, 145, 79" },
  },
  // Pink vs Mint
  {
    left: { tile: "#3d1f35", ball: "#e880b0", trailRgb: "232, 128, 176" },
    right: { tile: "#1f3d2d", ball: "#70e8a0", trailRgb: "112, 232, 160" },
  },
  // Crimson vs Slate
  {
    left: { tile: "#4a1a1a", ball: "#dc3545", trailRgb: "220, 53, 69" },
    right: { tile: "#2a2d35", ball: "#8895a7", trailRgb: "136, 149, 167" },
  },
];

function getRandomPalette() {
  return COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
}

const POWERUP_COLORS: Record<PowerUpType, string> = {
  split: "#f59e0b",
  giant: "#ec4899",
  speed: "#3b82f6",
  freeze: "#06b6d4",
  magnet: "#8b5cf6",
};

function createInitialTiles(): Tile[][] {
  const tiles: Tile[][] = [];
  for (let row = 0; row < ROWS; row++) {
    tiles[row] = [];
    for (let col = 0; col < COLS; col++) {
      tiles[row][col] = { team: col < COLS / 2 ? "left" : "right" };
    }
  }
  return tiles;
}

let ballIdCounter = 0;
let powerUpIdCounter = 0;

function createInitialBalls(tileWidth: number, tileHeight: number): Ball[] {
  const baseRadius = Math.min(tileWidth, tileHeight) * 0.4;

  return [
    {
      id: ballIdCounter++,
      x: COLS * 0.25 * tileWidth,
      y: (ROWS / 2) * tileHeight,
      vx: BASE_SPEED,
      vy: (Math.random() - 0.5) * 2,
      team: "left" as Team,
      radius: baseRadius,
      baseRadius,
      trail: [],
      frozen: 0,
      giant: 0,
      speed: 0,
      isClone: false,
      cloneExpires: 0,
    },
    {
      id: ballIdCounter++,
      x: COLS * 0.75 * tileWidth,
      y: (ROWS / 2) * tileHeight,
      vx: -BASE_SPEED,
      vy: (Math.random() - 0.5) * 2,
      team: "right" as Team,
      radius: baseRadius,
      baseRadius,
      trail: [],
      frozen: 0,
      giant: 0,
      speed: 0,
      isClone: false,
      cloneExpires: 0,
    },
  ];
}

function spawnPowerUp(width: number, height: number): PowerUp {
  const types: PowerUpType[] = ["split", "giant", "speed", "freeze", "magnet"];
  return {
    id: powerUpIdCounter++,
    x: Math.random() * (width - 60) + 30,
    y: Math.random() * (height - 60) + 30,
    type: types[Math.floor(Math.random() * types.length)],
    spawnTime: Date.now(),
  };
}

export default function TerritoryWar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tiles, setTiles] = useState<Tile[][]>(createInitialTiles);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, dpr: 1 });
  const [colors] = useState(() => getRandomPalette());
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const ballsRef = useRef<Ball[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const tilesRef = useRef<Tile[][]>(tiles);
  const animationRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const highScoresRef = useRef({ left: COLS * ROWS / 2, right: COLS * ROWS / 2 });

  const tileWidth = dimensions.width / COLS;
  const tileHeight = dimensions.height / ROWS;

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    const updateDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (tileWidth > 0 && tileHeight > 0 && ballsRef.current.length === 0) {
      ballsRef.current = createInitialBalls(tileWidth, tileHeight);
    }
  }, [tileWidth, tileHeight]);

  const countTiles = useCallback(() => {
    let left = 0;
    let right = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (tilesRef.current[row][col].team === "left") left++;
        else right++;
      }
    }
    return { left, right };
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameCountRef.current++;
    const dpr = dimensions.dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw tiles
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = tilesRef.current[row][col];
        const x = col * tileWidth;
        const y = row * tileHeight;
        const tileColors = colors[tile.team];

        ctx.fillStyle = tileColors.tile;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tileWidth) + 1, Math.ceil(tileHeight) + 1);
      }
    }

    // Spawn power-ups
    if (frameCountRef.current % POWERUP_SPAWN_INTERVAL === 0 && powerUpsRef.current.length < 3) {
      powerUpsRef.current.push(spawnPowerUp(dimensions.width, dimensions.height));
    }

    // Draw power-ups
    for (const powerUp of powerUpsRef.current) {
      const pulse = Math.sin(Date.now() / 200) * 0.2 + 1;
      const size = 14 * pulse;

      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, size + 4, 0, Math.PI * 2);
      ctx.fillStyle = `${POWERUP_COLORS[powerUp.type]}33`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, size, 0, Math.PI * 2);
      ctx.fillStyle = POWERUP_COLORS[powerUp.type];
      ctx.fill();
    }

    let hasChanges = false;
    const newTiles = tilesRef.current.map((row) => row.map((tile) => ({ ...tile })));
    const newBalls: Ball[] = [];

    // Process balls
    for (const ball of ballsRef.current) {
      // Handle clone expiration
      if (ball.isClone && ball.cloneExpires > 0) {
        ball.cloneExpires--;
        if (ball.cloneExpires <= 0) continue;
      }

      // Decrement effect timers
      if (ball.frozen > 0) ball.frozen--;
      if (ball.giant > 0) {
        ball.giant--;
        ball.radius = ball.giant > 0 ? ball.baseRadius * 2.5 : ball.baseRadius;
      }
      if (ball.speed > 0) ball.speed--;

      // Update trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > TRAIL_LENGTH) {
        ball.trail.shift();
      }

      // Skip movement if frozen
      if (ball.frozen > 0) {
        newBalls.push(ball);
        continue;
      }

      // Calculate speed multiplier (powerup + global slider)
      const speedMult = (ball.speed > 0 ? 2.5 : 1) * speedMultiplier;

      // Magnet effect - find enemy balls and pull towards their territory
      const enemyTeam = ball.team === "white" ? "green" : "white";
      let magnetPullX = 0;
      let magnetPullY = 0;

      for (const other of ballsRef.current) {
        if (other.team === enemyTeam && other.frozen <= 0) {
          // Check if other ball has magnet active (we check by position in enemy territory)
        }
      }

      // Apply magnet effect if ball has it
      const hasMagnet = ballsRef.current.some(b =>
        b.team !== ball.team &&
        powerUpsRef.current.some(p => p.type === "magnet")
      );

      ball.x += (ball.vx + magnetPullX) * speedMult;
      ball.y += (ball.vy + magnetPullY) * speedMult;

      // Boundary collision
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.radius > dimensions.width) {
        ball.x = dimensions.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }
      if (ball.y + ball.radius > dimensions.height) {
        ball.y = dimensions.height - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }

      // Power-up collision
      const powerUpsToRemove: number[] = [];
      for (const powerUp of powerUpsRef.current) {
        const dx = ball.x - powerUp.x;
        const dy = ball.y - powerUp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ball.radius + 14) {
          powerUpsToRemove.push(powerUp.id);

          switch (powerUp.type) {
            case "split": {
              // Create a clone ball
              const clone: Ball = {
                id: ballIdCounter++,
                x: ball.x,
                y: ball.y,
                vx: -ball.vy,
                vy: ball.vx,
                team: ball.team,
                radius: ball.baseRadius * 0.7,
                baseRadius: ball.baseRadius * 0.7,
                trail: [],
                frozen: 0,
                giant: 0,
                speed: 0,
                isClone: true,
                cloneExpires: POWERUP_DURATION * 2,
              };
              newBalls.push(clone);
              break;
            }
            case "giant":
              ball.giant = POWERUP_DURATION;
              ball.radius = ball.baseRadius * 2.5;
              break;
            case "speed":
              ball.speed = POWERUP_DURATION;
              break;
            case "freeze": {
              // Freeze enemy balls
              for (const other of ballsRef.current) {
                if (other.team !== ball.team) {
                  other.frozen = POWERUP_DURATION;
                }
              }
              break;
            }
            case "magnet": {
              // Push ball towards enemy territory
              const targetX = ball.team === "white" ? dimensions.width * 0.75 : dimensions.width * 0.25;
              const dx = targetX - ball.x;
              const dy = dimensions.height / 2 - ball.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                ball.vx = (dx / dist) * BASE_SPEED * 1.5;
                ball.vy = (dy / dist) * BASE_SPEED * 0.5;
              }
              break;
            }
          }
        }
      }

      powerUpsRef.current = powerUpsRef.current.filter(p => !powerUpsToRemove.includes(p.id));

      // Tile conversion
      const col = Math.floor(ball.x / tileWidth);
      const row = Math.floor(ball.y / tileHeight);

      // Convert multiple tiles if giant
      const convertRadius = ball.giant > 0 ? 2 : 1;
      for (let dr = -convertRadius + 1; dr < convertRadius; dr++) {
        for (let dc = -convertRadius + 1; dc < convertRadius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            const currentTile = newTiles[r][c];
            if (currentTile.team !== ball.team) {
              newTiles[r][c] = { team: ball.team };
              hasChanges = true;
            }
          }
        }
      }

      // Random direction change on conversion (only for center tile)
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        if (tilesRef.current[row][col].team !== ball.team) {
          const angle = Math.random() * Math.PI * 2;
          const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          ball.vx = Math.cos(angle) * currentSpeed;
          ball.vy = Math.sin(angle) * currentSpeed;
        }
      }

      newBalls.push(ball);
    }

    ballsRef.current = newBalls;

    // Get current counts for high score check
    const preCounts = countTiles();

    // Draw balls
    for (const ball of ballsRef.current) {
      const ballColors = colors[ball.team];

      // Check if this ball's team is at high score (only after delay)
      const isAtHighScore = frameCountRef.current > HIGHSCORE_DELAY && (ball.team === "left"
        ? preCounts.left >= highScoresRef.current.left
        : preCounts.right >= highScoresRef.current.right);

      // Rainbow colors for "pumped up" effect
      const rainbowColors = [
        "#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"
      ];

      // Draw trail
      for (let i = 0; i < ball.trail.length; i++) {
        const t = ball.trail[i];
        const alpha = (i / ball.trail.length) * 0.5;
        const size = ball.radius * (0.3 + (i / ball.trail.length) * 0.7);
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);

        if (isAtHighScore && !ball.isClone) {
          // Rainbow trail when at high score
          const colorIndex = (Math.floor(frameCountRef.current / 3) + i) % rainbowColors.length;
          ctx.fillStyle = rainbowColors[colorIndex] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        } else {
          ctx.fillStyle = `rgba(${ballColors.trailRgb}, ${alpha})`;
        }
        ctx.fill();
      }

      // Draw effect indicators
      if (ball.frozen > 0) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (ball.giant > 0) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (ball.speed > 0) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Rainbow glow when at high score
      if (isAtHighScore && !ball.isClone && ball.frozen <= 0) {
        const glowColorIndex = Math.floor(frameCountRef.current / 4) % rainbowColors.length;
        const pulse = Math.sin(frameCountRef.current / 8) * 0.3 + 1;

        // Outer glow
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * pulse + 8, 0, Math.PI * 2);
        ctx.fillStyle = rainbowColors[glowColorIndex] + "33";
        ctx.fill();

        // Inner glow
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * pulse + 4, 0, Math.PI * 2);
        ctx.fillStyle = rainbowColors[(glowColorIndex + 2) % rainbowColors.length] + "66";
        ctx.fill();
      }

      // Draw ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      if (ball.frozen > 0) {
        ctx.fillStyle = "#06b6d4";
      } else if (isAtHighScore && !ball.isClone) {
        // Cycling rainbow fill when at high score
        const ballColorIndex = Math.floor(frameCountRef.current / 5) % rainbowColors.length;
        ctx.fillStyle = rainbowColors[ballColorIndex];
      } else {
        ctx.fillStyle = ballColors.ball;
      }
      ctx.fill();

      // Clone indicator (slightly transparent)
      if (ball.isClone) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ballColors.ball;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (hasChanges) {
      tilesRef.current = newTiles;
      setTiles(newTiles);
    }

    // Draw score bar
    const counts = countTiles();
    const total = COLS * ROWS;

    // Update high scores (only after delay period)
    if (frameCountRef.current > HIGHSCORE_DELAY) {
      if (counts.left > highScoresRef.current.left) {
        highScoresRef.current.left = counts.left;
      }
      if (counts.right > highScoresRef.current.right) {
        highScoresRef.current.right = counts.right;
      }
    }

    const barWidth = 160;
    const barHeight = 6;
    const barX = dimensions.width / 2 - barWidth / 2;
    const barY = 20;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20, 4);
    ctx.fill();

    // Draw high score markers
    const leftHighX = barX + (highScoresRef.current.left / total) * barWidth;
    const rightHighX = barX + ((total - highScoresRef.current.right) / total) * barWidth;

    ctx.fillStyle = colors.right.tile;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    ctx.fillStyle = colors.left.tile;
    ctx.beginPath();
    ctx.roundRect(barX, barY, (counts.left / total) * barWidth, barHeight, 3);
    ctx.fill();

    // High score tick marks
    ctx.strokeStyle = colors.left.ball + "99";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftHighX, barY - 3);
    ctx.lineTo(leftHighX, barY + barHeight + 3);
    ctx.stroke();

    ctx.strokeStyle = colors.right.ball + "cc";
    ctx.beginPath();
    ctx.moveTo(rightHighX, barY - 3);
    ctx.lineTo(rightHighX, barY + barHeight + 3);
    ctx.stroke();

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [dimensions, tileWidth, tileHeight, countTiles, colors, speedMultiplier]);

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop, dimensions]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width * dimensions.dpr}
        height={dimensions.height * dimensions.dpr}
        style={{
          display: "block",
          width: dimensions.width,
          height: dimensions.height,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          background: "rgba(0, 0, 0, 0.5)",
          borderRadius: 6,
        }}
      >
        <span style={{ color: "#888", fontSize: 12 }}>0.5x</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={speedMultiplier}
          onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
          style={{
            width: 120,
            accentColor: "#666",
            cursor: "pointer",
          }}
        />
        <span style={{ color: "#888", fontSize: 12 }}>3x</span>
      </div>
    </div>
  );
}
