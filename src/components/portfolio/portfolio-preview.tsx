"use client";

import { Eye } from "lucide-react";
import { projectClaims, projectSummary, standaloneClaims } from "@/features/portfolio/portfolio";
import type { Workspace } from "@/types/domain";
import { DemoBadge } from "@/components/workspace/badges";
import { ExternalLink } from "@/components/workspace/external-link";

/**
 * Local preview of the saved portfolio draft (FR-PORT-03). Renders what a
 * visitor would see, but it is never public: the header says so. Demo
 * content keeps its label here too.
 */
export function PortfolioPreview({ ws }: { ws: Workspace }) {
  const profile = ws.profile;
  const projects = ws.portfolio.projects.filter((project) => project.visible);
  const skills = ws.portfolio.skills.filter((skill) => skill.visible);
  const other = standaloneClaims(ws);
  const isEmpty = !profile && projects.length === 0 && skills.length === 0 && other.length === 0;

  return (
    <section aria-labelledby="portfolio-preview-heading" className="rounded-md border border-border bg-surface">
      <div className="flex items-start gap-2 border-b border-border bg-surface-muted px-4 py-3 sm:px-5">
        <Eye aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
        <div>
          <h2 id="portfolio-preview-heading" className="text-label font-semibold">
            Local preview: not published
          </h2>
          <p className="text-support text-muted">Only you can see this. It shows your saved draft, not unsaved edits.</p>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 py-6 text-long sm:px-6">
        {isEmpty ? (
          <p className="text-body text-foreground-secondary">
            Nothing to preview yet. Add your profile, or approve proposals from the Review Queue.
          </p>
        ) : null}
        {profile ? (
          <header className="flex flex-col gap-2">
            <p className="text-title font-semibold">{profile.name}</p>
            {profile.headline ? <p className="text-subheading text-foreground-secondary">{profile.headline}</p> : null}
            {profile.location ? <p className="text-support text-muted">{profile.location}</p> : null}
            {profile.intro ? <p className="whitespace-pre-line">{profile.intro}</p> : null}
            {profile.links.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body">
                {profile.links.map((link) => (
                  <li key={link.id}>
                    <ExternalLink href={link.url}>{link.label}</ExternalLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
        ) : null}

        {skills.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-heading font-semibold">Skills</h3>
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill.id} className="flex items-center gap-1 rounded-sm border border-border px-2 text-body">
                  {skill.name}
                  {skill.isDemo ? <span className="text-meta font-medium text-demo">(Demo data)</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {projects.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h3 className="text-heading font-semibold">Projects</h3>
            {projects.map((project) => {
              const summary = projectSummary(ws, project);
              const claims = projectClaims(ws, project);
              return (
                <article key={project.id} className="flex flex-col gap-1.5 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-subheading font-semibold">{project.name}</h4>
                    {project.isDemo ? <DemoBadge /> : null}
                  </div>
                  {summary.text ? <p>{summary.text}</p> : null}
                  {project.technologies.length > 0 ? (
                    <p className="text-support text-muted">{project.technologies.join(" · ")}</p>
                  ) : null}
                  {claims.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {claims.map((claim) => (
                        <li key={claim.id}>{claim.text}</li>
                      ))}
                    </ul>
                  ) : null}
                  {project.links.length > 0 ? (
                    <ul className="flex flex-wrap gap-x-4 text-body">
                      {project.links.map((link) => (
                        <li key={link.id}>
                          <ExternalLink href={link.url} isDemo={project.isDemo}>
                            {link.label}
                          </ExternalLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}

        {other.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-heading font-semibold">Other achievements</h3>
            <ul className="list-disc pl-5">
              {other.map((claim) => (
                <li key={claim.id}>
                  {claim.text}
                  {claim.isDemo ? <span className="ml-2 text-meta font-medium text-demo">(Demo data)</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}
