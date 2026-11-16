const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

export function todayMoodDate() {
  return formatter.format(new Date());
}
