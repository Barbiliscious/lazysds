import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ReviewPage from "./pages/ReviewPage";
import RegisterPage from "./pages/RegisterPage";
import FindPage from "./pages/FindPage";
import ScanPage from "./pages/ScanPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/find" element={<FindPage />} />
      <Route path="/scan" element={<ScanPage />} />
    </Routes>
  );
}
