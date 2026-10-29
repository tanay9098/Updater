import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./alert";
import { EmptyState } from "./empty-state";
import { LoadingState, Skeleton } from "./skeleton";
import { StatusBadge } from "./status-badge";
import { ToastProvider, useToast, type ToastOptions } from "./toast";

function Notifier({ toast }: { toast: ToastOptions }) {
  const { notify } = useToast();
  return <button onClick={() => notify(toast)}>Do it</button>;
}

describe("StatusBadge", () => {
  it("always shows a text label next to its icon", () => {
    render(<StatusBadge tone="planned" label="Planned" />);
    const badge = screen.getByText("Planned");
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Alert", () => {
  it("uses role=alert for errors and role=status otherwise", () => {
    render(
      <>
        <Alert tone="error" title="Changes could not be saved">Storage is unavailable.</Alert>
        <Alert tone="info" title="Demo data loaded" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Changes could not be saved");
    expect(screen.getByRole("status")).toHaveTextContent("Demo data loaded");
  });
});

describe("EmptyState", () => {
  it("renders a heading, guidance, and at most one action", () => {
    render(
      <EmptyState
        title="No items need review"
        description="Add evidence on the Sources page."
        action={<a href="/sources">Go to Sources</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "No items need review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Sources" })).toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  it("announces loading once and hides the decorative blocks", () => {
    render(
      <LoadingState label="Loading workspace…">
        <Skeleton className="h-4 w-40" />
      </LoadingState>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace…");
  });
});

describe("Toast", () => {
  it("shows feedback only when notify is called, with a dismiss button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Notifier toast={{ title: "Edit saved", tone: "success" }} />
      </ToastProvider>,
    );
    expect(screen.queryByText("Edit saved")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Do it" }));
    expect(await screen.findByText("Edit saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Edit saved")).not.toBeInTheDocument();
  });

  it("runs a toast action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ToastProvider>
        <Notifier
          toast={{
            title: "Approved and added to your portfolio draft. Not published.",
            action: { label: "View in portfolio", altText: "Open Portfolio from the navigation", onClick },
          }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Do it" }));
    await user.click(await screen.findByRole("button", { name: "View in portfolio" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("refuses to work outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Notifier toast={{ title: "x" }} />)).toThrow(/ToastProvider/);
  });
});
