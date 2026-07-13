/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { TopicCard } from '../TopicCard';

const baseTopic = {
  id: 't1',
  title: 'Best Programming Languages',
  slug: 'best-programming-languages',
  description: 'A comprehensive comparison',
  totalRatings: 42,
  trendingScore: null,
  categoryName: 'Tech',
  categorySlug: 'tech',
  creatorUsername: 'alice',
  createdAt: '2024-01-01T00:00:00Z',
  topOptions: [
    { name: 'Rust', avgRating: 8.5 },
    { name: 'TypeScript', avgRating: 7.2 },
    { name: 'Python', avgRating: 6.8 },
  ],
  optionCount: 5,
};

describe('TopicCard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders topic title as a link to /topic/{slug}', () => {
    render(<TopicCard topic={baseTopic} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/topic/best-programming-languages');
    expect(screen.getByText('Best Programming Languages')).toBeInTheDocument();
  });

  it('renders category name', () => {
    render(<TopicCard topic={baseTopic} />);

    expect(screen.getByText('Tech')).toBeInTheDocument();
  });

  it('renders formatted vote count', () => {
    render(<TopicCard topic={baseTopic} />);

    expect(screen.getByText('42 votes')).toBeInTheDocument();
  });

  it('renders vote count with K format for >= 1000', () => {
    render(<TopicCard topic={{ ...baseTopic, totalRatings: 1500 }} />);

    expect(screen.getByText('1.5K votes')).toBeInTheDocument();
  });

  it('renders top options with scores (max 3 when not featured)', () => {
    render(<TopicCard topic={baseTopic} />);

    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('7.2')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('6.8')).toBeInTheDocument();
  });

  it('renders up to 5 options when featured', () => {
    const topicWith5Options = {
      ...baseTopic,
      topOptions: [
        { name: 'Rust', avgRating: 8.5 },
        { name: 'TypeScript', avgRating: 7.2 },
        { name: 'Python', avgRating: 6.8 },
        { name: 'Go', avgRating: 6.5 },
        { name: 'Java', avgRating: 5.9 },
      ],
    };

    render(<TopicCard topic={topicWith5Options} featured={true} />);

    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
  });

  it('renders description when featured', () => {
    render(<TopicCard topic={baseTopic} featured={true} />);

    expect(screen.getByText('A comprehensive comparison')).toBeInTheDocument();
  });

  it('does not render description when not featured', () => {
    render(<TopicCard topic={baseTopic} featured={false} />);

    expect(screen.queryByText('A comprehensive comparison')).not.toBeInTheDocument();
  });

  it('renders option count when optionCount is provided', () => {
    render(<TopicCard topic={baseTopic} />);

    expect(screen.getByText('5 options')).toBeInTheDocument();
  });

  it('renders "New" badge for topics created within 24 hours', () => {
    const recentTopic = { ...baseTopic, createdAt: new Date().toISOString() };

    render(<TopicCard topic={recentTopic} />);

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not render "New" badge for old topics', () => {
    render(<TopicCard topic={baseTopic} />);

    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('renders "Trending" badge when trendingScore > 5 and not new', () => {
    const trendingTopic = {
      ...baseTopic,
      trendingScore: 10,
      createdAt: '2023-01-01T00:00:00Z',
    };

    render(<TopicCard topic={trendingTopic} />);

    expect(screen.getByText(/Trending/)).toBeInTheDocument();
  });

  it('renders "Trending" badge when totalRatings > 20 and not new', () => {
    const popularTopic = {
      ...baseTopic,
      totalRatings: 25,
      trendingScore: null,
      createdAt: '2023-01-01T00:00:00Z',
    };

    render(<TopicCard topic={popularTopic} />);

    expect(screen.getByText(/Trending/)).toBeInTheDocument();
  });

  it('does not render Trending badge when topic is New (New takes priority)', () => {
    const newAndTrending = {
      ...baseTopic,
      trendingScore: 10,
      createdAt: new Date().toISOString(),
    };

    render(<TopicCard topic={newAndTrending} />);

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText(/Trending/)).not.toBeInTheDocument();
  });

  it('renders em dash for options with avgRating of 0', () => {
    const topicNoRatings = {
      ...baseTopic,
      topOptions: [{ name: 'Unrated Option', avgRating: 0 }],
    };

    render(<TopicCard topic={topicNoRatings} />);

    expect(screen.getByText('Unrated Option')).toBeInTheDocument();
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('clicking category button navigates to /category/{slug}', async () => {
    render(<TopicCard topic={baseTopic} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Tech'));

    expect(mockPush).toHaveBeenCalledWith('/category/tech');
  });

  it('does not render category button when categoryName is null', () => {
    const topicNoCategory = { ...baseTopic, categoryName: null, categorySlug: null };

    render(<TopicCard topic={topicNoCategory} />);

    expect(screen.queryByText('Tech')).not.toBeInTheDocument();
  });

  it('does not render topOptions section when topOptions is empty', () => {
    const topicNoOptions = { ...baseTopic, topOptions: [] };

    render(<TopicCard topic={topicNoOptions} />);

    expect(screen.queryByText('Rust')).not.toBeInTheDocument();
  });
});
