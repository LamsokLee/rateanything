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

import { UserRatingHistory } from '../UserRatingHistory';

const baseItems = [
  { topicTitle: 'Best IDE', topicSlug: 'best-ide', optionName: 'VS Code', score: 9, createdAt: '2026-01-15T12:00:00Z' },
  { topicTitle: 'Best Language', topicSlug: 'best-language', optionName: 'TypeScript', score: 8, createdAt: '2026-02-20T08:00:00Z' },
];

describe('UserRatingHistory', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders rating history items with topic, option, score, and formatted date', () => {
    render(
      <UserRatingHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.getAllByText('Best IDE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('VS Code').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('9').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Jan 15, 2026').length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText('Best Language').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Feb 20, 2026').length).toBeGreaterThanOrEqual(1);
  });

  it('renders links to topic pages', () => {
    render(
      <UserRatingHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    const links = screen.getAllByRole('link', { name: 'Best IDE' });
    expect(links[0]).toHaveAttribute('href', '/topic/best-ide');
  });

  it('renders empty state when initialItems is empty (table header only, no rows)', () => {
    render(
      <UserRatingHistory initialItems={[]} initialCursor={null} username="testuser" />
    );

    // No Load More button
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    // Table header is still rendered but no data links
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('does not show Load More button when initialCursor is null', () => {
    render(
      <UserRatingHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows Load More button when initialCursor is provided', () => {
    render(
      <UserRatingHistory initialItems={baseItems} initialCursor="cursor123" username="testuser" />
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
                { topicTitle: 'Best Framework', topicSlug: 'best-framework', optionName: 'React', score: 7, createdAt: '2026-03-10T10:00:00Z' },
              ],
              nextCursor: null,
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UserRatingHistory initialItems={baseItems} initialCursor="cursor123" username="testuser" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/trpc/users.getRatingHistory');
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
      <UserRatingHistory initialItems={baseItems} initialCursor="abc" username="testuser" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();

    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { items: [], nextCursor: null } } } }),
    });
  });
});
