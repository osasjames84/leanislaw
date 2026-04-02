import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
import CoachRoute from "./components/CoachRoute";
import CoachDashboard from "./components/CoachDashboard";
import PremiumCoaching from "./components/PremiumCoaching";
import ProfilePage from "./components/ProfilePage";
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
              <Route path="/chat" element={<CoachChat />} />
              <Route path="/premium-coaching" element={<PremiumCoaching />} />
              <Route
                path="/coach"
                element={
                  <CoachRoute>
                    <CoachDashboard />
                  </CoachRoute>
                }
              />
            </Route>
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
            </Routes>
          </ActiveWorkoutProvider>
        </UnitsProvider>
      </AuthProvider>
    </Router>
  );
};
export default App;
