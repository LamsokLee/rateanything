/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ArenaLeaderboard } from '../ArenaLeaderboard';

const MOCK_LEADERBOARD_RESPONSE = {
  result: {
    data: {
      json: {
        entries: [
          { rank: 1, optionId: 'opt-1', name: 'Top Option', imageUrl: null, eloRating: 1600, matchCount: 20, winCount: 15, lossCount: 5, winPercentage: 75 },
          { rank: 2, optionId: 'opt-2', name: 'Second Option', imageUrl: null, eloRating: 1520, matchCount: 18, winCount: 10, lossCount: 8, winPercentage: 56 },
          { rank: 3, optionId: 'opt-3', name: 'Third Option', imageUrl: null, eloRating: 1480, matchCount: 16, winCount: 7, lossCount: 9, winPercentage: 44 },
          { rank: 4, optionId: 'opt-4', name: 'Fourth Option', imageUrl: null, eloRating: 1400, matchCount: 14, winCount: 4, lossCount: 10, winPercentage: 29 },
        ],
        totalVotes: 34,
      },
    },
  },
};

const MOCK_EMPTY_RESPONSE = {
  result: {
    data: {
      json: {
        entries: [],
        totalVotes: 0,
      },
    },
  },
};

const MOCK_EARLY_RESPONSE = {
  result: {
    data: {
      json: {
        entries: [
          { rank: 1, optionId: 'opt-1', name: 'Leader', imageUrl: null, eloRating: 1516, matchCount: 2, winCount: 1, lossCount: 1, winPercentage: 50 },
        ],
        totalVotes: 1,
      },
    },
  },
};

describe('ArenaLeaderboard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // never resolves
    render(<ArenaLeaderboard topicId="topic-1" />);
    expect(screen.getByTestId('leaderboard-loading')).toBeInTheDocument();
  });

  it('renders leaderboard entries after successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEADERBOARD_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText('Top Option')).toBeInTheDocument();
      expect(screen.getByText('Second Option')).toBeInTheDocument();
      expect(screen.getByText('Third Option')).toBeInTheDocument();
      expect(screen.getByText('Fourth Option')).toBeInTheDocument();
    });
  });

  it('shows rank badges (gold/silver/bronze) for top 3', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEADERBOARD_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      // Top 3 have styled rank badges, 4th has plain text
      const badges = screen.getAllByText(/^[1-3]$/);
      expect(badges.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows total match count', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEADERBOARD_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText('34 matches')).toBeInTheDocument();
    });
  });

  it('shows empty state when no votes exist', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_EMPTY_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText(/no arena votes yet/i)).toBeInTheDocument();
    });
  });

  it('shows insufficient data warning when below threshold', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_EARLY_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText(/early rankings/i)).toBeInTheDocument();
    });
  });

  it('shows error state with retry button on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('refetches when refreshKey changes', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEADERBOARD_RESPONSE) })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(<ArenaLeaderboard topicId="topic-1" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('Top Option')).toBeInTheDocument();
    });

    // Trigger refresh
    rerender(<ArenaLeaderboard topicId="topic-1" refreshKey={1} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('displays Elo rating for each entry', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LEADERBOARD_RESPONSE) })
    ));

    render(<ArenaLeaderboard topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText('1600')).toBeInTheDocument();
      expect(screen.getByText('1520')).toBeInTheDocument();
    });
  });
});
