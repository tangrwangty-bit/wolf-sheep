/* Shared rules for the UI, AI, Worker, and dependency-free Node checks. */
(function (root) {
  'use strict';
  const SIZE = 5;
  const WOLF = 'wolf';
  const SHEEP = 'sheep';
  const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const inside = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  const otherSide = side => side === WOLF ? SHEEP : WOLF;

  function createInitialState() {
    const board = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, col) => row < 3 ? SHEEP :
        row === 4 && col % 2 === 0 ? WOLF : null));
    return { board, turn: WOLF, steps: 0, result: null, lastMove: null };
  }

  function countSheep(board) {
    let count = 0;
    for (const row of board) for (const piece of row) if (piece === SHEEP) count++;
    return count;
  }

  // This primitive intentionally ignores the turn/result, so terminal checks
  // can examine BOTH sides' mobility and never miss a wolf capture escape.
  function movesFrom(board, row, col) {
    if (!inside(row, col)) return [];
    const side = board[row][col];
    if (side !== WOLF && side !== SHEEP) return [];
    const moves = [];
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr, nc = col + dc;
      if (!inside(nr, nc) || board[nr][nc] !== null) continue;
      moves.push({ from: { row, col }, to: { row: nr, col: nc }, capture: false });
      const tr = row + dr * 2, tc = col + dc * 2;
      if (side === WOLF && inside(tr, tc) && board[tr][tc] === SHEEP) {
        moves.push({ from: { row, col }, to: { row: tr, col: tc }, capture: true });
      }
    }
    return moves;
  }

  function movesFor(board, side) {
    const moves = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (board[row][col] === side) moves.push(...movesFrom(board, row, col));
      }
    }
    return moves;
  }

  function legalMoves(state) {
    return state.result ? [] : movesFor(state.board, state.turn);
  }

  // state.turn is the side that would act NEXT. Wins take priority over step 100.
  function getResult(state) {
    if (countSheep(state.board) <= 5) return { winner: WOLF, reason: 'capture' };
    if (!movesFor(state.board, WOLF).length) return { winner: SHEEP, reason: 'trapped' };
    if (state.turn === SHEEP && !movesFor(state.board, SHEEP).length) {
      return { winner: WOLF, reason: 'sheep-blocked' };
    }
    if (state.steps >= 100) return { winner: 'draw', reason: 'limit' };
    return null;
  }

  function samePosition(a, b) {
    return !!a && !!b && a.row === b.row && a.col === b.col;
  }

  function sameMove(a, b) {
    return !!a && !!b && samePosition(a.from, b.from) && samePosition(a.to, b.to);
  }

  // The only state transition used by human moves AND AI simulations.
  // It validates the coordinates and derives capture from rules, not the caller.
  function applyMove(state, requested) {
    if (state.result || !requested || !requested.from || !requested.to) return null;
    const { row, col } = requested.from;
    if (!Number.isInteger(row) || !Number.isInteger(col) || !inside(row, col) ||
      state.board[row][col] !== state.turn) return null;
    const move = movesFrom(state.board, row, col).find(item => sameMove(item, requested));
    if (!move) return null;
    const board = state.board.map(line => line.slice());
    board[row][col] = null;
    board[move.to.row][move.to.col] = state.turn;
    const next = {
      board, turn: otherSide(state.turn), steps: state.steps + 1,
      lastMove: { ...move, side: state.turn }, result: null
    };
    next.result = getResult(next);
    return next;
  }

  const api = { SIZE, WOLF, SHEEP, inside, otherSide, createInitialState,
    countSheep, movesFrom, movesFor, legalMoves, getResult, samePosition, sameMove, applyMove };
  root.WolfSheepRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
