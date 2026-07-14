/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true })),
}));

/**
 * Mock Next.js navigation hooks.
 * useSearchParams returns a URLSearchParams instance that we control.
 * useRouter returns a push mock to capture navigation calls.
 */
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import { TopicPageClient } from '../TopicPageClient';

const MOCK_OPTIONS = [
  { id: 'opt-1', name: 'Alpha', avgRating: 8.5, ratingCount: 20, userRating: null },
  { id: 'opt-2', name: 'Beta', avgRating: 7.0, ratingCount: 15, userRating: 7 },
  { id: 'opt-3', name: 'Gamma', avgRating: 6.2, ratingCount: 10, userRating: null },
];

const CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];

const DEFAULT_PROPS = {
  topicId: 'topic-123',
  sortedOptions: MOCK_OPTIONS,
  optionColorMap: { 'opt-1': '#3b82f6', 'opt-2': '#ef4444', 'opt-3': '#22c55e' },
  historyByOption: {},
  chartColors: CHART_COLORS,
};

describe('TopicPageClient', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no ?mode= param (arena is default)
    mockSearchParams = new URLSearchParams('');
    // Mock fetch for ArenaView and ArenaLeaderboard (hangs by default)
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  it('defaults to Arena mode', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // Arena tab should be selected
    expect(screen.getByRole('tab', { name: /arena/i })).toHaveAttribute('aria-selected', 'true');
    // Arena panel should be visible (query by id)
    expect(document.getElementById('panel-arena')).toBeInTheDocument();
  });

  it('does not render Ratings panel in Arena mode', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // Ratings panel should NOT be visible
    expect(document.getElementById('panel-ratings')).not.toBeInTheDocument();
  });

  it('switches to Ratings mode when Ratings tab is clicked', async () => {
    // Simulate ?mode=rate in URL for the re-render after click
    mockSearchParams = new URLSearchParams('mode=rate');
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // With mode=rate in params, Ratings panel should appear with option names
    await waitFor(() => {
      expect(document.getElementById('panel-ratings')).toBeInTheDocument();
      expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Gamma').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('hides Arena panel when in Ratings mode', () => {
    mockSearchParams = new URLSearchParams('mode=rate');
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(document.getElementById('panel-arena')).not.toBeInTheDocument();
  });

  it('switches back to Arena mode from Ratings', () => {
    // Start in arena mode (default)
    mockSearchParams = new URLSearchParams('');
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // Arena panel visible
    expect(document.getElementById('panel-arena')).toBeInTheDocument();
  });

  it('renders the ranked options table in Ratings mode', () => {
    mockSearchParams = new URLSearchParams('mode=rate');
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // Should show "Options" heading and "Ranked by average rating" subtitle
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getByText('Ranked by average rating')).toBeInTheDocument();
  });

  it('always shows the mode switch', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(screen.getByRole('tablist', { name: /topic interaction mode/i })).toBeInTheDocument();
  });

  it('calls router.push with ?mode=rate when Rate tab is clicked', async () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    await userEvent.click(screen.getByRole('tab', { name: /rate 1-10/i }));

    expect(mockPush).toHaveBeenCalledWith('?mode=rate', { scroll: false });
  });

  it('calls router.push without mode param when Arena tab is clicked', async () => {
    mockSearchParams = new URLSearchParams('mode=rate');
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    await userEvent.click(screen.getByRole('tab', { name: /arena/i }));

    expect(mockPush).toHaveBeenCalledWith('?', { scroll: false });
  });
});
