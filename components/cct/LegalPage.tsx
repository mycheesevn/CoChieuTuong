"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLang, type Lang } from "@/lib/cct/i18n";
import type { LegalDoc } from "@/lib/cct/legal";

interface Props {
  docs: Record<Lang, LegalDoc>;
}

export function LegalPage({ docs }: Props) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    setLang(loadLang());
    document.documentElement.lang = loadLang();
  }, []);
  const doc = docs[lang];
  return (
    <div className="cct-legal-page">
      <article className="cct-legal">
        <Link href="/" className="cct-btn">
          {doc.back}
        </Link>
        <h1>{doc.title}</h1>
        <p className="cct-legal-updated">{doc.updated}</p>
        {doc.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {doc.sections.map((s, i) => (
          <section key={i}>
            <h2>{s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
        <div className="cct-legal-foot">
          <Link href="/" className="cct-btn">
            {doc.back}
          </Link>
        </div>
      </article>
    </div>
  );
}
