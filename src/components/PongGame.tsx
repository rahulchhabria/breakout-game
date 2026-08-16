import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { log } from '../utils/logger';
import {
  createGameSessionId,
  emitBrickBreakTelemetry,
  triggerGroupedDemoEvent,
  triggerSlowDemoSpan,
  triggerUniqueDemoIssue,
  triggerWarningDemoLog,
  type BrickBreakTelemetry,
} from '../sentry-demo';

interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  points: number;
  hits: number;
  maxHits: number;
  destroyed: boolean;
  powerType?: 'bonus' | 'trap' | null;
  powerEffect?: string | null;
  icon?: string | null;
  isBug: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'expand' | 'multiball' | 'slowball' | 'extralife';
  color: string;
  active: boolean;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  active: boolean;
  launched: boolean;
  trail: { x: number; y: number }[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface GameState {
  balls: Ball[];
  paddle: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bricks: Brick[];
  powerUps: PowerUp[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  score: number;
  lives: number;
  level: number;
  combo: number;
  bestCombo: number;
  isPlaying: boolean;
  isPaused: boolean;
  gameOver: boolean;
  gameWon: boolean;
  paddleExpanded: boolean;
  expandTimer: number;
  shrinkTimer: number;
  slowBallTimer: number;
  reverseTimer: number;
  shakeFrames: number;
  shakeIntensity: number;
  levelBannerFrames: number;
  pendingTelemetry: BrickBreakTelemetry[];
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 20;
const BALL_SIZE = 12;
const INITIAL_BALL_SPEED = 5;
const MAX_BALL_SPEED = 11;
const SPEED_PER_BRICK = 0.04;
const SPEED_PER_LEVEL = 0.6;
const BRICK_WIDTH = 75;
const BRICK_HEIGHT = 25;
const BRICK_PADDING = 5;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const PADDLE_SPEED = 9;
const MIN_DY_RATIO = 0.25; // ball will never travel flatter than this fraction of its speed
const COMBO_RESET_ON_PADDLE = true;
const LIFE_BONUS = 500;
const BUG_BRICK_INDICES = [4, 18, 37, 56, 73];

const BRICK_COLORS = [
  { color: '#ef4444', points: 70, hits: 1 },
  { color: '#f97316', points: 60, hits: 1 },
  { color: '#eab308', points: 50, hits: 1 },
  { color: '#22c55e', points: 40, hits: 1 },
  { color: '#3b82f6', points: 30, hits: 1 },
  { color: '#8b5cf6', points: 20, hits: 1 },
  { color: '#ec4899', points: 15, hits: 1 },
  { color: '#6b7280', points: 10, hits: 1 },
];

const BONUS_EFFECTS = [
  { effect: 'extra-life', icon: '⭐', label: 'Extra Life' },
  { effect: 'expand-paddle', icon: '⬆️', label: 'Expand Paddle' },
  { effect: 'multiball', icon: '💥', label: 'Multi-ball' },
  { effect: 'score-boost', icon: '💰', label: 'Score Boost' },
];
const TRAP_EFFECTS = [
  { effect: 'shrink-paddle', icon: '⬇️', label: 'Shrink Paddle' },
  { effect: 'reverse-controls', icon: '🔄', label: 'Reverse Controls' },
  { effect: 'lose-life', icon: '💔', label: 'Lose a Life' },
  { effect: 'speed-up', icon: '⚡', label: 'Speed Up Ball' },
];

const clampMinDy = (ball: Ball) => {
  const minDy = ball.speed * MIN_DY_RATIO;
  if (Math.abs(ball.dy) < minDy) {
    const sign = ball.dy === 0 ? -1 : Math.sign(ball.dy);
    const newDy = minDy * sign;
    const remaining = Math.sqrt(Math.max(0, ball.speed * ball.speed - newDy * newDy));
    ball.dx = remaining * (ball.dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(ball.dx));
    ball.dy = newDy;
  }
};

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysDownRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const mousePaddleXRef = useRef<number | null>(null);
  const gameSessionIdRef = useRef<string | null>(null);
  if (gameSessionIdRef.current === null) gameSessionIdRef.current = createGameSessionId();
  const emittedTelemetryIdsRef = useRef(new Set<string>());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [initials, setInitials] = useState('');
  const [showInitialsPrompt, setShowInitialsPrompt] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ initials: string; score: number }[]>([]);
  const [sentryTriggerStatus, setSentryTriggerStatus] = useState('');

  const getGameSessionId = () => {
    gameSessionIdRef.current ??= createGameSessionId();
    return gameSessionIdRef.current;
  };

  const createBricks = (level = 1): Brick[] => {
    const bricks: Brick[] = [];
    const startX = (CANVAS_WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
    const startY = 60;

    // Slightly more traps as you climb, but cap so it never feels unfair.
    const bonusChance = 0.1;
    const trapChance = Math.min(0.18, 0.08 + level * 0.015);

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const brickIndex = row * BRICK_COLS + col;
        const isBug = BUG_BRICK_INDICES.includes(brickIndex);
        const brickType = BRICK_COLORS[row] || BRICK_COLORS[BRICK_COLORS.length - 1];
        let powerType: 'bonus' | 'trap' | null = null;
        let powerEffect: string | null = null;
        let icon: string | null = null;
        const rand = Math.random();
        if (isBug) {
          icon = '🐛';
        } else if (rand < bonusChance) {
          powerType = 'bonus';
          const bonus = BONUS_EFFECTS[Math.floor(Math.random() * BONUS_EFFECTS.length)];
          powerEffect = bonus.effect;
          icon = bonus.icon;
        } else if (rand < bonusChance + trapChance) {
          powerType = 'trap';
          const trap = TRAP_EFFECTS[Math.floor(Math.random() * TRAP_EFFECTS.length)];
          powerEffect = trap.effect;
          icon = trap.icon;
        }
        bricks.push({
          id: `level-${level}-brick-${row}-${col}`,
          x: startX + col * (BRICK_WIDTH + BRICK_PADDING),
          y: startY + row * (BRICK_HEIGHT + BRICK_PADDING),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          color: brickType.color,
          points: brickType.points,
          hits: 0,
          maxHits: brickType.hits,
          destroyed: false,
          powerType,
          powerEffect,
          icon,
          isBug,
        });
      }
    }
    return bricks;
  };

  const buildInitialBall = (speed = INITIAL_BALL_SPEED): Ball => ({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 60,
    dx: 0,
    dy: 0,
    speed,
    active: true,
    launched: false,
    trail: [],
  });

  const [gameState, setGameState] = useState<GameState>({
    balls: [buildInitialBall()],
    paddle: {
      x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    },
    bricks: createBricks(),
    powerUps: [],
    particles: [],
    floatingTexts: [],
    score: 0,
    lives: 3,
    level: 1,
    combo: 0,
    bestCombo: 0,
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    gameWon: false,
    paddleExpanded: false,
    expandTimer: 0,
    shrinkTimer: 0,
    slowBallTimer: 0,
    reverseTimer: 0,
    shakeFrames: 0,
    shakeIntensity: 0,
    levelBannerFrames: 0,
    pendingTelemetry: [],
  });

  useEffect(() => {
    if (gameState.pendingTelemetry.length === 0) return;

    const telemetryIds = new Set(gameState.pendingTelemetry.map(event => event.id));
    gameState.pendingTelemetry.forEach(event => {
      if (emittedTelemetryIdsRef.current.has(event.id)) return;
      emittedTelemetryIdsRef.current.add(event.id);
      emitBrickBreakTelemetry(event);
    });

    setGameState(prev => ({
      ...prev,
      pendingTelemetry: prev.pendingTelemetry.filter(event => !telemetryIds.has(event.id)),
    }));
  }, [gameState.pendingTelemetry]);

  const playSound = useCallback((frequency: number, duration: number = 100) => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new Ctx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch {
      // Silently fail if audio context is not available
    }
  }, [soundEnabled]);

  const createPowerUp = (x: number, y: number): PowerUp => {
    const types: PowerUp['type'][] = ['expand', 'multiball', 'slowball', 'extralife'];
    const colors = ['#fbbf24', '#10b981', '#3b82f6', '#ef4444'];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      x,
      y,
      type,
      color: colors[types.indexOf(type)],
      active: true,
    };
  };

  const spawnParticles = (state: GameState, x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      const life = 20 + Math.floor(Math.random() * 15);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // slight upward bias
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 2,
      });
    }
    // Hard cap so a long combo doesn't tank perf.
    if (state.particles.length > 250) {
      state.particles.splice(0, state.particles.length - 250);
    }
  };

  const spawnFloatingText = (state: GameState, x: number, y: number, text: string, color: string) => {
    state.floatingTexts.push({ x, y, text, life: 45, color });
    if (state.floatingTexts.length > 30) state.floatingTexts.shift();
  };

  const triggerShake = (state: GameState, intensity: number, frames: number) => {
    if (intensity > state.shakeIntensity) {
      state.shakeIntensity = intensity;
      state.shakeFrames = frames;
    }
  };

  const launchAllStuckBalls = () => {
    setGameState(prev => {
      if (!prev.isPlaying || prev.isPaused) return prev;
      let changed = false;
      const balls = prev.balls.map(ball => {
        if (ball.active && !ball.launched) {
          changed = true;
          const angle = (Math.random() - 0.5) * Math.PI / 4; // -22.5°..+22.5°
          return {
            ...ball,
            launched: true,
            dx: ball.speed * Math.sin(angle),
            dy: -ball.speed * Math.cos(angle),
          };
        }
        return ball;
      });
      return changed ? { ...prev, balls } : prev;
    });
  };

  const startGame = () => {
    log.info('Game started', { lives: gameState.lives, level: gameState.level });
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      gameOver: false,
      gameWon: false,
    }));
  };

  const pauseGame = () => {
    const newPauseState = !gameState.isPaused;
    log.debug('Game pause state changed', {
      isPaused: newPauseState,
      score: gameState.score,
      lives: gameState.lives,
    });
    setGameState(prev => ({ ...prev, isPaused: newPauseState }));
  };

  const resetGame = () => {
    log.info('Game reset', { finalScore: gameState.score });
    gameSessionIdRef.current = createGameSessionId();
    emittedTelemetryIdsRef.current.clear();
    setGameState({
      balls: [buildInitialBall()],
      paddle: {
        x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        y: CANVAS_HEIGHT - 40,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
      },
      bricks: createBricks(1),
      powerUps: [],
      particles: [],
      floatingTexts: [],
      score: 0,
      lives: 3,
      level: 1,
      combo: 0,
      bestCombo: 0,
      isPlaying: false,
      isPaused: false,
      gameOver: false,
      gameWon: false,
      paddleExpanded: false,
      expandTimer: 0,
      shrinkTimer: 0,
      slowBallTimer: 0,
      reverseTimer: 0,
      shakeFrames: 0,
      shakeIntensity: 0,
      levelBannerFrames: 0,
      pendingTelemetry: [],
    });
  };

  const applyBonusEffect = (state: GameState, effect: string | null | undefined, brickX: number, brickY: number) => {
    switch (effect) {
      case 'extra-life':
        state.lives += 1;
        spawnFloatingText(state, brickX, brickY, '+1 LIFE', '#34d399');
        break;
      case 'expand-paddle':
        state.paddleExpanded = true;
        state.expandTimer = 600;
        state.shrinkTimer = 0;
        state.paddle.width = PADDLE_WIDTH * 1.5;
        spawnFloatingText(state, brickX, brickY, 'EXPAND', '#34d399');
        break;
      case 'multiball': {
        if (state.balls.length < 6) {
          const seed = state.balls.find(b => b.launched) || state.balls[0];
          const spawnAngles = [Math.PI / 8, -Math.PI / 8];
          spawnAngles.forEach(angle => {
            state.balls.push({
              x: seed.x,
              y: seed.y,
              dx: seed.speed * Math.sin(angle),
              dy: -seed.speed * Math.cos(angle),
              speed: seed.speed,
              active: true,
              launched: true,
              trail: [],
            });
          });
        }
        spawnFloatingText(state, brickX, brickY, 'MULTI-BALL', '#34d399');
        break;
      }
      case 'score-boost':
        state.score += 500;
        spawnFloatingText(state, brickX, brickY, '+500', '#fbbf24');
        break;
    }
  };

  const applyTrapEffect = (state: GameState, effect: string | null | undefined, brickX: number, brickY: number) => {
    switch (effect) {
      case 'shrink-paddle':
        state.paddleExpanded = false;
        state.expandTimer = 0;
        state.shrinkTimer = 480;
        state.paddle.width = PADDLE_WIDTH * 0.7;
        spawnFloatingText(state, brickX, brickY, 'SHRINK', '#f87171');
        break;
      case 'reverse-controls':
        state.reverseTimer = 360;
        spawnFloatingText(state, brickX, brickY, 'REVERSED', '#f87171');
        break;
      case 'lose-life':
        if (state.lives > 1) {
          state.lives -= 1;
          spawnFloatingText(state, brickX, brickY, '-1 LIFE', '#f87171');
          triggerShake(state, 10, 12);
        } else {
          // Don't end the game from a brick trap — convert to a different penalty.
          state.score = Math.max(0, state.score - 200);
          spawnFloatingText(state, brickX, brickY, '-200', '#f87171');
        }
        break;
      case 'speed-up':
        state.balls.forEach(ball => {
          if (!ball.launched) return;
          const newSpeed = Math.min(MAX_BALL_SPEED, ball.speed * 1.25);
          const scale = newSpeed / Math.max(0.01, ball.speed);
          ball.dx *= scale;
          ball.dy *= scale;
          ball.speed = newSpeed;
        });
        spawnFloatingText(state, brickX, brickY, 'SPEED UP', '#f87171');
        break;
    }
  };

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (!prev.isPlaying || prev.isPaused || prev.gameOver || prev.gameWon) return prev;

      const newState = { ...prev };
      newState.paddle = { ...prev.paddle };
      newState.balls = prev.balls.map(b => ({ ...b, trail: b.trail.slice() }));
      newState.bricks = prev.bricks.map(br => ({ ...br }));
      newState.powerUps = prev.powerUps.map(p => ({ ...p }));
      newState.particles = prev.particles.map(p => ({ ...p }));
      newState.floatingTexts = prev.floatingTexts.map(t => ({ ...t }));
      newState.pendingTelemetry = prev.pendingTelemetry;

      // Keyboard paddle movement (in-loop so it works during pauses-of-input)
      const reversed = newState.reverseTimer > 0;
      let dir = 0;
      if (keysDownRef.current.left) dir -= 1;
      if (keysDownRef.current.right) dir += 1;
      if (reversed) dir *= -1;
      if (dir !== 0) {
        newState.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - newState.paddle.width, newState.paddle.x + dir * PADDLE_SPEED));
        mousePaddleXRef.current = null; // keyboard takes over from mouse
      } else if (mousePaddleXRef.current !== null) {
        const target = reversed
          ? CANVAS_WIDTH - mousePaddleXRef.current - newState.paddle.width
          : mousePaddleXRef.current;
        newState.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - newState.paddle.width, target));
      }

      // Power-up timers
      if (newState.expandTimer > 0) {
        newState.expandTimer -= 1;
        if (newState.expandTimer <= 0) {
          newState.paddleExpanded = false;
          newState.paddle.width = PADDLE_WIDTH;
        }
      }
      if (newState.shrinkTimer > 0) {
        newState.shrinkTimer -= 1;
        if (newState.shrinkTimer <= 0) {
          newState.paddle.width = PADDLE_WIDTH;
        }
      }
      if (newState.slowBallTimer > 0) newState.slowBallTimer -= 1;
      if (newState.reverseTimer > 0) newState.reverseTimer -= 1;
      if (newState.shakeFrames > 0) {
        newState.shakeFrames -= 1;
        if (newState.shakeFrames <= 0) newState.shakeIntensity = 0;
      }
      if (newState.levelBannerFrames > 0) newState.levelBannerFrames -= 1;

      // Ball physics
      const speedMultiplier = newState.slowBallTimer > 0 ? 0.6 : 1;
      newState.balls.forEach(ball => {
        if (!ball.active) return;

        // If not launched yet, glue to paddle center.
        if (!ball.launched) {
          ball.x = newState.paddle.x + newState.paddle.width / 2;
          ball.y = newState.paddle.y - BALL_SIZE / 2 - 2;
          ball.trail.length = 0;
          return;
        }

        // Trail update
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 10) ball.trail.shift();

        ball.x += ball.dx * speedMultiplier;
        ball.y += ball.dy * speedMultiplier;

        // Wall bounces
        if (ball.x <= BALL_SIZE / 2) {
          ball.x = BALL_SIZE / 2;
          ball.dx = Math.abs(ball.dx);
          playSound(220, 60);
        } else if (ball.x >= CANVAS_WIDTH - BALL_SIZE / 2) {
          ball.x = CANVAS_WIDTH - BALL_SIZE / 2;
          ball.dx = -Math.abs(ball.dx);
          playSound(220, 60);
        }
        if (ball.y <= BALL_SIZE / 2) {
          ball.y = BALL_SIZE / 2;
          ball.dy = Math.abs(ball.dy);
          playSound(220, 60);
        }

        // Paddle collision
        if (
          ball.dy > 0 &&
          ball.y + BALL_SIZE / 2 >= newState.paddle.y &&
          ball.y - BALL_SIZE / 2 <= newState.paddle.y + newState.paddle.height &&
          ball.x >= newState.paddle.x &&
          ball.x <= newState.paddle.x + newState.paddle.width
        ) {
          const hitPos = (ball.x - newState.paddle.x) / newState.paddle.width;
          const angle = (hitPos - 0.5) * (Math.PI * 0.7); // up to ~63° off-vertical
          ball.dx = ball.speed * Math.sin(angle);
          ball.dy = -ball.speed * Math.cos(angle);
          ball.y = newState.paddle.y - BALL_SIZE / 2 - 1;
          clampMinDy(ball);
          playSound(330, 80);
          if (COMBO_RESET_ON_PADDLE && newState.combo > 0) {
            newState.combo = 0;
          }
        }

        // Brick collision (only handle first hit per frame to avoid double-bounce stuck states)
        for (const brick of newState.bricks) {
          if (brick.destroyed) continue;
          if (
            ball.x + BALL_SIZE / 2 >= brick.x &&
            ball.x - BALL_SIZE / 2 <= brick.x + brick.width &&
            ball.y + BALL_SIZE / 2 >= brick.y &&
            ball.y - BALL_SIZE / 2 <= brick.y + brick.height
          ) {
            const ballCenterX = ball.x;
            const ballCenterY = ball.y;
            const brickCenterX = brick.x + brick.width / 2;
            const brickCenterY = brick.y + brick.height / 2;
            const deltaX = ballCenterX - brickCenterX;
            const deltaY = ballCenterY - brickCenterY;

            if (Math.abs(deltaX / brick.width) > Math.abs(deltaY / brick.height)) {
              ball.dx = deltaX > 0 ? Math.abs(ball.dx) : -Math.abs(ball.dx);
            } else {
              ball.dy = deltaY > 0 ? Math.abs(ball.dy) : -Math.abs(ball.dy);
            }
            clampMinDy(ball);

            brick.hits += 1;

            if (brick.hits >= brick.maxHits) {
              brick.destroyed = true;

              // Combo + multiplier
              newState.combo += 1;
              if (newState.combo > newState.bestCombo) newState.bestCombo = newState.combo;
              const multiplier = 1 + Math.floor((newState.combo - 1) / 4); // x1 at 1-4, x2 at 5-8, ...
              const gained = brick.points * multiplier;
              newState.score += gained;

              if (multiplier > 1) {
                spawnFloatingText(
                  newState,
                  brick.x + brick.width / 2,
                  brick.y + brick.height / 2,
                  `+${gained} x${multiplier}`,
                  '#fbbf24'
                );
              }

              spawnParticles(newState, brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 8);
              triggerShake(newState, 3, 4);
              playSound(440 + Math.min(800, newState.combo * 12), 110);

              // Speed up the ball slightly per brick (capped)
              const newSpeed = Math.min(MAX_BALL_SPEED, ball.speed + SPEED_PER_BRICK);
              if (newSpeed !== ball.speed) {
                const scale = newSpeed / ball.speed;
                ball.dx *= scale;
                ball.dy *= scale;
                ball.speed = newSpeed;
              }

              const gameSessionId = getGameSessionId();
              const telemetryId = `${gameSessionId}:${brick.id}`;
              newState.pendingTelemetry = [
                ...newState.pendingTelemetry,
                {
                  id: telemetryId,
                  brickId: brick.id,
                  gameSessionId,
                  level: newState.level,
                  score: newState.score,
                  combo: newState.combo,
                  color: brick.color,
                  points: brick.points,
                  x: brick.x,
                  y: brick.y,
                  isBugBrick: brick.isBug,
                },
              ];

              // Apply bonus/trap effects
              if (brick.powerType === 'bonus') {
                applyBonusEffect(newState, brick.powerEffect, brick.x + brick.width / 2, brick.y + brick.height / 2);
              } else if (brick.powerType === 'trap') {
                applyTrapEffect(newState, brick.powerEffect, brick.x + brick.width / 2, brick.y + brick.height / 2);
              }

              // Drop a falling power-up sometimes (independent of bonus bricks)
              if (Math.random() < 0.12) {
                newState.powerUps.push(createPowerUp(brick.x + brick.width / 2, brick.y + brick.height));
              }
            } else {
              playSound(330, 80);
            }
            break; // resolve one brick per frame per ball
          }
        }

        // Off-screen
        if (ball.y > CANVAS_HEIGHT) {
          ball.active = false;
        }
      });

      // Compact balls
      newState.balls = newState.balls.filter(b => b.active);

      // Life loss
      if (newState.balls.length === 0) {
        newState.lives -= 1;
        newState.combo = 0;
        triggerShake(newState, 14, 18);
        log.warn('Life lost', { remainingLives: newState.lives, score: newState.score });

        if (newState.lives <= 0) {
          const bricksDestroyed = newState.bricks.filter(b => b.destroyed).length;
          log.info('Game over', {
            finalScore: newState.score,
            bricksDestroyed,
            totalBricks: newState.bricks.length,
          });
          newState.gameOver = true;
          newState.isPlaying = false;
        } else {
          newState.balls.push(buildInitialBall(INITIAL_BALL_SPEED + (newState.level - 1) * SPEED_PER_LEVEL));
        }
      }

      // Update power-ups
      newState.powerUps = newState.powerUps.filter(powerUp => {
        if (!powerUp.active) return false;
        powerUp.y += 2.2;

        if (
          powerUp.y + 10 >= newState.paddle.y &&
          powerUp.y <= newState.paddle.y + newState.paddle.height &&
          powerUp.x + 10 >= newState.paddle.x &&
          powerUp.x - 10 <= newState.paddle.x + newState.paddle.width
        ) {
          log.info('Power-up collected', { type: powerUp.type });
          playSound(550, 200);

          switch (powerUp.type) {
            case 'expand':
              newState.paddleExpanded = true;
              newState.expandTimer = 600;
              newState.shrinkTimer = 0;
              newState.paddle.width = PADDLE_WIDTH * 1.5;
              spawnFloatingText(newState, powerUp.x, powerUp.y, 'EXPAND', '#34d399');
              break;
            case 'multiball':
              if (newState.balls.length < 6) {
                const seed = newState.balls.find(b => b.launched) || newState.balls[0];
                const spawnAngles = [Math.PI / 8, -Math.PI / 8];
                spawnAngles.forEach(angle => {
                  newState.balls.push({
                    x: seed.x,
                    y: seed.y,
                    dx: seed.speed * Math.sin(angle),
                    dy: -seed.speed * Math.cos(angle),
                    speed: seed.speed,
                    active: true,
                    launched: true,
                    trail: [],
                  });
                });
              }
              spawnFloatingText(newState, powerUp.x, powerUp.y, 'MULTI-BALL', '#34d399');
              break;
            case 'slowball':
              newState.slowBallTimer = 600;
              spawnFloatingText(newState, powerUp.x, powerUp.y, 'SLOW BALL', '#60a5fa');
              break;
            case 'extralife':
              newState.lives += 1;
              spawnFloatingText(newState, powerUp.x, powerUp.y, '+1 LIFE', '#34d399');
              break;
          }
          powerUp.active = false;
          return false;
        }

        if (powerUp.y > CANVAS_HEIGHT) {
          powerUp.active = false;
          return false;
        }
        return true;
      });

      // Particles
      newState.particles = newState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.life -= 1;
        return p.life > 0;
      });

      // Floating texts
      newState.floatingTexts = newState.floatingTexts.filter(t => {
        t.y -= 0.6;
        t.life -= 1;
        return t.life > 0;
      });

      // Level cleared?
      const remainingBricks = newState.bricks.filter(brick => !brick.destroyed);
      if (remainingBricks.length === 0) {
        const lifeBonus = newState.lives * LIFE_BONUS;
        newState.score += lifeBonus;
        log.info('Level cleared', {
          score: newState.score,
          lives: newState.lives,
          level: newState.level,
          lifeBonus,
        });
        if (newState.level >= 5) {
          // Final clear → victory screen
          newState.gameWon = true;
          newState.isPlaying = false;
          playSound(660, 500);
        } else {
          // Advance to next level
          newState.level += 1;
          newState.bricks = createBricks(newState.level);
          newState.powerUps = [];
          newState.combo = 0;
          newState.levelBannerFrames = 120;
          const baseSpeed = INITIAL_BALL_SPEED + (newState.level - 1) * SPEED_PER_LEVEL;
          newState.balls = [{
            ...buildInitialBall(baseSpeed),
            x: newState.paddle.x + newState.paddle.width / 2,
            y: newState.paddle.y - BALL_SIZE / 2 - 2,
          }];
          newState.paddleExpanded = false;
          newState.expandTimer = 0;
          newState.shrinkTimer = 0;
          newState.slowBallTimer = 0;
          newState.reverseTimer = 0;
          newState.paddle.width = PADDLE_WIDTH;
          spawnFloatingText(newState, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, `+${lifeBonus} LIFE BONUS`, '#fbbf24');
        }
      }

      return newState;
    });
    // applyBonusEffect/applyTrapEffect are pure helpers that take state as an argument; no need to track them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSound]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f0f23');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Apply screen shake to gameplay layer
    const shakeX = gameState.shakeFrames > 0 ? (Math.random() - 0.5) * gameState.shakeIntensity : 0;
    const shakeY = gameState.shakeFrames > 0 ? (Math.random() - 0.5) * gameState.shakeIntensity : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Border
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
    ctx.setLineDash([]);

    if (gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
      // Bricks
      gameState.bricks.forEach(brick => {
        if (brick.destroyed) return;
        const alpha = 1 - (brick.hits / brick.maxHits) * 0.4;
        ctx.globalAlpha = alpha;

        let brickColor = brick.color;
        if (brick.isBug) brickColor = '#22d3ee';
        else if (brick.powerType === 'bonus') brickColor = '#facc15';
        else if (brick.powerType === 'trap') brickColor = '#ef4444';

        const brickGradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
        brickGradient.addColorStop(0, brickColor);
        brickGradient.addColorStop(1, brickColor + '80');

        ctx.fillStyle = brickGradient;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.strokeStyle = brickColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);

        if (brick.icon) {
          ctx.globalAlpha = 1;
          ctx.font = '18px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = brick.powerType === 'bonus' ? '#fffde4' : '#ffe4e4';
          ctx.fillText(brick.icon, brick.x + brick.width / 2, brick.y + brick.height / 2);
        }
        ctx.globalAlpha = 1;
      });

      // Power-ups
      gameState.powerUps.forEach(powerUp => {
        if (!powerUp.active) return;
        ctx.fillStyle = powerUp.color;
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const symbol = powerUp.type === 'expand' ? '↔'
          : powerUp.type === 'multiball' ? '●'
          : powerUp.type === 'slowball' ? '⏱' : '♥';
        ctx.fillText(symbol, powerUp.x, powerUp.y);
      });

      // Ball trails
      gameState.balls.forEach(ball => {
        if (!ball.active) return;
        ball.trail.forEach((p, i) => {
          const t = (i + 1) / ball.trail.length;
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.arc(p.x, p.y, (BALL_SIZE / 2) * (0.4 + t * 0.6), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      });

      // Balls
      gameState.balls.forEach(ball => {
        if (!ball.active) return;
        const ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE);
        ballGradient.addColorStop(0, '#ffffff');
        ballGradient.addColorStop(0.7, '#60a5fa');
        ballGradient.addColorStop(1, '#3b82f6');
        ctx.fillStyle = ballGradient;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Paddle
      const paddleGradient = ctx.createLinearGradient(
        gameState.paddle.x, gameState.paddle.y,
        gameState.paddle.x, gameState.paddle.y + gameState.paddle.height
      );
      if (gameState.shrinkTimer > 0) {
        paddleGradient.addColorStop(0, '#f87171');
        paddleGradient.addColorStop(1, '#dc2626');
        ctx.shadowColor = '#f87171';
      } else if (gameState.paddleExpanded) {
        paddleGradient.addColorStop(0, '#10b981');
        paddleGradient.addColorStop(1, '#059669');
        ctx.shadowColor = '#10b981';
      } else {
        paddleGradient.addColorStop(0, '#fbbf24');
        paddleGradient.addColorStop(1, '#f59e0b');
        ctx.shadowColor = '#fbbf24';
      }
      ctx.fillStyle = paddleGradient;
      ctx.shadowBlur = 12;
      ctx.fillRect(gameState.paddle.x, gameState.paddle.y, gameState.paddle.width, gameState.paddle.height);
      ctx.shadowBlur = 0;

      // Particles
      gameState.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      });
      ctx.globalAlpha = 1;

      // Floating texts
      gameState.floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.max(0, Math.min(1, t.life / 30));
        ctx.fillStyle = t.color;
        ctx.font = 'bold 16px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.text, t.x, t.y);
      });
      ctx.globalAlpha = 1;

      // "Launch" hint
      const unlaunched = gameState.balls.find(b => !b.launched);
      if (unlaunched) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#e0e7ff';
        ctx.font = 'bold 18px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Click or press Space to launch', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.globalAlpha = 1;
      }

      // Level banner
      if (gameState.levelBannerFrames > 0) {
        const t = gameState.levelBannerFrames / 120;
        ctx.globalAlpha = Math.min(1, t * 1.4);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 56px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LEVEL ${gameState.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.globalAlpha = 1;
      }

      // Reversed-controls warning band
      if (gameState.reverseTimer > 0) {
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(gameState.reverseTimer / 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }, [gameState]);

  // Mouse paddle control — store the desired paddle X in a ref so the loop applies it,
  // which means the paddle no longer freezes when the mouse leaves the canvas mid-move.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const w = gameState.paddleExpanded ? PADDLE_WIDTH * 1.5 : (gameState.shrinkTimer > 0 ? PADDLE_WIDTH * 0.7 : PADDLE_WIDTH);
      mousePaddleXRef.current = mouseX - w / 2;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [gameState.paddleExpanded, gameState.shrinkTimer]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysDownRef.current.left = true;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysDownRef.current.right = true;
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const hasUnlaunched = gameState.balls.some(b => !b.launched && b.active);
        if (gameState.isPlaying && hasUnlaunched && !gameState.isPaused) {
          launchAllStuckBalls();
        } else if (gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
          pauseGame();
        } else if (!gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
          startGame();
        }
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
          pauseGame();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        resetGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysDownRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysDownRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // We deliberately read fresh state inside the handlers via closure; rebinding per relevant state change is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isPlaying, gameState.isPaused, gameState.gameOver, gameState.gameWon, gameState.balls]);

  // Click on canvas: launch stuck balls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClick = () => launchAllStuckBalls();
    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!gameState.isPlaying) return;
    const gameLoop = () => {
      updateGame();
      render();
      animationRef.current = requestAnimationFrame(gameLoop);
    };
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState.isPlaying, updateGame, render]);

  // Render once even when not playing (so the start/pause overlay sits over a real background)
  useEffect(() => {
    if (!gameState.isPlaying) render();
  }, [gameState.isPlaying, render]);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleTouch = (e: TouchEvent) => {
      if (!gameState.isPlaying || gameState.isPaused || gameState.gameOver || gameState.gameWon) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const touchX = (touch.clientX - rect.left) * scaleX;
      const w = gameState.paddleExpanded ? PADDLE_WIDTH * 1.5 : (gameState.shrinkTimer > 0 ? PADDLE_WIDTH * 0.7 : PADDLE_WIDTH);
      mousePaddleXRef.current = touchX - w / 2;
      e.preventDefault();
    };
    const handleTouchEnd = () => launchAllStuckBalls();
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState.isPlaying, gameState.isPaused, gameState.gameOver, gameState.gameWon, gameState.paddleExpanded, gameState.shrinkTimer]);

  // Load leaderboard
  useEffect(() => {
    const stored = localStorage.getItem('breakout-leaderboard');
    if (stored) setLeaderboard(JSON.parse(stored));
  }, []);

  // Show initials prompt after game over or victory
  useEffect(() => {
    if ((gameState.gameOver || gameState.gameWon) && gameState.score > 0) {
      setShowInitialsPrompt(true);
    }
  }, [gameState.gameOver, gameState.gameWon, gameState.score]);

  const saveToLeaderboard = () => {
    if (!initials.trim()) return;
    const entry = { initials: initials.trim().toUpperCase().slice(0, 3), score: gameState.score };
    const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem('breakout-leaderboard', JSON.stringify(updated));
    setShowInitialsPrompt(false);
    setInitials('');
  };

  const generateUniqueIssue = () => {
    const triggerId = triggerUniqueDemoIssue();
    setSentryTriggerStatus(`Created unique issue ${triggerId.slice(0, 8)}`);
  };

  const generateGroupedEvent = () => {
    triggerGroupedDemoEvent();
    setSentryTriggerStatus('Sent event to the shared demo issue');
  };

  const generateSlowSpan = async () => {
    setSentryTriggerStatus('Running 500ms demo span…');
    await triggerSlowDemoSpan();
    setSentryTriggerStatus('Completed 500ms demo span');
  };

  const generateWarningLog = () => {
    triggerWarningDemoLog();
    setSentryTriggerStatus('Sent warning log');
  };

  const remainingBricks = gameState.bricks.filter(brick => !brick.destroyed).length;
  const livesDisplay = gameState.lives <= 5
    ? '❤️'.repeat(gameState.lives)
    : `❤️ × ${gameState.lives}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 min-w-0">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full max-w-[900px] mx-auto">
        <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-2 sm:p-6 shadow-2xl border border-purple-500/20 w-full sm:w-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="text-white">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                BREAKOUT
              </h1>
              <p className="text-sm text-gray-400">Destroy all the bricks!</p>
            </div>

            <div className="flex items-center gap-4 text-white">
              <div className="text-right">
                <div className="text-xs text-gray-400">Score</div>
                <div className="text-xl font-bold text-blue-400">{gameState.score}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Level</div>
                <div className="text-xl font-bold text-yellow-300">{gameState.level}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Combo</div>
                <div className="text-xl font-bold text-pink-300">
                  {gameState.combo > 0 ? `×${1 + Math.floor((gameState.combo - 1) / 4)}` : '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Bricks</div>
                <div className="text-xl font-bold text-purple-400">{remainingBricks}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Lives</div>
                <div className="text-xl font-bold text-red-400 whitespace-nowrap">{livesDisplay}</div>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          {(gameState.paddleExpanded || gameState.slowBallTimer > 0 || gameState.shrinkTimer > 0 || gameState.reverseTimer > 0) && (
            <div className="flex gap-2 mb-4 justify-center flex-wrap">
              {gameState.paddleExpanded && (
                <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                  Expanded ({Math.ceil(gameState.expandTimer / 60)}s)
                </div>
              )}
              {gameState.shrinkTimer > 0 && (
                <div className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">
                  Shrunk ({Math.ceil(gameState.shrinkTimer / 60)}s)
                </div>
              )}
              {gameState.slowBallTimer > 0 && (
                <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  Slow Ball ({Math.ceil(gameState.slowBallTimer / 60)}s)
                </div>
              )}
              {gameState.reverseTimer > 0 && (
                <div className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">
                  Reversed ({Math.ceil(gameState.reverseTimer / 60)}s)
                </div>
              )}
            </div>
          )}

          {/* Canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{ width: '100%', maxWidth: 800, height: 'auto', aspectRatio: '4/3', touchAction: 'none' }}
              className="border-2 border-purple-500/30 rounded-lg shadow-2xl select-none cursor-none"
              tabIndex={0}
            />

            {showInitialsPrompt && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-20">
                <div className="text-center text-white">
                  <h2 className="text-2xl font-bold mb-4">Enter Your Initials</h2>
                  <input
                    type="text"
                    maxLength={3}
                    value={initials}
                    onChange={e => setInitials(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                    className="text-black text-2xl px-4 py-2 rounded mb-4 w-24 text-center"
                    autoFocus
                  />
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={saveToLeaderboard}
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-6 py-2 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                      disabled={!initials.trim()}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowInitialsPrompt(false); setInitials(''); }}
                      className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gameState.gameOver && !showInitialsPrompt && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    Game Over
                  </h2>
                  <p className="text-xl mb-2">Final Score: <span className="text-blue-400 font-bold">{gameState.score}</span></p>
                  <p className="text-lg mb-1">Reached Level <span className="text-yellow-300 font-bold">{gameState.level}</span></p>
                  <p className="text-lg mb-6">Best Combo: <span className="text-pink-300 font-bold">×{1 + Math.floor(Math.max(0, gameState.bestCombo - 1) / 4)}</span> ({gameState.bestCombo} bricks)</p>
                  <button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}

            {gameState.gameWon && !showInitialsPrompt && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-green-400 bg-clip-text text-transparent">
                    Victory!
                  </h2>
                  <p className="text-xl mb-2">Final Score: <span className="text-blue-400 font-bold">{gameState.score}</span></p>
                  <p className="text-lg mb-1">Cleared <span className="text-yellow-300 font-bold">{gameState.level}</span> levels</p>
                  <p className="text-lg mb-6">Best Combo: <span className="text-pink-300 font-bold">{gameState.bestCombo} bricks</span></p>
                  <button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}

            {!gameState.isPlaying && !gameState.gameOver && !gameState.gameWon && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white px-4">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Ready to Break Out?
                  </h2>
                  <p className="text-lg mb-2 text-gray-300">Mouse, arrow keys, or A/D to move. Space to launch.</p>
                  <p className="text-sm mb-6 text-gray-400">P or Esc to pause • R to reset • 5 levels • Build combos for x2, x3, x4…</p>
                  <button
                    onClick={startGame}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                  >
                    Start Game
                  </button>
                </div>
              </div>
            )}

            {gameState.isPaused && gameState.isPlaying && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    Paused
                  </h2>
                  <button
                    onClick={pauseGame}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center mt-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {!gameState.isPlaying || gameState.gameOver || gameState.gameWon ? (
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play size={16} />
                  {gameState.gameOver || gameState.gameWon ? 'New Game' : 'Start'}
                </button>
              ) : (
                <button
                  onClick={pauseGame}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Pause size={16} />
                  {gameState.isPaused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                onClick={resetGame}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            <button
              onClick={() => setSoundEnabled(current => !current)}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </button>
          </div>

          {/* Deterministic Sentry demo controls */}
          <section
            aria-labelledby="sentry-demo-title"
            className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-3 text-white"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="sentry-demo-title" className="font-semibold text-cyan-300">Sentry trigger lab</h2>
                <p className="text-xs text-gray-400">Generate deterministic telemetry without playing a full round.</p>
              </div>
              <p aria-live="polite" className="min-h-5 text-xs text-cyan-200">{sentryTriggerStatus}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={generateUniqueIssue}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-cyan-500"
              >
                New issue
              </button>
              <button
                type="button"
                onClick={generateGroupedEvent}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-indigo-500"
              >
                Grouped event
              </button>
              <button
                type="button"
                onClick={() => void generateSlowSpan()}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-amber-500"
              >
                Slow span
              </button>
              <button
                type="button"
                onClick={generateWarningLog}
                className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-500"
              >
                Warning log
              </button>
            </div>
          </section>

          {/* Instructions */}
          <div className="mt-4 text-center text-gray-400 text-xs sm:text-sm">
            <p>Mouse / ← → / A D to move • Space launches and pauses • P or Esc to pause • R to reset</p>
            <p className="mt-1">
              <span className="text-cyan-300">🐛 bug bricks emit Sentry warning logs</span> &nbsp;•&nbsp;
              <span className="text-yellow-400">⭐ ⬆️ 💥 💰</span> bonus bricks &nbsp;•&nbsp;
              <span className="text-red-400">⬇️ 🔄 💔 ⚡</span> trap bricks
            </p>
            <p className="mt-1">
              Power-up drops:&nbsp;
              <span className="text-yellow-400">↔</span> Expand •
              <span className="text-green-400 ml-2">●</span> Multi-ball •
              <span className="text-blue-400 ml-2">⏱</span> Slow Ball •
              <span className="text-red-400 ml-2">♥</span> Extra Life
            </p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-2 sm:p-6 shadow-2xl border border-yellow-400/30 min-w-0 w-full sm:min-w-[220px] sm:max-w-[260px] flex flex-col items-center h-fit self-start mt-4 sm:mt-0">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Leaderboard</h3>
          <div className="flex justify-between w-full mb-2 px-1">
            <span className="font-mono text-gray-300 w-6"></span>
            <span className="font-mono text-gray-300 flex-1 text-center">Initials</span>
            <span className="font-mono text-gray-300 w-12 text-right">Score</span>
          </div>
          <ol className="text-lg w-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const entry = leaderboard[i];
              return (
                <li key={i} className="mb-2 flex justify-between">
                  <span className="font-mono text-gray-400 w-6">{i + 1}.</span>
                  <span className="font-mono text-white flex-1 text-center">{entry ? entry.initials : ''}</span>
                  <span className="font-bold text-blue-300 w-12 text-right">{entry ? entry.score : ''}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
