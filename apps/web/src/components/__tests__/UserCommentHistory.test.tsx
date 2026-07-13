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

import { UserCommentHistory } from '../UserCommentHistory';

const baseItems = [
  { id: 'c1', content: 'Great option!', topicTitle: 'Best IDE', topicSlug: 'best-ide', score: 5, createdAt: '2026-01-15T12:00:00Z' },
  { id: 'c2', content: 'I disagree with this ranking', topicTitle: 'Best Language', topicSlug: 'best-language', score: -2, createdAt: '2026-02-20T08:00:00Z' },
];

describe('UserCommentHistory', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders comment history items with content, topic, score, and date', () => {
    render(
      <UserCommentHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.getAllByText('Great option!').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Best IDE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Jan 15, 2026').length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText('I disagree with this ranking').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Best Language').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-2').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state message when no items', () => {
    render(
      <UserCommentHistory initialItems={[]} initialCursor={null} username="testuser" />
    );

    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  it('renders links to topic pages', () => {
    render(
      <UserCommentHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    const links = screen.getAllByRole('link', { name: 'Best IDE' });
    expect(links[0]).toHaveAttribute('href', '/topic/best-ide');
  });

  it('truncates long comment content with ellipsis', () => {
    const longContent = 'A'.repeat(150);
    const items = [
      { id: 'c3', content: longContent, topicTitle: 'Topic', topicSlug: 'topic', score: 1, createdAt: '2026-03-01T00:00:00Z' },
    ];

    render(
      <UserCommentHistory initialItems={items} initialCursor={null} username="testuser" />
    );

    const truncated = 'A'.repeat(120) + '\u2026';
    expect(screen.getAllByText(truncated).length).toBeGreaterThanOrEqual(1);
  });

  it('does not show Load More button when cursor is null', () => {
    render(
      <UserCommentHistory initialItems={baseItems} initialCursor={null} username="testuser" />
    );

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows Load More button when cursor is provided', () => {
    render(
      <UserCommentHistory initialItems={baseItems} initialCursor="cursor456" username="testuser" />
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
                { id: 'c3', content: 'New comment', topicTitle: 'New Topic', topicSlug: 'new-topic', score: 3, createdAt: '2026-04-01T00:00:00Z' },
              ],
              nextCursor: 'cursor789',
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UserCommentHistory initialItems={baseItems} initialCursor="cursor456" username="testuser" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/trpc/users.getCommentHistory');
    expect(callUrl).toContain('cursor456');
    expect(callUrl).toContain('testuser');

    await waitFor(() => {
      expect(screen.getAllByText('New comment').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('shows Loading... while fetching', async () => {
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    render(
      <UserCommentHistory initialItems={baseItems} initialCursor="abc" username="testuser" />
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
