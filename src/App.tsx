import { Analytics } from "@vercel/analytics/react";
import { HelmetProvider } from "react-helmet-async";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { Home } from "./components/Home";
import { Crop } from "./tools/Crop";
import { RemoveBg } from "./tools/RemoveBg";

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/remove-background" element={<RemoveBg />} />
            <Route
              path="/remove-bg"
              element={<Navigate to="/remove-background" replace />}
            />
            <Route
              path="/remove-image-background"
              element={<Navigate to="/remove-background" replace />}
            />
            <Route
              path="/remove-image-bg"
              element={<Navigate to="/remove-background" replace />}
            />
            <Route
              path="/background-remover"
              element={<Navigate to="/remove-background" replace />}
            />
            <Route
              path="/background-removal"
              element={<Navigate to="/remove-background" replace />}
            />

            <Route path="/crop-image" element={<Crop />} />
            <Route path="/crop" element={<Navigate to="/crop-image" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Analytics />
      </BrowserRouter>
    </HelmetProvider>
  );
}
