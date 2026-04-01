import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ExerciseList from "./components/ExerciseList";
import { useState } from "react";
import StartWorkout from "./components/StartWorkout";
import WorkoutSession from "./components/WorkoutSession";
import AboutPage from "./components/AboutPage";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeRedirect from "./components/HomeRedirect";
import TdeeCalculator from "./components/TdeeCalculator";
import TdeeOnboarding from "./components/TdeeOnboarding";
import AppShell from "./components/AppShell";
import LogCalories from "./components/LogCalories";
import LogWeight from "./components/LogWeight";
import Leaderboard from "./components/Leaderboard";
import MacroTracking from "./components/MacroTracking";
import WorkoutHub from "./components/WorkoutHub";
import InsightsPage from "./components/InsightsPage";
import InsightDetailPage from "./components/InsightDetailPage";
import CoachChat from "./components/CoachChat";
import { AuthProvider } from "./contexts/AuthContext";
import { UnitsProvider } from "./contexts/UnitsContext";

const App = () => {
  const [exercises, setExercises] = useState([]);

  return (
    <Router>
      <AuthProvider>
        <UnitsProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/insights/:metric" element={<InsightDetailPage />} />
              <Route path="/log/calories" element={<LogCalories />} />
              <Route path="/macros" element={<MacroTracking />} />
              <Route path="/log/weight" element={<LogWeight />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tdee" element={<TdeeCalculator />} />
              <Route path="/workout" element={<WorkoutHub />} />
              <Route path="/chat" element={<CoachChat />} />
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
              path="/workout/:id"
              element={
                <ProtectedRoute>
                  <WorkoutSession />
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
        </UnitsProvider>
      </AuthProvider>
    </Router>
  );
};
export default App;
