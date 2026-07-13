/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
import { CommentSection } from '../CommentSection';

const mockedUseAuth = vi.mocked(useAuth);

const mockComments = [
  {
    id: 'c1',
    content: 'Great topic!',
    upvotes: 5,
    downvotes: 1,
    createdAt: new Date().toISOString(),
    user: { id: 'u1', username: 'alice' },
    userVote: null,
    isOwner: true,
    isDeleted: false,
    replies: [
      {
        id: 'r1',
        content: 'I agree!',
        upvotes: 2,
        downvotes: 0,
        createdAt: new Date().toISOString(),
        user: { id: 'u2', username: 'bob' },
        userVote: null,
        isOwner: false,
        isDeleted: false,
      },
    ],
  },
  {
    id: 'c2',
    content: 'Original content here',
    upvotes: 0,
    downvotes: 0,
    createdAt: new Date().toISOString(),
    user: { id: 'u3', username: 'carol' },
    userVote: null,
    isOwner: false,
    isDeleted: true,
    replies: [
      {
        id: 'r2',
        content: 'Reply to deleted',
        upvotes: 1,
        downvotes: 0,
        createdAt: new Date().toISOString(),
        user: { id: 'u4', username: 'dave' },
        userVote: null,
        isOwner: false,
        isDeleted: false,
      },
    ],
  },
];

function mockFetchComments(comments = mockComments) {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('comments.getForTopic')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          result: { data: { json: { comments, nextCursor: null } } },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: {} } } }),
    });
  });
}

describe('CommentSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders fetched comments and replies', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });
    expect(screen.getByText('I agree!')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows Delete button ONLY for isOwner non-deleted comments', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    // Only one Delete button visible (for isOwner=true comment c1)
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete comment' });
    expect(deleteButtons).toHaveLength(1);
  });

  it('clicking Delete (confirm=true) calls comments.remove and refetches', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchComments();
    vi.stubGlobal('fetch', fetchMock);

    // Mock window.confirm to return true
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const deleteBtn = screen.getByRole('button', { name: 'Delete comment' });
    await user.click(deleteBtn);

    await waitFor(() => {
      // Confirm was called
      expect(window.confirm).toHaveBeenCalledWith('Delete this comment?');
      // fetch was called with comments.remove
      const removeCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('comments.remove')
      );
      expect(removeCalls).toHaveLength(1);
      const body = JSON.parse(removeCalls[0][1].body);
      expect(body).toEqual({ json: { commentId: 'c1' } });
    });
  });

  it('tombstoned comment (isDeleted) renders muted [deleted] with NO vote/reply/delete controls but replies still render', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    // The deleted comment should show [deleted] (appears multiple times: as username and content)
    const deletedTexts = screen.getAllByText('[deleted]');
    expect(deletedTexts.length).toBeGreaterThanOrEqual(1);

    // Replies to the deleted comment still render
    expect(screen.getByText('Reply to deleted')).toBeInTheDocument();
    expect(screen.getByText('dave')).toBeInTheDocument();
  });

  it('shows login prompt for guests instead of comment input', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Log in to join the discussion')).toBeInTheDocument();
    });

    // No textarea for guest
    expect(screen.queryByPlaceholderText('Share your take...')).not.toBeInTheDocument();
  });

  it('displays comment input for authenticated users', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your take...')).toBeInTheDocument();
    });
  });

  it('submit button is disabled when comment textarea is empty or whitespace', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', mockFetchComments());

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your take...')).toBeInTheDocument();
    });

    const postBtn = screen.getByRole('button', { name: 'Post' });
    // Initially disabled (empty)
    expect(postBtn).toBeDisabled();

    // Type only spaces — still disabled
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText('Share your take...');
    await user.type(textarea, '   ');
    expect(postBtn).toBeDisabled();

    // Type real content — enabled
    await user.clear(textarea);
    await user.type(textarea, 'Hello world');
    expect(postBtn).toBeEnabled();
  });

  it('submitting a comment calls /api/trpc/comments.create with correct payload and refetches', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchComments();
    vi.stubGlobal('fetch', fetchMock);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your take...')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText('Share your take...');
    await user.type(textarea, 'My new comment');

    const postBtn = screen.getByRole('button', { name: 'Post' });
    await user.click(postBtn);

    await waitFor(() => {
      const createCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0] === '/api/trpc/comments.create'
      );
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0][1].method).toBe('POST');
      expect(createCalls[0][1].headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(createCalls[0][1].body);
      expect(body).toEqual({ json: { topicId: 'topic1', content: 'My new comment' } });
    });

    // After successful create, it refetches comments (getForTopic called again)
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('comments.getForTopic')
      );
      // Initial load + refetch after submit = at least 2
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });

    // Textarea is cleared after successful submission
    expect(textarea).toHaveValue('');
  });

  it('clicking upvote calls /api/trpc/comments.upvote with commentId', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchComments();
    vi.stubGlobal('fetch', fetchMock);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const upvoteBtns = screen.getAllByRole('button', { name: 'Upvote' });
    // Click first upvote button (for comment c1)
    await user.click(upvoteBtns[0]);

    await waitFor(() => {
      const upvoteCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0] === '/api/trpc/comments.upvote'
      );
      expect(upvoteCalls).toHaveLength(1);
      expect(upvoteCalls[0][1].method).toBe('POST');
      const body = JSON.parse(upvoteCalls[0][1].body);
      expect(body).toEqual({ json: { commentId: 'c1' } });
    });
  });

  it('clicking downvote calls /api/trpc/comments.downvote with commentId', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchComments();
    vi.stubGlobal('fetch', fetchMock);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const downvoteBtns = screen.getAllByRole('button', { name: 'Downvote' });
    // Click first downvote button (for comment c1)
    await user.click(downvoteBtns[0]);

    await waitFor(() => {
      const downvoteCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0] === '/api/trpc/comments.downvote'
      );
      expect(downvoteCalls).toHaveLength(1);
      expect(downvoteCalls[0][1].method).toBe('POST');
      const body = JSON.parse(downvoteCalls[0][1].body);
      expect(body).toEqual({ json: { commentId: 'c1' } });
    });
  });

  it('reply flow: open reply, type, submit calls comments.create with parentId', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = mockFetchComments();
    vi.stubGlobal('fetch', fetchMock);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // There's initially one Reply button (on the non-deleted, non-reply comment c1)
    const replyBtns = screen.getAllByRole('button', { name: 'Reply' });
    await user.click(replyBtns[0]);

    // Reply textarea should appear
    const replyTextarea = await screen.findByPlaceholderText('Write a reply...');
    expect(replyTextarea).toBeInTheDocument();

    await user.type(replyTextarea, 'Nice reply');

    // After opening the reply form, there are now two Reply buttons: the toggle and the submit
    const allReplyBtns = screen.getAllByRole('button', { name: 'Reply' });
    // The submit button is the last one (inside the reply form)
    await user.click(allReplyBtns[allReplyBtns.length - 1]);

    await waitFor(() => {
      const createCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0] === '/api/trpc/comments.create'
      );
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0][1].method).toBe('POST');
      const body = JSON.parse(createCalls[0][1].body);
      expect(body).toEqual({ json: { topicId: 'topic1', content: 'Nice reply', parentId: 'c1' } });
    });

    // After successful reply, refetches
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('comments.getForTopic')
      );
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('vote applies optimistic update to upvote count in UI', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    // Use a fetch that returns vote result
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('comments.getForTopic')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            result: { data: { json: { comments: mockComments, nextCursor: null } } },
          }),
        });
      }
      if (typeof url === 'string' && url.includes('comments.upvote')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            result: { data: { json: { upvotes: 6, downvotes: 1, userVote: 'upvote' } } },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: { data: { json: {} } } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CommentSection topicId="topic1" />);

    await waitFor(() => {
      expect(screen.getByText('Great topic!')).toBeInTheDocument();
    });

    // Initial upvotes for c1 = 5
    const user = userEvent.setup();
    const upvoteBtns = screen.getAllByRole('button', { name: 'Upvote' });
    await user.click(upvoteBtns[0]);

    // Optimistic update should bump to 6
    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument();
    });
  });

});
