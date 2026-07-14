import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { GuestProvider } from "./auth/GuestContext";
import { ToastProvider } from "./components/toast";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireAdmin from "./components/RequireAdmin";
import RequireContributor from "./components/RequireContributor";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import MedicationsPage from "./pages/MedicationsPage";
import DoctorsPage from "./pages/DoctorsPage";
import AilmentsPage from "./pages/AilmentsPage";
import InsurancePage from "./pages/InsurancePage";
import PharmaciesPage from "./pages/PharmaciesPage";
import FamilyHistoryPage from "./pages/FamilyHistoryPage";
import SurgeriesPage from "./pages/SurgeriesPage";
import HospitalizationsPage from "./pages/HospitalizationsPage";
import VisionHistoryPage from "./pages/VisionHistoryPage";
import DentalHistoryPage from "./pages/DentalHistoryPage";
import VaccinationsPage from "./pages/VaccinationsPage";
import VisitLogsPage from "./pages/VisitLogsPage";
import VitalsPage from "./pages/VitalsPage";
import CalendarPage from "./pages/CalendarPage";
import DocumentsPage from "./pages/DocumentsPage";
import ShareLinksPage from "./pages/ShareLinksPage";
import BackupsPage from "./pages/BackupsPage";
import AuditLogPage from "./pages/AuditLogPage";
import SubmissionsPage from "./pages/SubmissionsPage";
import MySubmissionsPage from "./pages/MySubmissionsPage";
import NotesPage from "./pages/NotesPage";
import NutritionPlanPage from "./pages/NutritionPlanPage";
import GuestEntryPage from "./pages/GuestEntryPage";
import GuestSectionPage from "./pages/GuestSectionPage";
import GuestRecordPage from "./pages/GuestRecordPage";
import SettingsPage from "./pages/SettingsPage";
import AiAssistantPage from "./components/AiAssistantPage";

export default function App() {
  return (
    <GuestProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
            <Route path="/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/medications" element={<ProtectedRoute><MedicationsPage /></ProtectedRoute>} />
            <Route path="/doctors" element={<ProtectedRoute><DoctorsPage /></ProtectedRoute>} />
            <Route path="/ailments" element={<ProtectedRoute><AilmentsPage /></ProtectedRoute>} />
            <Route path="/insurance" element={<ProtectedRoute><InsurancePage /></ProtectedRoute>} />
            <Route path="/pharmacies" element={<ProtectedRoute><PharmaciesPage /></ProtectedRoute>} />
            <Route path="/family-history" element={<ProtectedRoute><FamilyHistoryPage /></ProtectedRoute>} />
            <Route path="/surgeries" element={<ProtectedRoute><SurgeriesPage /></ProtectedRoute>} />
            <Route path="/hospitalizations" element={<ProtectedRoute><HospitalizationsPage /></ProtectedRoute>} />
            <Route path="/vision-history" element={<ProtectedRoute><VisionHistoryPage /></ProtectedRoute>} />
            <Route path="/dental-history" element={<ProtectedRoute><DentalHistoryPage /></ProtectedRoute>} />
            <Route path="/vaccinations" element={<ProtectedRoute><VaccinationsPage /></ProtectedRoute>} />
            <Route path="/visit-logs" element={<ProtectedRoute><VisitLogsPage /></ProtectedRoute>} />
            <Route path="/vitals" element={<ProtectedRoute><VitalsPage /></ProtectedRoute>} />
            <Route path="/appointments" element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
            <Route path="/nutrition-plan" element={<ProtectedRoute><NutritionPlanPage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
            <Route path="/share-links" element={<RequireAdmin><ShareLinksPage /></RequireAdmin>} />
            <Route path="/audit-log" element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
            <Route path="/submissions" element={<RequireAdmin><SubmissionsPage /></RequireAdmin>} />
            <Route path="/my-submissions" element={<ProtectedRoute><RequireContributor><MySubmissionsPage /></RequireContributor></ProtectedRoute>} />
            <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
            <Route path="/backups" element={<RequireAdmin><BackupsPage /></RequireAdmin>} />
            <Route path="/assistant" element={<ProtectedRoute><AiAssistantPage /></ProtectedRoute>} />
            <Route path="/guest" element={<GuestEntryPage />} />
            <Route path="/guest/sections/:section" element={<GuestSectionPage />} />
            <Route path="/guest/sections/:section/:recordId" element={<GuestRecordPage />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </GuestProvider>
  );
}
