/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: (d: Date | string | number) => {
    const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  },
}));

import { UserArenaVoteHistory } from '../UserArenaVoteHistory';

const baseItems = [
  { id: 'vote-1', topicTitle: 'Best IDE', topicSlug: 'best-ide', winnerName: 'VS Code', loserName: 'Vim', createdAt: '2026-01-15T12:00:00Z' },
  { id: 'vote-2', topicTitle: 'Best Language', topicSlug: 'best-language', winnerName: 'TypeScript', loserName: 'JavaScript', createdAt: '2026-02-20T08:00:00Z' },
];

describe('UserArenaVoteHistory', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders arena vote items with "Picked X over Y" text', () => {
    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.getAllByText(/Picked/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('VS Code').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vim').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JavaScript').length).toBeGreaterThanOrEqual(1);
  });

  it('renders links to topic pages with arena mode', () => {
    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    const links = screen.getAllByRole('link', { name: 'Best IDE' });
    expect(links[0]).toHaveAttribute('href', '/topic/best-ide?mode=arena');
  });

  it('renders empty state when no items', () => {
    render(
      <UserArenaVoteHistory initialItems={[]} initialCursor={null} username="testuser" />
    );

    expect(screen.getByText('No arena votes yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('does not show Load More button when initialCursor is null', () => {
    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows Load More button when initialCursor is provided', () => {
    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor="cursor123" username="testuser" />
    );

    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('clicking Load More fetches next page and appends items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          data: {
            json: {
              items: [
                { id: 'vote-3', topicTitle: 'Best Framework', topicSlug: 'best-framework', winnerName: 'React', loserName: 'Angular', createdAt: '2026-03-10T10:00:00Z' },
              ],
              nextCursor: null,
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor="cursor123" username="testuser" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/trpc/users.getArenaVoteHistory');
    expect(callUrl).toContain('cursor123');
    expect(callUrl).toContain('testuser');

    await waitFor(() => {
      expect(screen.getAllByText('Best Framework').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('React').length).toBeGreaterThanOrEqual(1);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  it('shows Loading... text while fetching more items', async () => {
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor="abc" username="testuser" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();

    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { items: [], nextCursor: null } } } }),
    });
  });

  it('renders formatted dates', () => {
    render(
      <UserArenaVoteHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.getAllByText('Jan 15, 2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Feb 20, 2026').length).toBeGreaterThanOrEqual(1);
  });
});
