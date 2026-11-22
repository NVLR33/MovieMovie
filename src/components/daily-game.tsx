'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { DailyGameQuestion } from '@/lib/daily-game';

const STORAGE_KEY = 'mg_daily_game';

function savedChoice(question: DailyGameQuestion): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved?.id === question.id && question.options.includes(saved.choice) ? saved.choice : null;
  } catch {
    return null;
  }
}

/** A low-stakes preview: answering never calls the score/XP endpoint. */
export default function DailyGame({ question, go, en = false }: {
  question: DailyGameQuestion;
  go: (url: string) => void;
  en?: boolean;
}) {
  const [choice, setChoice] = useState<string | null>(() => savedChoice(question));
  const answered = useRef(choice !== null);
  const choose = (option: string) => {
    if (answered.current) return;
    answered.current = true;
    setChoice(option);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: question.id, choice: option })); } catch { /* Private/storage-limited browsing still works. */ }
  };
  const correct = choice === question.correct;

  return (
    <div className="daily-game">
      <div className="daily-game-heading"><b>{en ? 'Question of the day' : 'Вопрос дня'}</b><small>{en ? 'Release year · new daily, UTC' : 'Год премьеры · новый вопрос каждый день, UTC'}</small></div>
      <fieldset className="daily-game-question">
        <legend>{en ? `What year was “${question.title}” released?` : `В каком году вышел «${question.title}»?`}</legend>
        <div className="daily-game-options">
          {question.options.map((option, index) => {
            const right = choice !== null && option === question.correct;
            const wrong = choice === option && !right;
            return <button type="button" key={option} disabled={choice !== null} className={`daily-game-option${right ? ' is-correct' : ''}${wrong ? ' is-incorrect' : ''}`} onClick={() => choose(option)}>
              <span className="daily-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
              {right && <Check size={16} aria-label={en ? 'Correct answer' : 'Правильный ответ'} />}
              {wrong && <X size={16} aria-label={en ? 'Your answer is incorrect' : 'Твой ответ неверный'} />}
            </button>;
          })}
        </div>
      </fieldset>
      <div className="daily-game-feedback" role="status" aria-atomic="true">
        {choice !== null && <p className={correct ? 'daily-feedback-correct' : ''}>{correct
          ? (en ? 'Correct! Your movie radar is on point.' : 'Верно! Твой кинорадар не подвёл.')
          : (en ? `Not quite. The correct answer is ${question.correct}.` : `Не совсем! Правильный ответ — ${question.correct}.`)}</p>}
      </div>
      <small className="daily-game-note">{en ? 'A quick warm-up, no XP. Play full rounds in Mini-games.' : 'Разминка без XP. Полные раунды — в мини-играх.'}</small>
      <button type="button" className="daily-game-more" onClick={() => go('/games')}>{choice !== null ? (en ? 'Keep playing' : 'Играть дальше') : (en ? 'All mini-games' : 'Все мини-игры')}<ArrowRight size={16} /></button>
    </div>
  );
}
