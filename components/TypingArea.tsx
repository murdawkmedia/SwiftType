
import React, { useEffect, useRef } from 'react';

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
  enableKeyboard = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && enableKeyboard && !isFinished) {
      inputRef.current?.focus();
    }
  }, [enableKeyboard, isActive, isFinished]);

  const handleContainerClick = () => {
    if (enableKeyboard && isActive && !isFinished) {
      inputRef.current?.focus();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished || !isActive) return;
    const nextValue = event.target.value;
    if (nextValue.length <= targetText.length) {
      // Input events cover physical keyboards, mobile keyboards and paste.
      // Count inserted/replaced characters; deleting a mistake keeps its history.
      let prefix = 0;
      while (prefix < userInput.length && prefix < nextValue.length && userInput[prefix] === nextValue[prefix]) prefix += 1;
      let suffix = 0;
      while (suffix < userInput.length - prefix && suffix < nextValue.length - prefix && userInput[userInput.length - 1 - suffix] === nextValue[nextValue.length - 1 - suffix]) suffix += 1;
      for (let index = prefix; index < nextValue.length - suffix; index += 1) {
        onKeystroke?.(nextValue[index] === targetText[index]);
      }
      onInputChange?.(nextValue);
    }
  };

  return (
    <section
      className="typing-area"
      onClick={handleContainerClick}
      aria-label="Typing test area"
    >
      {enableKeyboard && (
        <input
          ref={inputRef}
          className="typing-capture"
          type="text"
          value={userInput}
          onChange={handleChange}
          aria-label="Typing input"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          disabled={isFinished || !isActive}
        />
      )}

      <p className="sr-only" aria-label="Target text">
        {targetText}
      </p>

      <div className="character-stream" aria-hidden="true">
        {targetText.split('').map((char, index) => {
          const isTyped = index < userInput.length;
          const isCorrect = isTyped && userInput[index] === char;
          const isCurrent = index === userInput.length && isActive;

          return (
            <span
              key={`${char}-${index}`}
              data-testid={`char-${index}`}
              className={[
                'character',
                isTyped ? 'is-typed' : '',
                isCorrect ? 'is-correct' : '',
                isTyped && !isCorrect ? 'is-incorrect' : '',
                isCurrent ? 'is-current' : '',
                isDark ? 'theme-dark' : 'theme-light',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {char}
            </span>
          );
        })}
      </div>

      {!isActive && !isFinished && (
        <div className="typing-idle-overlay" aria-hidden="true" />
      )}
    </section>
  );
};

export default TypingArea;
