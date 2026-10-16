# Rizzume

Resumes with rizz. A free, offline resume builder that types like LaTeX and edits like a note.

**Live:** https://pankqx.github.io/rizzume/

- **Write on the page.** Click any line and type. Enter adds a bullet; Backspace on an empty one removes it. Paste a list and every line becomes a bullet.
- **One page, every time.** Auto-fit tunes type size and spacing so the page is full and never spills.
- **LaTeX-quality output.** The Classic template is a point-for-point match of a hand-written `article` resume (10pt, A4, 0.5in margins, Latin Modern).
- **Real PDF.** Vector text you can select and that applicant tracking systems can read, with clickable links. Generated in the browser.
- **Proof marks.** Weak verbs, missing numbers, three-line bullets and dangling last words are circled in the margin.
- **Job match.** Paste a job post to see which of its skills your resume mentions, and add the missing ones in a click.
- **A copy per role.** Keep a base resume and tailored copies side by side.
- **Exports:** PDF, standalone `.tex` (compiles on Overleaf), and `.json` backups.
- **Private and offline.** Everything stays in your browser's storage. Installable as an app.

Templates: Classic, Modern (sans with an accent colour) and Compact (small caps, tighter).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Plain Vite + vanilla JS. No framework, no backend. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## How the PDF works

The resume is laid out once by the browser. The exporter then walks every word, rule, icon and link on that page and draws it into a PDF at the same coordinates with `pdf-lib`, embedding the same font files. Screen and PDF can't drift apart because they come from one layout.

## Credits

Latin Modern fonts (GUST Font License), IBM Plex Sans and Hanken Grotesk (SIL OFL), Font Awesome 5 Free icons (CC BY 4.0).
