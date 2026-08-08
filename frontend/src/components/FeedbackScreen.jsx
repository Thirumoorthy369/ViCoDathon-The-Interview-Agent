import { useEffect } from 'react';
import anime from 'animejs';
import './FeedbackScreen.css';

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const TargetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

export default function FeedbackScreen({ candidate, feedback, questionCount, messages, onStartNew }) {
  // Page entrance timeline with SVG path drawing and staggered cards
  useEffect(() => {
    if (!feedback) return;

    // Reset offsets first for clean SVG path drawing
    anime({
      targets: '.feedback-check svg path, .feedback-check svg polyline',
      strokeDashoffset: [anime.setDashoffset, 0],
      duration: 1200,
      delay: (el, i) => i * 200,
      easing: 'easeInOutSine'
    });

    anime.timeline({
      easing: 'easeOutQuad'
    })
    .add({
      targets: '.feedback-header',
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 600
    })
    .add({
      targets: '.feedback-summary',
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 600
    }, '-=300')
    .add({
      targets: '.feedback-section',
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(120),
      duration: 800
    }, '-=400')
    .add({
      targets: '.feedback-action',
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 500
    }, '-=300');
  }, [feedback]);

  if (!feedback) return null;

  const candidateName = candidate?.member?.name || 'Candidate';
  const coveredDays = new Set();
  // Extract covered days from messages content (rough heuristic for the chip tags)
  const dayMentions = messages?.filter(m => m.role === 'interviewer')
    .flatMap(m => {
      const matches = m.text.match(/Day \d+/g);
      return matches || [];
    }) || [];

  return (
    <div className="feedback">
      <div className="feedback-container">
        {/* Completion Header */}
        <header className="feedback-header">
          <div className="feedback-check">
            <CheckCircleIcon />
          </div>
          <h2 className="feedback-title">Interview Complete</h2>
          <p className="feedback-subtitle">
            {candidateName} · {questionCount} questions asked
          </p>
        </header>

        {/* Summary */}
        <section className="feedback-section feedback-summary">
          <p className="feedback-summary-text">{feedback.summary}</p>
        </section>

        {/* Strengths */}
        <section className="feedback-section">
          <div className="feedback-section-header">
            <div className="feedback-section-icon strengths-icon">
              <StarIcon />
            </div>
            <h3 className="feedback-section-title">Strengths</h3>
          </div>
          <ul className="feedback-list strengths-list">
            {feedback.strengths.map((item, i) => (
              <li key={i} className="feedback-item strengths-item">
                <span className="feedback-item-marker strengths-marker">✦</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Gaps / Areas to Improve */}
        <section className="feedback-section">
          <div className="feedback-section-header">
            <div className="feedback-section-icon gaps-icon">
              <TargetIcon />
            </div>
            <h3 className="feedback-section-title">Areas to Improve</h3>
          </div>
          <ul className="feedback-list gaps-list">
            {feedback.gaps.map((item, i) => (
              <li key={i} className="feedback-item gaps-item">
                <span className="feedback-item-marker gaps-marker">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Next Steps */}
        <section className="feedback-section">
          <div className="feedback-section-header">
            <div className="feedback-section-icon next-icon">
              <ArrowRightIcon />
            </div>
            <h3 className="feedback-section-title">Recommended Next Steps</h3>
          </div>
          <ul className="feedback-list next-list">
            {feedback.next.map((item, i) => (
              <li key={i} className="feedback-item next-item">
                <span className="feedback-item-number">{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Action */}
        <div className="feedback-action">
          <button
            id="start-new-interview-btn"
            className="btn btn-primary btn-lg"
            onClick={onStartNew}
          >
            <RefreshIcon />
            Start New Interview
          </button>
        </div>
      </div>
    </div>
  );
}
