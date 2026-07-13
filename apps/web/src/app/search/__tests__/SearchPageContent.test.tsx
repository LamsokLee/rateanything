/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock TopicCard to simplify assertions
vi.mock('@/components/TopicCard', () => ({
  TopicCard: ({ topic }: { topic: { title: string } }) => (
    <div data-testid="topic-card">{topic.title}</div>
  ),
}));

import SearchPageContent from '../../search/SearchPageContent';

const mockSearchResults = {
  topics: [
    {
      id: 's1',
      title: 'Best Laptops 2024',
      slug: 'best-laptops-2024',
      description: 'Laptop comparison',
      imageUrl: null,
      totalRatings: 50,
      trendingScore: 3,
      createdAt: '2024-01-15T00:00:00Z',
      categoryName: 'Tech',
      categorySlug: 'tech',
      creatorUsername: 'alice',
      creatorAvatarUrl: null,
      topOptions: [{ name: 'MacBook', avgRating: 8.0 }],
      optionCount: 4,
    },
    {
      id: 's2',
      title: 'Best Keyboards',
      slug: 'best-keyboards',
      description: null,
      imageUrl: null,
      totalRatings: 20,
      trendingScore: null,
      createdAt: '2024-02-01T00:00:00Z',
      categoryName: 'Tech',
      categorySlug: 'tech',
      creatorUsername: 'bob',
      creatorAvatarUrl: null,
      topOptions: [],
      optionCount: 3,
    },
  ],
};

function mockFetchResults(results = mockSearchResults) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: { data: { json: results } } }),
  });
}

describe('SearchPageContent', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    // Reset search params to empty
    mockSearchParams.delete('q');
  });

  it('renders search input and heading', () => {
    render(<SearchPageContent />);

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('shows initial state message when no search has been performed', () => {
    render(<SearchPageContent />);

    expect(screen.getByText('Type at least 2 characters to search for topics')).toBeInTheDocument();
  });

  it('search button is disabled when query is less than 2 characters', () => {
    render(<SearchPageContent />);

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    expect(searchBtn).toBeDisabled();
  });

  it('submitting search form calls fetch with correct endpoint and params', async () => {
    const fetchMock = mockFetchResults();
    vi.stubGlobal('fetch', fetchMock);

    render(<SearchPageContent />);

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Search topics...');
    await user.type(input, 'laptops');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('/api/trpc/topics.search');
      const url = new URL(calledUrl, 'http://localhost');
      const inputParam = JSON.parse(url.searchParams.get('input') ?? '{}');
      expect(inputParam).toEqual({ json: { query: 'laptops', limit: 20 } });
    });
  });

  it('updates router with search query param on submit', async () => {
    vi.stubGlobal('fetch', mockFetchResults());

    render(<SearchPageContent />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search topics...'), 'keyboards');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(mockPush).toHaveBeenCalledWith('/search?q=keyboards');
  });

  it('renders search results after successful fetch', async () => {
    vi.stubGlobal('fetch', mockFetchResults());

    render(<SearchPageContent />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search topics...'), 'laptops');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Best Laptops 2024')).toBeInTheDocument();
      expect(screen.getByText('Best Keyboards')).toBeInTheDocument();
    });

    // Result count badge
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('shows no-results state when search returns empty topics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { topics: [] } } } }),
    }));

    render(<SearchPageContent />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search topics...'), 'zzzzz');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText(/No topics found for/)).toBeInTheDocument();
    });
  });

  it('shows loading skeleton during fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<SearchPageContent />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search topics...'), 'test query');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // Loading skeleton placeholders are animated divs
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('performs search on initial load when URL has q param', async () => {
    mockSearchParams.set('q', 'initial query');
    const fetchMock = mockFetchResults();
    vi.stubGlobal('fetch', fetchMock);

    render(<SearchPageContent />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('/api/trpc/topics.search');
      const url = new URL(calledUrl, 'http://localhost');
      const inputParam = JSON.parse(url.searchParams.get('input') ?? '{}');
      expect(inputParam).toEqual({ json: { query: 'initial query', limit: 20 } });
    });
  });

  it('does not perform search on initial load when query is less than 2 chars', () => {
    mockSearchParams.set('q', 'a');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SearchPageContent />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders breadcrumb with Home link', () => {
    render(<SearchPageContent />);

    const homeLink = screen.getByText('Home');
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
