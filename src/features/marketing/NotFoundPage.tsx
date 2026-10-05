import { AppLink, Logo } from "../../components/core";
export function NotFoundPage() {
  return (
    <main className="not-found">
      <Logo />
      <p className="eyebrow">404</p>
      <h1>This page has moved.</h1>
      <p>Return to MassLaidOff and choose the experience that fits you.</p>
      <AppLink to="/" className="button button-primary">
        Go home
      </AppLink>
    </main>
  );
}
