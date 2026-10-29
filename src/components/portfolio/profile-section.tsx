"use client";

import { useState, type FormEvent } from "react";
import { CircleDot } from "lucide-react";
import { updateProfile, updateProfileLinks } from "@/features/profile/profile";
import type { FieldErrors } from "@/lib/validation/field-errors";
import type { UserProfile } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/components/hooks/use-unsaved-warning";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { LinkListEditor, linkErrors, newLinkRow, sameLinks, type LinkRow } from "./link-list-editor";

/** "Unsaved changes" marker for a form section (design.md §11: unsaved vs saved). */
export function UnsavedNote({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-medium text-warning">
      <CircleDot aria-hidden="true" size={14} strokeWidth={1.75} />
      Unsaved changes
    </span>
  );
}

function profileValues(profile: UserProfile | null) {
  return {
    name: profile?.name ?? "",
    headline: profile?.headline ?? "",
    intro: profile?.intro ?? "",
    location: profile?.location ?? "",
    email: profile?.email ?? "",
  };
}

/** Profile fields (FR-PROF-01). Remounted by the caller when the saved profile changes. */
export function ProfileForm({
  profile,
  fields = "full",
  onSaved,
}: {
  profile: UserProfile | null;
  fields?: "full" | "basics";
  onSaved?: () => void;
}) {
  const run = useWorkspaceAction();
  const saved = profileValues(profile);
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = (Object.keys(saved) as Array<keyof typeof saved>).some((key) => values[key] !== saved[key]);
  useUnsavedWarning(dirty);

  function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((ws, now) => updateProfile(ws, values, now), { success: { title: "Profile saved" } });
    if (outcome.ok || outcome.applied) {
      setErrors({});
      onSaved?.();
    } else {
      setErrors(outcome.fieldErrors ?? { "": outcome.error.message });
    }
  }

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const errorCount = Object.keys(errors).length;

  return (
    <form noValidate onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
      {errorCount > 1 ? (
        <Alert tone="error" title={`${errorCount} fields need attention`}>
          Fix the fields marked below, then save again.
        </Alert>
      ) : null}
      {errors[""] ? <Alert tone="error" title="Profile not saved">{errors[""]}</Alert> : null}
      <Field label="Name" required error={errors.name}>
        <Input value={values.name} maxLength={100} autoComplete="name" onChange={set("name")} />
      </Field>
      <Field label="Headline" error={errors.headline} hint={`${values.headline.length}/140. For example, your current focus.`}>
        <Input value={values.headline} maxLength={140} onChange={set("headline")} />
      </Field>
      {fields === "full" ? (
        <>
          <Field label="Introduction" error={errors.intro} hint={`${values.intro.length}/2000 characters`}>
            <Textarea value={values.intro} rows={5} maxLength={2000} onChange={set("intro")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" error={errors.location} hint="Optional.">
              <Input value={values.location} maxLength={100} onChange={set("location")} />
            </Field>
            <Field label="Email" error={errors.email} hint="Optional. Shown only where you include contact details.">
              <Input type="email" value={values.email} autoComplete="email" onChange={set("email")} />
            </Field>
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!dirty && profile !== null}>
          Save profile
        </Button>
        <UnsavedNote dirty={dirty} />
      </div>
    </form>
  );
}

export function ProfileSection({ profile }: { profile: UserProfile | null }) {
  const signature = JSON.stringify(profileValues(profile));
  return (
    <Panel title="Profile" description="Name, headline, introduction, and contact details.">
      <ProfileForm key={signature} profile={profile} />
    </Panel>
  );
}

export function LinksSection({ profile }: { profile: UserProfile | null }) {
  const signature = JSON.stringify(profile?.links ?? []);
  return (
    <Panel title="Links" description="Relevant external links, such as your code host profile or blog.">
      {profile ? (
        <LinksForm key={signature} profile={profile} />
      ) : (
        <p className="text-body text-foreground-secondary">Save your profile with a name first, then add links.</p>
      )}
    </Panel>
  );
}

function LinksForm({ profile }: { profile: UserProfile }) {
  const run = useWorkspaceAction();
  const [rows, setRows] = useState<LinkRow[]>(() => profile.links.map((link) => newLinkRow(link)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = !sameLinks(rows, profile.links);
  useUnsavedWarning(dirty);

  function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((ws, now) => updateProfileLinks(ws, rows, now), { success: { title: "Links saved" } });
    if (outcome.ok || outcome.applied) setErrors({});
    else setErrors(outcome.fieldErrors ? linkErrors(outcome.fieldErrors) : { "": outcome.error.message });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {errors[""] ? <Alert tone="error" title="Links not saved">{errors[""]}</Alert> : null}
      <LinkListEditor rows={rows} onChange={setRows} errors={errors} max={20} addLabel="Add profile link" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!dirty}>
          Save links
        </Button>
        <UnsavedNote dirty={dirty} />
      </div>
    </form>
  );
}
