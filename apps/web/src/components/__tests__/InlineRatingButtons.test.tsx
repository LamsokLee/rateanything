/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
import { InlineRatingButtons } from '../InlineRatingButtons';

const mockedUseAuth = vi.mocked(useAuth);

function mockFetchSuccess(data: { optionAvgRating: number; optionRatingCount: number }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: { data: { json: data } } }),
  });
}

function mockFetchFailure() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: { message: 'Server error' } }),
  });
}

function getPostCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    (c: unknown[]) => c[1] && typeof c[1] === 'object' && (c[1] as Record<string, unknown>).method === 'POST'
  );
}

describe('InlineRatingButtons', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders 10 rating buttons with correct aria labels', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={null} />
    );

    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i} out of 10` })).toBeInTheDocument();
    }
  });

  it('highlights the current user rating button', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={7} />
    );

    const btn7 = screen.getByRole('button', { name: 'Rate 7 out of 10' });
    expect(btn7).toHaveClass('bg-accent');
  });

  it('clicking an unselected score calls ratings.submit and invokes onScoreUpdate (authenticated user)', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
    const onScoreUpdate = vi.fn();
    const fetchMock = mockFetchSuccess({ optionAvgRating: 7.5, optionRatingCount: 12 });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={null} onScoreUpdate={onScoreUpdate} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rate 8 out of 10' }));

    await waitFor(() => {
      const postCalls = getPostCalls(fetchMock);
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      expect(postCalls[0][0]).toBe('/api/trpc/ratings.submit');
      const callBody = JSON.parse((postCalls[0][1] as { body: string }).body);
      expect(callBody).toEqual({ json: { optionId: 'opt1', score: 8 } });
    });

    await waitFor(() => {
      expect(onScoreUpdate).toHaveBeenCalledWith(7.5, 12);
    });
  });

  it('clicking the CURRENT rating calls ratings.remove (cancel) and clears selection', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
    const onScoreUpdate = vi.fn();
    const fetchMock = mockFetchSuccess({ optionAvgRating: 6.0, optionRatingCount: 5 });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={5} onScoreUpdate={onScoreUpdate} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rate 5 out of 10' }));

    await waitFor(() => {
      const postCalls = getPostCalls(fetchMock);
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      expect(postCalls[0][0]).toBe('/api/trpc/ratings.remove');
      const callBody = JSON.parse((postCalls[0][1] as { body: string }).body);
      expect(callBody).toEqual({ json: { optionId: 'opt1' } });
    });

    await waitFor(() => {
      expect(onScoreUpdate).toHaveBeenCalledWith(6.0, 5);
    });

    await waitFor(() => {
      const btn5 = screen.getByRole('button', { name: 'Rate 5 out of 10' });
      expect(btn5).not.toHaveClass('bg-accent');
    });
  });

  it('guest path includes guestFingerprint in ratings.submit payload', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });
    const fetchMock = mockFetchSuccess({ optionAvgRating: 5.0, optionRatingCount: 3 });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={null} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rate 3 out of 10' }));

    await waitFor(() => {
      const postCalls = getPostCalls(fetchMock);
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      const callBody = JSON.parse((postCalls[0][1] as { body: string }).body);
      expect(callBody.json.optionId).toBe('opt1');
      expect(callBody.json.score).toBe(3);
      expect(callBody.json.guestFingerprint).toBeDefined();
      expect(typeof callBody.json.guestFingerprint).toBe('string');
    });
  });

  it('guest path includes guestFingerprint in ratings.remove payload', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });
    const fetchMock = mockFetchSuccess({ optionAvgRating: 4.0, optionRatingCount: 2 });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={4} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rate 4 out of 10' }));

    await waitFor(() => {
      const postCalls = getPostCalls(fetchMock);
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      expect(postCalls[0][0]).toBe('/api/trpc/ratings.remove');
      const callBody = JSON.parse((postCalls[0][1] as { body: string }).body);
      expect(callBody.json.guestFingerprint).toBeDefined();
      expect(typeof callBody.json.guestFingerprint).toBe('string');
    });
  });

  it('failed fetch rolls back optimistic state (submit)', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchFailure();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={null} />
    );

    const user = userEvent.setup();
    const btn6 = screen.getByRole('button', { name: 'Rate 6 out of 10' });
    await user.click(btn6);

    await waitFor(() => {
      expect(btn6).not.toHaveClass('bg-accent');
    });
  });

  it('failed fetch rolls back optimistic state (remove/cancel)', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineRatingButtons optionId="opt1" currentUserRating={9} />
    );

    const user = userEvent.setup();
    const btn9 = screen.getByRole('button', { name: 'Rate 9 out of 10' });
    await user.click(btn9);

    await waitFor(() => {
      expect(btn9).toHaveClass('bg-accent');
    });
  });
});
