import { SITE_URL } from "@/lib/seo";

export function PersonSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Nicolás Mastromarino",
    url: SITE_URL,
    email: "mailto:nico@nicolasmastromarino.com",
    jobTitle: "CRM & Automation Consultant",
    image: `${SITE_URL}/nicolas-mastromarino-crm-automation-consultant.jpg`,
    description:
      "Hands-on CRM implementation, management, and marketing automation for home services, agencies, and coaches. GoHighLevel-led, platform-agnostic.",
    sameAs: ["https://ar.linkedin.com/in/nicolasmastromarino"],
    knowsAbout: [
      "CRM implementation",
      "GoHighLevel",
      "Marketing automation",
      "Zapier workflows",
      "Sales operations",
      "Email marketing",
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "AR",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbSchema({
  locale,
  items,
}: {
  locale: string;
  items: { name: string; path: string }[];
}) {
  const prefix = locale === "es" ? "/es" : "";
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const localizedPath = item.path === "/" ? prefix || "/" : `${prefix}${item.path}`;
      return {
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: new URL(localizedPath, SITE_URL).toString(),
      };
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ArticleSchema({
  title,
  description,
  datePublished,
  path,
}: {
  title: string;
  description: string;
  datePublished: string;
  path: string;
}) {
  const url = new URL(path, SITE_URL).toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished,
    url,
    mainEntityOfPage: url,
    image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}`,
    author: {
      "@type": "Person",
      name: "Nicolás Mastromarino",
      url: SITE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** the business and the site as a whole, for search engines and AI assistants that read structured data */
export function SiteSchema() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Nicolás Mastromarino",
      url: SITE_URL,
      inLanguage: ["en", "es"],
    },
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "Nicolás Mastromarino, CRM & Automation Consultant",
      url: SITE_URL,
      image: `${SITE_URL}/nicolas-mastromarino-crm-automation-consultant.jpg`,
      email: "mailto:nico@nicolasmastromarino.com",
      description:
        "CRM and automation for home-service businesses: HVAC, roofing, plumbing and electrical, landscaping, solar and locksmiths. GoHighLevel, Zapier and custom websites.",
      areaServed: "Worldwide",
      knowsLanguage: ["en", "es"],
      serviceType: [
        "CRM implementation",
        "CRM management",
        "Marketing automation",
        "Workflow automation",
        "Website development (GoHighLevel or custom)",
      ],
      provider: { "@type": "Person", name: "Nicolás Mastromarino", url: SITE_URL },
      sameAs: ["https://ar.linkedin.com/in/nicolasmastromarino"],
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
