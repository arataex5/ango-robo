import { cardById } from '../core/criteria';
import { secretOf, type Problem } from '../core/problem';
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
        {problem.cards.map((_, v) => {
          const { card, crit } = secretOf(problem, v);
          return (
            <li key={v}>
              <b>{LETTERS[v]}</b>
              <span>
                {problem.mode && problem.mode !== 'classic' && <small className="reveal-card">カード{card}　</small>}
                <CritText text={cardById(card).criteria[crit].text} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
