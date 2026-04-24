import { TypingStats } from '../types';

export const EMPTY_STATS: TypingStats = {
  wpm: 0,
  accuracy: 100,
  charactersTyped: 0,
  totalKeystrokes: 0,
  incorrectKeystrokes: 0,
  timeTaken: 0,
  wordsTyped: 0,
};

export interface SpeechMatch {
  matchedWordCount: number;
  targetWordCount: number;
  displayInput: string;
  completedInput: string;
  isComplete: boolean;
}

export const createEmptyStats = (): TypingStats => ({ ...EMPTY_STATS });

export const normalizeSpeechToken = (value: string): string =>
  value.toLowerCase().replace(/[^\w\s]/g, '').trim();

export const splitWords = (value: string): string[] =>
  value.trim().split(/\s+/).filter(Boolean);

export const countWords = (value: string): number => splitWords(value).length;

export const buildTranscriptFromResults = (results: ArrayLike<any>): string =>
  Array.from(results)
    .map((result: any) => result?.[0]?.transcript?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

export const matchSpeechPrefix = (
  targetText: string,
  transcript: string
): SpeechMatch => {
  const targetWords = splitWords(targetText);
  const spokenWords = splitWords(transcript);
  let matchedWordCount = 0;

  for (
    let index = 0;
    index < spokenWords.length && index < targetWords.length;
    index += 1
  ) {
    if (
      normalizeSpeechToken(spokenWords[index]) !==
      normalizeSpeechToken(targetWords[index])
    ) {
      break;
    }
    matchedWordCount += 1;
  }

  const completedInput = targetWords.slice(0, matchedWordCount).join(' ');
  const isComplete =
    targetWords.length > 0 && matchedWordCount === targetWords.length;
  const displayInput =
    completedInput && !isComplete ? `${completedInput} ` : completedInput;

  return {
    matchedWordCount,
    targetWordCount: targetWords.length,
    displayInput,
    completedInput,
    isComplete,
  };
};

export const calculateWpm = (
  completedCharacters: number,
  currentCharacters: number,
  elapsedMs: number
): number => {
  if (elapsedMs <= 0) return 0;
  const elapsedMinutes = elapsedMs / 1000 / 60;
  return (completedCharacters + currentCharacters) / 5 / elapsedMinutes;
};

export const formatTime = (seconds: number, totalDuration: number): string => {
  if (totalDuration >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
};

export const recordKeystroke = (
  stats: TypingStats,
  isCorrect: boolean
): TypingStats => {
  const totalKeystrokes = stats.totalKeystrokes + 1;
  const incorrectKeystrokes =
    stats.incorrectKeystrokes + (isCorrect ? 0 : 1);
  const accuracy =
    totalKeystrokes === 0
      ? 100
      : ((totalKeystrokes - incorrectKeystrokes) / totalKeystrokes) * 100;

  return {
    ...stats,
    totalKeystrokes,
    incorrectKeystrokes,
    accuracy,
  };
};
