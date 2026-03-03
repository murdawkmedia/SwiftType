import React, { useRef, useEffect } from 'react';

interface TypingAreaProps {
  targetText: string;
  userInput: string;
  onInputChange?: (value: string) => void;
  onKeystroke?: (isCorrect: boolean) => void;
  isFinished: boolean;
  isActive: boolean;
  isDark: boolean;
  enableKeyboard?: boolean;
}

const TypingArea: React.FC<TypingAreaProps> = ({
  targetText,
  userInput,
  onInputChange,
  onKeystroke,
  isFinished,
  isActive,
  isDark,
  enableKeyboard = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus hidden input whenever keyboard mode becomes active
  useEffect(() => {
    if (isActive && enableKeyboard && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive, enableKeyboard]);

  // Track individual keystrokes for accurate accuracy calculation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      // Tab is handled globally for reset; don't let it move focus
      e.preventDefault();
      return;
    }
    // Count printable character presses and backspace as keystrokes
    if (e.key.length === 1) {
      const nextIndex = userInput.length;
      const isCorrect = e.key === targetText[nextIndex];
      onKeystroke?.(isCorrect);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished || !isActive) return;
    // Never allow typing beyond the target length
    const val = e.target.value;
    if (val.length <= targetText.length) {
      onInputChange?.(val);
    }
  };

  const renderCharacters = () => {
    return targetText.split('').map((char, index) => {
      const isCurrent = index === userInput.length;
      const isTyped = index < userInput.length;
      const isCorrect = isTyped && userInput[index] === char;
      const isWrong = isTyped && userInput[index] !== char;

      let colorClass = isDark ? 'text-gray-600' : 'text-gray-300';
      if (isCorrect) colorClass = isDark ? 'text-white' : 'text-gray-800';
      else if (isWrong) colorClass = isDark ? 'text-red-400 bg-red-400/10' : 'text-red-500 bg-red-50';

      return (
        <span
          key={index}
          className={`relative transition-colors duration-150 rounded-[2px] ${colorClass} ${
            isCurrent && isActive
              ? `cursor-blink border-l-2 ${isDark ? 'border-blue-400' : 'border-blue-500'}`
              : ''
          }`}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <div
      className="relative w-full max-w-4xl mx-auto py-12 px-8 min-h-[200px]"
      onClick={() => enableKeyboard && inputRef.current?.focus()}
      role="region"
      aria-label="Typing test area"
    >
      {/* Hidden input to capture keyboard input on all devices including mobile */}
      {enableKeyboard && (
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="absolute opacity-0 pointer-events-none"
          style={{ width: '1px', height: '1px', top: 0, left: 0 }}
          aria-label="Type the text shown above"
          aria-live="off"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="next"
          disabled={!isActive || isFinished}
        />
      )}

      <div
        className="text-2xl md:text-3xl leading-relaxed tracking-tight font-normal text-left select-none"
        aria-label={`Target text: ${targetText}`}
        aria-describedby="typing-instructions"
      >
        {renderCharacters()}
      </div>

      {/* Dimmed overlay while idle */}
      {!isActive && !isFinished && (
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-2xl pointer-events-none transition-all duration-300 ${
            isDark ? 'bg-black/20 backdrop-blur-[1px]' : 'bg-white/40 backdrop-blur-[2px]'
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default TypingArea;
