import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PongGame from './PongGame';

describe('PongGame', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('renders the game title', () => {
    render(<PongGame />);
    expect(screen.getByText('BREAKOUT')).toBeDefined();
  });
});
