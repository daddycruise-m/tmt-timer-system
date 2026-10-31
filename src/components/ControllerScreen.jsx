import React, { useState, useRef, useEffect } from 'react';
import Ably from 'ably';
import QuickCues from './QuickCues';
import LiveDisplayPreview from './LiveDisplayPreview';
import '../styles/ControllerScreen.css';

export default function ControllerScreen({ onBack }) {
  const [targetRoom, setTargetRoom] = useState('');
  const [connected, setConnected] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [minutesInput, setMinutesInput] = useState(5);
  const [statusText, setStatusText] = useState('');

  // Service Schedule Sidebar State
  const [scheduleText, setScheduleText] = useState('');

  // Live Display Screen Preview State
  const [previewTimeLeft, setPreviewTimeLeft] = useState(300);
  const [previewIsRunning, setPreviewIsRunning] = useState(false);
  const [previewAlert, setPreviewAlert] = useState('');

  const ablyRef = useRef(null);
  const channelRef = useRef(null);
  const localBcRef = useRef(null);

  // Set up local channel listener (Guarantees instant sync for local tabs)
  useEffect(() => {
    const bc = new BroadcastChannel('timer_local_channel');
    localBcRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'STATUS_UPDATE' || data.timeLeft !== undefined)) {
        setPreviewTimeLeft(Number(data.timeLeft));
        setPreviewIsRunning(Boolean(data.isRunning));
        setPreviewAlert(data.alertMessage || '');
      }
    };

    return () => {
      bc.close();
      if (ablyRef.current) {
        ablyRef.current.close();
      }
    };
  }, []);

  const connectToDisplay = () => {
    if (!targetRoom.trim()) {
      setStatusText('Please enter a room code.');
      return;
    }

    // Strip "ROOM-" or spaces automatically so channel names match guaranteed
    const cleanCode = targetRoom.trim().toUpperCase().replace('ROOM-', '').replace('ROOM', '');
    setStatusText('Connecting to Ably cloud...');

    if (ablyRef.current) {
      ablyRef.current.close();
    }

    try {
      const client = new Ably.Realtime({
        key:
          import.meta.env.VITE_ABLY_API_KEY ||
          'is2n0g.1mQykw:C4UeVPOamjXSoDivEpWlp9WKstM1x47DTikF-xgU2-U',
        echoMessages: false,
        disconnectedRetryTimeout: 1000,
        fallbackHostsUseDefault: true,
      });

      ablyRef.current = client;

      client.connection.on('connected', () => {
        const channel = client.channels.get(`timer-room-${cleanCode}`);
        channelRef.current = channel;

        // Listen for all status updates from Display to update Live Preview Screen
        channel.subscribe('timer-status', (message) => {
          let data = message.data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
          }

          if (data && (data.type === 'STATUS_UPDATE' || data.timeLeft !== undefined)) {
            setPreviewTimeLeft(Number(data.timeLeft));
            setPreviewIsRunning(Boolean(data.isRunning));
            setPreviewAlert(data.alertMessage || '');
          }
        });

        // Request immediate sync snapshot upon connection
        sendCommand('REQUEST_SYNC');

        // Backup sync request pings
        const syncInterval = setInterval(() => {
          sendCommand('REQUEST_SYNC');
        }, 500);

        setTimeout(() => clearInterval(syncInterval), 2500);

        setConnected(true);
        setStatusText('');
      });

      client.connection.on('failed', () => {
        setStatusText('Ably connection failed. Local sync fallback active.');
        setConnected(true); // Still enable controls so local tab sync works
      });
    } catch (err) {
      console.error('Ably init error:', err);
      setStatusText('Connection error occurred. Fallback enabled.');
      setConnected(true);
    }
  };

  const sendCommand = (type, value = null) => {
    const payload = { type, value };

    // 1. Send via Ably (for mobile / cross-device)
    if (channelRef.current) {
      try {
        channelRef.current.publish('timer-cmd', payload);
      } catch (e) {
        console.error('Error sending Ably command:', e);
      }
    }

    // 2. Send via Local BroadcastChannel (guaranteed instant tab-to-tab sync)
    if (localBcRef.current) {
      localBcRef.current.postMessage(payload);
    }
  };

  // Handle schedule document/text file upload
  const handleScheduleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setScheduleText(event.target.result);
    };
    reader.onerror = () => {
      alert('Error reading file. Please try uploading a text file or paste the text directly.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="controller-wrapper">
      <div className="controller-header">
        <button className="back-btn" onClick={onBack}>← Switch Role</button>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Remote Controller</h2>
      </div>

      {!connected ? (
        <div className="ctrl-card">
          <h3 className="card-title">Pair with Display Screen</h3>
          <p className="card-sub">Enter the Code shown on the Display screen:</p>
          
          {statusText && (
            <p style={{ color: statusText.includes('Failed') || statusText.includes('error') ? '#ef4444' : '#38bdf8', fontSize: '13px', marginBottom: '12px' }}>
              {statusText}
            </p>
          )}

          <div className="flex-row">
            <input
              type="text"
              placeholder="e.g. ROOM-8492 or 8492"
              value={targetRoom}
              onChange={(e) => setTargetRoom(e.target.value)}
              className="text-input"
            />
            <button className="btn-primary" onClick={connectToDisplay}>
              Connect
            </button>
          </div>
        </div>
      ) : (
        /* Responsive Layout Grid: Automatically switches between vertical stack (portrait) and 2 columns (landscape/widescreen) */
        <div className="controller-main-layout">
          
          {/* LEFT COLUMN: Controls & Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Live Display Preview Component */}
            <LiveDisplayPreview
              timeLeft={previewTimeLeft}
              isRunning={previewIsRunning}
              alertMessage={previewAlert}
            />

            {/* Controls */}
            <div className="ctrl-card">
              <h3 className="card-title">Timer Controls</h3>
              <div className="btn-grid-3">
                <button className="action-btn start" onClick={() => sendCommand('START')}>▶ START</button>
                <button className="action-btn pause" onClick={() => sendCommand('PAUSE')}>⏸ PAUSE</button>
                <button className="action-btn reset" onClick={() => sendCommand('RESET', minutesInput * 60)}>🔄 RESET</button>
              </div>
            </div>

            {/* Time Config */}
            <div className="ctrl-card">
              <h3 className="card-title">Set Duration</h3>
              <div className="flex-row">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(Number(e.target.value))}
                  className="text-input"
                  style={{ width: '80px', textAlign: 'center', flex: 'none' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Minutes</span>
                <button className="btn-secondary" onClick={() => sendCommand('SET_TIME', minutesInput * 60)}>
                  Apply
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <QuickCues onSendCue={(text) => sendCommand('SHOW_MESSAGE', text)} />

            {/* Custom Banner Message */}
            <div className="ctrl-card">
              <h3 className="card-title">Custom Overlay Message</h3>
              <div className="flex-row">
                <input
                  type="text"
                  placeholder="Type message..."
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  className="text-input"
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    sendCommand('SHOW_MESSAGE', customMsg);
                    setCustomMsg('');
                  }}
                >
                  Send
                </button>
                <button className="btn-secondary" onClick={() => sendCommand('CLEAR_MESSAGE')}>
                  Clear
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Service Schedule Reference Sidebar */}
          <div className="ctrl-card schedule-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Service Schedule</span>
              {scheduleText && (
                <button 
                  onClick={() => setScheduleText('')} 
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </h3>
            <p className="card-sub" style={{ fontSize: '12px', marginBottom: '10px' }}>
              Import a schedule document (.txt) or paste order of service notes below:
            </p>

            {/* File Importer */}
            <div style={{ marginBottom: '12px' }}>
              <label 
                style={{ 
                  display: 'inline-block', 
                  width: '100%', 
                  padding: '8px 12px', 
                  background: '#1e293b', 
                  border: '1px dashed #475569', 
                  borderRadius: '6px', 
                  textAlign: 'center', 
                  color: '#38bdf8', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                📁 Upload Schedule File (.txt)
                <input 
                  type="file" 
                  accept=".txt,.md" 
                  onChange={handleScheduleFileUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>

            {/* Schedule Textarea / Viewer */}
            <textarea
              placeholder="Paste service schedule, program outline, or notes here for easy reference..."
              value={scheduleText}
              onChange={(e) => setScheduleText(e.target.value)}
              className="text-input"
              style={{
                flex: 1,
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '13px',
                lineHeight: '1.5',
                padding: '12px',
                minHeight: '350px',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px'
              }}
            />
          </div>

        </div>
      )}
    </div>
  );
}