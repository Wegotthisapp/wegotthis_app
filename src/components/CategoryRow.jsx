import TaskCard from "./TaskCard";

export default function CategoryRow({ title, tasks }) {
  if (!tasks.length) return null;

  return (
    <section style={styles.section}>
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.scrollContainer}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} compact />
        ))}
      </div>
    </section>
  );
}

const styles = {
  section: {
    marginBottom: "2rem"
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.5rem"
  },
  scrollContainer: {
    display: "flex",
    overflowX: "auto",
    gap: "1rem",
    paddingBottom: "0.5rem"
  }
};
