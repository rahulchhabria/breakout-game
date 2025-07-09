import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { log, getRecentLogs } from '../utils/logger';
import * as Sentry from '@sentry/react';

interface Brick {
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
  score: number;
  lives: number;
  level: number;
  isPlaying: boolean;
  isPaused: boolean;
  gameOver: boolean;
  gameWon: boolean;
  paddleExpanded: boolean;
  expandTimer: number;
  slowBallTimer: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 20;
const BALL_SIZE = 12;
const INITIAL_BALL_SPEED = 3; // Reduced from 4 for better control
const BRICK_WIDTH = 75;
const BRICK_HEIGHT = 25;
const BRICK_PADDING = 5;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;

const BRICK_COLORS = [
  { color: '#ef4444', points: 70, hits: 1 }, // Red - top row
  { color: '#f97316', points: 60, hits: 1 }, // Orange
  { color: '#eab308', points: 50, hits: 1 }, // Yellow
  { color: '#22c55e', points: 40, hits: 1 }, // Green
  { color: '#3b82f6', points: 30, hits: 1 }, // Blue
  { color: '#8b5cf6', points: 20, hits: 1 }, // Purple
  { color: '#ec4899', points: 15, hits: 1 }, // Pink - reduced from 2 hits to 1
  { color: '#6b7280', points: 10, hits: 1 }, // Gray - reduced from 3 hits to 1
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
  { effect: 'slow-span', icon: '🐢', label: 'Slow Sentry Span' }, // NEW
];

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [initials, setInitials] = useState('');
  const [showInitialsPrompt, setShowInitialsPrompt] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ initials: string; score: number }[]>([]);
  
  const createBricks = (): Brick[] => {
    const bricks: Brick[] = [];
    const startX = (CANVAS_WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
    const startY = 60;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const brickType = BRICK_COLORS[row] || BRICK_COLORS[BRICK_COLORS.length - 1];
        // Randomly assign powerType and effect
        let powerType: 'bonus' | 'trap' | null = null;
        let powerEffect: string | null = null;
        let icon: string | null = null;
        const rand = Math.random();
        if (rand < 0.1) { // 10% chance bonus
          powerType = 'bonus';
          const bonus = BONUS_EFFECTS[Math.floor(Math.random() * BONUS_EFFECTS.length)];
          powerEffect = bonus.effect;
          icon = bonus.icon;
        } else if (rand < 0.2) { // 10% chance trap
          powerType = 'trap';
          const trap = TRAP_EFFECTS[Math.floor(Math.random() * TRAP_EFFECTS.length)];
          powerEffect = trap.effect;
          icon = trap.icon;
        }
        bricks.push({
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
        } as Brick & { icon?: string });
      }
    }
    return bricks;
  };

  const [gameState, setGameState] = useState<GameState>({
    balls: [{
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      dy: -INITIAL_BALL_SPEED,
      speed: INITIAL_BALL_SPEED,
      active: true,
    }],
    paddle: {
      x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    },
    bricks: createBricks(),
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    gameWon: false,
    paddleExpanded: false,
    expandTimer: 0,
    slowBallTimer: 0,
  });

  const playSound = (frequency: number, duration: number = 100) => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  };

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const paddleWidth = gameState.paddleExpanded ? PADDLE_WIDTH * 1.5 : PADDLE_WIDTH;
    const paddleX = Math.max(0, Math.min(CANVAS_WIDTH - paddleWidth, mouseX - paddleWidth / 2));
    
    setGameState(prev => ({
      ...prev,
      paddle: { ...prev.paddle, x: paddleX, width: paddleWidth },
    }));
  }, [gameState.paddleExpanded]);

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
      lives: gameState.lives 
    });
    setGameState(prev => ({
      ...prev,
      isPaused: newPauseState,
    }));
  };

  const resetGame = () => {
    log.info('Game reset', { finalScore: gameState.score });
    setGameState({
      balls: [{
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        dx: INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        dy: -INITIAL_BALL_SPEED,
        speed: INITIAL_BALL_SPEED,
        active: true,
      }],
      paddle: {
        x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        y: CANVAS_HEIGHT - 40,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
      },
      bricks: createBricks(),
      powerUps: [],
      score: 0,
      lives: 3,
      level: 1,
      isPlaying: false,
      isPaused: false,
      gameOver: false,
      gameWon: false,
      paddleExpanded: false,
      expandTimer: 0,
      slowBallTimer: 0,
    });
  };

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (!prev.isPlaying || prev.isPaused || prev.gameOver || prev.gameWon) return prev;

      const newState = { ...prev };
      
      // Update power-up timers
      if (newState.expandTimer > 0) {
        newState.expandTimer -= 1;
        if (newState.expandTimer <= 0) {
          newState.paddleExpanded = false;
          newState.paddle.width = PADDLE_WIDTH;
        }
      }
      
      if (newState.slowBallTimer > 0) {
        newState.slowBallTimer -= 1;
      }

      // Update balls
      newState.balls = newState.balls.filter(ball => {
        if (!ball.active) {
          log.debug('Ball lost', { 
            position: { x: ball.x, y: ball.y },
            velocity: { dx: ball.dx, dy: ball.dy }
          });
          return false;
        }
        return true;
      });
      
      newState.balls.forEach(ball => {
        const speedMultiplier = newState.slowBallTimer > 0 ? 0.3 : 1; // Reduced slow multiplier from 0.5 to 0.3
        ball.x += ball.dx * speedMultiplier;
        ball.y += ball.dy * speedMultiplier;

        // Ball collision with walls
        if (ball.x <= BALL_SIZE / 2 || ball.x >= CANVAS_WIDTH - BALL_SIZE / 2) {
          ball.dx = -ball.dx;
          playSound(220, 100);
        }
        
        if (ball.y <= BALL_SIZE / 2) {
          ball.dy = -ball.dy;
          playSound(220, 100);
        }

        // Ball collision with paddle
        if (
          ball.y + BALL_SIZE / 2 >= newState.paddle.y &&
          ball.y - BALL_SIZE / 2 <= newState.paddle.y + newState.paddle.height &&
          ball.x >= newState.paddle.x &&
          ball.x <= newState.paddle.x + newState.paddle.width &&
          ball.dy > 0
        ) {
          const hitPos = (ball.x - newState.paddle.x) / newState.paddle.width;
          const angle = (hitPos - 0.5) * Math.PI / 3;
          
          ball.dy = -Math.abs(ball.dy);
          ball.dx = ball.speed * Math.sin(angle);
          ball.dy = -ball.speed * Math.cos(angle);
          
          playSound(330, 100);
        }

        // Ball collision with bricks
        newState.bricks.forEach(brick => {
          if (brick.destroyed) return;
          
          if (
            ball.x + BALL_SIZE / 2 >= brick.x &&
            ball.x - BALL_SIZE / 2 <= brick.x + brick.width &&
            ball.y + BALL_SIZE / 2 >= brick.y &&
            ball.y - BALL_SIZE / 2 <= brick.y + brick.height
          ) {
            // Determine collision side
            const ballCenterX = ball.x;
            const ballCenterY = ball.y;
            const brickCenterX = brick.x + brick.width / 2;
            const brickCenterY = brick.y + brick.height / 2;
            
            const deltaX = ballCenterX - brickCenterX;
            const deltaY = ballCenterY - brickCenterY;
            
            if (Math.abs(deltaX / brick.width) > Math.abs(deltaY / brick.height)) {
              ball.dx = -ball.dx;
            } else {
              ball.dy = -ball.dy;
            }
            
            brick.hits += 1;
            newState.score += brick.points;
            
            if (brick.hits >= brick.maxHits) {
              brick.destroyed = true;
              playSound(440, 150);
              // Add recent logs as breadcrumbs before capturing exception
              getRecentLogs().forEach(logEntry => {
                Sentry.addBreadcrumb({
                  category: 'log',
                  message: logEntry.message,
                  level: logEntry.level,
                  data: logEntry.attributes,
                  timestamp: Math.floor(logEntry.timestamp / 1000),
                });
              });
              // Trigger a unique Sentry error for each brick broken
              Sentry.captureException(
                new Error(`Brick broken at (${brick.x},${brick.y}) - color: ${brick.color} - points: ${brick.points}`),
                {
                  fingerprint: [
                    'brick-broken',
                    brick.color // Group by color only
                  ]
                }
              );

              // Handle trap/bonus effects
              if (brick.powerType === 'trap' && brick.powerEffect === 'slow-span') {
                Sentry.startSpan({ name: 'intentional-slow-span' }, () => {
                  const start = Date.now();
                  while (Date.now() - start < 2000) {}
                });
              }
              
              // Chance to drop power-up
              if (Math.random() < 0.15) {
                newState.powerUps.push(createPowerUp(brick.x + brick.width / 2, brick.y + brick.height));
              }
            } else {
              playSound(330, 100);
            }
          }
        });

        // Ball goes off screen
        if (ball.y > CANVAS_HEIGHT) {
          ball.active = false;
        }
      });

      // Check if all balls are gone
      if (newState.balls.length === 0) {
        newState.lives -= 1;
        log.warn('Life lost', { 
          remainingLives: newState.lives,
          score: newState.score
        });
        
        if (newState.lives <= 0) {
          log.info('Game over', {
            finalScore: newState.score,
            bricksDestroyed: newState.bricks.filter(b => b.destroyed).length,
            totalBricks: newState.bricks.length
          });
          newState.gameOver = true;
          newState.isPlaying = false;
        } else {
          // Add new ball
          newState.balls.push({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            dx: INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
            dy: -INITIAL_BALL_SPEED,
            speed: INITIAL_BALL_SPEED,
            active: true,
          });
        }
      }

      // Update power-ups
      newState.powerUps = newState.powerUps.filter(powerUp => {
        if (!powerUp.active) return false;
        
        powerUp.y += 2;
        
        // Check collision with paddle
        if (
          powerUp.y + 10 >= newState.paddle.y &&
          powerUp.y <= newState.paddle.y + newState.paddle.height &&
          powerUp.x + 10 >= newState.paddle.x &&
          powerUp.x - 10 <= newState.paddle.x + newState.paddle.width
        ) {
          log.info('Power-up collected', {
            type: powerUp.type,
            position: { x: powerUp.x, y: powerUp.y }
          });
          
          playSound(550, 200);
          
          switch (powerUp.type) {
            case 'expand':
              newState.paddleExpanded = true;
              newState.expandTimer = 600; // 10 seconds at 60fps
              newState.paddle.width = PADDLE_WIDTH * 1.5;
              break;
            case 'multiball':
              if (newState.balls.length < 5) {
                const mainBall = newState.balls[0];
                newState.balls.push({
                  x: mainBall.x,
                  y: mainBall.y,
                  dx: mainBall.speed * 0.6, // Reduced from 0.8
                  dy: -mainBall.speed * 0.6, // Reduced from 0.8
                  speed: mainBall.speed,
                  active: true,
                });
                newState.balls.push({
                  x: mainBall.x,
                  y: mainBall.y,
                  dx: -mainBall.speed * 0.6, // Reduced from 0.8
                  dy: -mainBall.speed * 0.6, // Reduced from 0.8
                  speed: mainBall.speed,
                  active: true,
                });
              }
              break;
            case 'slowball':
              newState.slowBallTimer = 600; // 10 seconds
              break;
            case 'extralife':
              newState.lives += 1;
              break;
          }
          
          powerUp.active = false;
          return false;
        }
        
        // Remove if off screen
        if (powerUp.y > CANVAS_HEIGHT) {
          powerUp.active = false;
          return false;
        }
        
        return true;
      });

      // Check win condition
      const remainingBricks = newState.bricks.filter(brick => !brick.destroyed);
      if (remainingBricks.length === 0) {
        log.info('Game won', {
          finalScore: newState.score,
          lives: newState.lives,
          powerUpsCollected: newState.powerUps.length
        });
        newState.gameWon = true;
        newState.isPlaying = false;
        playSound(660, 500);
      }

      return newState;
    });
  }, [playSound]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f0f23');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw game border
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
    ctx.setLineDash([]);

    if (gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
      // Draw bricks
      gameState.bricks.forEach(brick => {
        if (brick.destroyed) return;
        
        // Brick damage effect
        const alpha = 1 - (brick.hits / brick.maxHits) * 0.5;
        ctx.globalAlpha = alpha;

        // Special color for bonus/trap bricks
        let brickColor = brick.color;
        if (brick.powerType === 'bonus') {
          brickColor = '#facc15'; // Gold/yellow for bonus
        } else if (brick.powerType === 'trap') {
          brickColor = '#ef4444'; // Red for trap
        }

        // Brick gradient
        const brickGradient = ctx.createLinearGradient(
          brick.x, brick.y,
          brick.x, brick.y + brick.height
        );
        brickGradient.addColorStop(0, brickColor);
        brickGradient.addColorStop(1, brickColor + '80');

        ctx.fillStyle = brickGradient;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

        // Brick border
        ctx.strokeStyle = brickColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);

        // Draw icon for bonus/trap
        if (brick.powerType && typeof (brick as { icon?: unknown }).icon === 'string') {
          ctx.globalAlpha = 1;
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = brick.powerType === 'bonus' ? '#fffde4' : '#ffb4b4';
          ctx.fillText((brick as { icon?: string }).icon!, brick.x + brick.width / 2, brick.y + brick.height / 2);
        }

        ctx.globalAlpha = 1;
      });

      // Draw balls
      gameState.balls.forEach(ball => {
        if (!ball.active) return;
        
        const ballGradient = ctx.createRadialGradient(
          ball.x, ball.y, 0,
          ball.x, ball.y, BALL_SIZE
        );
        ballGradient.addColorStop(0, '#ffffff');
        ballGradient.addColorStop(0.7, '#60a5fa');
        ballGradient.addColorStop(1, '#3b82f6');
        
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        // Ball glow
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw paddle
      const paddleGradient = ctx.createLinearGradient(
        gameState.paddle.x, gameState.paddle.y,
        gameState.paddle.x, gameState.paddle.y + gameState.paddle.height
      );
      
      if (gameState.paddleExpanded) {
        paddleGradient.addColorStop(0, '#10b981');
        paddleGradient.addColorStop(1, '#059669');
        ctx.shadowColor = '#10b981';
      } else {
        paddleGradient.addColorStop(0, '#fbbf24');
        paddleGradient.addColorStop(1, '#f59e0b');
        ctx.shadowColor = '#fbbf24';
      }
      
      ctx.fillStyle = paddleGradient;
      ctx.shadowBlur = 10;
      ctx.fillRect(
        gameState.paddle.x,
        gameState.paddle.y,
        gameState.paddle.width,
        gameState.paddle.height
      );
      ctx.shadowBlur = 0;

      // Draw power-ups
      gameState.powerUps.forEach(powerUp => {
        if (!powerUp.active) return;
        
        ctx.fillStyle = powerUp.color;
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Power-up symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const symbol = powerUp.type === 'expand' ? '↔' : 
                      powerUp.type === 'multiball' ? '●' :
                      powerUp.type === 'slowball' ? '⏱' : '♥';
        ctx.fillText(symbol, powerUp.x, powerUp.y + 4);
      });
    }
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const gameLoop = () => {
      updateGame();
      render();
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    if (gameState.isPlaying) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.isPlaying, updateGame, render]);

  // Touch controls for mobile (if not already present)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleTouch = (e: TouchEvent) => {
      if (!gameState.isPlaying || gameState.isPaused || gameState.gameOver || gameState.gameWon) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const touchX = (touch.clientX - rect.left) * scaleX;
      const paddleWidth = gameState.paddleExpanded ? PADDLE_WIDTH * 1.5 : PADDLE_WIDTH;
      const paddleX = Math.max(0, Math.min(CANVAS_WIDTH - paddleWidth, touchX - paddleWidth / 2));
      setGameState(prev => ({
        ...prev,
        paddle: { ...prev.paddle, x: paddleX, width: paddleWidth },
      }));
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
    };
  }, [gameState.isPlaying, gameState.isPaused, gameState.gameOver, gameState.gameWon, gameState.paddleExpanded]);

  // Load leaderboard from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('breakout-leaderboard');
    if (stored) setLeaderboard(JSON.parse(stored));
  }, []);

  // Show initials prompt after game over or victory
  useEffect(() => {
    if ((gameState.gameOver || gameState.gameWon) && (gameState.score > 0)) {
      setShowInitialsPrompt(true);
    }
  }, [gameState.gameOver, gameState.gameWon]);

  // Save to leaderboard
  const saveToLeaderboard = () => {
    if (!initials.trim()) return;
    const entry = { initials: initials.trim().toUpperCase().slice(0, 3), score: gameState.score };
    const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem('breakout-leaderboard', JSON.stringify(updated));
    setShowInitialsPrompt(false);
    setInitials('');
  };

  const remainingBricks = gameState.bricks.filter(brick => !brick.destroyed).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 min-w-0">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full max-w-[900px] mx-auto">
        <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-2 sm:p-6 shadow-2xl border border-purple-500/20 w-full sm:w-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-white">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                BREAKOUT
              </h1>
              <p className="text-sm text-gray-400">Destroy all the bricks!</p>
            </div>
            
            <div className="flex items-center gap-4 text-white">
              <div className="text-right">
                <div className="text-sm text-gray-400">Score</div>
                <div className="text-2xl font-bold text-blue-400">{gameState.score}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Bricks</div>
                <div className="text-2xl font-bold text-purple-400">{remainingBricks}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Lives</div>
                <div className="text-2xl font-bold text-red-400">
                  {'❤️'.repeat(gameState.lives)}
                </div>
              </div>
            </div>
          </div>

          {/* Power-up indicators */}
          {(gameState.paddleExpanded || gameState.slowBallTimer > 0) && (
            <div className="flex gap-2 mb-4 justify-center">
              {gameState.paddleExpanded && (
                <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                  Expanded Paddle ({Math.ceil(gameState.expandTimer / 60)}s)
                </div>
              )}
              {gameState.slowBallTimer > 0 && (
                <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  Slow Ball ({Math.ceil(gameState.slowBallTimer / 60)}s)
                </div>
              )}
            </div>
          )}

          {/* Game Canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{ width: '100%', maxWidth: 800, height: 'auto', aspectRatio: '4/3', touchAction: 'none' }}
              className="border-2 border-purple-500/30 rounded-lg shadow-2xl select-none"
            />

            {/* Initials Prompt Overlay */}
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

            {/* Game Over Overlay */}
            {gameState.gameOver && !showInitialsPrompt && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    Game Over
                  </h2>
                  <p className="text-xl mb-2">Final Score: <span className="text-blue-400 font-bold">{gameState.score}</span></p>
                  <p className="text-lg mb-6">Bricks Destroyed: <span className="text-purple-400 font-bold">{gameState.bricks.length - remainingBricks}</span></p>
                  <button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}

            {/* Victory Overlay */}
            {gameState.gameWon && !showInitialsPrompt && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-green-400 bg-clip-text text-transparent">
                    Victory!
                  </h2>
                  <p className="text-xl mb-2">Final Score: <span className="text-blue-400 font-bold">{gameState.score}</span></p>
                  <p className="text-lg mb-6">All bricks destroyed!</p>
                  <button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}

            {/* Start Screen */}
            {!gameState.isPlaying && !gameState.gameOver && !gameState.gameWon && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Ready to Break Out?
                  </h2>
                  <p className="text-lg mb-6 text-gray-300">Move your mouse to control the paddle • Destroy all bricks to win!</p>
                  <button
                    onClick={startGame}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                  >
                    Start Game
                  </button>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
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
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
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
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-gray-400 text-sm">
            <p>Move your mouse to control the paddle • Destroy all bricks to win • Collect power-ups for special abilities!</p>
            <p className="mt-1">
              <span className="text-yellow-400">↔</span> Expand Paddle • 
              <span className="text-green-400 ml-2">●</span> Multi-ball • 
              <span className="text-blue-400 ml-2">⏱</span> Slow Ball • 
              <span className="text-red-400 ml-2">♥</span> Extra Life
            </p>
          </div>
        </div>
        {/* Leaderboard Sidebar */}
        <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-2 sm:p-6 shadow-2xl border border-yellow-400/30 min-w-0 w-full sm:min-w-[220px] sm:max-w-[260px] flex flex-col items-center h-fit self-start mt-4 sm:mt-0">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Leaderboard</h3>
          <div className="flex justify-between w-full mb-2 px-1">
            <span className="font-mono text-gray-300 w-6"></span>
            <span className="font-mono text-gray-300 flex-1 text-center">Initials</span>
            <span className="font-mono text-gray-300 w-10 text-right">Score</span>
          </div>
          <ol className="text-lg w-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const entry = leaderboard[i];
              return (
                <li key={i} className="mb-2 flex justify-between">
                  <span className="font-mono text-gray-400 w-6">{i + 1}.</span>
                  <span className="font-mono text-white flex-1 text-center">{entry ? entry.initials : ''}</span>
                  <span className="font-bold text-blue-300 w-10 text-right">{entry ? entry.score : ''}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}