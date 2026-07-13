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

import { TopicFeed } from '../TopicFeed';

const mockCategories = [
  { id: 1, name: 'Tech', slug: 'tech' },
  { id: 2, name: 'Food', slug: 'food' },
  { id: 3, name: 'Sports', slug: 'sports' },
];

const mockTopics = [
  {
    id: 't1',
    title: 'Best IDEs',
    slug: 'best-ides',
    description: 'Compare code editors',
    totalRatings: 30,
    trendingScore: null,
    categoryName: 'Tech',
    categorySlug: 'tech',
    creatorUsername: 'alice',
    createdAt: '2024-01-01T00:00:00Z',
    topOptions: [{ name: 'VS Code', avgRating: 8.0 }],
    optionCount: 3,
  },
  {
    id: 't2',
    title: 'Best Pizza',
    slug: 'best-pizza',
    description: null,
    totalRatings: 15,
    trendingScore: null,
    categoryName: 'Food',
    categorySlug: 'food',
    creatorUsername: 'bob',
    createdAt: '2024-02-01T00:00:00Z',
    topOptions: [{ name: 'Margherita', avgRating: 7.5 }],
    optionCount: 4,
  },
  {
    id: 't3',
    title: 'Best Frameworks',
    slug: 'best-frameworks',
    description: null,
    totalRatings: 10,
    trendingScore: null,
    categoryName: 'Tech',
    categorySlug: 'tech',
    creatorUsername: 'carol',
    createdAt: '2024-03-01T00:00:00Z',
    topOptions: [],
    optionCount: 2,
  },
];

describe('TopicFeed', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all topics as TopicCards', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    expect(screen.getByText('Best IDEs')).toBeInTheDocument();
    expect(screen.getByText('Best Pizza')).toBeInTheDocument();
    expect(screen.getByText('Best Frameworks')).toBeInTheDocument();
  });

  it('renders category tabs from props', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tech' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Food' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sports' })).toBeInTheDocument();
  });

  it('"All" tab is selected by default', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows total topic count', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Trending')).toBeInTheDocument();
  });

  it('clicking a category tab filters topics to that category', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Tech' }));

    expect(screen.getByRole('tab', { name: 'Tech' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Best IDEs')).toBeInTheDocument();
    expect(screen.getByText('Best Frameworks')).toBeInTheDocument();
    expect(screen.queryByText('Best Pizza')).not.toBeInTheDocument();
  });

  it('shows filtered count when category is active', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Tech' }));

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows "View all →" link when a category is active', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Food' }));

    const viewAllLink = screen.getByText('View all →');
    expect(viewAllLink).toHaveAttribute('href', '/category/food');
  });

  it('does not show "View all →" link when All tab is active', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    expect(screen.queryByText('View all →')).not.toBeInTheDocument();
  });

  it('shows empty state when filtered category has no topics', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Sports' }));

    expect(screen.getByText('No topics in this category yet.')).toBeInTheDocument();
  });

  it('empty state includes link to category page', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Sports' }));

    const link = screen.getByText(/View all in Sports/);
    expect(link).toHaveAttribute('href', '/category/sports');
  });

  it('clicking "All" tab again shows all topics', async () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Tech' }));
    expect(screen.queryByText('Best Pizza')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'All' }));
    expect(screen.getByText('Best Pizza')).toBeInTheDocument();
    expect(screen.getByText('Best IDEs')).toBeInTheDocument();
  });

  it('first topic card is rendered as featured', () => {
    render(<TopicFeed topics={mockTopics} categories={mockCategories} />);

    // Featured card shows description
    expect(screen.getByText('Compare code editors')).toBeInTheDocument();
  });

  it('renders with empty topics array', () => {
    render(<TopicFeed topics={[]} categories={mockCategories} />);

    expect(screen.getByText('No topics in this category yet.')).toBeInTheDocument();
  });
});
