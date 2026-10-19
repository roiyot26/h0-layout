# CV source

`public/cv.pdf` is the published CV. Rebuild it with:

```bash
# Once per machine: OFL variable fonts as cv/fonts/{Literata,Literata-Italic,Inter}.ttf
# On the portfolio box they are symlinked from the sand-box Google font tree.
npm run build-cv
npm run cv-check
```

`scripts/build-cv.mjs` prints `cv/cv.html` through headless Chrome, then rewrites
the PDF info dictionary with pypdf so Author / Creator / Producer are
`Roi Yotvat` and no Chrome/Skia/XMP producer string remains.

`cv/experience.json` is the honesty source for years, roles and employers
(Moveo Creative, Mister Bit, Coding Academy). The HTML must stay in line with it.
Tel Aviv appears once, in the header. There is no phone number. The email stays
(the history check allows that local part only inside `*.pdf`).
