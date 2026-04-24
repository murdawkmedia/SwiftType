import React, { useCallback, useEffect, useRef, useState } from 'react';
import TypingArea from './components/TypingArea';
import StatsOverlay from './components/StatsOverlay';
import {
  buildTranscriptFromResults,
  calculateWpm,
  countWords,
  createEmptyStats,
  matchSpeechPrefix,
  recordKeystroke,
} from './lib/typing';
import {
  InputMode,
  Quote,
  TestConfig,
  TestStatus,
  TypingStats,
  VoiceProcessingMode,
} from './types';
import { DEFAULT_QUOTES, DURATIONS } from './constants';

type SpeechRecognitionAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | boolean;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((event: { results: ArrayLike<any> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<SpeechRecognitionAvailability>;
  install?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<boolean>;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const VOICE_LANGUAGE = 'en-US';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(true);
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.KEYBOARD);
  const [config, setConfig] = useState<TestConfig>({ duration: 30 });
  const [quote, setQuote] = useState<Quote>(DEFAULT_QUOTES[0]);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  const [voiceProcessingMode, setVoiceProcessingMode] =
    useState<VoiceProcessingMode>(VoiceProcessingMode.UNKNOWN);
  const [sessionStats, setSessionStats] =
    useState<TypingStats>(createEmptyStats);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartVoiceRef = useRef(false);
  const latestRef = useRef({
    status,
    inputMode,
    quote,
  });

  latestRef.current.status = status;
  latestRef.current.inputMode = inputMode;
  latestRef.current.quote = quote;

  const getRandomQuote = useCallback((currentQuoteText?: string): Quote => {
    const pool = currentQuoteText
      ? DEFAULT_QUOTES.filter((candidate) => candidate.text !== currentQuoteText)
      : DEFAULT_QUOTES;
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const safeStopRecognition = useCallback((allowRestart = false) => {
    shouldRestartVoiceRef.current = allowRestart;
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.stop();
    } catch {
      // Some browser recognizers throw if they are already stopped.
    }
  }, []);

  const stopVoiceSession = useCallback(() => {
    shouldRestartVoiceRef.current = false;
    safeStopRecognition(false);
    recognitionRef.current = null;
    setIsListening(false);
  }, [safeStopRecognition]);

  const finishTest = useCallback(() => {
    clearTimer();
    stopVoiceSession();
    setStatus(TestStatus.FINISHED);
  }, [clearTimer, stopVoiceSession]);

  const resetTest = useCallback(
    (newDuration?: number) => {
      clearTimer();
      stopVoiceSession();

      const duration = newDuration ?? config.duration;
      setStatus(TestStatus.IDLE);
      setUserInput('');
      setTimeLeft(duration);
      setQuote(getRandomQuote());
      setSessionStats(createEmptyStats());
      setMessage('');
      setVoiceProcessingMode(VoiceProcessingMode.UNKNOWN);
      startTimeRef.current = null;
    },
    [clearTimer, config.duration, getRandomQuote, stopVoiceSession]
  );

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          finishTest();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  }, [clearTimer, finishTest]);

  const handleSpeechInput = useCallback(
    (transcript: string) => {
      const currentQuote = latestRef.current.quote;
      if (latestRef.current.status !== TestStatus.RUNNING) return;

      const match = matchSpeechPrefix(currentQuote.text, transcript);
      if (match.matchedWordCount === 0) return;

      setUserInput(match.displayInput);

      if (match.isComplete) {
        setSessionStats((previous) => ({
          ...previous,
          charactersTyped:
            previous.charactersTyped + match.completedInput.length,
          wordsTyped: previous.wordsTyped + match.targetWordCount,
        }));
        setUserInput('');
        setQuote(getRandomQuote(currentQuote.text));
        safeStopRecognition(true);
      }
    },
    [getRandomQuote, safeStopRecognition]
  );

  const configureOnDeviceSpeech = useCallback(
    async (
      SpeechRecognition: SpeechRecognitionConstructor,
      recognition: SpeechRecognitionLike
    ): Promise<VoiceProcessingMode> => {
      const supportsLocalSpeech =
        'processLocally' in recognition &&
        typeof SpeechRecognition.available === 'function';

      if (!supportsLocalSpeech) {
        return VoiceProcessingMode.BROWSER_PROVIDER;
      }

      try {
        const availability = await SpeechRecognition.available!({
          langs: [VOICE_LANGUAGE],
          processLocally: true,
        });

        if (availability === true || availability === 'available') {
          recognition.processLocally = true;
          return VoiceProcessingMode.ON_DEVICE;
        }

        if (
          (availability === 'downloadable' || availability === 'downloading') &&
          typeof SpeechRecognition.install === 'function'
        ) {
          const installed = await SpeechRecognition.install({
            langs: [VOICE_LANGUAGE],
            processLocally: true,
          });
          if (installed) {
            recognition.processLocally = true;
            return VoiceProcessingMode.ON_DEVICE;
          }
        }
      } catch {
        return VoiceProcessingMode.BROWSER_PROVIDER;
      }

      return VoiceProcessingMode.BROWSER_PROVIDER;
    },
    []
  );

  const startSpeechRecognition = useCallback(async (): Promise<boolean> => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        'Voice input is not supported in this browser. Keyboard mode is ready.'
      );
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = VOICE_LANGUAGE;
    let startStoppedByError = false;
    recognition.onresult = (event) => {
      handleSpeechInput(buildTranscriptFromResults(event.results));
    };
    recognition.onerror = (event) => {
      startStoppedByError = true;
      const denied =
        event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setMessage(
        denied
          ? 'Microphone access was denied. Switch to keyboard mode or allow microphone access to try voice.'
          : `Voice input stopped: ${event.error}. Keyboard mode is ready.`
      );
      clearTimer();
      shouldRestartVoiceRef.current = false;
      setIsListening(false);
      setStatus(TestStatus.IDLE);
      setTimeLeft(config.duration);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      if (shouldRestartVoiceRef.current) {
        try {
          recognition.start();
        } catch {
          // Browser recognition may already be running after a quick restart.
        }
      }
    };

    const processingMode = await configureOnDeviceSpeech(
      SpeechRecognition,
      recognition
    );

    try {
      recognitionRef.current = recognition;
      shouldRestartVoiceRef.current = true;
      recognition.start();
      if (startStoppedByError) {
        return false;
      }
      setIsListening(true);
      setVoiceProcessingMode(processingMode);
      setMessage(
        processingMode === VoiceProcessingMode.ON_DEVICE
          ? 'Voice mode is using on-device recognition for this browser.'
          : 'Voice mode uses your browser speech provider, which may process audio outside this app.'
      );
      return true;
    } catch {
      setMessage(
        'Voice input could not start. Keyboard mode is ready without microphone access.'
      );
      recognitionRef.current = null;
      shouldRestartVoiceRef.current = false;
      setIsListening(false);
      return false;
    }
  }, [
    clearTimer,
    config.duration,
    configureOnDeviceSpeech,
    handleSpeechInput,
  ]);

  const startTest = useCallback(async () => {
    if (status === TestStatus.RUNNING) return;

    setMessage('');
    setUserInput('');
    setTimeLeft(config.duration);

    if (inputMode === InputMode.VOICE) {
      const started = await startSpeechRecognition();
      if (!started) return;
    }

    startTimeRef.current = Date.now();
    setStatus(TestStatus.RUNNING);
    startTimer();
  }, [
    config.duration,
    inputMode,
    startSpeechRecognition,
    startTimer,
    status,
  ]);

  const handleKeyboardInput = useCallback(
    (value: string) => {
      if (status !== TestStatus.RUNNING) return;
      setUserInput(value);

      if (value === quote.text) {
        setSessionStats((previous) => ({
          ...previous,
          charactersTyped: previous.charactersTyped + value.length,
          wordsTyped: previous.wordsTyped + countWords(quote.text),
        }));
        setUserInput('');
        setQuote(getRandomQuote(quote.text));
      }
    },
    [getRandomQuote, quote, status]
  );

  const handleKeystroke = useCallback(
    (isCorrect: boolean) => {
      if (inputMode !== InputMode.KEYBOARD || status !== TestStatus.RUNNING) {
        return;
      }
      setSessionStats((previous) => recordKeystroke(previous, isCorrect));
    },
    [inputMode, status]
  );

  const changeMode = (mode: InputMode) => {
    if (mode === inputMode) return;
    setInputMode(mode);
    resetTest();
  };

  const currentAcceptedWords =
    inputMode === InputMode.VOICE ? countWords(userInput) : 0;
  const acceptedWords = sessionStats.wordsTyped + currentAcceptedWords;
  const isVoice = inputMode === InputMode.VOICE;
  const privacyNote = isVoice
    ? voiceProcessingMode === VoiceProcessingMode.ON_DEVICE
      ? 'Voice recognition is running on device in this browser. This app still does not run a server or store results.'
      : 'Voice recognition is handled by your browser speech provider and may process audio outside this app. SwiftType does not run a server, store audio, or keep results.'
    : 'Keyboard mode runs in this browser. SwiftType does not run a server, store keystrokes, or keep results.';

  useEffect(() => {
    if (status !== TestStatus.RUNNING || startTimeRef.current === null) return;

    const interval = window.setInterval(() => {
      const elapsedMs = Date.now() - startTimeRef.current!;
      const currentCharacters = userInput.trimEnd().length;

      setSessionStats((previous) => ({
        ...previous,
        wpm: calculateWpm(
          previous.charactersTyped,
          currentCharacters,
          elapsedMs
        ),
        timeTaken: elapsedMs / 1000 / 60,
      }));
    }, 200);

    return () => window.clearInterval(interval);
  }, [status, userInput]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopVoiceSession();
    };
  }, [clearTimer, stopVoiceSession]);

  return (
    <div className={isDark ? 'app theme-dark' : 'app theme-light'}>
      <nav className="topbar" aria-label="Main navigation">
        <div className="brand">
          <img src="/logo.png" alt="SwiftType logo" className="brand-logo" />
          <h1>SwiftType</h1>
        </div>

        <div className="controls" aria-label="Test controls">
          <div className="segmented-control" aria-label="Input mode">
            <button
              type="button"
              aria-pressed={inputMode === InputMode.KEYBOARD}
              onClick={() => changeMode(InputMode.KEYBOARD)}
            >
              Keyboard
            </button>
            <button
              type="button"
              aria-pressed={inputMode === InputMode.VOICE}
              onClick={() => changeMode(InputMode.VOICE)}
            >
              Voice
            </button>
          </div>

          <div className="segmented-control" aria-label="Duration">
            {DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                aria-pressed={config.duration === duration}
                onClick={() => {
                  setConfig({ duration });
                  resetTest(duration);
                }}
              >
                {duration}s
              </button>
            ))}
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={() => setIsDark((current) => !current)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <main className="workspace">
        <StatsOverlay
          wpm={sessionStats.wpm}
          accuracy={sessionStats.accuracy}
          timeLeft={timeLeft}
          totalDuration={config.duration}
          inputMode={inputMode}
          acceptedWords={acceptedWords}
          isDark={isDark}
        />

        <TypingArea
          targetText={quote.text}
          userInput={userInput}
          onInputChange={handleKeyboardInput}
          onKeystroke={handleKeystroke}
          isFinished={status === TestStatus.FINISHED}
          isActive={status === TestStatus.RUNNING}
          isDark={isDark}
          enableKeyboard={inputMode === InputMode.KEYBOARD}
        />

        <div className="quote-author">- {quote.author}</div>

        <div className="action-row">
          {status === TestStatus.IDLE && (
            <button className="primary-action" type="button" onClick={startTest}>
              Start {inputMode === InputMode.VOICE ? 'Voice' : 'Keyboard'}
            </button>
          )}

          {status === TestStatus.RUNNING && (
            <>
              {isListening && (
                <span className="listening-indicator" role="status">
                  Listening
                </span>
              )}
              <button
                className="secondary-action"
                type="button"
                onClick={() => resetTest()}
              >
                Restart
              </button>
            </>
          )}

          {status === TestStatus.FINISHED && (
            <button
              className="primary-action"
              type="button"
              onClick={() => resetTest()}
            >
              Try Again
            </button>
          )}
        </div>

        {message && (
          <div className="notice" role="status">
            <p>{message}</p>
            {inputMode === InputMode.VOICE && status !== TestStatus.RUNNING && (
              <button
                type="button"
                className="text-action"
                onClick={() => changeMode(InputMode.KEYBOARD)}
              >
                Use keyboard mode
              </button>
            )}
          </div>
        )}

        <p className="privacy-note">{privacyNote}</p>

        {status === TestStatus.FINISHED && (
          <section className="results-card" aria-label="Test results">
            <h2>Test Results</h2>
            <div className="results-grid">
              <div>
                <span>Speed</span>
                <strong>{Math.round(sessionStats.wpm)} WPM</strong>
              </div>
              <div>
                <span>{inputMode === InputMode.VOICE ? 'Accepted' : 'Accuracy'}</span>
                <strong>
                  {inputMode === InputMode.VOICE
                    ? `${sessionStats.wordsTyped} words`
                    : `${Math.round(sessionStats.accuracy)}%`}
                </strong>
              </div>
              <div>
                <span>Characters</span>
                <strong>{sessionStats.charactersTyped}</strong>
              </div>
              <div>
                <span>{inputMode === InputMode.VOICE ? 'Mode' : 'Errors'}</span>
                <strong>
                  {inputMode === InputMode.VOICE
                    ? voiceProcessingMode === VoiceProcessingMode.ON_DEVICE
                      ? 'On device'
                      : 'Browser'
                    : sessionStats.incorrectKeystrokes}
                </strong>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>Copyright 2026 SwiftType.</span>
        <span>By Murdawk Media.</span>
        <span>No account, backend, paid API, or app-owned telemetry.</span>
      </footer>

      <GlobalKeyListener onReset={() => resetTest()} />
    </div>
  );
};

const GlobalKeyListener: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReset]);

  return null;
};

export default App;
