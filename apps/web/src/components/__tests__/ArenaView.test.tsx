/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
import { ArenaView } from '../ArenaView';

const mockedUseAuth = vi.mocked(useAuth);

const MOCK_PAIR_RESPONSE = {
  result: {
    data: {
      json: {
        insufficientOptions: false,
        optionA: {
          id: 'opt-a-id',
          name: 'Option Alpha',
          imageUrl: null,
          eloRating: 1500,
          matchCount: 10,
        },
        optionB: {
          id: 'opt-b-id',
          name: 'Option Beta',
          imageUrl: null,
          eloRating: 1500,
          matchCount: 8,
        },
      },
    },
  },
};

const MOCK_VOTE_RESPONSE = {
  result: {
    data: {
      json: {
        matchId: 'vote-123',
        newEloA: 1516,
        newEloB: 1484,
      },
    },
  },
};

const MOCK_INSUFFICIENT_RESPONSE = {
  result: {
    data: {
      json: {
        insufficientOptions: true,
        optionA: null,
        optionB: null,
      },
    },
  },
};

function mockFetch(responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  let callIndex = 0;
  return vi.fn(() => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return Promise.resolve(response);
  });
}

describe('ArenaView', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
  });

  it('shows loading placeholders on the persistent card initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // never resolves
    render(<ArenaView topicId="topic-1" />);
    // The refactored ArenaView keeps the split-card in place during initial
    // load and surfaces loading state via aria-labels on the two halves
    // rather than a separate skeleton element.
    expect(screen.getByLabelText('Loading option A')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading option B')).toBeInTheDocument();
  });

  it('renders two option cards after successful fetch', async () => {
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
    ]));

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick Option Alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pick Option Beta/i })).toBeInTheDocument();
    });
  });

  it('shows insufficient options message when topic has < 2 options', async () => {
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_INSUFFICIENT_RESPONSE) },
    ]));

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByText(/needs at least 2 options/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure and provides retry button', async () => {
    vi.stubGlobal('fetch', mockFetch([
      { ok: false, json: () => Promise.resolve({}) },
    ]));

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('submits vote when card is clicked and shows reveal state', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
      { ok: true, json: () => Promise.resolve(MOCK_VOTE_RESPONSE) },
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) }, // next pair
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<ArenaView topicId="topic-1" />);

    // Wait for cards to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick Option Alpha/i })).toBeInTheDocument();
    });

    // Click option A
    await userEvent.click(screen.getByRole('button', { name: /Pick Option Alpha/i }));

    // Should show vote result
    await waitFor(() => {
      expect(screen.getByText(/Winner!/i)).toBeInTheDocument();
    });

    // Verify vote was submitted to correct endpoint
    const postCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => c[1] && typeof c[1] === 'object' && (c[1] as Record<string, unknown>).method === 'POST'
    );
    expect(postCalls.length).toBe(1);
    const body = JSON.parse((postCalls[0][1] as Record<string, unknown>).body as string);
    expect(body.json.winnerOptionId).toBe('opt-a-id');
  });

  it('provides a skip button that calls arena.skip', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
      { ok: true, json: () => Promise.resolve({ result: { data: { json: { matchId: 'skip-1', skipped: true } } } }) },
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip this pair/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /skip this pair/i }));

    // Should call skip endpoint
    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c: unknown[]) => {
          if (!c[1] || typeof c[1] !== 'object') return false;
          const opts = c[1] as Record<string, unknown>;
          return opts.method === 'POST' && typeof c[0] === 'string' && (c[0] as string).includes('skip');
        }
      );
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('includes guest fingerprint for unauthenticated users', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    const fetchMock = mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
      { ok: true, json: () => Promise.resolve(MOCK_VOTE_RESPONSE) },
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick Option Alpha/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Pick Option Alpha/i }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c: unknown[]) => c[1] && typeof c[1] === 'object' && (c[1] as Record<string, unknown>).method === 'POST'
      );
      expect(postCalls.length).toBe(1);
      const body = JSON.parse((postCalls[0][1] as Record<string, unknown>).body as string);
      expect(body.json.guestFingerprint).toBeDefined();
      expect(typeof body.json.guestFingerprint).toBe('string');
    });
  });

  it('disables cards while submitting', async () => {
    // Make vote response slow
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('getPair')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) });
      }
      // Slow vote response
      return new Promise((resolve) =>
        setTimeout(() => resolve({ ok: true, json: () => Promise.resolve(MOCK_VOTE_RESPONSE) }), 2000)
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick Option Alpha/i })).toBeInTheDocument();
    });

    // Click option A
    fireEvent.click(screen.getByRole('button', { name: /Pick Option Alpha/i }));

    // Both cards should be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick Option Alpha/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Pick Option Beta/i })).toBeDisabled();
    });
  });

  it('has accessible labels on cards and skip button', async () => {
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, json: () => Promise.resolve(MOCK_PAIR_RESPONSE) },
    ]));

    render(<ArenaView topicId="topic-1" />);

    await waitFor(() => {
      // Cards have descriptive aria-labels
      expect(screen.getByRole('button', { name: /Pick Option Alpha \(option A\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pick Option Beta \(option B\)/i })).toBeInTheDocument();
      // Skip button is accessible
      expect(screen.getByRole('button', { name: /skip this pair/i })).toBeInTheDocument();
      // Group is labeled
      expect(screen.getByRole('group', { name: /choose between two options/i })).toBeInTheDocument();
    });
  });
});
