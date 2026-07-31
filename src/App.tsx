import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./components/Home";
import { Crop } from "./tools/Crop";
import { Overlay } from "./tools/Overlay";
import { RemoveBg } from "./tools/RemoveBg";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/remove-bg" element={<RemoveBg />} />
          <Route path="/crop" element={<Crop />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
