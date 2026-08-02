import { Analytics } from "@vercel/analytics/react";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Faq } from "./pages/Faq";
import { ForAgents } from "./pages/ForAgents";
import { HowItWorks } from "./pages/HowItWorks";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { UseCases } from "./pages/UseCases";
import { RemoveBg } from "./pages/RemoveBg";

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<RemoveBg />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/use-cases" element={<UseCases />} />
            <Route path="/for-agents" element={<ForAgents />} />
            <Route
              path="/ai-agents"
              element={<Navigate to="/for-agents" replace />}
            />
            <Route path="/faq" element={<Faq />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/remove-background" element={<RemoveBg />} />
            <Route path="/remove-bg" element={<Navigate to="/" replace />} />
            <Route
              path="/remove-image-background"
              element={<Navigate to="/" replace />}
            />
            <Route
              path="/remove-image-bg"
              element={<Navigate to="/" replace />}
            />
            <Route
              path="/background-remover"
              element={<Navigate to="/" replace />}
            />
            <Route
              path="/background-removal"
              element={<Navigate to="/" replace />}
            />
            <Route path="/crop-image" element={<Navigate to="/" replace />} />
            <Route path="/crop" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Analytics />
      </BrowserRouter>
    </HelmetProvider>
  );
}
