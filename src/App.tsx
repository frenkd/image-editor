import { Analytics } from "@vercel/analytics/react";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HowItWorks } from "./pages/HowItWorks";
import { RemoveBg } from "./tools/RemoveBg";

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<RemoveBg />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
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
