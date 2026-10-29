import type { ReactNode } from "react";
import { pretty } from "../i18n";

/** Newer concepts are sentences with "?" where the answer goes; the original four are "a op b". */
export const isSentence = (problem: string) => problem.includes("?");

/**
 * A problem with an answer in its place: "47 + 38 = <answer>" or "The pencil is <answer> cm long."
 * `answer` is any node (Lumi's answer, a crossed-out answer, a blank), so callers keep their styling.
 */
export default function ProblemText({ problem, answer }: { problem: string; answer: ReactNode }) {
  if (!isSentence(problem)) {
    return (
      <>
        <span>{pretty(problem)} =</span> {answer}
      </>
    );
  }
  const i = problem.lastIndexOf("?");
  return (
    <>
      {problem.slice(0, i)}
      {answer}
      {problem.slice(i + 1)}
    </>
  );
}
