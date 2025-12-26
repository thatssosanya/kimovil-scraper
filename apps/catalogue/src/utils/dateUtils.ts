export const getStartOfWeek = () => {
  const today = new Date();
  today.setHours(9, 34, 0, 0);
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const startOfWeekString = startOfWeek.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return startOfWeekString.replace(/\s*г\.$/, "");
};