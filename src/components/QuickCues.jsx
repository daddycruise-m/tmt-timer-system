import React from "react";
import '../styles/ControllerScreen.css';

export default function QuickCues({ onSendCue }){
    return(
        <div className="ctrl-card">
            <div className="card-title">One-Tap Preset Cues</div>
            <div className="btn-grid-3">
                <button className="preset-btn" onClick={() => onSendCue('5 MINS REMAINING')}>
                    ⌛ 5 Mins left
                </button>

                 <button className="preset-btn" onClick={() => onSendCue('WRAP IT UP')}>
                    ⚠ Wrap It Up
                </button>

                 <button className="preset-btn alert" onClick={() => onSendCue('TIME IS UP')}>
                    🚨 TIME UP!
                </button>
            </div>
        </div>
    );
}