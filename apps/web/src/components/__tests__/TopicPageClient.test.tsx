/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true })),
}));

let mockMode: 'arena' | 'rate' = 'arena';

vi.mock('@/components/ModeProvider', () => ({
  useMode: () => ({ mode: mockMode, setMode: vi.fn(), toggleMode: vi.fn() }),
}));

// Mock fetch for ArenaView and ArenaLeaderboard (hangs by default)
vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

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
    mockMode = 'arena';
  });

  it('defaults to Arena panel', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(document.getElementById('panel-arena')).toBeInTheDocument();
    expect(document.getElementById('panel-ratings')).not.toBeInTheDocument();
  });

  it('does not render Ratings panel in Arena mode', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(document.getElementById('panel-ratings')).not.toBeInTheDocument();
  });

  it('renders Ratings panel in Rating mode', () => {
    mockMode = 'rate';
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    // Ratings panel should appear with option names
    waitFor(() => {
      expect(document.getElementById('panel-ratings')).toBeInTheDocument();
      expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Gamma').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('hides Arena panel when in Rating mode', () => {
    mockMode = 'rate';
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(document.getElementById('panel-arena')).not.toBeInTheDocument();
  });

  it('renders the ranked options table in Rating mode', () => {
    mockMode = 'rate';
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getByText('Ranked by average rating')).toBeInTheDocument();
  });

  it('does not render a local mode toggle', () => {
    render(<TopicPageClient {...DEFAULT_PROPS} />);

    expect(screen.queryByRole('tablist', { name: /topic interaction mode/i })).not.toBeInTheDocument();
  });
});
