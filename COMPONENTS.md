# Component foundation

Magic UI source is vendored from its official registry (https://magicui.design/r/) with its MIT license in MAGICUI-LICENSE.md.

- Magic Card: candidate records and the landing profile preview. Configured with a restrained blue pointer highlight.
- Blur Fade: the landing hero, with reduced-motion handling.
- Scroll Progress: a thin blue reading indicator on the landing page.

Native inputs, checkboxes, selects, file inputs, structural elements and dialogs cover controls absent from the Magic UI catalog. They retain labels, keyboard behavior and the same Google Sans styling.

Vite builds a single React application from `index.html` and `src/main.tsx`. React owns the complete page tree, routing, forms, directory filters, and application state.
