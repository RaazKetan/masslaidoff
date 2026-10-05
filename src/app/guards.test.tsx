import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "./auth-context";
import { RequireAuth, RequireRole } from "./guards";

const baseAuth: AuthState = {
  loading: false,
  error: null,
  authenticated: false,
  account: null,
  accountType: null,
  accountName: "",
  email: "",
  companyEmail: "",
  companyEmailVerified: false,
  demo: false,
  refresh: vi.fn(async () => {}),
  createDemoSession: vi.fn(),
  signOut: vi.fn(async () => {}),
};

function renderRoutes(auth: AuthState, path: string, content: React.ReactNode) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/login/job-seeker"
            element={<div>Job seeker login</div>}
          />
          <Route path="/login/hiring" element={<div>Hiring login</div>} />
          <Route path="/app/profile" element={<div>Profile</div>} />
          <Route path={path} element={content} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("route access control", () => {
  it("redirects anonymous workspace visitors to sign in", () => {
    renderRoutes(
      baseAuth,
      "/app/reviews",
      <RequireAuth>
        <div>Private review form</div>
      </RequireAuth>,
    );
    expect(screen.getByText("Job seeker login")).toBeInTheDocument();
    expect(screen.queryByText("Private review form")).not.toBeInTheDocument();
  });

  it("sends anonymous candidate-detail visitors to hiring sign in", () => {
    renderRoutes(
      baseAuth,
      "/app/discover/abc",
      <RequireAuth>
        <div>Candidate detail</div>
      </RequireAuth>,
    );
    expect(screen.getByText("Hiring login")).toBeInTheDocument();
  });

  it("shows a retry instead of redirecting when the account fails to load", () => {
    renderRoutes(
      { ...baseAuth, error: new Error("API down") },
      "/app/reviews",
      <RequireAuth>
        <div>Private review form</div>
      </RequireAuth>,
    );
    expect(screen.getByText("API down")).toBeInTheDocument();
    expect(screen.queryByText("Job seeker login")).not.toBeInTheDocument();
  });

  it("redirects a candidate away from recruiter search", () => {
    renderRoutes(
      { ...baseAuth, authenticated: true, accountType: "candidate" },
      "/app/discover",
      <RequireRole role="recruiter">
        <div>Talent directory</div>
      </RequireRole>,
    );
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.queryByText("Talent directory")).not.toBeInTheDocument();
  });

  it("allows a recruiter into recruiter search", () => {
    renderRoutes(
      { ...baseAuth, authenticated: true, accountType: "recruiter" },
      "/app/discover",
      <RequireRole role="recruiter">
        <div>Talent directory</div>
      </RequireRole>,
    );
    expect(screen.getByText("Talent directory")).toBeInTheDocument();
  });
});
