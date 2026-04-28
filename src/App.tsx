import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import PendingApproval from "./pages/PendingApproval";
import AccountDisabled from "./pages/AccountDisabled";
import PricingTable from "./pages/PricingTable";
import Orders from "./pages/Orders";
import Approvals from "./pages/Approvals";
import Operations from "./pages/Operations";
import OperationsMTM from "./pages/OperationsMTM";
import MTM from "./pages/MTM";
import Market from "./pages/Market";
import Settings from "./pages/Settings";
import AdminUsers from "./pages/AdminUsers";
import Financial from "./pages/Financial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/aguardando-aprovacao" element={<PendingApproval />} />
            <Route path="/acesso-desativado" element={<AccountDisabled />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<PricingTable />} />
              <Route path="/ordens" element={<Orders />} />
              <Route path="/aprovacoes" element={<Approvals />} />
              <Route path="/operacoes-mtm" element={<OperationsMTM />} />
              <Route path="/operacoes" element={<Operations />} />
              <Route path="/mtm" element={<MTM />} />
              <Route path="/mercado" element={<Market />} />
              <Route path="/financeiro" element={<Financial />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/admin/usuarios" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
