import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RouteError from "./error";

describe("route error boundary", () => {
  it("offers retry and a link back to Overview", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<RouteError error={new Error("boom")} retry={retry} />);

    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Unexpected error");
    expect(screen.getByRole("link", { name: "Go to Overview" })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
