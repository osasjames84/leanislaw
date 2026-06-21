import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ExerciseList from "./components/ExerciseList";
import { useState } from "react";
import StartWorkout from "./components/StartWorkout";
import WorkoutArea from "./components/WorkoutArea";
import AboutPage from "./components/AboutPage";
import Login from "./components/Login";
import Register from "./components/Register";
import CheckEmail from "./components/CheckEmail";
import VerifyEmail from "./components/VerifyEmail";
import ForgotPassword from "./components/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeRedirect from "./components/HomeRedirect";
import TdeeCalculator from "./components/TdeeCalculator";
import TdeeOnboarding from "./components/TdeeOnboarding";
import UsernameOnboarding from "./components/UsernameOnboarding";
import AppShell from "./components/AppShell";
import LogCalories from "./components/LogCalories";
import LogWeight from "./components/LogWeight";
import Leaderboard from "./components/Leaderboard";
import MacroTracking from "./components/MacroTracking";
import InsightsPage from "./components/InsightsPage";
import InsightDetailPage from "./components/InsightDetailPage";
import CoachChat from "./components/CoachChat";
import ChatInbox from "./components/ChatInbox";
import FriendDM from "./components/FriendDM";
import CoachRoute from "./components/CoachRoute";
import CoachConsole from "./components/CoachConsole";
import PremiumCoaching from "./components/PremiumCoaching";
import ProfilePage from "./components/ProfilePage";
import MyWeek from "./components/MyWeek";
import SupportPage from "./components/SupportPage";
import SupportSignpost from "./components/SupportSignpost";
import IntakeScreen from "./components/IntakeScreen";
import ClientCoaching from "./components/ClientCoaching";
import ClientForm from "./components/ClientForm";
import CoachingSignpost from "./components/CoachingSignpost";
import { AuthProvider } from "./contexts/AuthContext";
import { UnitsProvider } from "./contexts/UnitsContext";
import { ActiveWorkoutProvider } from "./contexts/ActiveWorkoutContext";

const App = () => {
  const [exercises, setExercises] = useState([]);

  return (
    <Router>
      <AuthProvider>
        <UnitsProvider>
          <ActiveWorkoutProvider>
            <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/insights/:metric" element={<InsightDetailPage />} />
              <Route path="/log/calories" element={<LogCalories />} />
              <Route path="/macros" element={<MacroTracking />} />
              <Route path="/log/weight" element={<LogWeight />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tdee" element={<TdeeCalculator />} />
              <Route path="/workout/:sessionId" element={<WorkoutArea />} />
              <Route path="/workout" element={<WorkoutArea />} />
              <Route path="/chat" element={<ChatInbox />} />
              <Route path="/chat/chad" element={<CoachChat />} />
              <Route path="/chat/friend/:friendId" element={<FriendDM />} />
              <Route path="/premium-coaching" element={<PremiumCoaching />} />
              <Route path="/me/week" element={<MyWeek />} />
              <Route path="/coaching" element={<ClientCoaching />} />
              <Route path="/coaching/forms/:formId" element={<ClientForm />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
            <Route
              path="/coach"
              element={
                <CoachRoute>
                  <CoachConsole />
                </CoachRoute>
              }
            />
            <Route
              path="/coach/clients/:clientId"
              element={
                <CoachRoute>
                  <CoachConsole />
                </CoachRoute>
              }
            />
            <Route path="/coach/library" element={<CoachRoute><CoachConsole section="library" /></CoachRoute>} />
            <Route path="/coach/metrics" element={<CoachRoute><CoachConsole section="metrics" /></CoachRoute>} />
            <Route path="/coach/forms" element={<CoachRoute><CoachConsole section="forms" /></CoachRoute>} />
            <Route path="/coach/tutorials" element={<CoachRoute><CoachConsole section="tutorials" /></CoachRoute>} />
            <Route path="/coach/reports" element={<Navigate to="/coach" replace />} />
            <Route
              path="/exercises"
              element={
                <ProtectedRoute>
                  <ExerciseList exercises={exercises} setExercises={setExercises} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workoutSessions/"
              element={
                <ProtectedRoute>
                  <StartWorkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setup/username"
              element={
                <ProtectedRoute>
                  <UsernameOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setup/tdee"
              element={
                <ProtectedRoute>
                  <TdeeOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setup/intake"
              element={
                <ProtectedRoute>
                  <IntakeScreen />
                </ProtectedRoute>
              }
            />
            </Routes>
            <CoachingSignpost />
            <SupportSignpost />
          </ActiveWorkoutProvider>
        </UnitsProvider>
      </AuthProvider>
    </Router>
  );
};
export default App;
