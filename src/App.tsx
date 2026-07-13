import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Phase 2 adds /review, Phase 3 adds /register */}
    </Routes>
  );
}
