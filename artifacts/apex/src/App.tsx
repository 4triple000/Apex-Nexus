import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { AvatarProvider } from "@/contexts/AvatarContext";
import { PersonalityProvider } from "@/contexts/PersonalityContext";
import { CharacterProvider } from "@/contexts/CharacterContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import { ApexStateProvider } from "@/contexts/ApexStateContext";
import { PaywallProvider } from "@/contexts/PaywallContext";
import { FTUEGate } from "@/components/ftue/FTUEScreen";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { EngineProvider } from "@/engine/EngineContext";

// Pages load on demand so the first visit only downloads what it shows
const Home = lazy(() => import("@/pages/home"));
const WorkflowBuilderPage = lazy(() => import("@/pages/workflow-builder"));
const AiStudioPage = lazy(() => import("@/pages/ai-studio"));
const ArenaPage = lazy(() => import("@/pages/arena"));
const ApexOSPage = lazy(() => import("@/pages/apex-os"));
const LoginPage = lazy(() => import("@/pages/login"));
const Screenshot = lazy(() => import("@/pages/screenshot"));
const Usage = lazy(() => import("@/pages/usage"));
const AvatarPage = lazy(() => import("@/pages/avatar"));
const WorkflowsPage = lazy(() => import("@/pages/workflows"));
const DMPage = lazy(() => import("@/pages/dm").then((m) => ({ default: m.DMPage })));
const StudioPage = lazy(() => import("@/pages/studio"));
const StudioProjectPage = lazy(() => import("@/pages/studio").then((m) => ({ default: m.StudioProjectPage })));
const MarketplacePage = lazy(() => import("@/pages/marketplace"));
const FeedPage = lazy(() => import("@/pages/feed"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ExplorePage = lazy(() => import("@/pages/explore"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const CreatorDashboardPage = lazy(() => import("@/pages/creator-dashboard"));
const InsightsPage = lazy(() => import("@/pages/insights"));
const MultiplayerPage = lazy(() => import("@/pages/multiplayer"));
const ApexFeaturesPage = lazy(() => import("@/pages/apex-features").then((m) => ({ default: m.ApexFeaturesPage })));
const LandingPage = lazy(() => import("@/pages/landing"));
const GameEnginePage = lazy(() => import("@/pages/game-engine"));
const GameEcosystemPage = lazy(() => import("@/pages/game-ecosystem"));
const ApexDevOSPage = lazy(() => import("@/pages/apex-dev-os"));
const ApexAvatarPage = lazy(() => import("@/pages/apex-avatar"));
const ApexBuilderPage = lazy(() => import("@/pages/apex-builder"));
const NexusBuilderPage = lazy(() => import("@/pages/nexus-builder"));
const DomainSettingsPage = lazy(() => import("@/pages/domain-settings"));
const DevCockpitPage = lazy(() => import("@/pages/dev-cockpit"));
const RuntimePage = lazy(() => import("@/pages/runtime"));
const DeployDashboardPage = lazy(() => import("@/pages/deploy-dashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function FullScreenLoader() {
  return (
    <div style={{
      minHeight: "100dvh", background: "#07080E",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18,
    }}>
      <ApexLogo size={72} state="spinning" radius={20} />
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
      }}>
        Loading…
      </span>
    </div>
  );
}

// ── Layout wrapper — shows loading spinner while auth resolves, then renders app.
//    Auth is OPTIONAL — guests can use the app without an account. ──────────────
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;

  return <FTUEGate>{children}</FTUEGate>;
}

function Router() {
  return (
    <Switch>
      {/* ── Public marketing pages — no auth, no FTUE ── */}
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={LoginPage} />

      {/* ── Full-screen protected routes — bypasses the mobile Layout ── */}
      <Route path="/workflow-builder">
        <ProtectedLayout><WorkflowBuilderPage /></ProtectedLayout>
      </Route>
      <Route path="/ai-studio">
        <ProtectedLayout><AiStudioPage /></ProtectedLayout>
      </Route>
      <Route path="/arena">
        <ProtectedLayout><ArenaPage /></ProtectedLayout>
      </Route>
      <Route path="/game-engine">
        <ProtectedLayout><GameEnginePage /></ProtectedLayout>
      </Route>
      <Route path="/games">
        <ProtectedLayout><GameEcosystemPage /></ProtectedLayout>
      </Route>
      <Route path="/apex-dev-os">
        <ApexDevOSPage />
      </Route>
      <Route path="/apex-avatar">
        <ProtectedLayout><ApexAvatarPage /></ProtectedLayout>
      </Route>
      <Route path="/apex-builder">
        <ApexBuilderPage />
      </Route>
      <Route path="/nexus-builder">
        <NexusBuilderPage />
      </Route>
      <Route path="/domain-settings">
        <DomainSettingsPage />
      </Route>
      <Route path="/dev-cockpit">
        <DevCockpitPage />
      </Route>
      <Route path="/runtime">
        <RuntimePage />
      </Route>
      <Route path="/deploy">
        <DeployDashboardPage />
      </Route>
      <Route path="/apex-os">
        <ProtectedLayout><ApexOSPage /></ProtectedLayout>
      </Route>
      <Route path="/studio/project/:id">
        <ProtectedLayout><StudioProjectPage /></ProtectedLayout>
      </Route>

      {/* ── All other routes — protected + standard mobile Layout ── */}
      <Route>
        <ProtectedLayout>
          <Layout>
            <Suspense fallback={null}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/screenshot" component={Screenshot} />
              <Route path="/usage" component={Usage} />
              <Route path="/avatar" component={AvatarPage} />
              <Route path="/workflows" component={WorkflowsPage} />
              <Route path="/dm" component={DMPage} />
              <Route path="/studio" component={StudioPage} />
              <Route path="/marketplace" component={MarketplacePage} />
              <Route path="/feed" component={FeedPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/profile/:userId" component={ProfilePage} />
              <Route path="/explore" component={ExplorePage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/creator-dashboard" component={CreatorDashboardPage} />
              <Route path="/insights" component={InsightsPage} />
              <Route path="/multiplayer" component={MultiplayerPage} />
              <Route path="/apex-features" component={ApexFeaturesPage} />
              <Route component={NotFound} />
            </Switch>
            </Suspense>
          </Layout>
        </ProtectedLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ApexStateProvider>
        <AuthProvider>
          <PrivacyProvider>
            <AvatarProvider>
              <PersonalityProvider>
                <CharacterProvider>
                  <EngineProvider>
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <PaywallProvider>
                        <Suspense fallback={<FullScreenLoader />}>
                          <Router />
                        </Suspense>
                      </PaywallProvider>
                    </WouterRouter>
                  </EngineProvider>
                </CharacterProvider>
              </PersonalityProvider>
            </AvatarProvider>
          </PrivacyProvider>
        </AuthProvider>
        </ApexStateProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
