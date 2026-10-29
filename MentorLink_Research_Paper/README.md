# MentorLink Research Paper

This folder contains the IEEE conference-format research paper draft for MentorLink.

- `conference_101719.tex`: manuscript source; author fields are intentionally blank.
- `bibliography.bib`: references used by the manuscript.
- `IEEEtran.cls`: supplied IEEE template class.

## Compile

From this directory, run:

```bash
pdflatex conference_101719.tex
bibtex conference_101719
pdflatex conference_101719.tex
pdflatex conference_101719.tex
```

The current environment did not expose `pdflatex` or `bibtex`, so compilation must be completed in a TeX-enabled environment such as TeX Live, MacTeX, Overleaf, or VS Code with a LaTeX extension.

The author block is intentionally empty and should be completed before submission.
