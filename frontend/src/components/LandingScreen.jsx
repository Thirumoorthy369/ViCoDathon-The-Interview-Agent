import { useState, useEffect } from 'react';
import anime from 'animejs';
import './LandingScreen.css';

// Microphone SVG icon for the brand
const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

export default function LandingScreen({ onStartInterview, isLoading, error, apiUrl }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [fullCandidateData, setFullCandidateData] = useState(null);

  // Fetch candidates list
  useEffect(() => {
    async function fetchCandidates() {
      try {
        const response = await fetch(`${apiUrl}/api/candidates`);
        const data = await response.json();
        setCandidates(data.candidates || []);
      } catch (err) {
        console.error('Failed to load candidates:', err);
      } finally {
        setLoadingCandidates(false);
      }
    }
    fetchCandidates();
  }, [apiUrl]);

  // Page Load entrance animations
  useEffect(() => {
    anime.timeline({
      easing: 'easeOutQuad'
    })
    .add({
      targets: '.landing-logo-icon',
      scale: [0, 1],
      rotate: '1turn',
      duration: 1000,
      easing: 'easeOutElastic(1, .6)'
    })
    .add({
      targets: ['.landing-title', '.landing-tagline', '.landing-description'],
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(100),
      duration: 800
    }, '-=600')
    .add({
      targets: '.landing-search-container',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600
    }, '-=400');
  }, []);

  // Candidate cards staggered animation when loaded or filtered
  useEffect(() => {
    if (!loadingCandidates && filtered.length > 0) {
      anime({
        targets: '.candidate-card',
        translateY: [30, 0],
        opacity: [0, 1],
        delay: anime.stagger(40),
        duration: 800,
        easing: 'easeOutElastic(1, .85)'
      });
    }
  }, [loadingCandidates, searchQuery, candidates]);

  // Filter candidates by search
  const filtered = candidates.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.jobRole.toLowerCase().includes(q) ||
      c.education.toLowerCase().includes(q)
    );
  });
  // Lookup selected candidate's local data instantly for zero-latency UI labels
  const selectedLocalCandidate = candidates.find(c => c.id === selectedId);

  // Handle candidate selection
  const handleSelect = async (candidateId) => {
    setSelectedId(candidateId);
    setFullCandidateData(null); // Clear previous details so Start button disables while loading
    
    // Fun selection micro-animation
    anime({
      targets: `#candidate-${candidateId}`,
      scale: [0.98, 1.01, 1],
      duration: 400,
      easing: 'easeOutQuad'
    });

    // Fetch the full candidate profile with missions (required for the personalization engine)
    try {
      const response = await fetch(`${apiUrl}/api/candidates/${candidateId}`);
      const data = await response.json();
      setFullCandidateData(data);
    } catch (err) {
      console.error('Failed to sync candidate details in background:', err);
    }
  };

  // Handle start
  const handleStart = () => {
    if (fullCandidateData) {
      // Start button pulse zoom before transitioning
      anime({
        targets: '.start-btn',
        scale: [1, 0.95, 1.1, 1],
        duration: 500,
        easing: 'easeInOutQuad',
        complete: () => {
          onStartInterview(fullCandidateData);
        }
      });
    }
  };

  // Deselect candidate when clicking empty areas (Landing background)
  const handleOuterClick = (e) => {
    // Ignore clicks inside active widgets or cards
    if (
      e.target.closest('.candidate-card') || 
      e.target.closest('.landing-search-container') || 
      e.target.closest('.landing-action-bar')
    ) {
      return;
    }
    setSelectedId(null);
    setFullCandidateData(null);
  };

  return (
    <div className="landing" onClick={handleOuterClick}>
      {/* Decorative background elements */}
      <div className="landing-bg-pattern" />
      
      <div className="landing-container">
        {/* Hero Section */}
        <header className="landing-hero">
          <div className="landing-logo">
            <div className="landing-logo-icon">
              <MicIcon />
            </div>
            <div className="landing-logo-text">
              <h1 className="landing-title">AI Interview Agent</h1>
              <p className="landing-tagline">Build the interviewer, not the interview.</p>
            </div>
          </div>
          <p className="landing-description">
            Experience a realistic, AI-powered technical interview personalized to your 
            learning journey. Select a candidate below to begin.
          </p>
        </header>

        {/* Search */}
        <div className="landing-search-container">
          <div className="landing-search">
            <SearchIcon />
            <input
              id="candidate-search"
              type="text"
              placeholder="Search candidates by name, role, or education..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="landing-search-input"
            />
          </div>
          <span className="landing-count">
            {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Candidate List */}
        <div className="landing-candidates">
          {loadingCandidates ? (
            <div className="landing-loading">
              <div className="loading-shimmer" />
              <div className="loading-shimmer" />
              <div className="loading-shimmer" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="landing-empty">
              <p>No candidates match your search.</p>
            </div>
          ) : (
            filtered.map((c, index) => (
              <button
                key={c.id}
                id={`candidate-${c.id}`}
                className={`candidate-card ${selectedId === c.id ? 'selected' : ''}`}
                onClick={() => handleSelect(c.id)}
              >
                {selectedId === c.id && (
                  <div className="candidate-selected-tag">Selected</div>
                )}
                
                <div className="candidate-card-header">
                  <div className="candidate-avatar">
                    <span className="candidate-initials">
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="candidate-header-details">
                    <div className="candidate-name">{c.name}</div>
                    <div className="candidate-exp-badge">{c.yearsExperience} yrs experience</div>
                  </div>
                </div>

                <div className="candidate-card-body">
                  <div className="candidate-role">
                    <BriefcaseIcon />
                    <span>{c.jobRole}</span>
                  </div>
                  <div className="candidate-education">{c.education}</div>
                </div>

                <div className="candidate-card-footer">
                  <div className="candidate-stat-pill">
                    <strong>{c.missionsCompleted}</strong> <span>/ 31 missions</span>
                  </div>
                  <div className="candidate-stat-pill">
                    <strong>{c.commitDays}</strong> <span>commit days</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="landing-error animate-fade-in">
            <p>⚠ {error}</p>
          </div>
        )}

        {/* Footer */}
        <footer className="landing-footer">
          <p className="footer-built-with">
            Built with 🧡 for <strong>ViCoDathon</strong> · Powered by <strong>an AI Engineer</strong> and <strong>Vibe Coder</strong>
          </p>
          <div className="footer-privacy-links">
            <span>🛡️ Privacy Guard: Conversations are held in-memory and destroyed immediately upon session completion.</span>
          </div>
        </footer>
      </div>

      {/* Floating Sticky Bottom Action Bar (Moved outside container to avoid backdrop-filter fixed clipping) */}
      <div className={`landing-action-bar ${selectedId ? 'visible' : ''}`}>
        <div className="action-bar-left">
          <span className="action-bar-pulse" />
          <span className="action-bar-text">
            Ready to interview <strong>{selectedLocalCandidate?.name || 'Candidate'}</strong>
          </span>
        </div>
        <button
          id="start-interview-btn"
          className="btn btn-primary start-btn"
          disabled={!selectedId || isLoading || !fullCandidateData}
          onClick={handleStart}
        >
          {isLoading || (!fullCandidateData && selectedId) ? (
            <>
              <span className="btn-spinner" />
              Starting...
            </>
          ) : (
            <>
              <span>Start Interview</span>
              <ArrowRightIcon />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
