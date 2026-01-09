
import React from 'react';

interface StatsOverlayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
  isDark: boolean;
}

const StatsOverlay: React.FC<StatsOverlayProps> = ({ wpm, accuracy, timeLeft, isDark }) => {
  const valueClass = isDark ? 'text-white' : 'text-gray-900';
  const labelClass = isDark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="flex items-center space-x-12 justify-center mb-8">
      <div className="flex flex-col items-center">
        <span className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}>Time</span>
        <span className={`text-3xl font-light tabular-nums transition-colors duration-300 ${valueClass}`}>
          {timeLeft}s
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}>WPM</span>
        <span className={`text-3xl font-light tabular-nums transition-colors duration-300 ${valueClass}`}>
          {Math.round(wpm)}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className={`text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${labelClass}`}>Accuracy</span>
        <span className={`text-3xl font-light tabular-nums transition-colors duration-300 ${valueClass}`}>
          {Math.round(accuracy)}%
        </span>
      </div>
    </div>
  );
};

export default StatsOverlay;
