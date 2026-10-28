import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

describe("Field", () => {
  it("labels the control and links helper text", () => {
    render(
      <Field label="Headline" hint="One line about your work.">
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Headline" });
    expect(input).toHaveAccessibleDescription("One line about your work.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks required fields in text and on the control", () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name (required)" });
    expect(input).toBeRequired();
  });

  it("links the error with aria-describedby and sets aria-invalid", () => {
    render(
      <Field label="Website" hint="Include https://." error="Enter a full web address.">
        <Input type="url" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Website" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Include https://. Enter a full web address.");
  });

  it("wires textareas and selects the same way", () => {
    render(
      <>
        <Field label="Introduction" error="Too long.">
          <Textarea />
        </Field>
        <Field label="Kind">
          <Select defaultValue="project">
            <option value="project">Project</option>
            <option value="article">Article</option>
          </Select>
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Introduction" })).toHaveAccessibleDescription("Too long.");
    expect(screen.getByRole("combobox", { name: "Kind" })).toHaveValue("project");
  });
});

describe("Button", () => {
  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("keeps its label while loading, sets aria-busy, and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("can render a link with button styling", () => {
    render(
      <Button asChild variant="primary">
        <a href="/sources">Open Sources</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Open Sources" })).toHaveAttribute("href", "/sources");
  });
});

describe("Checkbox and Switch", () => {
  it("toggles a labeled checkbox by click and keyboard", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Include contact details" hint="Email and links." />);
    const checkbox = screen.getByRole("checkbox", { name: "Include contact details" });
    expect(checkbox).toHaveAccessibleDescription("Email and links.");
    await user.click(screen.getByText("Include contact details"));
    expect(checkbox).toBeChecked();
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("toggles a labeled switch", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Shown in portfolio" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("switch", { name: "Shown in portfolio" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
