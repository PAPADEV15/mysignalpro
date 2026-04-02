import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Signals from "@/pages/Signals";
import SignalDetail from "@/pages/SignalDetail";
import AnalysisRuns from "@/pages/AnalysisRuns";
import Watchlist from "@/pages/Watchlist";
import SettingsPage from "@/pages/Settings";
import Audit from "@/pages/Audit";
import Metrics from "@/pages/Metrics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="signals" element={<Signals />} />
              <Route path="signals/:id" element={<SignalDetail />} />
              <Route path="analysis-runs" element={<AnalysisRuns />} />
              <Route path="watchlist" element={<ProtectedRoute requiredRole="admin"><Watchlist /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute requiredRole="admin"><Audit /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
