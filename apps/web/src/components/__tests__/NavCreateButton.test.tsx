/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import { useAuth } from '@/components/AuthProvider';
import { NavCreateButton } from '../NavCreateButton';

const mockedUseAuth = vi.mocked(useAuth);

describe('NavCreateButton', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing for guests (not signed in)', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, isSignedIn: false });

    const { container } = render(<NavCreateButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing while loading', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true, isSignedIn: false });

    const { container } = render(<NavCreateButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Create Topic link for signed-in users', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });

    render(<NavCreateButton />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/create');
    expect(screen.getByText('+ Create Topic')).toBeInTheDocument();
  });

  it('link points to /create path', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', displayName: 'Test', username: 'test' }, isLoading: false, isSignedIn: true });

    render(<NavCreateButton />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/create');
  });
});
