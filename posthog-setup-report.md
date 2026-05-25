<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. The breakout game already had a solid PostHog foundation (`posthog-js` initialized via `src/posthog.ts`, 11 events tracked in `src/components/PongGame.tsx`). This integration supplemented that foundation with three new events covering bonus/trap brick effects and combo milestones, confirmed environment variable values in `.env`, and built a PostHog dashboard with five analytics insights.

| Event Name | Description | File |
|---|---|---|
| `game_started` | Player starts a new game session | `src/components/PongGame.tsx` |
| `game_paused` | Player pauses the game | `src/components/PongGame.tsx` |
| `game_resumed` | Player resumes a paused game | `src/components/PongGame.tsx` |
| `game_reset` | Player resets the game | `src/components/PongGame.tsx` |
| `life_lost` | Player loses a life (ball falls) | `src/components/PongGame.tsx` |
| `game_over` | Game ends with no lives remaining | `src/components/PongGame.tsx` |
| `power_up_collected` | Player catches a falling power-up | `src/components/PongGame.tsx` |
| `level_cleared` | Player clears all bricks on a level | `src/components/PongGame.tsx` |
| `game_won` | Player wins by completing all levels | `src/components/PongGame.tsx` |
| `leaderboard_score_saved` | Player saves their score to the leaderboard | `src/components/PongGame.tsx` |
| `leaderboard_score_skipped` | Player skips saving their score | `src/components/PongGame.tsx` |
| `sound_toggled` | Player toggles game sound on/off | `src/components/PongGame.tsx` |
| `bonus_effect_triggered` ✨ | Bonus brick effect applied (expand, multi-ball, extra-life, score-boost) — with `effect`, `level`, `score` properties | `src/components/PongGame.tsx` |
| `trap_effect_triggered` ✨ | Trap brick effect applied (shrink, reverse, lose-life, speed-up, slow-span) — with `effect`, `level`, `score`, `lives` properties | `src/components/PongGame.tsx` |
| `combo_milestone_reached` ✨ | Player hits a combo threshold (5, 10, or 20 consecutive bricks) — with `combo`, `level`, `score` properties | `src/components/PongGame.tsx` |

_✨ = newly added by this integration_

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1628489)
- [Game Sessions Over Time](/insights/HFrkLnRa) — daily trend of new game sessions
- [Game Completion Funnel](/insights/Rt9iAFJV) — conversion from game start → level cleared → game won
- [Player Churn: Lives Lost & Game Over](/insights/OBy0yGku) — track where players struggle
- [Leaderboard Score Conversion](/insights/HOXwz2RN) — how many players save their score after game over
- [Bonus vs Trap Effect Triggers](/insights/TC9gBxGm) — balance visibility into brick effect frequency

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
