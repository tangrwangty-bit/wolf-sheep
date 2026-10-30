/* Local AI. No service, dependency, or network request is involved. */
(function (root) {
  'use strict';
  const R = root.WolfSheepRules || (typeof require === 'function' ? require('./rules.js') : null);
  const WIN = 1000000;
  const TIMEOUT = Symbol('search deadline');
  const now = () => performance.now();

  function positionKey(state) {
    return state.turn + ':' + state.board.map(row => row.map(piece => piece === R.WOLF ? 'w' : piece === R.SHEEP ? 's' : '.').join('')).join('');
  }

  // Positive favors wolves, negative favors sheep. Captured material is the
  // primary objective; mobility, capture threats, and enclosure shape the plan.
  function evaluate(state) {
    if (state.result) {
      if (state.result.winner === 'draw') return 0;
      const speed = (100 - state.steps) * 100;
      return state.result.winner === R.WOLF ? WIN + speed : -WIN - speed;
    }
    const wolfMoves = R.movesFor(state.board, R.WOLF);
    const sheepMoves = R.movesFor(state.board, R.SHEEP);
    let score = (15 - R.countSheep(state.board)) * 320;
    score += wolfMoves.length * 12 - sheepMoves.length * 2;
    const threatened = new Set(wolfMoves.filter(move => move.capture).map(move => move.to.row * 5 + move.to.col));
    score += threatened.size * 85;
    const wolves = [], sheep = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (state.board[row][col] === R.WOLF) wolves.push({ row, col });
        if (state.board[row][col] === R.SHEEP) sheep.push({ row, col });
      }
    }
    for (const wolf of wolves) {
      const mobility = R.movesFrom(state.board, wolf.row, wolf.col).length;
      if (!mobility) score -= 230;
      else if (mobility === 1) score -= 65;
      score += (4 - Math.abs(wolf.row - 2) - Math.abs(wolf.col - 2)) * 5;
      let closest = 10;
      for (const item of sheep) {
        const distance = Math.abs(item.row - wolf.row) + Math.abs(item.col - wolf.col);
        closest = Math.min(closest, distance);
        if (distance === 1) score -= 9;
      }
      score -= closest * 5;
    }
    // Cohesion makes a blocking front more useful than scattered sheep.
    for (const item of sheep) {
      if (item.row < 4 && state.board[item.row + 1][item.col] === R.SHEEP) score -= 3;
      if (item.col < 4 && state.board[item.row][item.col + 1] === R.SHEEP) score -= 3;
    }
    return score;
  }

  function* search(state, options) {
    const moves = R.legalMoves(state);
    if (!moves.length) return null;
    let nodes = 0;
    const deadline = now() + Math.max(25, options.timeLimit ?? 750);
    const recent = options.recentPositions || [];
    const maximizing = state.turn === R.WOLF;
    const direction = maximizing ? 1 : -1;
    let best = moves[0]; // A legal fallback even if no deeper iteration finishes.
    function* checkpoint() {
      if (now() >= deadline) throw TIMEOUT;
      if (++nodes % 16 === 0) yield;
    }
    function repetitionAdjustment(next) {
      return recent.includes(positionKey(next)) ? -direction * 22 : 0;
    }
    function* order(position, candidates, preferred) {
      const list = [];
      for (const move of candidates) {
        yield* checkpoint();
        const next = R.applyMove(position, move);
        list.push({ move, next, score: evaluate(next) });
      }
      const sign = position.turn === R.WOLF ? 1 : -1;
      list.sort((a, b) => {
        if (preferred && R.sameMove(a.move, preferred)) return -1;
        if (preferred && R.sameMove(b.move, preferred)) return 1;
        return (b.score - a.score) * sign;
      });
      return list;
    }
    // A scored one-ply policy with bounded randomness, never a random legal
    // walk. Captures/terminal wins still dominate beginner variation.
    if (options.difficulty !== 'hard') {
      let score = -Infinity;
      for (const move of moves) {
        const next = R.applyMove(state, move);
        const value = direction * (evaluate(next) + repetitionAdjustment(next)) + (options.random || Math.random)() * 42;
        if (value > score) { score = value; best = move; }
        if (++nodes % 8 === 0) yield;
      }
      return best;
    }

    function* minimax(position, depth, alpha, beta) {
      yield* checkpoint();
      if (position.result || depth === 0) return evaluate(position);
      const isMax = position.turn === R.WOLF;
      let value = isMax ? -Infinity : Infinity;
      const children = yield* order(position, R.legalMoves(position));
      for (const child of children) {
        const score = yield* minimax(child.next, depth - 1, alpha, beta);
        if (isMax) { value = Math.max(value, score); alpha = Math.max(alpha, value); }
        else { value = Math.min(value, score); beta = Math.min(beta, value); }
        if (alpha >= beta) break;
      }
      return value;
    }

    try {
      // Keep the best answer from the last FULL iteration when time expires.
      for (let depth = 1; depth <= Math.min(6, options.maxDepth ?? 5); depth++) {
        const ordered = yield* order(state, moves, depth > 1 ? best : null);
        let candidate = ordered[0].move;
        let value = maximizing ? -Infinity : Infinity;
        let alpha = -Infinity, beta = Infinity;
        for (const child of ordered) {
          const score = (yield* minimax(child.next, depth - 1, alpha, beta)) + repetitionAdjustment(child.next);
          if ((maximizing && score > value) || (!maximizing && score < value)) {
            value = score;
            candidate = child.move;
          }
          // Repetition is a root preference, not a minimax position value.
          // Leave a margin so it cannot make the search window too narrow.
          if (maximizing) alpha = Math.max(alpha, value - 22);
          else beta = Math.min(beta, value + 22);
        }
        best = candidate;
        if (Math.abs(value) >= WIN) break;
      }
    } catch (error) { if (error !== TIMEOUT) throw error; }
    return best;
  }

  async function chooseMove(state, options = {}) {
    const iterator = search(state, options);
    let sliceStarted = now();
    while (true) {
      if (options.signal?.aborted) {
        const error = new Error('AI search cancelled');
        error.name = 'AbortError';
        throw error;
      }
      const item = iterator.next();
      if (item.done) return item.value;
      if (now() - sliceStarted >= 8) {
        await new Promise(resolve => setTimeout(resolve, 0));
        sliceStarted = now();
      }
    }
  }

  const api = { chooseMove, evaluate, positionKey };
  root.WolfSheepAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
