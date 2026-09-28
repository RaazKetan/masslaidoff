# Component foundation

Magic UI source is vendored from its official registry (https://magicui.design/r/) with its MIT license in MAGICUI-LICENSE.md.

- Ripple Button: every action button, navigation action, form action and prominent link on both pages. The local source adds an href prop to render semantic anchors.
- Magic Card: candidate rows, manager-review cards, the landing profile preview and hiring panel. Configured with a very subtle blue pointer highlight.
- Blur Fade: landing headings and workspace page headings, with reduced-motion handling.
- Scroll Progress: a thin blue reading indicator on the landing page.

Native inputs, checkboxes, selects, file inputs, structural elements and dialogs cover controls absent from the Magic UI catalog. They retain labels, keyboard behavior and the same Google Sans styling.

Vite builds index.html and workspace.html to dist. React islands own dynamic content while preserving the existing accessible document structure and page flows. All HTML templates are application-owned; user-entered values continue to be escaped before previewing. npm run build produces the hosted static assets.
