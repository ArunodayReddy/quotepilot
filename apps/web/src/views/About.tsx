import Link from "next/link";
import { Reveal } from "../components/Reveal";
import { TrackedCta } from "../components/TrackedCta";
import type { AboutContent, RichSegment } from "../lib/cms";

/** Render one CMS rich-text segment. */
function Segment({ seg }: { seg: RichSegment }) {
  if ("text" in seg) return <>{seg.text}</>;
  if ("bold" in seg) return <strong>{seg.bold}</strong>;
  return <Link href={seg.link.href}>{seg.link.label}</Link>;
}

/** Server-rendered from the CMS: static content, real SSR for SEO.
 *  The single tracked CTA uses the client <TrackedCta/> island. */
export function About({ content }: { content: AboutContent }) {
  return (
    <div className="page">
      <div className="container">
        <div className="prose">
          <Reveal>
            <h1 className="section-heading" style={{ textAlign: "left" }}>
              {content.title}
            </h1>
          </Reveal>
          <Reveal>
            <p className="section-sub" style={{ textAlign: "left", marginLeft: 0 }}>
              {content.lead}
            </p>
          </Reveal>

          {content.sections.map((section) => (
            <Reveal as="div" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((para, i) => (
                <p key={i}>
                  {para.map((seg, j) => (
                    <Segment key={j} seg={seg} />
                  ))}
                </p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.cta && (
                <TrackedCta
                  href={section.cta.href}
                  className="btn btn-primary btn-lg"
                  event="cta_clicked"
                  element="about_cta"
                  page="about"
                >
                  {section.cta.label}
                </TrackedCta>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
