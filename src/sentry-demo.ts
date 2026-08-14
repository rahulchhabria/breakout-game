import * as Sentry from '@sentry/react';
import { log } from './utils/logger';

export interface BrickBreakTelemetry {
  id: string;
  brickId: string;
  gameSessionId: string;
  level: number;
  score: number;
  combo: number;
  color: string;
  points: number;
  x: number;
  y: number;
  createsIssue: boolean;
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createGameSessionId = () => createId();

export function emitBrickBreakTelemetry(event: BrickBreakTelemetry) {
  const attributes = {
    brick_id: event.brickId,
    game_session_id: event.gameSessionId,
    level: event.level,
    score: event.score,
    combo: event.combo,
    color: event.color,
    points: event.points,
    x: event.x,
    y: event.y,
  };

  if (!event.createsIssue) {
    log.info('Brick destroyed', attributes);
    return;
  }

  Sentry.captureException(new Error(`Bug brick destroyed: ${event.brickId}`), {
    fingerprint: ['breakout-bug-brick', event.gameSessionId, event.brickId],
    tags: {
      trigger: 'bug-brick',
      brick_id: event.brickId,
      game_level: String(event.level),
    },
    contexts: {
      brick: attributes,
    },
  });
}

export function triggerUniqueDemoIssue() {
  const triggerId = createId();
  Sentry.captureException(new Error(`Manual unique Sentry issue: ${triggerId}`), {
    fingerprint: ['breakout-manual-unique-issue', triggerId],
    tags: { trigger: 'manual-unique-issue' },
  });
  return triggerId;
}

export function triggerGroupedDemoEvent() {
  Sentry.captureException(new Error('Manual grouped Sentry event'), {
    fingerprint: ['breakout-manual-grouped-event'],
    tags: { trigger: 'manual-grouped-event' },
  });
}

export async function triggerSlowDemoSpan() {
  await Sentry.startSpan(
    { name: 'manual-sentry-demo-slow-span', op: 'ui.action' },
    () => new Promise(resolve => window.setTimeout(resolve, 500)),
  );
}

export function triggerWarningDemoLog() {
  log.warn('Manual Sentry warning log', { trigger: 'manual-warning-log' });
}
