import { cardById } from '../core/criteria';
import type { Problem } from '../core/problem';
import { CodeChips, CritText, LETTERS } from './bits';

/** 正解コードと、各検証機が実際に見ていた要件の種明かし */
export default function Reveal({ problem }: { problem: Problem }) {
  return (
    <div className="reveal">
      <div className="reveal-code">
        <span>正解</span>
        <CodeChips code={problem.code} size="lg" />
      </div>
      <ul>
        {problem.cards.map((cardId, v) => (
          <li key={v}>
            <b>{LETTERS[v]}</b>
            <span>
              <CritText text={cardById(cardId).criteria[problem.secret[v]].text} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
