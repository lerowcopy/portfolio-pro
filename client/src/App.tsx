import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import PortfolioEditorPage from "./pages/PortfolioEditorPage";
import PublicPortfolioPage from "./pages/PublicPortfolioPage";
import ProjectFormPage from "./pages/ProjectFormPage";
import ProjectsPage from "./pages/ProjectsPage";
import TemplateGallery from "./pages/TemplateGallery";
import ExternalAuthPage from "./pages/ExternalAuthPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path={"/auth/signin"}>{() => <ExternalAuthPage mode="signin" />}</Route>
      <Route path={"/auth/signup"}>{() => <ExternalAuthPage mode="signup" />}</Route>
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/dashboard/portfolios/:id/edit"} component={PortfolioEditorPage} />
      <Route path={"/dashboard/portfolios/:id/projects/new"} component={ProjectFormPage} />
      <Route path={"/dashboard/portfolios/:id/projects/:projectId/edit"} component={ProjectFormPage} />
      <Route path={"/dashboard/portfolios/:id/projects"} component={ProjectsPage} />
      <Route path={"/templates"} component={TemplateGallery} />
      <Route path={"/404"} component={NotFound} />
      <Route path={"/:slug"} component={PublicPortfolioPage} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
