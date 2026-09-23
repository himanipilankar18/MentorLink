# Visual Design Guide

Purpose: Document the existing MentorConnect visual language and provide a clearly marked starting point for future UI consistency.

Last updated: 2026-09-23

## Design-System Status

The repository has a recognizable visual language but not a centralized design-token system. The guidance below records verified values from the active static auth pages and marks new standardization as proposed.

`📋 Proposed — pending review`: consolidate these values into shared tokens only after a human design decision.

## Color Palette

| Token | Value | Current use |
|---|---|---|
| Background black | `#000000` | Main page and form pane |
| Near-black | `#0a0a0a` | Body/form surfaces |
| Surface | `#1a1a1a` | Inputs and select options |
| Purple | `#8b5cf6` | Illustration and primary accent |
| Lavender | `#a78bfa` | Focus states and gradients |
| Light lavender | `#c4b5fd` | Illustration gradient |
| Yellow cream | `#fef3c7` | Illustration and active control text/background |
| Warm yellow | `#fde68a` | Active controls and illustration |
| Pink accent | `#ec4899` | Gradient and decorative shapes |
| Green accent | `#10b981` | Illustration details and success-related accents |
| Amber accent | `#f59e0b` | Decorative details |
| Primary text | `#ffffff` | Headings and input text |
| Secondary text | `#888888` | Supporting copy |
| Muted text | `#555555` / `#666666` | Placeholders and low-emphasis copy |

## Typography

Current auth pages use the system family:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif
```

Current scale:

| Use | Approximate size |
|---|---:|
| Main auth heading | `2rem` to `2.2rem` |
| Section/label heading | `0.95rem` |
| Field labels | `0.85rem` |
| Body/supporting text | `0.8rem` to `0.9rem` |
| Helper text | `0.75rem` |

`📋 Proposed — pending review`: define shared CSS variables and a formal type ramp across the static pages and React landing app.

## Spacing and Grid

- Auth pages use a two-pane desktop layout: form and illustration.
- Registration and login forms use two-column rows for related fields.
- Input height is approximately `42px` on the current registration page.
- Common control radius is approximately `12px`; cards use approximately `18px` to `24px`.
- Form groups use compact vertical spacing to keep registration usable on shorter screens.
- Guidance topics use a compact multi-column chip/checkbox layout.
- On smaller screens, the illustration is hidden and form rows collapse to one column.

## Components

### Buttons

- Use clear action labels such as `Continue`, `Login`, or `Verify & Continue`.
- Use a strong light surface against the dark form.
- Preserve disabled states and avoid changing button dimensions during loading.
- Use hover/focus transitions sparingly and consistently.

### Forms

- Keep labels visible and close to controls.
- Use native browser validation for basic required/type checks, with server-side validation as authoritative.
- Distinguish optional sections visually without implying their fields are required.
- Never use a placeholder as the only label.
- Keep conditional fields out of the active validation path when hidden.

### Cards and surfaces

- Use dark translucent surfaces with restrained borders and shadows.
- Keep the registration card centered and bounded; allow natural document scrolling where content exceeds the viewport.
- Preserve the illustration as a balanced visual counterweight, not as a separate product identity.

## UI Voice

- Direct, calm, and specific.
- Tell users what is happening: `OTP sent`, `Registration complete`, `Invalid credentials`.
- Avoid claiming mentorship capabilities that are not implemented.
- Explain optional admission information as private/profile context, not public credentials.

## Accessibility Notes

- Keep explicit labels associated with every input.
- Ensure active segmented controls expose state through more than color alone where possible.
- Preserve keyboard operation for tabs, form fields, checkboxes, and buttons.
- Maintain visible focus states against the dark background.
- Use sufficient contrast for muted text and error messages.
- Do not rely on the illustration or decorative emoji to convey required information.
- Ensure conditional sections remain understandable to screen readers when shown or hidden.

## Open Design Questions

- TODO: Decide whether the static pages and React landing app should share a formal token file.
- TODO: Decide whether the product should standardize on a custom font or retain the system stack.
- TODO: Define a single responsive breakpoint and shared spacing scale across all pages.
