
export enum TestStatus {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  charactersTyped: number;
  totalKeystrokes: number;
  incorrectKeystrokes: number;
  timeTaken: number;
}

export interface TestConfig {
  duration: number; // in seconds
}

export interface Quote {
  text: string;
  author: string;
}
