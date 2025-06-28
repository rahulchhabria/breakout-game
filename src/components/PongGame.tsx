import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { log } from '../utils/logger';

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

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const createBricks = (): Brick[] => {
    const bricks: Brick[] = [];
    const startX = (CANVAS_WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
    const startY = 60;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const brickType = BRICK_COLORS[row] || BRICK_COLORS[BRICK_COLORS.length - 1];
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
        });
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
        
        // Brick gradient
        const brickGradient = ctx.createLinearGradient(
          brick.x, brick.y,
          brick.x, brick.y + brick.height
        );
        brickGradient.addColorStop(0, brick.color);
        brickGradient.addColorStop(1, brick.color + '80');
        
        ctx.fillStyle = brickGradient;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        
        // Brick border
        ctx.strokeStyle = brick.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        
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

  const remainingBricks = gameState.bricks.filter(brick => !brick.destroyed).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-purple-500/20">
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
            className="border-2 border-purple-500/30 rounded-lg shadow-2xl cursor-none"
          />
          
          {/* Game Over Overlay */}
          {gameState.gameOver && (
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
          {gameState.gameWon && (
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
    </div>
  );
}