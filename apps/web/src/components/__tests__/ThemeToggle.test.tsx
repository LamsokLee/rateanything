/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    setTheme: mockSetTheme,
  })),
}));

import { useTheme } from 'next-themes';
import { ThemeToggle } from '../ThemeToggle';

const mockedUseTheme = vi.mocked(useTheme);

describe('ThemeToggle', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTheme.mockReturnValue({
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      theme: 'dark',
      themes: ['light', 'dark'],
      systemTheme: 'dark',
      forcedTheme: undefined,
    });
  });

  it('renders a button with correct aria-label for dark mode', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('renders a button with correct aria-label for light mode', () => {
    mockedUseTheme.mockReturnValue({
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      theme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('calls setTheme with "light" when clicking in dark mode', async () => {
    render(<ThemeToggle />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with "dark" when clicking in light mode', async () => {
    mockedUseTheme.mockReturnValue({
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      theme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    render(<ThemeToggle />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('renders sun icon SVG in dark mode', () => {
    const { container } = render(<ThemeToggle />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders moon icon (fillRule evenodd) in light mode', () => {
    mockedUseTheme.mockReturnValue({
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      theme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    const { container } = render(<ThemeToggle />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const moonPath = container.querySelector('path[fill-rule="evenodd"]');
    expect(moonPath).toBeInTheDocument();
  });
});
