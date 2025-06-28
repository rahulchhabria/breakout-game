import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PongGame from './PongGame';

describe('PongGame', () => {
  it('renders the game title', () => {
    render(<PongGame />);
    expect(screen.getByText('BREAKOUT')).toBeDefined();
  });
}); 