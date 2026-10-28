import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppearanceSettings } from "./appearance-settings";
import { ThemeToggle } from "./theme-toggle";

function renderControls() {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <ThemeToggle />
        <AppearanceSettings />
      </ToastProvider>
    </TooltipProvider>,
  );
}

const theme = () => document.documentElement.getAttribute("data-theme");

describe("theme controls", () => {
  it("starts in the bright theme with an accessible, unpressed toggle", () => {
    renderControls();
    const toggle = screen.getByRole("button", { name: "Dark theme" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("radio", { name: "Light (default)" })).toBeChecked();
  });

  it("switches to dark, persists it, and keeps the radio group in sync", async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole("button", { name: "Dark theme" }));

    expect(theme()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("changes the theme from the radio group and updates the toggle", async () => {
    const user = userEvent.setup();
    document.documentElement.setAttribute("data-theme", "dark");
    renderControls();

    await user.click(screen.getByRole("radio", { name: "Light (default)" }));

    expect(theme()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("works by keyboard", async () => {
    const user = userEvent.setup();
    renderControls();

    await user.tab();
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(theme()).toBe("dark");
    await user.keyboard(" ");
    expect(theme()).toBe("light");
  });

  it("still changes the theme when saving fails, and says it won't persist", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    renderControls();

    await user.click(screen.getByRole("button", { name: "Dark theme" }));

    expect(theme()).toBe("dark");
    expect(await screen.findByText("Theme changed for this visit only")).toBeInTheDocument();
  });

  it("shows no notification when saving succeeds", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(screen.queryByText("Theme changed for this visit only")).not.toBeInTheDocument();
  });
});
