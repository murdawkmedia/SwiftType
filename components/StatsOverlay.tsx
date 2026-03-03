import React from 'react';

interface StatsOverlayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
  totalDuration: number;
  isDark: boolean;
}

const StatsOverlay: React.FC<StatsOverlayProps> = ({
  wpm,
  accuracy,
  timeLeft,
  totalDuration,
  isDark,
}) => {
  const labelClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const valueClass = isDark ? 'text-white' : 'text-gray-900';

  // Format as M:SS for durations >= 60s so 62s shows as 1:02
  const formatTime = (seconds: number): string => {
    if (totalDuration >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  // Color-code WPM: red < 30, amber 30-59, green >= 60
  const wpmColor = () => {
    if (wpm === 0) return valueClass;
    if (wpm >= 60) return isDark ? 'text-green-400' : 'text-green-600';
    if (wpm >= 30) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-red-400' : 'text-red-500';
  };

  return (
    <div
      className="flex items-center space-x-12 justify-center mb-8"
      role="status"
      aria-label="Test statistics"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col items-center">
        <span
          className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}
        >
          Time
        </span>
        <span
          className={`text-3xl font-light tabular-nums transition-colors duration-300 ${valueClass}`}
          aria-label={`${timeLeft} seconds remaining`}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span
          className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}
        >
          WPM
        </span>
        <span
          className={`text-3xl font-light tabular-nums transition-all duration-300 ${wpmColor()}`}
          aria-label={`${Math.round(wpm)} words per minute`}
        >
          {Math.round(wpm)}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span
          className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}
        >
          Accuracy
        </span>
        <span
          className={`text-3xl font-light tabular-nums transition-colors duration-300 ${valueClass}`}
          aria-label={`${Math.round(accuracy)} percent accuracy`}
        >
          {Math.round(accuracy)}%
        </span>
      </div>
    </div>
  );
};

export default StatsOverlay;
