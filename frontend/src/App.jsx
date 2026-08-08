/**
 * AI Interview Agent — Main App Component
 * 
 * Three screens per UI-Design.md §2:
 * 1. Landing / Candidate Select
 * 2. Interview (Chat) Screen
 * 3. Feedback / Results Screen
 */

import { useState, useCallback } from 'react';
import LandingScreen from './components/LandingScreen';
import InterviewScreen from './components/InterviewScreen';
import FeedbackScreen from './components/FeedbackScreen';
import './App.css';

// API base URL — defaults to localhost for dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [screen, setScreen] = useState('landing'); // 'landing' | 'interview' | 'feedback'
  const [sessionId, setSessionId] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Start a new interview session
   */
  const startInterview = useCallback(async (selectedCandidate) => {
    setError(null);
    setIsLoading(true);

    // Generate client-side sessionId (App-Flow.md §1)
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setCandidate(selectedCandidate);

    try {
      const response = await fetch(`${API_URL}/api/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          candidate: selectedCandidate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      setMessages([{
        role: 'interviewer',
        text: data.reply,
        timestamp: Date.now()
      }]);
      setQuestionCount(1);
      setScreen('interview');

    } catch (err) {
      console.error('Start interview error:', err);
      setError(err.message || 'Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Send a message during the interview
   */
  const sendMessage = useCallback(async (messageText) => {
    if (!sessionId || isLoading) return;
    
    setError(null);
    setIsLoading(true);

    // Add candidate message immediately (optimistic)
    const candidateMsg = {
      role: 'candidate',
      text: messageText,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, candidateMsg]);

    try {
      const response = await fetch(`${API_URL}/api/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: messageText
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Add interviewer reply
      setMessages(prev => [...prev, {
        role: 'interviewer',
        text: data.reply,
        timestamp: Date.now()
      }]);
      setQuestionCount(prev => prev + 1);

      // Check if interview is done
      if (data.done) {
        setFeedback(data.feedback);
        // Brief delay before transitioning to feedback screen
        setTimeout(() => setScreen('feedback'), 1500);
      }

    } catch (err) {
      console.error('Send message error:', err);
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  /**
   * Start a new interview (return to landing)
   */
  const startNewInterview = useCallback(() => {
    setScreen('landing');
    setSessionId(null);
    setCandidate(null);
    setMessages([]);
    setFeedback(null);
    setQuestionCount(0);
    setError(null);
    setIsLoading(false);
  }, []);

  return (
    <div className="app">
      {screen === 'landing' && (
        <LandingScreen 
          onStartInterview={startInterview}
          isLoading={isLoading}
          error={error}
          apiUrl={API_URL}
        />
      )}

      {screen === 'interview' && (
        <InterviewScreen
          candidate={candidate}
          messages={messages}
          questionCount={questionCount}
          isLoading={isLoading}
          error={error}
          onSendMessage={sendMessage}
          onDismissError={() => setError(null)}
        />
      )}

      {screen === 'feedback' && (
        <FeedbackScreen
          candidate={candidate}
          feedback={feedback}
          questionCount={questionCount}
          messages={messages}
          onStartNew={startNewInterview}
        />
      )}
    </div>
  );
}

export default App;
