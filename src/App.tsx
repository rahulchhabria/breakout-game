import React, { useEffect } from 'react';
import PongGame from './components/PongGame';
import * as Sentry from '@sentry/react';
import { FeedbackButton } from './components/FeedbackButton';

function App() {
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'custom',
      message: 'App component mounted',
      level: 'info',
    });
  }, []);

  return (
    <>
      <PongGame />
      <FeedbackButton />
    </>
  );
}

export default App;