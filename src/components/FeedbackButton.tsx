import * as Sentry from '@sentry/react';

export function FeedbackButton() {
  const sendFeedback = () => {
    // Example of programmatically sending feedback
    Sentry.captureFeedback({
      name: 'Anonymous User',
      email: 'anonymous@example.com',
      message: 'This is feedback from the custom button!',
    });
  };

  return (
    <button
      onClick={sendFeedback}
      className="fixed bottom-4 left-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      Send Custom Feedback
    </button>
  );
} 