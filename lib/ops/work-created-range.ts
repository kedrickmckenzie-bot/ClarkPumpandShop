export function workCreatedRange(from?: string, through?: string) {
  const day = (value?: string) => {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new Error("Choose a valid created date.");
    return `${value}T00:00:00.000Z`;
  };
  const createdFrom = day(from);
  const end = day(through);
  if (createdFrom && end && createdFrom > end) throw new Error("Created through must be on or after Created from.");
  return { createdFrom, createdTo: end ? new Date(Date.parse(end) + 86_400_000).toISOString() : undefined };
}
