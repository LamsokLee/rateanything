/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../Sparkline', () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

import { useAuth } from '@/components/AuthProvider';
import { OptionRow } from '../OptionRow';

const mockedUseAuth = vi.mocked(useAuth);

const baseProps = {
  optionId: 'opt1',
  name: 'Test Option',
  initialAvgRating: 8.3,
  initialRatingCount: 15,
  userRating: null,
  rank: 2,
  rankBadge: null,
  optColor: '#ff0000',
  history: undefined,
  layout: 'desktop' as const,
};

describe('OptionRow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { score: null } } } }),
    }));
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
  });

  it('renders option name, score, and vote count', () => {
    render(<OptionRow {...baseProps} />);

    expect(screen.getByText('Test Option')).toBeInTheDocument();
    expect(screen.getByText('8.3')).toBeInTheDocument();
    expect(screen.getByText('15 votes')).toBeInTheDocument();
  });

  it('shows em-dash when count is 0', () => {
    render(<OptionRow {...baseProps} initialRatingCount={0} initialAvgRating={0} />);

    // em-dash for score display
    const scoreElements = screen.getAllByText('\u2014');
    expect(scoreElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0 votes')).toBeInTheDocument();
  });

  it('displays formatted avg with one decimal when count > 0', () => {
    render(<OptionRow {...baseProps} initialAvgRating={7.123} initialRatingCount={5} />);

    expect(screen.getByText('7.1')).toBeInTheDocument();
  });

  it('updates displayed avg/count when InlineRatingButtons onScoreUpdate fires', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { optionAvgRating: 9.2, optionRatingCount: 16 } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OptionRow {...baseProps} />);

    expect(screen.getByText('8.3')).toBeInTheDocument();
    expect(screen.getByText('15 votes')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rate 9 out of 10' }));

    await waitFor(() => {
      expect(screen.getByText('9.2')).toBeInTheDocument();
      expect(screen.getByText('16 votes')).toBeInTheDocument();
    });
  });

  it('re-syncs when initial props change (rerender with new props)', () => {
    const { rerender } = render(<OptionRow {...baseProps} />);

    expect(screen.getByText('8.3')).toBeInTheDocument();

    rerender(<OptionRow {...baseProps} initialAvgRating={9.0} initialRatingCount={20} />);

    expect(screen.getByText('9.0')).toBeInTheDocument();
    expect(screen.getByText('20 votes')).toBeInTheDocument();
  });

  it('renders mobile layout correctly', () => {
    render(<OptionRow {...baseProps} layout="mobile" />);

    expect(screen.getByText('Test Option')).toBeInTheDocument();
    expect(screen.getByText('8.3')).toBeInTheDocument();
    expect(screen.getByText('15 votes')).toBeInTheDocument();
  });

  it('renders rank badge when provided', () => {
    render(<OptionRow {...baseProps} rank={3} rankBadge={{ bg: '#gold', text: '#000' }} />);

    // rank 3 should render inside a badge span
    const rankElements = screen.getAllByText('3'); expect(rankElements[0]).toHaveStyle({ color: 'rgb(0, 0, 0)' });
  });
});
