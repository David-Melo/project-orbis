import { useGame } from "../state/useGame";
import { describeEffect } from "../engine/effects";
import type { GeneratedCard } from "../engine/card";

/**
 * Daily Session Panel: current day, the generated hand, the selected-card
 * preview, and the confirm/cancel controls. This is where the player
 * "interviews the tile" and chooses which future enters the world.
 */
export function SessionPanel() {
  const { state, store } = useGame();
  const { world, phase, hand, selectedCardId, context } = state;
  const selected = hand.find((c) => c.id === selectedCardId);

  return (
    <section className="panel session-panel">
      <header className="panel__header">
        <h2>Daily Session</h2>
        <span className="day-badge">Day {world.currentDay}</span>
      </header>

      {phase === "idle" && (
        <div className="session-idle">
          <p className="muted">
            {world.assignedTileId
              ? "A tile is assigned."
              : "No active session."}
          </p>
          <button className="btn btn--primary" onClick={() => store.startDay()}>
            ▶ Start Day
          </button>
        </div>
      )}

      {phase === "choosing" && context && (
        <>
          <p className="assigned-line">
            Assigned tile{" "}
            <strong>
              ({context.targetX}, {context.targetY})
            </strong>{" "}
            — the map offers {hand.length} futures:
          </p>

          <div className="card-hand">
            {hand.map((card) => (
              <CardView
                key={card.id}
                card={card}
                selected={card.id === selectedCardId}
                onSelect={() => store.selectCard(card.id)}
              />
            ))}
          </div>

          {selected && (
            <div className="card-preview">
              <h3>Preview: {selected.title}</h3>
              <ul className="effect-list">
                {selected.effects.map((effect, i) => (
                  <li key={i}>{describeEffect(effect)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="session-actions">
            <button
              className="btn btn--primary"
              disabled={!selectedCardId}
              onClick={() => store.confirmCard()}
            >
              ✓ Confirm
            </button>
            <button className="btn" onClick={() => store.cancelDay()}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function CardView({
  card,
  selected,
  onSelect,
}: {
  card: GeneratedCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`card ${selected ? "card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="card__title">{card.title}</div>
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
