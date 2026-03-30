import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ExerciseList from "./components/ExerciseList";
import { useState, useEffect } from "react";
import StartWorkout from "./components/StartWorkout";
import  WorkoutSession from "./components/WorkoutSession";
import AboutPage from "./components/AboutPage"; // 1. Import the new page

const App = () => {
  const [exercises, setExercises] = useState([]);
  
  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exercises" element={<ExerciseList exercises = {exercises} setExercises={setExercises} />} />
        <Route path="/workoutSessions/" element={<StartWorkout/>} />
        <Route path="/workout/:id" element={<WorkoutSession/>} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
};
export default App;