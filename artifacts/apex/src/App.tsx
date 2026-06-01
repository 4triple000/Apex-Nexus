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
import Home from "@/pages/home";
import WorkflowBuilderPage from "@/pages/workflow-builder";
import AiStudioPage from "@/pages/ai-studio";
import ArenaPage from "@/pages/arena";
import ApexOSPage from "@/pages/apex-os";
import LoginPage from "@/pages/login";
import Screenshot from "@/pages/screenshot";
import Usage from "@/pages/usage";
import AvatarPage from "@/pages/avatar";
import WorkflowsPage from "@/pages/workflows";
import { DMPage } from "@/pages/dm";
import StudioPage, { StudioProjectPage } from "@/pages/studio";
import MarketplacePage from "@/pages/marketplace";
import FeedPage from "@/pages/feed";
import ProfilePage from "@/pages/profile";
import ExplorePage from "@/pages/explore";
import PricingPage from "@/pages/pricing";
import CreatorDashboardPage from "@/pages/creator-dashboard";
import InsightsPage from "@/pages/insights";
import MultiplayerPage from "@/pages/multiplayer";
import { ApexFeaturesPage } from "@/pages/apex-features";
import LandingPage from "@/pages/landing";
import GameEnginePage from "@/pages/game-engine";
import GameEcosystemPage from "@/pages/game-ecosystem";
import ApexDevOSPage from "@/pages/apex-dev-os";
import ApexAvatarPage from "@/pages/apex-avatar";
import ApexBuilderPage from "@/pages/apex-builder";
import NexusBuilderPage from "@/pages/nexus-builder";
import DomainSettingsPage from "@/pages/domain-settings";
import DevCockpitPage from "@/pages/dev-cockpit";
import RuntimePage from "@/pages/runtime";
import DeployDashboardPage from "@/pages/deploy-dashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// ── Layout wrapper — shows loading spinner while auth resolves, then renders app.
//    Auth is OPTIONAL — guests can use the app without an account. ──────────────
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
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
                        <Router />
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
