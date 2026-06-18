import { useGame } from "../state/useGame";
import {
  SURFACE_KEYS,
  TERRAIN_LABEL,
  type Direction,
} from "../engine/components";

/**
 * Tile Inspector: exposes the raw component state of the inspected tile —
 * terrain, the four 0-10 stats, surface capabilities, connections, traits,
 * and the events that touched this tile. This is the proof that visuals are
 * derived from state.
 */
export function TileInspector() {
  const { state, store } = useGame();
  const tile = store.getInspectedTile();

  if (!tile) {
    return (
      <section className="panel">
        <header className="panel__header">
          <h2>Tile Inspector</h2>
        </header>
        <p className="muted">Click a tile to inspect its components.</p>
      </section>
    );
  }

  const events = state.world.events.filter((e) => e.targetTileId === tile.id);

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Tile Inspector</h2>
        <span className="coord-badge">
          ({tile.position.x}, {tile.position.y})
        </span>
      </header>

      <dl className="kv">
        <dt>Terrain</dt>
        <dd>
          {TERRAIN_LABEL[tile.terrain.kind]} <code>{tile.terrain.kind}</code>
        </dd>
        <Stat label="Elevation" value={tile.elevation.value} />
        <Stat label="Moisture" value={tile.moisture.value} />
        <Stat label="Temperature" value={tile.temperature.value} />
        <Stat label="Fertility" value={tile.fertility.value} />
      </dl>

      <h4>Surface</h4>
      <div className="chips">
        {SURFACE_KEYS.map((key) => (
          <span
            key={key}
            className={`chip ${tile.surface[key] ? "chip--on" : "chip--off"}`}
          >
            {key}
          </span>
        ))}
      </div>

      <h4>Connections</h4>
      {hasConnections(tile.connections) ? (
        <ul className="conn-list">
          {(["n", "e", "s", "w"] as Direction[]).map((dir) => {
            const conns = tile.connections[dir];
            if (!conns || conns.length === 0) return null;
            return (
              <li key={dir}>
                {dir.toUpperCase()}: {conns.map((c) => c.kind).join(", ")}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">None</p>
      )}

      <h4>Traits</h4>
      {tile.traits.traits.length > 0 ? (
        <div className="chips">
          {tile.traits.traits.map((t) => (
            <span key={t} className="chip chip--trait">
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">None</p>
      )}

      <h4>History ({events.length})</h4>
      {events.length > 0 ? (
        <ul className="tile-history">
          {events.map((e) => (
            <li key={e.id}>
              <span className="muted">Day {e.day}:</span> {e.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No recorded events.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <span className="stat-bar">
          <span className="stat-bar__fill" style={{ width: `${value * 10}%` }} />
        </span>
        <span className="stat-value">{value}</span>
      </dd>
    </>
  );
}

function hasConnections(connections: {
  n?: unknown[];
  e?: unknown[];
  s?: unknown[];
  w?: unknown[];
}): boolean {
  return (["n", "e", "s", "w"] as const).some(
    (d) => (connections[d]?.length ?? 0) > 0,
  );
}
