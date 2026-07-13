/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

import { Skeleton, TopicCardSkeleton, OptionCardSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild;
    expect(el).toBeInTheDocument();
    expect(el!.className).toContain('animate-pulse');
  });

  it('applies aria-hidden for accessibility', () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className prop', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);

    const el = container.firstElementChild;
    expect(el!.className).toContain('h-4');
    expect(el!.className).toContain('w-32');
  });

  it('has bg-muted and rounded base classes', () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild;
    expect(el!.className).toContain('bg-muted');
    expect(el!.className).toContain('rounded');
  });
});

describe('TopicCardSkeleton', () => {
  afterEach(cleanup);

  it('renders multiple skeleton elements', () => {
    const { container } = render(<TopicCardSkeleton />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('OptionCardSkeleton', () => {
  afterEach(cleanup);

  it('renders multiple skeleton elements including rating button placeholders', () => {
    const { container } = render(<OptionCardSkeleton />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(10);
  });
});
