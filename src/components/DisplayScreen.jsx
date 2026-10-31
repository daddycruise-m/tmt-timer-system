import React, { useEffect, useState, useRef } from "react";
import Ably from "ably";
import "../styles/DisplayScreen.css";

export default function DisplayScreen({ onBack }) {
  const [roomCode, setRoomCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef(null);
  const localBcRef = useRef(null);

  // Keep ref up to date to prevent stale closures inside listeners & intervals
  const stateRef = useRef({ timeLeft: 300, isRunning: false, alertMessage: "" });

  useEffect(() => {
    stateRef.current = { timeLeft, isRunning, alertMessage };
  }, [timeLeft, isRunning, alertMessage]);

  // Broadcast current state to Controller's Live Preview Display Screen
  const broadcastStatus = (time, running, alert) => {
    const payload = {
      type: "STATUS_UPDATE",
      timeLeft: Number(time),
      isRunning: Boolean(running),
      alertMessage: alert || "",
    };

    // 1. Send via Ably Cloud (for cross-device/mobile sync)
    if (channelRef.current) {
      channelRef.current.publish("timer-status", payload).catch((err) => {
        console.warn("Ably publish error:", err);
      });
    }

    // 2. Send via Local Browser Channel (for instant tab-to-tab sync)
    if (localBcRef.current) {
      localBcRef.current.postMessage(payload);
    }
  };

  // Command handler for incoming events from Controller
  const handleIncomingCommand = (data) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "START":
        setIsRunning(true);
        broadcastStatus(stateRef.current.timeLeft, true, stateRef.current.alertMessage);
        break;
      case "PAUSE":
        setIsRunning(false);
        broadcastStatus(stateRef.current.timeLeft, false, stateRef.current.alertMessage);
        break;
      case "RESET": {
        setIsRunning(false);
        const resetVal = data.value !== undefined && data.value !== null ? Number(data.value) : 300;
        setTimeLeft(resetVal);
        broadcastStatus(resetVal, false, stateRef.current.alertMessage);
        break;
      }
      case "SET_TIME": {
        const newTime = Number(data.value) || 300;
        setTimeLeft(newTime);
        broadcastStatus(newTime, stateRef.current.isRunning, stateRef.current.alertMessage);
        break;
      }
      case "SHOW_MESSAGE":
        setAlertMessage(data.value);
        broadcastStatus(stateRef.current.timeLeft, stateRef.current.isRunning, data.value);
        break;
      case "CLEAR_MESSAGE":
        setAlertMessage("");
        broadcastStatus(stateRef.current.timeLeft, stateRef.current.isRunning, "");
        break;
      case "REQUEST_SYNC":
        broadcastStatus(
          stateRef.current.timeLeft,
          stateRef.current.isRunning,
          stateRef.current.alertMessage
        );
        break;
      default:
        break;
    }
  };

  // Local BroadcastChannel Receiver (Tab-to-Tab fallback)
  useEffect(() => {
    const bc = new BroadcastChannel("timer_local_channel");
    localBcRef.current = bc;

    bc.onmessage = (event) => {
      handleIncomingCommand(event.data);
    };

    return () => {
      bc.close();
    };
  }, []);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.warn("Wake Lock failed:", err.message);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (wakeLock) wakeLock.release();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Ably Realtime Setup
  useEffect(() => {
    const rawCode = Math.floor(1000 + Math.random() * 9000).toString();
    const formattedCode = `ROOM-${rawCode}`;
    setRoomCode(formattedCode);

    try {
      const client = new Ably.Realtime({
        key:
          import.meta.env.VITE_ABLY_API_KEY ||
          "is2n0g.1mQykw:C4UeVPOamjXSoDivEpWlp9WKstM1x47DTikF-xgU2-U",
        echoMessages: false,
        disconnectedRetryTimeout: 1000,
        fallbackHostsUseDefault: true,
      });

      const channel = client.channels.get(`timer-room-${rawCode}`);
      channelRef.current = channel;

      client.connection.on((stateChange) => {
        if (stateChange.current === "connected") {
          setIsConnected(true);
          // Broadcast current snapshot immediately upon connecting
          broadcastStatus(
            stateRef.current.timeLeft,
            stateRef.current.isRunning,
            stateRef.current.alertMessage
          );
        } else if (
          stateChange.current === "disconnected" ||
          stateChange.current === "failed" ||
          stateChange.current === "closed"
        ) {
          setIsConnected(false);
        }
      });

      // Listen for Ably commands sent from Controller
      channel.subscribe("timer-cmd", (message) => {
        let data = message.data;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch (e) {}
        }
        handleIncomingCommand(data);
      });

      return () => {
        channel.unsubscribe();
        client.close();
      };
    } catch (err) {
      console.error("Ably Display connection error:", err);
      setIsConnected(false);
    }
  }, []);

  // Timer loop & continuous 1-second sync heartbeat
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (stateRef.current.isRunning && stateRef.current.timeLeft > 0) {
        setTimeLeft((prev) => {
          const nextTime = prev - 1;
          broadcastStatus(nextTime, true, stateRef.current.alertMessage);
          return nextTime;
        });
      } else if (stateRef.current.timeLeft === 0 && stateRef.current.isRunning) {
        setIsRunning(false);
        broadcastStatus(0, false, stateRef.current.alertMessage);
      } else {
        // Send heartbeat ping when paused so new controllers get state instantly
        broadcastStatus(
          stateRef.current.timeLeft,
          false,
          stateRef.current.alertMessage
        );
      }
    }, 1000);

    return () => clearInterval(heartbeat);
  }, []);

  const formatTime = (seconds) => {
    const safeSecs = isNaN(seconds) ? 0 : Math.max(0, seconds);
    const mins = Math.floor(safeSecs / 60);
    const secs = safeSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getStatusClass = () => {
    if (timeLeft === 0) return "display-wrapper expired";
    if (timeLeft <= 60 && isRunning) return "display-wrapper warning";
    return "display-wrapper";
  };

  return (
    <div className={getStatusClass()}>
      <div className="display-header">
        <button
          className="back-btn"
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
          }}
        >
          ← Exit
        </button>
        <span className="code-badge">
          Pair Code: <strong>{roomCode || "Generating..."}</strong>
        </span>
        <span className={isConnected ? "status-active" : "status-waiting"}>
          {isConnected ? "● Ready for Controller" : "○ Connecting..."}
        </span>
      </div>

      <div className="timer-digits">{formatTime(timeLeft)}</div>

      {alertMessage && (
        <div className="glass-alert">
          <span>🔔</span>
          <span>{alertMessage}</span>
        </div>
      )}
    </div>
  );
}