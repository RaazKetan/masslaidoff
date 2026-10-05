import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/auth-context";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { RequireAuth, RequireRole } from "./app/guards";
import { StatePanel } from "./components/core";
import "./magicui.css";
import "./magicui-overrides.css";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
const LandingPage = lazy(() =>
  import("./features/marketing/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./features/marketing/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const AuthPage = lazy(() =>
  import("./features/auth/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./features/auth/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const VerifyCompanyEmailPage = lazy(() =>
  import("./features/auth/VerifyCompanyEmailPage").then((module) => ({
    default: module.VerifyCompanyEmailPage,
  })),
);
const WorkspaceLayout = lazy(() =>
  import("./features/workspace/WorkspaceLayout").then((module) => ({
    default: module.WorkspaceLayout,
  })),
);
const CandidateDirectoryPage = lazy(() =>
  import("./features/candidates/CandidateDirectoryPage").then((module) => ({
    default: module.CandidateDirectoryPage,
  })),
);
const CandidateProfilePage = lazy(() =>
  import("./features/candidates/CandidateProfilePage").then((module) => ({
    default: module.CandidateProfilePage,
  })),
);
const RecruiterProfilePage = lazy(() =>
  import("./features/recruiters/RecruiterProfilePage").then((module) => ({
    default: module.RecruiterProfilePage,
  })),
);
const SubmitReviewPage = lazy(() =>
  import("./features/reviews/SubmitReviewPage").then((module) => ({
    default: module.SubmitReviewPage,
  })),
);
const ManagerReviewsPage = lazy(() =>
  import("./features/reviews/ManagerReviewsPage").then((module) => ({
    default: module.ManagerReviewsPage,
  })),
);
const CandidateDetailPage = lazy(() => import("./features/recruiters/CandidateDetailPage").then((module) => ({ default: module.CandidateDetailPage })));
const AccessRequestsPage = lazy(() => import("./features/candidates/AccessRequestsPage").then((module) => ({ default: module.AccessRequestsPage })));
const OutreachPage = lazy(() => import("./features/recruiters/OutreachPage").then((module) => ({ default: module.OutreachPage })));
const PublicDataPage = lazy(() => import("./features/marketing/PublicDataPage").then((module) => ({ default: module.PublicDataPage })));

function ProfileRoute() {
  const auth = useAuth();
  return auth.accountType === "recruiter" ? (
    <RecruiterProfilePage />
  ) : (
    <CandidateProfilePage />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/manager-reviews" element={<ManagerReviewsPage />} />
      <Route path="/data" element={<PublicDataPage />} />
      <Route
        path="/login/job-seeker"
        element={<AuthPage audience="candidate" />}
      />
      <Route path="/login/hiring" element={<AuthPage audience="recruiter" />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/verify-company-email"
        element={<VerifyCompanyEmailPage />}
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <WorkspaceLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfileRoute />} />
        <Route
          path="profile/edit"
          element={
            <RequireRole role="candidate">
              <CandidateProfilePage edit />
            </RequireRole>
          }
        />
        <Route
          path="discover"
          element={
            <RequireRole role="recruiter">
              <CandidateDirectoryPage />
            </RequireRole>
          }
        />
        <Route path="discover/:id" element={<RequireRole role="recruiter"><CandidateDetailPage /></RequireRole>} />
        <Route path="outreach" element={<RequireRole role="recruiter"><OutreachPage /></RequireRole>} />
        <Route path="requests" element={<RequireRole role="candidate"><AccessRequestsPage /></RequireRole>} />
        <Route
          path="reviews"
          element={
            <RequireRole role="candidate">
              <SubmitReviewPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <Suspense
              fallback={
                <StatePanel
                  kind="loading"
                  title="Loading MassLaidOff"
                  message="Preparing this page."
                />
              }
            >
              <AppRoutes />
            </Suspense>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
