
export enum TestStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export enum InputMode {
  KEYBOARD = 'KEYBOARD',
  VOICE = 'VOICE'
}

export enum VoiceProcessingMode {
  UNKNOWN = 'UNKNOWN',
  ON_DEVICE = 'ON_DEVICE',
  BROWSER_PROVIDER = 'BROWSER_PROVIDER'
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  charactersTyped: number;
  totalKeystrokes: number;
  incorrectKeystrokes: number;
  timeTaken: number;
  wordsTyped: number;
}

export interface TestConfig {
  duration: number; // in seconds
}

export interface Quote {
  text: string;
  author: string;
}
