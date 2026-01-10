
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TypingArea from './components/TypingArea';
import StatsOverlay from './components/StatsOverlay';
import { TestStatus, TypingStats, TestConfig, Quote } from './types';
import { DEFAULT_QUOTES, DURATIONS } from './constants';

// Add type definition for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  // State
  const [isDark, setIsDark] = useState(true);
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [config, setConfig] = useState<TestConfig>({ duration: 30 });
  const [quote, setQuote] = useState<Quote>(DEFAULT_QUOTES[0]);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isListening, setIsListening] = useState(false);

  // Cumulative stats for the whole test session
  const [sessionStats, setSessionStats] = useState<TypingStats>({
    wpm: 0,
    accuracy: 100,
    charactersTyped: 0,
    totalKeystrokes: 0,
    incorrectKeystrokes: 0,
    timeTaken: 0
  });

  // Refs
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const statsRef = useRef(sessionStats);
  const recognitionRef = useRef<any>(null);

  // Ref to hold latest state/handlers to avoid stale closures in event listeners
  const latestRef = useRef({
    status,
    isListening,
    quote,
    sessionStats,
    handleSpeechInput: (val: string) => { } // Placeholder
  });

  // Keep ref in sync for interval access
  useEffect(() => {
    statsRef.current = sessionStats;
  }, [sessionStats]);

  const getRandomQuote = (currentQuoteText?: string): Quote => {
    let filtered = DEFAULT_QUOTES;
    if (currentQuoteText) {
      filtered = DEFAULT_QUOTES.filter(q => q.text !== currentQuoteText);
    }
    return filtered[Math.floor(Math.random() * filtered.length)];
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

  const resetTest = useCallback((newDuration?: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const d = newDuration ?? config.duration;
    setStatus(TestStatus.IDLE);
    setUserInput('');
    setIsListening(false);
    setTimeLeft(d);
    setQuote(getRandomQuote());
    setSessionStats({
      wpm: 0,
      accuracy: 100,
      charactersTyped: 0,
      totalKeystrokes: 0,
      incorrectKeystrokes: 0,
      timeTaken: 0
    });
    startTimeRef.current = null;
  }, [config.duration]);

  // Handle Speech Input Definition
  const handleSpeechInput = (value: string) => {
    if (status === TestStatus.FINISHED) return;

    // Normalization helper (lowercase, remove punctuation)
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '');

    // Split target into words, keeping their original punctuation for reconstruction if needed
    // But simply, we want to match against the *words* of the target.
    const targetWords = quote.text.split(' ');
    const spokenWords = value.trim().split(' ');

    let matchedWordCount = 0;

    // Check how many words match from the beginning
    // We compare normalized spoken words against normalized target words
    for (let i = 0; i < spokenWords.length && i < targetWords.length; i++) {
      const spoken = normalize(spokenWords[i]);
      const target = normalize(targetWords[i]);

      if (spoken === target) {
        matchedWordCount++;
      } else {
        break;
      }
    }

    // Reconstruction:
    let constructedInput = '';
    if (matchedWordCount > 0) {
      constructedInput = targetWords.slice(0, matchedWordCount).join(' ');
      if (matchedWordCount < targetWords.length) {
        constructedInput += ' ';
      }
    }

    const accuracy = 100;

    if (matchedWordCount > 0) {
      setSessionStats(prev => ({
        ...prev,
        wpm: prev.wpm,
        accuracy: accuracy,
        totalKeystrokes: constructedInput.length,
        incorrectKeystrokes: 0
      }));

      setUserInput(constructedInput);
    }

    // Check if we matched all words
    if (matchedWordCount === targetWords.length) {
      setSessionStats(prev => ({
        ...prev,
        charactersTyped: prev.charactersTyped + constructedInput.length
      }));

      setUserInput('');

      // Stop recognition to clear buffer
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      setQuote(getRandomQuote(quote.text));
    }
  };

  // Update latestRef on every render so callbacks see fresh data/handlers
  useEffect(() => {
    latestRef.current = {
      status,
      isListening,
      quote,
      sessionStats,
      handleSpeechInput
    };
  }, [status, isListening, quote, sessionStats, handleSpeechInput]); // handleSpeechInput is constant if defined outside or depends on these

  const startTest = () => {
    setStatus(TestStatus.RUNNING);
    startTimeRef.current = Date.now();
    setIsListening(true);

    // Start Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const currentTranscript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');

        // Use latestRef to call the fresh handler
        latestRef.current.handleSpeechInput(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable microphone permissions.');
        }
      };

      recognition.onend = () => {
        // Use latestRef to check fresh state
        const { status, isListening } = latestRef.current;

        // Restart if still running (handles silence timeouts)
        if (status === TestStatus.RUNNING && isListening) {
          try {
            recognition.start();
          } catch (e) {
            // ignore
          }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error('Failed to start recognition', e);
      }
    } else {
      alert('Web Speech API not supported in this browser.');
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
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  // Real-time WPM calculation
  useEffect(() => {
    if (status !== TestStatus.RUNNING || !startTimeRef.current) return;

    const updateWpm = () => {
      const timeElapsedSec = (Date.now() - startTimeRef.current!) / 1000;
      const timeElapsedMin = timeElapsedSec / 60;

      // WPM = (all previously finished quotes chars + current input chars) / 5 / minutes
      const totalChars = sessionStats.charactersTyped + userInput.length;
      const currentWpm = timeElapsedMin > 0 ? (totalChars / 5) / timeElapsedMin : 0;

      setSessionStats(prev => ({
        ...prev,
        wpm: currentWpm,
        timeTaken: timeElapsedMin
      }));
    };

    const interval = setInterval(updateWpm, 100);
    return () => clearInterval(interval);
  }, [status, userInput.length, sessionStats.charactersTyped]);

  const themeClass = isDark ? 'bg-[#161617] text-[#f5f5f7]' : 'bg-[#fbfbfd] text-[#1d1d1f]';
  const navClass = isDark ? 'bg-black/70 border-white/10' : 'bg-white/70 border-gray-200/50';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${themeClass}`}>
      <nav className={`apple-blur sticky top-0 z-50 px-6 py-4 border-b transition-colors duration-500 ${navClass}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="SwiftVoice Logo" className="w-10 h-10 rounded-xl" />
            <h1 className="text-xl font-medium tracking-tight">SwiftVoice</h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className={`flex p-1 rounded-full border transition-colors duration-300 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100/80 border-gray-200'}`}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setConfig({ duration: d });
                    resetTest(d);
                  }}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${config.duration === d
                    ? (isDark ? 'bg-white text-black' : 'bg-white shadow-sm text-blue-600')
                    : (isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                    }`}
                >
                  {d}s
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-full border transition-all duration-300 hover:scale-110 active:scale-95 ${isDark ? 'bg-white/10 border-white/20 text-yellow-400' : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 max-w-5xl mx-auto w-full">
        <StatsOverlay
          wpm={sessionStats.wpm}
          accuracy={sessionStats.accuracy}
          timeLeft={timeLeft}
          isDark={isDark}
        />

        <div className="w-full relative min-h-[300px] flex flex-col items-center justify-center">
          {/* We pass a dummy onInputChange because we handle input via speech */}
          <TypingArea
            targetText={quote.text}
            userInput={userInput}
            isFinished={status === TestStatus.FINISHED}
            isActive={status === TestStatus.RUNNING}
            isDark={isDark}
          />

          <div className="mt-4">
            {status === TestStatus.IDLE && (
              <button
                onClick={startTest}
                className={`px-8 py-3 rounded-full font-medium transition-all duration-300 transform hover:scale-105 ${isDark ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  }`}
              >
                Start Speaking
              </button>
            )}
            {status === TestStatus.RUNNING && (
              <div className="flex items-center space-x-2 animate-pulse">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className={isDark ? 'text-white' : 'text-black'}>Listening...</span>
              </div>
            )}
          </div>

          <div className={`mt-8 text-center font-light transition-colors duration-300 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            — {quote.author}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center">
          {status === TestStatus.FINISHED && (
            <div className={`mb-8 p-8 rounded-3xl shadow-xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 border ${isDark ? 'bg-white/5 border-white/10 shadow-black/50' : 'bg-white border-gray-100 shadow-gray-200/50'
              } flex flex-col items-center max-w-md w-full`}>
              <h2 className={`text-2xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Test Results</h2>
              <div className="grid grid-cols-2 gap-8 w-full">
                <div className="text-center">
                  <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Speed</p>
                  <p className={`text-4xl font-light ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{Math.round(sessionStats.wpm)} WPM</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Accuracy</p>
                  <p className={`text-4xl font-light ${isDark ? 'text-white' : 'text-gray-800'}`}>{Math.round(sessionStats.accuracy)}%</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-500/10 w-full text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest">Total Keystrokes: {sessionStats.totalKeystrokes}</p>
              </div>
            </div>
          )}

          {(status === TestStatus.FINISHED || status === TestStatus.RUNNING) && (
            <button
              onClick={() => resetTest()}
              className={`group flex items-center space-x-2 px-8 py-3 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg ${isDark ? 'bg-white text-black hover:bg-gray-100 shadow-white/5' : 'bg-gray-900 text-white hover:bg-black shadow-gray-300'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-500 ${status === TestStatus.FINISHED ? 'rotate-180' : 'group-hover:rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium">Restart Test</span>
            </button>
          )}

          <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest">
            Press Tab to reset
          </p>
        </div>
      </main>

      <footer className={`py-8 border-t transition-colors duration-500 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
            <p>&copy; 2026 SwiftVoice. Pure Focus Voice.</p>
            <div className="flex items-center space-x-1.5">
              <span>Created by:</span>
              <a
                href="https://www.murdawkmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors duration-300 font-medium ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'}`}
              >
                Murdawk Media
              </a>
            </div>
          </div>
          <p className="text-xs italic opacity-50 mt-4 md:mt-0">Inspired by tech pioneers, from 1980 to today.</p>
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
