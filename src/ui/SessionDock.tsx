import { useGame } from "../state/useGame";
import { describeEffect } from "../engine/effects";
import { TERRAIN_LABEL } from "../engine/components";
import type { GeneratedCard } from "../engine/card";

/**
 * Bottom session dock: the daily hand, centered and tiled horizontally. This
 * is where the player "interviews the tile" — Start Day deals the hand, then
 * a card is chosen (click or number key) and confirmed (button or Enter).
 */
export function SessionDock() {
  const { state, store } = useGame();
  const { phase, hand, selectedCardId, context } = state;

  if (phase === "idle") {
    return (
      <div className="dock dock--idle">
        <button className="btn btn--primary btn--lg" onClick={() => store.startDay()}>
          ▶ Start Day
        </button>
        <span className="dock-hint">
          <kbd>Space</kbd> start / confirm · <kbd>1</kbd>–<kbd>3</kbd> pick · click a
          tile to act on it · <kbd>Esc</kbd> cancel
        </span>
      </div>
    );
  }

  return (
    <div className="dock">
      <div className="dock-head">
        {context && (
          <span className="assigned-line">
            Assigned{" "}
            <strong>
              ({context.targetX}, {context.targetY})
            </strong>{" "}
            · currently <strong>{TERRAIN_LABEL[context.targetTerrain]}</strong> — choose a
            future:
          </span>
        )}
        <div className="dock-actions">
          <button
            className="btn btn--primary"
            disabled={!selectedCardId}
            onClick={() => store.confirmCard()}
          >
            ✓ Confirm <kbd>Space</kbd>
          </button>
          <button className="btn" onClick={() => store.cancelDay()}>
            Cancel <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      <div className="card-hand">
        {hand.map((card, i) => (
          <CardView
            key={card.id}
            index={i + 1}
            card={card}
            selected={card.id === selectedCardId}
            onSelect={() => store.selectCard(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CardView({
  card,
  index,
  selected,
  onSelect,
}: {
  card: GeneratedCard;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`card ${selected ? "card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="card__top">
        <span className="card__key">{index}</span>
        <span className="card__title">{card.title}</span>
      </div>
      <div className="card__age">{card.age}</div>
      {card.flavor && <div className="card__flavor">{card.flavor}</div>}
      <ul className="card__effects">
        {card.effects.map((effect, i) => (
          <li key={i}>{describeEffect(effect)}</li>
        ))}
      </ul>
    </button>
  );
}
