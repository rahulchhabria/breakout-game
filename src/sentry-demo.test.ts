import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  startSpan: vi.fn((_options: unknown, callback: () => unknown) => callback()),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  captureException: mocks.captureException,
  startSpan: mocks.startSpan,
}));

vi.mock('./utils/logger', () => ({
  log: {
    info: mocks.info,
    warn: mocks.warn,
  },
}));

import {
  emitBrickBreakTelemetry,
  triggerGroupedDemoEvent,
  triggerUniqueDemoIssue,
  triggerWarningDemoLog,
  type BrickBreakTelemetry,
} from './sentry-demo';

const brickBreak: BrickBreakTelemetry = {
  id: 'session-1:level-1-brick-5-6',
  brickId: 'level-1-brick-5-6',
  gameSessionId: 'session-1',
  level: 1,
  score: 70,
  combo: 1,
  color: '#ef4444',
  points: 70,
  x: 42,
  y: 60,
  isBugBrick: true,
};

describe('Sentry demo telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regresses BREAKOUT-GAME-FR by logging the bug-brick hit without creating an issue', () => {
    emitBrickBreakTelemetry(brickBreak);

    expect(mocks.warn).toHaveBeenCalledWith(
      'Bug brick destroyed',
      expect.objectContaining({
        brick_id: 'level-1-brick-5-6',
        game_session_id: 'session-1',
        level: 1,
      }),
    );
    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it('records an ordinary brick as a structured log without creating an issue', () => {
    emitBrickBreakTelemetry({ ...brickBreak, isBugBrick: false });

    expect(mocks.info).toHaveBeenCalledWith(
      'Brick destroyed',
      expect.objectContaining({ brick_id: 'level-1-brick-5-6', level: 1 }),
    );
    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it('creates a different fingerprint for each manual unique issue', () => {
    triggerUniqueDemoIssue();
    triggerUniqueDemoIssue();

    const firstFingerprint = mocks.captureException.mock.calls[0][1].fingerprint;
    const secondFingerprint = mocks.captureException.mock.calls[1][1].fingerprint;
    expect(firstFingerprint).not.toEqual(secondFingerprint);
  });

  it('uses one stable fingerprint for grouped demo events', () => {
    triggerGroupedDemoEvent();
    triggerGroupedDemoEvent();

    expect(mocks.captureException.mock.calls[0][1].fingerprint).toEqual([
      'breakout-manual-grouped-event',
    ]);
    expect(mocks.captureException.mock.calls[1][1].fingerprint).toEqual([
      'breakout-manual-grouped-event',
    ]);
  });

  it('sends warning triggers through structured logs', () => {
    triggerWarningDemoLog();

    expect(mocks.warn).toHaveBeenCalledWith(
      'Manual Sentry warning log',
      { trigger: 'manual-warning-log' },
    );
  });
});
