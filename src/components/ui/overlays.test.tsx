import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("ConfirmDialog", () => {
  function renderConfirm(onConfirm: () => void | Promise<void>) {
    render(
      <ConfirmDialog
        trigger={<Button>Reset workspace</Button>}
        title="Reset workspace?"
        description="This deletes your profile, sources, evidence, and drafts from this browser."
        confirmLabel="Reset workspace"
        destructive
        onConfirm={onConfirm}
      />,
    );
  }

  it("names the action, describes the loss, and focuses Cancel first", async () => {
    const user = userEvent.setup();
    renderConfirm(vi.fn());
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Reset workspace?" });
    expect(dialog).toHaveAccessibleDescription(
      "This deletes your profile, sources, evidence, and drafts from this browser.",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Escape without confirming and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);
    const trigger = screen.getByRole("button", { name: "Reset workspace" });
    await user.click(trigger);
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("closes only after the action resolves", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    renderConfirm(onConfirm);
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    const dialog = await screen.findByRole("alertdialog");

    const confirm = screen.getAllByRole("button", { name: "Reset workspace" }).find((button) =>
      dialog.contains(button),
    );
    if (!confirm) throw new Error("confirm button not found");
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("stays open and reports a failed action instead of closing", async () => {
    const user = userEvent.setup();
    renderConfirm(() => Promise.reject(new Error("Browser storage is full.")));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = screen.getAllByRole("button", { name: "Reset workspace" }).find((button) =>
      dialog.contains(button),
    );
    if (!confirm) throw new Error("confirm button not found");

    await user.click(confirm);

    expect(await screen.findByRole("alert")).toHaveTextContent("Browser storage is full.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("traps focus, has a named close button, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Add entry</Button>
        </DialogTrigger>
        <DialogContent title="Add entry" description="Recorded as a user-supplied statement.">
          <input aria-label="Title" />
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog", { name: "Add entry" });
    expect(dialog).toHaveAccessibleDescription("Recorded as a user-supplied statement.");

    const close = screen.getByRole("button", { name: "Close dialog" });
    const title = screen.getByRole("textbox", { name: "Title" });
    await user.tab();
    await user.tab();
    await user.tab();
    expect([close, title]).toContain(document.activeElement);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add entry" })).toHaveFocus();
  });
});

describe("Menu", () => {
  it("opens from the keyboard and moves between items with arrow keys", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button>More actions for Demo project</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Duplicate</MenuItem>
          <MenuItem destructive>Delete</MenuItem>
        </MenuContent>
      </Menu>,
    );
    screen.getByRole("button", { name: "More actions for Demo project" }).focus();
    await user.keyboard("{Enter}");

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Duplicate", "Delete"]);
    await waitFor(() => expect(items[0]).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("Tabs", () => {
  it("switches panels with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="edit">
        <TabsList aria-label="Portfolio view">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">Editor panel</TabsContent>
        <TabsContent value="preview">Preview panel</TabsContent>
      </Tabs>,
    );
    const edit = screen.getByRole("tab", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Editor panel");

    await user.click(edit);
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Preview panel");
  });
});
