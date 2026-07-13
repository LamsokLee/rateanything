/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <div data-testid="sign-in-wrapper">{children}</div>,
  UserButton: Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div data-testid="user-button">{children}</div>,
    {
      MenuItems: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Link: ({ label, href }: { label: string; labelIcon?: React.ReactNode; href: string }) => (
        <a href={href}>{label}</a>
      ),
    }
  ),
  useUser: vi.fn(() => ({ isLoaded: true, user: null })),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { useAuth } from '@/components/AuthProvider';
import { useUser } from '@clerk/nextjs';
import { NavAuth } from '../NavAuth';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUser = vi.mocked(useUser);

describe('NavAuth', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_real_key');
    mockedUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false, user: null } as ReturnType<typeof useUser>);
  });

  it('shows loading state when auth is loading', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true, isSignedIn: false });

    render(<NavAuth />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows Log In button when user is not signed in', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    render(<NavAuth />);

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows user display name and profile link when signed in', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'u1', displayName: 'johndoe', username: 'johndoe' },
      isLoading: false,
      isSignedIn: true,
    });
    mockedUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true, user: {} } as ReturnType<typeof useUser>);

    render(<NavAuth />);

    expect(screen.getByText('@johndoe')).toBeInTheDocument();
    const profileLink = screen.getByRole('link', { name: /view profile for johndoe/i });
    expect(profileLink).toHaveAttribute('href', '/me');
  });

  it('renders UserButton component when signed in', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'u1', displayName: 'johndoe', username: 'johndoe' },
      isLoading: false,
      isSignedIn: true,
    });
    mockedUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true, user: {} } as ReturnType<typeof useUser>);

    render(<NavAuth />);

    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('shows Guest Mode when in dev bypass (no clerk key)', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    render(<NavAuth />);

    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
  });

  it('shows Guest Mode when clerk key contains placeholder', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'placeholder_key');
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    render(<NavAuth />);

    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
  });
});
