/**
 * A few-word label for planning boards. Uses the saved short name, then the
 * linked equipment, then a guess from the problem's opening words.
 */
const verbs = /\b(is|are|was|were|does|do|did|has|have|will|won't|can't|cannot|keeps|stops|stalls|leaks|leaking|drips|drags|slams|spins|runs|shuts|flicker|flickers|needs|need|backs|backing|not|isn't|doesn't|on|in|at|after|during|when|near|over|under|by|from|for|with)\b/i;

export function suggestShortName(problem: string) {
  const firstClause = problem.split(/[.;,:(]/)[0]!.trim().replace(/^(the|a|an|our|two|one)\s+/i, "");
  const words: string[] = [];
  for (const word of firstClause.split(/\s+/)) {
    if (words.length && verbs.test(word)) break;
    words.push(word);
    if (words.length === 4) break;
  }
  const label = words.join(" ").replace(/[^\w\s/&'-]+$/, "");
  return label ? label[0]!.toUpperCase() + label.slice(1) : problem.slice(0, 30);
}

export function jobShortName(job: { shortName?: string; assetName?: string; problem: string }) {
  return job.shortName || job.assetName || suggestShortName(job.problem);
}
