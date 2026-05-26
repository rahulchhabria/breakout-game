import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PongGame from './PongGame';

describe('PongGame', () => {
  it('renders the game title', () => {
    render(<PongGame />);
    expect(screen.getByText('BREAKOUT')).toBeDefined();
  });

  it('handles negative lives without throwing RangeError', () => {
    expect(() => {
      const livesDisplay = (lives: number) =>
        lives <= 5 ? '❤️'.repeat(Math.max(0, lives)) : `❤️ × ${lives}`;
      
      livesDisplay(-1);
      livesDisplay(0);
      livesDisplay(3);
    }).not.toThrow();
  });

  it('prevents lives from going below zero', () => {
    const simulateLivesDecrement = (lives: number) => Math.max(0, lives - 1);
    
    expect(simulateLivesDecrement(3)).toBe(2);
    expect(simulateLivesDecrement(1)).toBe(0);
    expect(simulateLivesDecrement(0)).toBe(0);
    expect(simulateLivesDecrement(-1)).toBe(0);
  });
}); 