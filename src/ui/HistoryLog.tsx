import { useGame } from "../state/useGame";

/**
 * History Log: the chronological event list. The current map is materialized
 * state; this log is the world's memory. Newest events are shown first.
 */
export function HistoryLog() {
  const { state, store } = useGame();
  const events = state.world.events;

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>History Log</h2>
        <span className="coord-badge">{events.length} events</span>
      </header>

      {events.length === 0 ? (
        <p className="muted">No history yet. Play a card to begin the record.</p>
      ) : (
        <ol className="history-list">
          {events
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.id} className="history-item">
                <button
                  type="button"
                  className="history-item__link"
                  onClick={() => store.inspectTile(event.targetTileId)}
                >
                  <span className="history-item__day">Day {event.day}</span>
                  <span className="history-item__title">{event.title}</span>
                </button>
                <p className="history-item__desc">{event.description}</p>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
