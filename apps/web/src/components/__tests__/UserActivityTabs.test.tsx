/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../UserRatingHistory', () => ({
  UserRatingHistory: ({ initialItems }: { initialItems: unknown[] }) => (
    <div data-testid="rating-history">Rating items: {initialItems.length}</div>
  ),
}));

vi.mock('../UserCommentHistory', () => ({
  UserCommentHistory: ({ initialItems }: { initialItems: unknown[] }) => (
    <div data-testid="comment-history">Comment items: {initialItems.length}</div>
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { UserActivityTabs } from '../UserActivityTabs';

const baseProps = {
  username: 'alice',
  initialRatingItems: [
    { topicTitle: 'Best Language', topicSlug: 'best-language', optionName: 'Rust', score: 9, createdAt: new Date().toISOString() },
  ],
  initialRatingCursor: null,
  initialCommentItems: [
    { id: 'cm1', content: 'Nice topic', topicTitle: 'Best Language', topicSlug: 'best-language', score: 3, createdAt: new Date().toISOString() },
  ],
  initialCommentCursor: null,
  initialCreatedTopics: [
    { id: 't1', title: 'Best Programming Language', slug: 'best-programming-language', totalRatings: 42, createdAt: new Date().toISOString(), categoryName: 'Tech', categorySlug: 'tech' },
  ],
};

describe('UserActivityTabs', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders three tab buttons: Votes, Comments, Topics', () => {
    render(<UserActivityTabs {...baseProps} />);

    expect(screen.getByRole('tab', { name: 'Votes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Comments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Topics' })).toBeInTheDocument();
  });

  it('shows Votes panel by default', () => {
    render(<UserActivityTabs {...baseProps} />);

    expect(screen.getByRole('tab', { name: 'Votes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('rating-history')).toBeInTheDocument();
  });

  it('switching to Comments tab shows comments panel', async () => {
    render(<UserActivityTabs {...baseProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Comments' }));

    expect(screen.getByRole('tab', { name: 'Comments' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('comment-history')).toBeInTheDocument();
  });

  it('switching to Topics tab shows created topics', async () => {
    render(<UserActivityTabs {...baseProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Topics' }));

    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Best Programming Language')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('42 votes')).toBeInTheDocument();
  });

  it('Topics tab shows empty state when no created topics', async () => {
    render(<UserActivityTabs {...baseProps} initialCreatedTopics={[]} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Topics' }));

    expect(screen.getByText('No topics created yet.')).toBeInTheDocument();
  });

  it('Votes tab shows empty state when no rating items', () => {
    render(<UserActivityTabs {...baseProps} initialRatingItems={[]} />);

    expect(screen.getByText('No votes yet.')).toBeInTheDocument();
  });

  it('tab panels have correct ARIA attributes', () => {
    render(<UserActivityTabs {...baseProps} />);

    const votesPanel = screen.getByRole('tabpanel', { name: 'Votes' });
    expect(votesPanel).toHaveAttribute('aria-labelledby', 'tab-votes');
    expect(votesPanel).toHaveAttribute('id', 'tabpanel-votes');
  });

  it('Topics tab renders topic links to correct URLs', async () => {
    render(<UserActivityTabs {...baseProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Topics' }));

    const link = screen.getByRole('link', { name: /Best Programming Language/i });
    expect(link).toHaveAttribute('href', '/topic/best-programming-language');
  });
});
