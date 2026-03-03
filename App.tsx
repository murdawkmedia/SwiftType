import React, { useState, useEffect, useCallback, useRef } from 'react';
import TypingArea from './components/TypingArea';
import StatsOverlay from './components/StatsOverlay';
import { TestStatus, InputMode, TypingStats, TestConfig, Quote } from './types';
import { DEFAULT_QUOTES, DURATIONS } from './constants';

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const EMPTY_STATS: TypingStats = {
  wpm: 0,
  accuracy: 100,
  charactersTyped: 0,
  totalKeystrokes: 0,
  incorrectKeystrokes: 0,
  timeTaken: 0,
  wordsTyped: 0,
};

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(true);
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.VOICE);
  const [config, setConfig] = useState<TestConfig>({ duration: 30 });
  const [quote, setQuote] = useState<Quote>(DEFAULT_QUOTES[0]);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isListening, setIsListening] = useState(false);
  const [sessionStats, setSessionStats] = useState<TypingStats>({ ...EMPTY_STATS });

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Synchronously update this ref during render so speech callbacks
  // always see the freshest state without stale closures.
  const latestRef = useRef({
    status,
    isListening,
    quote,
    handleSpeechInput: (_val: string) => {},
  });
  latestRef.current.status = status;
  latestRef.current.isListening = isListening;
  latestRef.current.quote = quote;

  const getRandomQuote = (currentQuoteText?: string): Quote => {
    const pool = currentQuoteText
      ? DEFAULT_QUOTES.filter((q) => q.text !== currentQuoteText)
      : DEFAULT_QUOTES;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const finishTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setStatus(TestStatus.FINISHED);
  }, []);

  const resetTest = useCallback(
    (newDuration?: number) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      const d = newDuration ?? config.duration;
      setStatus(TestStatus.IDLE);
      setUserInput('');
      setIsListening(false);
      setTimeLeft(d);
      setQuote(getRandomQuote());
      setSessionStats({ ...EMPTY_STATS });
      startTimeRef.current = null;
    },
    [config.duration]
  );

  // ─── Voice input handler ──────────────────────────────────────────────────

  /**
   * Called on every speech recognition result (including interim).
   * Builds a prefix-matched input string from the transcript.
   *
   * BUG FIXED: original code used .join('') which concatenated speech
   * segments without spaces. Now we trim each segment and join with ' '.
   */
  const handleSpeechInput = useCallback(
    (value: string) => {
      // Read the latest quote from the ref to avoid stale closures
      const currentQuote = latestRef.current.quote;
      if (latestRef.current.status === TestStatus.FINISHED) return;

      const normalize = (str: string) =>
        str.toLowerCase().replace(/[^\w\s]/g, '').trim();

      const targetWords = currentQuote.text.split(' ');
      const spokenWords = value.trim().split(/\s+/).filter(Boolean);

      let matchedWordCount = 0;
      for (
        let i = 0;
        i < spokenWords.length && i < targetWords.length;
        i++
      ) {
        if (normalize(spokenWords[i]) === normalize(targetWords[i])) {
          matchedWordCount++;
        } else {
          break;
        }
      }

      if (matchedWordCount > 0) {
        const constructedInput = targetWords
          .slice(0, matchedWordCount)
          .join(' ');
        // Append trailing space if more words remain (visual cue)
        const displayInput =
          matchedWordCount < targetWords.length
            ? constructedInput + ' '
            : constructedInput;

        setUserInput(displayInput);

        // Completed entire quote
        if (matchedWordCount === targetWords.length) {
          setSessionStats((prev) => ({
            ...prev,
            charactersTyped: prev.charactersTyped + constructedInput.length,
            wordsTyped: prev.wordsTyped + matchedWordCount,
          }));

          setUserInput('');
          // Stop recognition so the buffer clears; onend will restart it
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (_) {}
          }
          setQuote(getRandomQuote(currentQuote.text));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally empty — we read all state from latestRef
  );

  // Keep the latest handler in latestRef (synchronous, so recognition
  // callbacks see the current version without waiting for an effect).
  latestRef.current.handleSpeechInput = handleSpeechInput;

  // ─── Keyboard input handler ───────────────────────────────────────────────

  const handleKeyInput = useCallback(
    (value: string) => {
      if (status !== TestStatus.RUNNING) return;
      setUserInput(value);

      // Check for quote completion (exact match)
      if (value === quote.text) {
        setSessionStats((prev) => ({
          ...prev,
          charactersTyped: prev.charactersTyped + value.length,
          wordsTyped: prev.wordsTyped + quote.text.split(' ').length,
        }));
        setUserInput('');
        setQuote(getRandomQuote(quote.text));
      }
    },
    [status, quote]
  );

  /**
   * Per-keystroke accuracy tracking for keyboard mode.
   * Called from TypingArea's onKeyDown before the input value changes.
   */
  const handleKeystroke = useCallback((isCorrect: boolean) => {
    setSessionStats((prev) => {
      const totalKeystrokes = prev.totalKeystrokes + 1;
      const incorrectKeystrokes =
        prev.incorrectKeystrokes + (isCorrect ? 0 : 1);
      const accuracy =
        ((totalKeystrokes - incorrectKeystrokes) / totalKeystrokes) * 100;
      return { ...prev, totalKeystrokes, incorrectKeystrokes, accuracy };
    });
  }, []);

  // ─── Start / speech recognition ──────────────────────────────────────────

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Web Speech API is not supported in this browser. Try Chrome or Edge, or switch to Keyboard mode.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      /**
       * BUG FIXED: original code used .join('') — concatenating all speech
       * segments without spaces, turning "hello world" into "helloworld".
       *
       * Fix: trim each segment's transcript and join with a single space.
       * This handles both single-segment and multi-segment results correctly.
       */
      const transcript = Array.from(event.results as any[])
        .map((result: any) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');

      latestRef.current.handleSpeechInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert(
          'Microphone access denied. Please allow microphone permissions and try again.'
        );
        finishTest();
      }
    };

    recognition.onend = () => {
      // Auto-restart on silence timeouts while the test is still running
      const { status: s, isListening: listening } = latestRef.current;
      if (s === TestStatus.RUNNING && listening) {
        try {
          recognition.start();
        } catch (_) {
          // Already started or recognition ended cleanly — safe to ignore
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }, [finishTest]);

  const startTest = useCallback(() => {
    setStatus(TestStatus.RUNNING);
    startTimeRef.current = Date.now();

    if (inputMode === InputMode.VOICE) {
      setIsListening(true);
      startSpeechRecognition();
    }

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [inputMode, startSpeechRecognition, finishTest]);

  // ─── Real-time WPM update ─────────────────────────────────────────────────

  useEffect(() => {
    if (status !== TestStatus.RUNNING || !startTimeRef.current) return;

    const updateWpm = () => {
      const timeElapsedSec = (Date.now() - startTimeRef.current!) / 1000;
      const timeElapsedMin = timeElapsedSec / 60;
      if (timeElapsedMin <= 0) return;

      setSessionStats((prev) => {
        // WPM = (completed chars + chars of current in-progress input) / 5 / minutes
        const totalChars = prev.charactersTyped + userInput.trimEnd().length;
        const currentWpm = totalChars / 5 / timeElapsedMin;
        return {
          ...prev,
          wpm: currentWpm,
          timeTaken: timeElapsedMin,
        };
      });
    };

    const interval = setInterval(updateWpm, 200);
    return () => clearInterval(interval);
  }, [status, userInput]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Derived display values ───────────────────────────────────────────────

  const themeClass = isDark
    ? 'bg-[#161617] text-[#f5f5f7]'
    : 'bg-[#fbfbfd] text-[#1d1d1f]';
  const navClass = isDark
    ? 'bg-black/70 border-white/10'
    : 'bg-white/70 border-gray-200/50';

  const isVoice = inputMode === InputMode.VOICE;

  // Compute displayed accuracy: for voice mode it's always 100 (only exact
  // matches advance the cursor); for keyboard mode it's tracked per keystroke.
  const displayAccuracy = isVoice ? 100 : Math.round(sessionStats.accuracy);

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 ${themeClass}`}
    >
      {/* ── Nav ── */}
      <nav
        className={`apple-blur sticky top-0 z-50 px-4 sm:px-6 py-4 border-b transition-colors duration-500 ${navClass}`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-2">
            <img
              src="/logo.png"
              alt="SwiftType logo"
              className="w-10 h-10 rounded-xl"
            />
            <h1 className="text-xl font-medium tracking-tight">SwiftType</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Input mode toggle */}
            <div
              className={`flex p-1 rounded-full border transition-colors duration-300 ${
                isDark
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-100/80 border-gray-200'
              }`}
            >
              {([InputMode.VOICE, InputMode.KEYBOARD] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setInputMode(mode);
                    resetTest();
                  }}
                  aria-pressed={inputMode === mode}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    inputMode === mode
                      ? isDark
                        ? 'bg-white text-black'
                        : 'bg-white shadow-sm text-blue-600'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {mode === InputMode.VOICE ? '🎤 Voice' : '⌨️ Keys'}
                </button>
              ))}
            </div>

            {/* Duration picker */}
            <div
              className={`flex p-1 rounded-full border transition-colors duration-300 ${
                isDark
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-100/80 border-gray-200'
              }`}
            >
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setConfig({ duration: d });
                    resetTest(d);
                  }}
                  aria-pressed={config.duration === d}
                  aria-label={`${d} second test`}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    config.duration === d
                      ? isDark
                        ? 'bg-white text-black'
                        : 'bg-white shadow-sm text-blue-600'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>

            {/* Dark/light toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`p-2 rounded-full border transition-all duration-300 hover:scale-110 active:scale-95 ${
                isDark
                  ? 'bg-white/10 border-white/20 text-yellow-400'
                  : 'bg-gray-100 border-gray-200 text-gray-600'
              }`}
            >
              {isDark ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main
        className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-5xl mx-auto w-full"
        id="typing-instructions"
      >
        <StatsOverlay
          wpm={sessionStats.wpm}
          accuracy={displayAccuracy}
          timeLeft={timeLeft}
          totalDuration={config.duration}
          isDark={isDark}
        />

        <div className="w-full relative min-h-[300px] flex flex-col items-center justify-center">
          <TypingArea
            targetText={quote.text}
            userInput={userInput}
            onInputChange={handleKeyInput}
            onKeystroke={handleKeystroke}
            isFinished={status === TestStatus.FINISHED}
            isActive={status === TestStatus.RUNNING}
            isDark={isDark}
            enableKeyboard={inputMode === InputMode.KEYBOARD}
          />

          <div className="mt-4">
            {status === TestStatus.IDLE && (
              <button
                onClick={startTest}
                aria-label={
                  isVoice ? 'Start speaking to begin voice test' : 'Start typing to begin keyboard test'
                }
                className={`px-8 py-3 rounded-full font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                  isDark
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400'
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500'
                }`}
              >
                {isVoice ? '🎤 Start Speaking' : '⌨️ Start Typing'}
              </button>
            )}

            {status === TestStatus.RUNNING && isVoice && (
              <div
                className="flex items-center space-x-2"
                role="status"
                aria-label="Listening for speech"
              >
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
                <span className={isDark ? 'text-white' : 'text-black'}>
                  Listening…
                </span>
              </div>
            )}

            {status === TestStatus.RUNNING && !isVoice && (
              <p
                className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                aria-live="polite"
              >
                Click the text area if focus is lost
              </p>
            )}
          </div>

          <div
            className={`mt-8 text-center font-light transition-colors duration-300 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
            aria-label={`Quote by ${quote.author}`}
          >
            — {quote.author}
          </div>
        </div>

        {/* ── Results & restart ── */}
        <div className="mt-16 flex flex-col items-center">
          {status === TestStatus.FINISHED && (
            <div
              className={`mb-8 p-8 rounded-3xl shadow-xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 border ${
                isDark
                  ? 'bg-white/5 border-white/10 shadow-black/50'
                  : 'bg-white border-gray-100 shadow-gray-200/50'
              } flex flex-col items-center max-w-md w-full`}
              role="region"
              aria-label="Test results"
            >
              <h2
                className={`text-2xl font-medium mb-6 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Test Results
              </h2>

              <div className="grid grid-cols-2 gap-8 w-full">
                <div className="text-center">
                  <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">
                    Speed
                  </p>
                  <p
                    className={`text-4xl font-light ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`}
                    aria-label={`${Math.round(sessionStats.wpm)} words per minute`}
                  >
                    {Math.round(sessionStats.wpm)} WPM
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">
                    Accuracy
                  </p>
                  <p
                    className={`text-4xl font-light ${
                      isDark ? 'text-white' : 'text-gray-800'
                    }`}
                    aria-label={`${displayAccuracy} percent accuracy`}
                  >
                    {displayAccuracy}%
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-500/10 w-full">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">
                      Words
                    </p>
                    <p className={`text-lg font-light mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {sessionStats.wordsTyped}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">
                      Chars
                    </p>
                    <p className={`text-lg font-light mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {sessionStats.charactersTyped}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">
                      {isVoice ? 'Mode' : 'Errors'}
                    </p>
                    <p className={`text-lg font-light mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {isVoice ? '🎤' : sessionStats.incorrectKeystrokes}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(status === TestStatus.FINISHED || status === TestStatus.RUNNING) && (
            <button
              onClick={() => resetTest()}
              aria-label="Restart test"
              className={`group flex items-center space-x-2 px-8 py-3 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg ${
                isDark
                  ? 'bg-white text-black hover:bg-gray-100 shadow-white/5'
                  : 'bg-gray-900 text-white hover:bg-black shadow-gray-300'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform duration-500 ${
                  status === TestStatus.FINISHED
                    ? 'rotate-180'
                    : 'group-hover:rotate-180'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="font-medium">Restart</span>
            </button>
          )}

          <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest">
            Press <kbd className="font-mono">Tab</kbd> to reset
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className={`py-8 border-t transition-colors duration-500 ${
          isDark ? 'border-white/5' : 'border-gray-100'
        }`}
      >
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
            <p>&copy; 2026 SwiftType. Privacy-first. No data leaves your browser.</p>
            <div className="flex items-center space-x-1.5">
              <span>By</span>
              <a
                href="https://www.murdawkmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors duration-300 font-medium ${
                  isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Murdawk Media
              </a>
            </div>
          </div>
          <p className="text-xs italic opacity-50 mt-4 md:mt-0">
            All processing happens locally in your browser.
          </p>
        </div>
      </footer>

      <GlobalKeyListener onReset={() => resetTest()} />
    </div>
  );
};

const GlobalKeyListener: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReset]);
  return null;
};

export default App;
