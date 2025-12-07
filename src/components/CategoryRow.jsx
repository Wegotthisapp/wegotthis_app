import TaskCard from "./TaskCard";

export default function CategoryRow({ title, tasks, userId }) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <section style={styles.section}>
      <h2 style={styles.title}>{title}</h2>

      <div style={styles.row}>
        {tasks.map((task) => (
          <div key={task.id} style={styles.cardWrapper}>
            <TaskCard
              task={task}
              isOwn={userId && task.owner_id === userId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const styles = {
  section: {
    marginBottom: "2rem",
  },
  title: {
    fontSize: "1.4rem",
    fontWeight: "600",
    marginBottom: "0.75rem",
  },
  row: {
    display: "flex",
    overflowX: "auto",
    gap: "1rem",
    paddingBottom: "0.5rem",
    scrollbarWidth: "thin",
  },
  cardWrapper: {
    minWidth: "260px", // per avere l’effetto card in orizzontale
    flex: "0 0 auto",
  },
};
