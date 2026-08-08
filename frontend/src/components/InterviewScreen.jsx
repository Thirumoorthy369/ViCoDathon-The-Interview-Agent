/**
 * Interview (Chat) Screen (UI-Design.md §2.2)
 * 
 * - Header: candidate name + role, progress indicator
 * - Chat transcript with message bubbles
 * - Typing indicator while waiting for reply
 * - Input area with Send button
 */

import { useState, useEffect, useRef } from 'react';
import anime from 'animejs';
import './InterviewScreen.css';

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

// Typing indicator (three-dot pulse)
function TypingIndicator() {
  return (
    <div className="message message-interviewer typing-indicator-container">
      <div className="message-avatar interviewer-avatar">
        <MicIcon />
      </div>
      <div className="message-content">
        <span className="message-label">Interviewer</span>
        <div className="message-bubble interviewer-bubble typing-bubble">
          <div className="typing-dots">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewScreen({ 
  candidate, messages, questionCount, isLoading, error, onSendMessage, onDismissError, onReset 
}) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Animate the last message bubble on mount
  useEffect(() => {
    const messagesElements = document.querySelectorAll('.message');
    if (messagesElements.length > 0) {
      const lastMessage = messagesElements[messagesElements.length - 1];
      // Skip animating typing indicator here, let CSS handle it
      if (lastMessage.classList.contains('typing-indicator-container')) return;

      const isInterviewer = lastMessage.classList.contains('message-interviewer');
      anime({
        targets: lastMessage,
        translateX: isInterviewer ? [-30, 0] : [30, 0],
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 400,
        easing: 'easeOutCubic'
      });
    }
  }, [messages.length]);

  // Animate progress bar fill changes smoothly
  const progressPercent = Math.min((questionCount / 10) * 100, 100);
  useEffect(() => {
    anime({
      targets: '.interview-progress-fill',
      width: `${progressPercent}%`,
      duration: 600,
      easing: 'easeOutCubic'
    });
  }, [progressPercent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // Auto-focus input when the user is prompted to type (isLoading becomes false)
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const firstName = candidate?.member?.name?.split(' ')[0] || 'Candidate';

  return (
    <div className="interview">
      {/* Header */}
      <header className="interview-header">
        <div className="interview-header-left">
          <div className="interview-header-avatar">
            <MicIcon />
          </div>
          <div className="interview-header-info">
            <span className="interview-header-name">
              Interview with {candidate?.member?.name}
            </span>
            <span className="interview-header-role">
              {candidate?.member?.jobRole} · {candidate?.member?.yearsExperience}yr exp
            </span>
          </div>
        </div>
        <div className="interview-header-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div className="interview-progress">
            <span className="interview-progress-text">
              Question {questionCount} of ~10
            </span>
            <div className="interview-progress-bar">
              <div 
                className="interview-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <button 
            className="btn btn-ghost"
            onClick={onReset}
            title="Exit interview and return to landing page"
            style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: 'auto', border: '1px solid var(--color-border)' }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="interview-chat">
        <div className="interview-chat-inner">
          {messages.map((msg, i) => (
            <div 
              key={i}
              className={`message ${msg.role === 'interviewer' ? 'message-interviewer' : 'message-candidate'}`}
            >
              {msg.role === 'interviewer' && (
                <div className="message-avatar interviewer-avatar">
                  <MicIcon />
                </div>
              )}
              <div className="message-content">
                <span className="message-label">
                  {msg.role === 'interviewer' ? 'Interviewer' : firstName}
                </span>
                <div className={`message-bubble ${msg.role === 'interviewer' ? 'interviewer-bubble' : 'candidate-bubble'}`}>
                  {msg.text}
                </div>
              </div>
              {msg.role === 'candidate' && (
                <div className="message-avatar candidate-avatar">
                  <span>{firstName[0]}</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          {/* Error toast */}
          {error && (
            <div className="chat-error animate-fade-in">
              <p>⚠ {error}</p>
              <div className="chat-error-actions" style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
                {error.toLowerCase().includes('session') ? (
                  <button className="btn btn-primary" onClick={onReset} style={{ padding: '4px 12px', fontSize: '0.8rem', minHeight: 'auto' }}>
                    Restart Interview
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={onDismissError}>Dismiss</button>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="interview-input-area">
        <div className="interview-input-container">
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="interview-input"
            placeholder="Type your answer..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <button
            id="send-btn"
            className="btn btn-primary send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
        <p className="interview-input-hint">
          Press Enter to send · Shift+Enter for new line
        </p>
      </footer>
    </div>
  );
}
