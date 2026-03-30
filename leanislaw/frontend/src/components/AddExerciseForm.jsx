import { useState } from 'react';

const AddExerciseForm = ({ onAddExercise }) => {
    const [formData, setFormData] = useState({ name: "", body_part: "" });

    const handleUpload = async (e) => {
        e.preventDefault();
        const response = await fetch(`/api/v1/exercises`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Fixed typo: 'application/json'
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const data = await response.json();
            onAddExercise(data); 
            setFormData({ name: "", body_part: "chest" }); // Reset form
        } else {
        // THIS IS THE KEY: See what the server is actually complaining about
        const errorData = await response.json();
        console.error("Server Error:", errorData);
        alert(`Error: ${errorData.error}`); 
    }
    };

    return (
        <form onSubmit={handleUpload}>
            <input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
            />
            {/* ... dropdown logic ... */}
            <button type="submit">Add Exercise</button>
            <select 
                value={formData.body_part} 
                onChange={(e) => setFormData({...formData, body_part: e.target.value})}
                >
                <option value="chest">Chest</option>
                <option value="back">Back</option>
                <option value="legs">Legs</option>
                <option value="triceps">Triceps</option>
                <option value="biceps">Biceps</option>
                <option value="shoulders">Shoulders</option>
        </select>
        </form>
    );
};

export default AddExerciseForm;