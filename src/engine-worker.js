/* Same engine and card modules as the page; no DOM or UI policy in this worker. */
(function (root) {
  'use strict';
  let queue = Promise.resolve(), cup;
  const signatures = new Map();
  async function initialize(items) {
    root.window = root;
    const json = async path => { const response = await fetch(path); if (!response.ok) throw Error('Worker resource ' + response.status); return response.json(); };
    for (const item of items) {
      if (item.script) await import(item.script);
      if (item.rows) { root.DuelWebRows = []; for (const path of item.rows) root.DuelWebRows.push(...await json(path)); }
      if (item.locales) { root.DuelCardLocales = {}; for (const path of item.locales) Object.assign(root.DuelCardLocales, Object.fromEntries(await json(path))); }
    }
  }
  async function handle(type, payload, id) {
    if (type === 'init') {
      if (payload.items) await initialize(payload.items);
      // New tournament engines and restored engines share the same live budget.
      // This stays in the worker; deterministic Node tools keep their fixed budget.
      root.DuelEngine.prototype._aiTimeBudgetMs=8;
      return true;
    }
    if (type === 'ai') {
      const engine = root.DuelEngine.restore(payload.snapshot), start = performance.now();
      engine._aiTimeBudgetMs=8;const action = engine.aiNext();
      return { action, randomState: engine.randomState, ms: performance.now() - start };
    }
    if (type === 'precompute') {
      const engine = root.DuelEngine.restore(payload.snapshot), steps = [], frames = [{ index: 0, snapshot: engine.snapshot() }];
      const started = performance.now();
      while (engine.state.winner === null && steps.length < (payload.limit || 2400)) {
        engine._aiTimeBudgetMs=8;const action = engine.aiNext(), randomState = engine.randomState;
        if (!action) throw Error('Robot found no action at step ' + steps.length);
        const result = engine.act(action);
        if (!result.ok) throw Error(result.error || 'Robot action failed');
        steps.push({ action, randomState });
        if (steps.length % 40 === 0) {
          frames.push({ index: steps.length, snapshot: engine.snapshot() });
          root.postMessage({ id, progress: { steps: steps.length, turn: engine.state.turn } });
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      if (engine.state.winner === null) throw Error('Replay exceeded the action limit; original duel is retained.');
      return { steps, frames, final: engine.snapshot(), ms: performance.now() - started };
    }
    if (type === 'tournament') {
      if (payload.snapshot) { cup = root.DuelTournament.Tournament.restore(payload.snapshot); cup.resume(); signatures.clear(); }
      if (!cup || cup.data.id !== payload.cupId) throw Error('Tournament worker is not initialized');
      cup.advance(payload.batches || 24, payload.budgetMs || 40);
      const matches = [];
      // Completed matches contain long journals. Do not clone the whole event
      // for every update just to discard the unchanged matches afterwards.
      for (const match of cup.matches) {
        const signature = match.status + ':' + match.games.map(g => g.steps.length).join(',');
        if (signatures.get(match.id) !== signature) {
          const data=JSON.parse(JSON.stringify(match)),engine=cup.engines.get(match.id);
          if(engine&&match.status==='running')data.games.at(-1).current=engine.snapshot();
          matches.push(data);signatures.set(match.id, signature);
        }
      }
      return { matches, status: cup.data.status, championId: cup.data.championId, updatedAt: cup.data.updatedAt };
    }
    throw Error('Unknown worker request');
  }
  root.onmessage = ({ data }) => {
    queue = queue.then(async () => {
      try { const result = await handle(data.type, data.payload || {}, data.id); root.postMessage({ id: data.id, result }); }
      catch (error) { root.postMessage({ id: data.id, error: error.message || String(error) }); }
    });
  };
})(globalThis);
