import React from 'react';
import '../styles/LiveDisplayPreview.css';

export default function LiveDisplayPreview({ timeLeft, isRunning, alertMessage }) {
  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const safeSecs = isNaN(seconds) ? 0 : Math.max(0, seconds);
    const mins = Math.floor(safeSecs / 60);
    const secs = safeSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="preview-card">
      <div className="preview-header">
        <h3 className="preview-title">Live Display Screen</h3>
        <span className={`preview-status-badge ${isRunning ? 'running' : 'paused'}`}>
          {isRunning ? '● RUNNING' : '○ PAUSED'}
        </span>
      </div>

      <div className="preview-time-display">
        {formatTime(timeLeft)}
      </div>

      {alertMessage && (
        <div className="preview-alert-banner">
          <span>🔔</span>
          <span>{alertMessage}</span>
        </div>
      )}
    </div>
  );
}