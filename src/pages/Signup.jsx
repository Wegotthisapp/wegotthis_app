import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [categories, setCategories] = useState([]);
  const [tools, setTools] = useState([]);
  const [skillsGood, setSkillsGood] = useState([]);
  const [skillsMaybe, setSkillsMaybe] = useState([]);
  const [isProfessional, setIsProfessional] = useState(false);

  const categoryOptions = ["Cleaning", "Gardening", "Moving", "Repair", "Other"];
  const toolOptions = ["Ladder", "Gloves", "Vacuum", "Toolbox", "Other"];
  const skillOptions = ["Cooking", "Driving", "Pet Care", "IT Support", "Other"];

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleCategoryChange = (value) => {
    if (categories.includes(value)) {
      setCategories(categories.filter((c) => c !== value));
    } else {
      setCategories([...categories, value]);
    }
  };

  const handleToolChange = (value) => {
    if (tools.includes(value)) {
      setTools(tools.filter((t) => t !== value));
    } else {
      setTools([...tools, value]);
    }
  };

  const handleSkillGoodChange = (value) => {
    if (skillsGood.includes(value)) {
      setSkillsGood(skillsGood.filter((s) => s !== value));
    } else {
      setSkillsGood([...skillsGood, value]);
    }
  };

  const handleSkillMaybeChange = (value) => {
    if (skillsMaybe.includes(value)) {
      setSkillsMaybe(skillsMaybe.filter((s) => s !== value));
    } else {
      setSkillsMaybe([...skillsMaybe, value]);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Could not retrieve user id after signup.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: userId,
          full_name: name,
          helper_categories: categories,
          helper_tools: tools,
          is_professional: isProfessional,
        },
      ]);

    setLoading(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    alert("Account created! Check your email to confirm.");

    // After signup, send the helper to the setup flow instead of home
    navigate("/helper-setup");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Sign Up</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {step === 1 && (
        <>
          <h3>Step 1: Account</h3>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Step 2: Personal Info</h3>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 3 && (
        <>
          <h3>Step 3: Categories</h3>
          {categoryOptions.map((cat) => (
            <label key={cat} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={categories.includes(cat)}
                onChange={() => handleCategoryChange(cat)}
              />{" "}
              {cat}
            </label>
          ))}
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 4 && (
        <>
          <h3>Step 4: Tools</h3>
          {toolOptions.map((tool) => (
            <label key={tool} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={tools.includes(tool)}
                onChange={() => handleToolChange(tool)}
              />{" "}
              {tool}
            </label>
          ))}
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 5 && (
        <>
          <h3>Step 5: Skills you are good at</h3>
          {skillOptions.map((skill) => (
            <label key={skill} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={skillsGood.includes(skill)}
                onChange={() => handleSkillGoodChange(skill)}
              />{" "}
              {skill}
            </label>
          ))}
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 6 && (
        <>
          <h3>Step 6: Skills you could consider</h3>
          {skillOptions.map((skill) => (
            <label key={skill} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={skillsMaybe.includes(skill)}
                onChange={() => handleSkillMaybeChange(skill)}
              />{" "}
              {skill}
            </label>
          ))}
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleNext}>Next</button>
        </>
      )}

      {step === 7 && (
        <>
          <h3>Step 7: Professional?</h3>
          <label>
            <input
              type="checkbox"
              checked={isProfessional}
              onChange={(e) => setIsProfessional(e.target.checked)}
            />{" "}
            I am a professional and can provide certificates
          </label>
          <br />
          <button onClick={handlePrev}>Back</button>
          <button onClick={handleSignup} disabled={loading}>
            {loading ? "Signing up..." : "Finish & Sign Up"}
          </button>
        </>
      )}
    </div>
  );
}
