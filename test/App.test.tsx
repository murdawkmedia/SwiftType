import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe('App', () => {
  it('records accuracy for mobile input events without keydown', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    fireEvent.input(screen.getByLabelText('Typing input'), { target: { value: 'X' }, inputType: 'insertText' });
    expect(screen.getByLabelText('0 percent accuracy')).toBeInTheDocument();
  });

  it('lets Tab move focus without resetting a running test', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    const input = screen.getByLabelText('Typing input');
    await user.type(input, 'D');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Restart' })).toHaveFocus();
    expect(input).toHaveValue('D');
    expect(screen.queryByRole('button', { name: 'Start Keyboard' })).not.toBeInTheDocument();
  });

  it('cancels pending voice setup when switching to keyboard', async () => {
    let resolveAvailability!: (value: string) => void;
    const start = vi.fn();
    class PendingRecognition {
      static available = () => new Promise<string>((resolve) => { resolveAvailability = resolve; });
      continuous = false;
      interimResults = false;
      lang = '';
      processLocally = false;
      onresult = null;
      onerror = null;
      onend = null;
      start = start;
      stop() {}
    }
    window.SpeechRecognition = PendingRecognition as any;
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: 'Start Voice' }));
    await user.click(screen.getByRole('button', { name: 'Keyboard' }));
    await act(async () => { resolveAvailability('available'); });
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start Keyboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Typing input')).toBeDisabled();
  });

  it('loads its branding from the hosted app path', () => {
    render(<App />);
    expect(screen.getByAltText('SwiftType logo')).toHaveAttribute('src', '/swifttype/logo.png');
  });

  it('starts in keyboard mode and captures typing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    const input = screen.getByLabelText('Typing input');

    await user.type(input, 'D');

    expect(input).toHaveValue('D');
    expect(screen.getByTestId('char-0')).toHaveClass('is-correct');
  });

  it('keeps corrected keyboard errors in accuracy stats', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    const input = screen.getByLabelText('Typing input');

    await user.type(input, 'X');

    expect(screen.getByTestId('char-0')).toHaveClass('is-incorrect');
    expect(screen.getByLabelText('0 percent accuracy')).toBeInTheDocument();
  });

  it('resets duration and formats long timers', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '60s' }));

    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('does not start the timer when speech recognition is unsupported', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: 'Start Voice' }));

    expect(
      screen.getByText(/Voice input is not supported in this browser/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('30 seconds remaining')).toBeInTheDocument();
  });

  it('returns to idle when microphone permission is denied', async () => {
    class DeniedRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((event: { results: ArrayLike<any> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onerror?.({ error: 'not-allowed' });
      }
      stop() {}
    }

    window.SpeechRecognition = DeniedRecognition as any;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: 'Start Voice' }));

    expect(
      await screen.findByText(/Microphone access was denied/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Voice' })).toBeInTheDocument();
  });

  it('finishes when the timer expires', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Keyboard' }));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByRole('heading', { name: 'Test Results' })).toBeInTheDocument();
  });

  it('includes the unfinished quote in final character and speed stats', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    fireEvent.input(screen.getByLabelText('Typing input'), { target: { value: 'Design is' } });
    act(() => { vi.advanceTimersByTime(30_000); });
    const results = screen.getByRole('region', { name: 'Test results' });
    expect(results).toHaveTextContent('Characters9');
    expect(results).toHaveTextContent('Speed4 WPM');
  });

  it('finishes on time after the browser delays a timer tick', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Keyboard' }));
    vi.setSystemTime(Date.now() + 60_000);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('heading', { name: 'Test Results' })).toBeInTheDocument();
  });
});
