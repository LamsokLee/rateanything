/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}));

import { useUser as useClerkUser } from '@clerk/nextjs';
import { AuthProvider, useAuth } from '../AuthProvider';

const mockedUseClerkUser = vi.mocked(useClerkUser);

function AuthConsumer() {
  const { user, isLoading, isSignedIn } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="signed-in">{String(isSignedIn)}</span>
      <span data-testid="user-id">{user?.id ?? 'null'}</span>
      <span data-testid="display-name">{user?.displayName ?? 'null'}</span>
      <span data-testid="username">{user?.username ?? 'null'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_real_key');
  });

  it('provides loading state when Clerk has not loaded', () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: false,
      isSignedIn: undefined,
      user: undefined,
    } as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('signed-in').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
  });

  it('provides signed-in user data with username as displayName', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user_123',
        username: 'johndoe',
        fullName: 'John Doe',
        firstName: 'John',
        primaryEmailAddress: { emailAddress: 'john@example.com' },
      },
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('signed-in').textContent).toBe('true');
    expect(screen.getByTestId('user-id').textContent).toBe('user_123');
    expect(screen.getByTestId('display-name').textContent).toBe('johndoe');
    expect(screen.getByTestId('username').textContent).toBe('johndoe');
  });

  it('uses fullName as displayName when username is null', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user_456',
        username: null,
        fullName: 'Jane Smith',
        firstName: 'Jane',
        primaryEmailAddress: { emailAddress: 'jane@example.com' },
      },
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('Jane Smith');
    });
  });

  it('uses firstName as displayName when username and fullName are null', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user_789',
        username: null,
        fullName: null,
        firstName: 'Bob',
        primaryEmailAddress: { emailAddress: 'bob@example.com' },
      },
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('Bob');
    });
  });

  it('uses email local part as displayName when name fields are null', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user_abc',
        username: null,
        fullName: null,
        firstName: null,
        primaryEmailAddress: { emailAddress: 'alice@example.com' },
      },
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('alice');
    });
  });

  it('uses "User" as displayName when all fields are null', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'user_xyz',
        username: null,
        fullName: null,
        firstName: null,
        primaryEmailAddress: null,
      },
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('User');
    });
  });

  it('provides signed-out state when user is not signed in', async () => {
    mockedUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    } as unknown as ReturnType<typeof useClerkUser>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('signed-in').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
    expect(screen.getByTestId('display-name').textContent).toBe('null');
  });

  it('provides guest state in dev bypass mode (no clerk key)', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('signed-in').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
  });

  it('provides guest state when clerk key is placeholder', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'placeholder_value');

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('signed-in').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
  });
});
