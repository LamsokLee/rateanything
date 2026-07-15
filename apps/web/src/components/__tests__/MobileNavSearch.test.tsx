/* @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Mock pathname value — allow tests to override via mockReturnValue
const mockPathname = vi.fn().mockReturnValue("/");

// Mock next/navigation used by NavSearch and MobileNavSearch
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname(),
}));

import { MobileNavSearch } from "../MobileNavSearch";

describe("MobileNavSearch", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  afterEach(cleanup);

  it("renders a button with aria-label and aria-expanded=false", () => {
    render(<MobileNavSearch />);
    const btn = screen.getByRole("button", { name: "Open search" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("expands search panel on click and sets aria-expanded=true", async () => {
    render(<MobileNavSearch />);
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: "Open search" });

    await user.click(btn);

    expect(btn).toHaveAttribute("aria-expanded", "true");
    // The search input from NavSearch should now be visible
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("moves focus to the input when expanded", async () => {
    render(<MobileNavSearch />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open search" }));

    const input = screen.getByPlaceholderText("Search...");
    expect(document.activeElement).toBe(input);
  });

  it("collapses search panel on second click", async () => {
    render(<MobileNavSearch />);
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: "Open search" });

    await user.click(btn);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("closes panel on Escape key", async () => {
    render(<MobileNavSearch />);
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: "Open search" });

    await user.click(btn);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
    // Focus returns to the button after Escape
    expect(document.activeElement).toBe(btn);
  });

  it("closes panel on outside click", async () => {
    const { container } = render(
      <div>
        <MobileNavSearch />
        <div data-testid="outside">Outside area</div>
      </div>
    );
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: "Open search" });

    await user.click(btn);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

    // Click outside both button and panel
    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("shows 'Close search' aria-label when open", async () => {
    render(<MobileNavSearch />);
    const user = userEvent.setup();

    const btn = screen.getByRole("button", { name: "Open search" });
    await user.click(btn);

    expect(btn).toHaveAttribute("aria-label", "Close search");
  });

  it("has aria-controls referencing the panel id", () => {
    render(<MobileNavSearch />);
    const btn = screen.getByRole("button", { name: "Open search" });
    expect(btn).toHaveAttribute("aria-controls", "mobile-nav-search-panel");
  });

  it("auto-closes panel when pathname changes (route navigation)", async () => {
    const { rerender } = render(<MobileNavSearch />);
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: "Open search" });

    await user.click(btn);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

    // Simulate route change
    mockPathname.mockReturnValue("/search?q=test");
    rerender(<MobileNavSearch />);

    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });
});
