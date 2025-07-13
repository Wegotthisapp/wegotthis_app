import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Courses() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setCourses(data);
    };

    fetchCourses();
  }, []);

  return (
    <div className="container">
      <h2>Courses</h2>
      {courses.map(course => (
        <div key={course.id} className="card">
          <h3>{course.title}</h3>
          <p>{course.description}</p>
          <a href={course.content_url} target="_blank" rel="noopener noreferrer">
            View Course
          </a>
        </div>
      ))}
    </div>
  );
}
