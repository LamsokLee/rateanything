/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockMode: 'arena' | 'rate' = 'arena';

vi.mock('@/components/ModeProvider', () => ({
  useMode: () => ({ mode: mockMode, setMode: vi.fn(), toggleMode: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ArenaCta } from '../ArenaCta';

describe('ArenaCta', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = 'arena';
  });

  it('renders in Arena mode', () => {
    render(<ArenaCta />);

    expect(screen.getByRole('link', { name: /Try Arena Mode/i })).toBeInTheDocument();
  });

  it('is hidden in Rate mode', () => {
    mockMode = 'rate';
    render(<ArenaCta />);

    expect(screen.queryByRole('link', { name: /Try Arena Mode/i })).not.toBeInTheDocument();
  });
});
