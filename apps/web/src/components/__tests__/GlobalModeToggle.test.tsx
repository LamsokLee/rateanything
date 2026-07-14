/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetMode = vi.fn();
let mockMode: 'arena' | 'rate' = 'arena';

vi.mock('@/components/ModeProvider', () => ({
  useMode: () => ({ mode: mockMode, setMode: mockSetMode, toggleMode: vi.fn() }),
}));

import { GlobalModeToggle } from '../GlobalModeToggle';

describe('GlobalModeToggle', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = 'arena';
  });

  it('renders Arena and Rate tabs', () => {
    render(<GlobalModeToggle />);

    expect(screen.getByRole('tab', { name: 'Arena mode' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rating mode' })).toBeInTheDocument();
  });

  it('marks Arena tab as selected in Arena mode', () => {
    mockMode = 'arena';
    render(<GlobalModeToggle />);

    expect(screen.getByRole('tab', { name: 'Arena mode' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Rating mode' })).toHaveAttribute('aria-selected', 'false');
  });

  it('marks Rate tab as selected in Rate mode', () => {
    mockMode = 'rate';
    render(<GlobalModeToggle />);

    expect(screen.getByRole('tab', { name: 'Rating mode' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Arena mode' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls setMode with "rate" when Rate tab is clicked', async () => {
    render(<GlobalModeToggle />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Rating mode' }));

    expect(mockSetMode).toHaveBeenCalledWith('rate');
  });

  it('calls setMode with "arena" when Arena tab is clicked', async () => {
    mockMode = 'rate';
    render(<GlobalModeToggle />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Arena mode' }));

    expect(mockSetMode).toHaveBeenCalledWith('arena');
  });
});
