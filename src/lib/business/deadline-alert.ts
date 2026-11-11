export type DeadlineAlert = { label: string; tone: "red" | "yellow" | "green" | "neutral" };
/** Month boundaries use the corporate Colombia calendar, not the browser's timezone. */
export function bogotaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/Bogota", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(now);
  const pick = (key:string) => parts.find(part => part.type === key)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
/** Deadline colors: overdue/current month red; next month yellow; >2 months green. */
export function deadlineAlert(presentationDate: string | null | undefined, status: string | null | undefined, today: string): DeadlineAlert {
  if (status === "terminado") return {label:"Terminada",tone:"neutral"};
  if (status === "vencido") return {label:"Vencida",tone:"red"};
  if (!presentationDate || !/^\d{4}-\d{2}-\d{2}$/.test(presentationDate)) return {label:"Sin fecha",tone:"neutral"};
  if (presentationDate < today) return {label:"Vencida",tone:"red"};
  const [year,month] = presentationDate.split("-").map(Number);
  const [currentYear,currentMonth] = today.split("-").map(Number);
  const offset = (year-currentYear)*12 + month-currentMonth;
  if (offset <= 0) return {label:"Este mes",tone:"red"};
  if (offset === 1) return {label:"Próximo mes",tone:"yellow"};
  if (offset === 2) return {label:"En 2 meses",tone:"neutral"};
  return {label:"Más de 2 meses",tone:"green"};
}
