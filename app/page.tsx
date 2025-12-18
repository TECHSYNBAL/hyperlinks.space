import Image from "next/image";
import { readFile } from "node:fs/promises";
import path from "node:path";

function parseLinksFile(fileContents: string): string[] {
  // Expected format (one per line): `1. https://example.com/`
  return fileContents
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\.\s*/, "").trim());
}

export default async function Home() {
  const linksPath = path.join(
    process.cwd(),
    "public",
    "hyperlinks",
    "links.txt",
  );

  const linksTxt = await readFile(linksPath, "utf8");
  const links = parseLinksFile(linksTxt);

  // We expect 4 links (1..4) to match `/public/hyperlinks/{n}.svg`.
  const cells = [1, 2, 3, 4].map((n) => ({
    n,
    href: links[n - 1] ?? "#",
    src: `/hyperlinks/${n}.svg`,
  }));

  return (
    <main className="hyperlinksGrid">
      {cells.map(({ n, href, src }) => (
        <a
          key={n}
          className="hyperlinksCell"
          href={href}
          aria-label={`Open link ${n}`}
        >
          <div className="hyperlinksImagePad">
            <Image
              src={src}
              alt=""
              fill
              sizes="50vw"
              priority={n <= 2}
              className={`hyperlinksImage hyperlinksPos${n}`}
            />
          </div>
        </a>
      ))}
    </main>
  );
}
