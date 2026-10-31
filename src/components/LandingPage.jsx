import React from 'react';
import '../styles/LandingPage.css';

export default function LandingPage({ onSelectRole }) {
  return (
    <div className="landing-container">
      <div className="landing-card">
        <h1 className="landing-title">⏱️ Remote Timer System</h1>
        <p className="landing-subtext">
          Select this device's role to initiate peer-to-peer connection:
        </p>

        <div className="role-grid">
          <button className="role-card-btn" onClick={() => onSelectRole('display')}>
            <span className="role-icon">🖥️</span>
            <span className="role-title">Display Screen</span>
            <span className="role-desc">For presentation stage or secondary screen device.</span>
          </button>

          <button className="role-card-btn" onClick={() => onSelectRole('controller')}>
            <span className="role-icon">🎮</span>
            <span className="role-title">Controller Remote</span>
            <span className="role-desc">Moderator dashboard to trigger timers and cues.</span>
          </button>
        </div>
      </div>
    </div>
  );
}