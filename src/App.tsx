import React, { useState, useEffect } from 'react';
import PongGame from './components/PongGame';
import * as Sentry from '@sentry/react';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'custom',
      message: 'App component mounted',
      level: 'info',
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Replace with your Sentry project details
    const orgSlug = 'rc-sentry-projects';
    const url = `https://sentry.io/api/0/projects/${orgSlug}/breakout-game/user-feedback/`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The auth token is required to post user feedback via the Sentry API
        // in production. It can be provided at build time using the
        // VITE_SENTRY_AUTH_TOKEN environment variable.
        ...(import.meta.env.VITE_SENTRY_AUTH_TOKEN && {
          Authorization: `Bearer ${import.meta.env.VITE_SENTRY_AUTH_TOKEN}`,
        }),
      },
      body: JSON.stringify({
        name: email || 'Anonymous',
        email,
        comments: feedback,
        event_id: '', // Not tied to an event
      }),
    });
    setSubmitted(true);
    setShowForm(false);
    setFeedback('');
    setEmail('');
  };

  return (
    <>
      <PongGame />
      <button
        onClick={() => setShowForm(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          background: 'linear-gradient(90deg, #6366f1, #a21caf)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '12px 20px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
        }}
      >
        Send Feedback
      </button>
      {showForm && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          zIndex: 1001,
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: 24,
          minWidth: 300,
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label>Email (optional):</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Feedback:</label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                required
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', minHeight: 60 }}
              />
            </div>
            <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Submit</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: 8, background: '#eee', color: '#333', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
          </form>
        </div>
      )}
      {submitted && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          zIndex: 1002,
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: 24,
          minWidth: 300,
        }}>
          <p>Thank you for your feedback!</p>
          <button onClick={() => setSubmitted(false)} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
        </div>
      )}
    </>
  );
}

export default App;