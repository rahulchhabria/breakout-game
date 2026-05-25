<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into this React + Vite breakout game. `posthog-js` was already installed and initialized via `src/posthog.ts`. The wizard added 11 `posthog.capture()` calls across the game's main component covering all key player interactions and game outcomes. Environment variables `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` were confirmed and updated in `.env`. A pre-existing ESLint error (empty `while` block body) was also fixed.

| Event Name | Description | File |
|---|---|---|
| `game_started` | Player clicks Start Game | `src/components/PongGame.tsx` |
| `game_paused` | Player pauses an active session | `src/components/PongGame.tsx` |
| `game_resumed` | Player resumes after pausing | `src/components/PongGame.tsx` |
| `game_reset` | Player manually resets the game | `src/components/PongGame.tsx` |
| `game_over` | Session ends due to all lives lost (churn) | `src/components/PongGame.tsx` |
| `game_won` | Player destroys all bricks (conversion) | `src/components/PongGame.tsx` |
| `life_lost` | A ball falls below the canvas | `src/components/PongGame.tsx` |
| `power_up_collected` | Player catches a power-up with the paddle | `src/components/PongGame.tsx` |
| `leaderboard_score_saved` | Player saves initials + score to leaderboard | `src/components/PongGame.tsx` |
| `leaderboard_score_skipped` | Player skips saving to leaderboard | `src/components/PongGame.tsx` |
| `sound_toggled` | Player toggles game sound on/off | `src/components/PongGame.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1627858)
- [Game Sessions Started (Daily)](/insights/4ZO8Syrj) — daily volume of new game sessions
- [Game Completion Funnel](/insights/5a49WFFY) — conversion from `game_started` → `game_won`
- [Game Over vs Game Won](/insights/gyQdFr1t) — churn vs success rate over time
- [Power-ups Collected by Type](/insights/q4NWGgP6) — breakdown of which power-ups players collect most
- [Leaderboard Engagement Funnel](/insights/4A50rtvs) — how many players save their score after a session

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
