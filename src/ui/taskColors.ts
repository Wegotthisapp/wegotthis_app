export type TaskType = "ask" | "offer";

export function taskColors(params: { isMine: boolean; taskType: TaskType }) {
  const { isMine, taskType } = params;

  // Semantic intention:
  // Violet -> my tasks (especially offers)
  // Blue   -> other people's tasks (asks)
  // Still keep taskType influence.
  const base =
    taskType === "offer"
      ? {
          bg: "bg-violet-50",
          border: "border-violet-200",
          chip: "bg-violet-100 border-violet-200",
          accent: "text-violet-700",
        }
      : {
          bg: "bg-blue-50",
          border: "border-blue-200",
          chip: "bg-blue-100 border-blue-200",
          accent: "text-blue-700",
        };

  // ownership can override background intensity slightly (optional)
  const mineBoost = isMine
    ? {
        bg: taskType === "offer" ? "bg-violet-100" : "bg-violet-50",
        border: taskType === "offer" ? "border-violet-300" : base.border,
        chip: taskType === "offer" ? "bg-violet-200 border-violet-300" : "bg-violet-100 border-violet-200",
        accent: "text-violet-800",
      }
    : {
        bg: taskType === "ask" ? "bg-blue-100" : base.bg,
        border: taskType === "ask" ? "border-blue-300" : base.border,
        chip: taskType === "ask" ? "bg-blue-200 border-blue-300" : base.chip,
        accent: taskType === "ask" ? "text-blue-800" : base.accent,
      };

  // final: always enforce readable text on light backgrounds
  return {
    rowBg: mineBoost.bg,
    rowBorder: mineBoost.border,
    chipBg: mineBoost.chip,
    accentText: mineBoost.accent,
    titleText: "text-slate-900",
    previewText: "text-slate-600",
    metaText: "text-slate-500",
  };
}
