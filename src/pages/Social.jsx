import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Social() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setPosts(data);
    };

    fetchPosts();
  }, []);

  return (
    <div className="container">
      <h2>Social Feed</h2>
      {posts.map(post => (
        <div key={post.id} className="post">
          {post.image_url && <img src={post.image_url} alt="Post" />}
          <p className="caption">{post.caption}</p>
        </div>
      ))}
    </div>
  );
}
