
import React from 'react';
import { formatTime } from '../lib/typing';
import { InputMode } from '../types';

interface StatsOverlayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
  totalDuration: number;
  inputMode: InputMode;
  acceptedWords: number;
  isDark: boolean;
}

const StatsOverlay: React.FC<StatsOverlayProps> = ({
  wpm,
  accuracy,
  timeLeft,
  totalDuration,
  inputMode,
  acceptedWords,
}) => {
  const thirdLabel = inputMode === InputMode.VOICE ? 'Words' : 'Accuracy';
  const thirdValue =
    inputMode === InputMode.VOICE
      ? `${acceptedWords}`
      : `${Math.round(accuracy)}%`;
  const thirdAria =
    inputMode === InputMode.VOICE
      ? `${acceptedWords} accepted words`
      : `${Math.round(accuracy)} percent accuracy`;

  return (
    <div className="stats-overlay" role="status" aria-live="polite">
      <div className="stat">
        <span className="stat-label">Time</span>
        <span className="stat-value" aria-label={`${timeLeft} seconds remaining`}>
          {formatTime(timeLeft, totalDuration)}
        </span>
      </div>

      <div className="stat">
        <span className="stat-label">WPM</span>
        <span className="stat-value" aria-label={`${Math.round(wpm)} words per minute`}>
          {Math.round(wpm)}
        </span>
      </div>

      <div className="stat">
        <span className="stat-label">{thirdLabel}</span>
        <span className="stat-value" aria-label={thirdAria}>
          {thirdValue}
        </span>
      </div>
    </div>
  );
};

export default StatsOverlay;
