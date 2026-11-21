# Rizzume

Resumes with rizz. A free, offline resume builder that types like LaTeX and edits like a note.

**Live:** https://pankqx.github.io/rizzume/

- **Write on the page.** Click any line and type. Enter always adds a new point (it never cuts the one you're in, even on wrapped lines); Shift+Enter splits on purpose; Alt+↑/↓ moves a point; Backspace on an empty one removes it. Hover a point for add, move and delete buttons. Paste a list and every line becomes a point.
- **One page, every time.** Auto-fit tunes type size and spacing so the page is full and never spills.
- **LaTeX-quality output.** The Classic template is a point-for-point match of a hand-written `article` resume (10pt, A4, 0.5in margins, Latin Modern).
- **Real PDF.** Vector text you can select and that applicant tracking systems can read, with clickable links. Generated in the browser.
- **Proof marks.** Weak verbs, missing numbers, three-line bullets and dangling last words are circled in the margin.
- **Job match.** Paste a job post to see which of its skills your resume mentions, and add the missing ones in a click.
- **A copy per role.** Keep a base resume and tailored copies side by side.
- **Exports:** PDF, standalone `.tex` (compiles on Overleaf), and `.json` backups.
- **Private and offline.** Everything stays in your browser's storage. Installable as an app.
- **Visit counter.** The footer shows total visits and PDFs downloaded, counted with [Abacus](https://v2.jasoncameron.dev/abacus/) (namespace `rizzume-pankqx`). Only the two numbers are sent, never resume content. Local development uses a separate `rizzume-dev` namespace.

Templates: Classic, Modern (sans with an accent colour), Compact (small caps, tighter) and Placement (the campus-placement LaTeX format: Times, links stacked on the right, `[GitHub | Live]` project links, education table and declaration; its `.tex` export is that exact LaTeX file).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm test         # end-to-end editing tests in your installed Chrome (CHROME_PATH=/path/to/chrome to override)
```

Plain Vite + vanilla JS. No framework, no backend. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## How the PDF works

The resume is laid out once by the browser. The exporter then walks every word, rule, icon and link on that page and draws it into a PDF at the same coordinates with `pdf-lib`, embedding the same font files. Screen and PDF can't drift apart because they come from one layout.

## Credits

Latin Modern and TeX Gyre Termes fonts (GUST Font License), IBM Plex Sans and Hanken Grotesk (SIL OFL), Font Awesome 5 Free icons (CC BY 4.0).
