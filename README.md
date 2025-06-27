# Breakout Game

This example React project integrates Sentry for error monitoring, session replays and user feedback.

## Configuration

1. Copy `.env.example` to `.env` and fill in the values for your Sentry project.
2. Provide `SENTRY_AUTH_TOKEN` when building for production so source maps can be uploaded.
3. Optionally set `VITE_SENTRY_AUTH_TOKEN` if you want to submit user feedback directly from the browser (not recommended for public deployments).

## Development

Run `npm run dev` to start the development server.
