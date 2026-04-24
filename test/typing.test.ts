import { describe, expect, it } from 'vitest';
import {
  buildTranscriptFromResults,
  calculateWpm,
  createEmptyStats,
  formatTime,
  matchSpeechPrefix,
  normalizeSpeechToken,
  recordKeystroke,
} from '../lib/typing';

describe('typing utilities', () => {
  it('normalizes speech tokens', () => {
    expect(normalizeSpeechToken('Hello, WORLD!')).toBe('hello world');
  });

  it('joins speech recognition segments with spaces', () => {
    const results = [
      [{ transcript: 'Design is' }],
      [{ transcript: ' how it works' }],
    ];

    expect(buildTranscriptFromResults(results)).toBe('Design is how it works');
  });

  it('prefix matches spoken words against the target', () => {
    const match = matchSpeechPrefix(
      'Design is how it works.',
      'design is how'
    );

    expect(match).toMatchObject({
      matchedWordCount: 3,
      targetWordCount: 5,
      displayInput: 'Design is how ',
      completedInput: 'Design is how',
      isComplete: false,
    });
  });

  it('detects completed voice quotes', () => {
    const match = matchSpeechPrefix(
      'Design is how it works.',
      'design is how it works'
    );

    expect(match.isComplete).toBe(true);
    expect(match.displayInput).toBe('Design is how it works.');
  });

  it('calculates WPM safely', () => {
    expect(calculateWpm(25, 25, 60_000)).toBe(10);
    expect(calculateWpm(0, 0, 0)).toBe(0);
  });

  it('formats long durations as minutes and seconds', () => {
    expect(formatTime(62, 120)).toBe('1:02');
    expect(formatTime(14, 15)).toBe('14s');
  });

  it('records keyboard accuracy even when mistakes are corrected later', () => {
    const afterCorrect = recordKeystroke(createEmptyStats(), true);
    const afterWrong = recordKeystroke(afterCorrect, false);

    expect(afterWrong.totalKeystrokes).toBe(2);
    expect(afterWrong.incorrectKeystrokes).toBe(1);
    expect(afterWrong.accuracy).toBe(50);
  });
});
