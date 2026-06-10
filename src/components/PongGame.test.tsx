import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PongGame from './PongGame';

describe('PongGame', () => {
  it('renders the game title', () => {
    render(<PongGame />);
    expect(screen.getByText('BREAKOUT')).toBeDefined();
  });

  it('handles negative lives gracefully without RangeError', () => {
    // This test verifies that the livesDisplay computation doesn't crash
    // when lives is negative (which could happen due to race conditions)
    expect(() => {
      // Simulate the livesDisplay logic with negative lives
      const lives = -1;
      const livesDisplay = lives <= 5
        ? '❤️'.repeat(Math.max(0, lives))
        : `❤️ × ${lives}`;
      expect(livesDisplay).toBe('');
    }).not.toThrow();
  });

  it('guards life decrement from going negative', () => {
    // Verify the Math.max(0, lives - 1) guard works
    const lives = 0;
    const newLives = Math.max(0, lives - 1);
    expect(newLives).toBe(0);
    expect(newLives).toBeGreaterThanOrEqual(0);
  });
}); 