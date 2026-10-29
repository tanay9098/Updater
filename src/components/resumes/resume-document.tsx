import type { ResumeDocument } from "@/features/resumes/drafts";
import { safeExternalUrl } from "@/lib/validation/url";

/**
 * The resume itself: single column, real text, semantic headings
 * (design.md §12). Used for the on-screen preview and the print view. Demo
 * content stays labeled. No ATS compatibility is claimed.
 */
export function ResumeDocumentView({ doc, headingLevel = 2 }: { doc: ResumeDocument; headingLevel?: 1 | 2 }) {
  const Title = headingLevel === 1 ? "h1" : "h2";
  const Section = headingLevel === 1 ? "h2" : "h3";
  const Entry = headingLevel === 1 ? "h3" : "h4";
  const contactLinks = doc.contact?.links.filter((link) => safeExternalUrl(link.url)) ?? [];

  return (
    <div className="resume-document flex flex-col gap-5 text-body text-foreground">
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        {doc.name ? <Title className="text-title font-semibold">{doc.name}</Title> : null}
        <p className={doc.name ? "text-subheading text-foreground-secondary" : "text-title font-semibold"}>{doc.targetRole}</p>
        {doc.contact ? (
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-support text-foreground-secondary">
            {doc.contact.email ? <span>{doc.contact.email}</span> : null}
            {doc.contact.location ? <span>{doc.contact.location}</span> : null}
            {contactLinks.map((link) => (
              <span key={link.id}>
                {link.label}: {link.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
            ))}
          </p>
        ) : null}
        {doc.hasDemoContent ? (
          <p className="text-meta font-medium text-demo">Contains fictional demo data.</p>
        ) : null}
      </header>

      {doc.summary ? (
        <section className="resume-entry flex flex-col gap-1">
          <Section className="text-heading font-semibold">Summary</Section>
          <p className="whitespace-pre-line">{doc.summary}</p>
        </section>
      ) : null}

      {doc.projects.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Section className="text-heading font-semibold">Projects</Section>
          {doc.projects.map((project) => (
            <article key={project.id} className="resume-entry flex flex-col gap-1">
              <Entry className="text-subheading font-semibold">
                {project.name}
                {project.isDemo ? <span className="ml-2 text-meta font-medium text-demo">(Demo data)</span> : null}
              </Entry>
              {project.technologies.length > 0 ? (
                <p className="text-support text-foreground-secondary">{project.technologies.join(", ")}</p>
              ) : null}
              {project.summary ? <p>{project.summary.text}</p> : null}
              {project.achievements.length > 0 ? (
                <ul className="list-disc pl-5">
                  {project.achievements.map((achievement) => (
                    <li key={achievement.claimId}>{achievement.text}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {doc.otherAchievements.length > 0 ? (
        <section className="resume-entry flex flex-col gap-1">
          <Section className="text-heading font-semibold">Selected achievements</Section>
          <ul className="list-disc pl-5">
            {doc.otherAchievements.map((achievement) => (
              <li key={achievement.claimId}>
                {achievement.text}
                {achievement.claim.isDemo ? <span className="ml-2 text-meta font-medium text-demo">(Demo data)</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {doc.skills.length > 0 ? (
        <section className="resume-entry flex flex-col gap-1">
          <Section className="text-heading font-semibold">Skills</Section>
          <p>
            {doc.skills.map((skill) => skill.name).join(", ")}
            {doc.skills.some((skill) => skill.isDemo) ? (
              <span className="ml-2 text-meta font-medium text-demo">(includes demo data)</span>
            ) : null}
          </p>
        </section>
      ) : null}

      {!doc.summary && doc.projects.length === 0 && doc.otherAchievements.length === 0 && doc.skills.length === 0 ? (
        <p className="text-support text-muted">
          Nothing selected yet. Write a summary or select approved projects, achievements, and skills.
        </p>
      ) : null}
    </div>
  );
}
