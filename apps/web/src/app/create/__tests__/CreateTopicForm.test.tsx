/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { useAuth } from '@/components/AuthProvider';
import { CreateTopicForm } from '../CreateTopicForm';

const mockedUseAuth = vi.mocked(useAuth);

const mockCategories = [
  { id: 1, name: 'Tech', slug: 'tech' },
  { id: 2, name: 'Food', slug: 'food' },
];

describe('CreateTopicForm', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows login prompt when user is not authenticated', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    render(<CreateTopicForm categories={mockCategories} />);

    expect(screen.getByText('Please log in to create a topic.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('renders form fields for authenticated user', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Image URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Source URL/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Topic' })).toBeInTheDocument();
  });

  it('renders two initial option fields', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    expect(optionInputs).toHaveLength(2);
  });

  it('adds a new option field when clicking "+ Add Option"', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.click(screen.getByText('+ Add Option'));

    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    expect(optionInputs).toHaveLength(3);
  });

  it('removes an option field when clicking "Remove option"', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    // Add a third option first
    await user.click(screen.getByText('+ Add Option'));
    expect(screen.getAllByPlaceholderText(/Option \d+ name/)).toHaveLength(3);

    // Remove one
    const removeBtns = screen.getAllByRole('button', { name: 'Remove option' });
    await user.click(removeBtns[0]);

    expect(screen.getAllByPlaceholderText(/Option \d+ name/)).toHaveLength(2);
  });

  it('does not show Remove buttons when only 2 options remain', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    expect(screen.queryByRole('button', { name: 'Remove option' })).not.toBeInTheDocument();
  });

  it('shows validation error for title less than 5 characters', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
  });

  it('shows validation error when no category is selected', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    expect(screen.getByText('Please select a category')).toBeInTheDocument();
  });

  it('shows validation error when fewer than 2 options have names', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    // Leave option fields empty
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    expect(screen.getByText('At least 2 options are required')).toBeInTheDocument();
  });

  it('shows validation error for invalid image URL', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    await user.type(screen.getByLabelText(/Image URL/), 'not-a-url');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'Option A');
    await user.type(optionInputs[1], 'Option B');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    expect(screen.getByText('Please enter a valid image URL')).toBeInTheDocument();
  });

  it('submits successfully and navigates to the new topic', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: { slug: 'best-laptops' } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Best Laptops for Coding');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    await user.type(screen.getByLabelText(/Description/), 'A comparison of dev laptops');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'MacBook Pro');
    await user.type(optionInputs[1], 'ThinkPad X1');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/trpc/topics.create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            title: 'Best Laptops for Coding',
            categoryId: 1,
            description: 'A comparison of dev laptops',
            imageUrl: undefined,
            sourceUrl: undefined,
            options: [
              { name: 'MacBook Pro', description: undefined },
              { name: 'ThinkPad X1', description: undefined },
            ],
          },
        }),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/topic/best-laptops');
    });
  });

  it('shows button text "Creating..." while submitting', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    // Never-resolving fetch to keep isSubmitting=true
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'Opt A');
    await user.type(optionInputs[1], 'Opt B');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    });
  });

  it('displays general error when fetch returns non-ok response', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Duplicate title' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'Opt A');
    await user.type(optionInputs[1], 'Opt B');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    await waitFor(() => {
      expect(screen.getByText('Duplicate title')).toBeInTheDocument();
    });
  });

  it('displays network error when fetch throws', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'Opt A');
    await user.type(optionInputs[1], 'Opt B');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument();
    });
  });

  it('navigates to "/" when response has no slug', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Alice', username: 'alice' }, isLoading: false, isSignedIn: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { data: { json: {} } } }),
    }));

    render(<CreateTopicForm categories={mockCategories} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Title/), 'Valid Title Here');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    const optionInputs = screen.getAllByPlaceholderText(/Option \d+ name/);
    await user.type(optionInputs[0], 'Opt A');
    await user.type(optionInputs[1], 'Opt B');
    await user.click(screen.getByRole('button', { name: 'Create Topic' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });
});
