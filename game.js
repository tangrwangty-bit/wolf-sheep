(function () {
  'use strict';
  const R = WolfSheepRules;
  const $ = id => document.getElementById(id);
  const settings = { mode: 'ai', humanSide: R.WOLF, difficulty: 'easy' };
  let state = R.createInitialState();
  let history = [];
  let selected = null;
  let thinking = false;
  let worker = null;
  let aiTimer = null;
  let generation = 0;
  let abortController = null;
  const cells = [];
  const sideName = side => side === R.WOLF ? '狼' : '羊';
  const coordinate = position => `${'ABCDE'[position.col]}${position.row + 1}`;

  for (let row = 0; row < R.SIZE; row++) {
    for (let col = 0; col < R.SIZE; col++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.addEventListener('click', () => handleCell(row, col));
      $('board').append(cell);
      cells.push(cell);
    }
  }

  function undoIndex() {
    if (settings.mode === 'local') return history.length - 1;
    for (let index = history.length - 1; index >= 0; index--) {
      if (history[index].turn === settings.humanSide) return index;
    }
    return -1;
  }

  function render() {
    const count = R.countSheep(state.board);
    const captured = 15 - count;
    const choices = selected ? R.movesFrom(state.board, selected.row, selected.col) : [];
    for (const cell of cells) {
      const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
      const position = { row, col };
      const piece = state.board[row][col];
      const choice = choices.find(move => R.samePosition(move.to, position));
      const isSelected = R.samePosition(selected, position);
      const lastFrom = state.lastMove && R.samePosition(state.lastMove.from, position);
      const lastTo = state.lastMove && R.samePosition(state.lastMove.to, position);
      cell.className = ['cell', piece ? 'occupied' : '', isSelected ? 'selected' : '',
        choice ? choice.capture ? 'capture-target' : 'move-target' : '',
        lastFrom ? 'last-from' : '', lastTo ? 'last-to' : ''].filter(Boolean).join(' ');
      cell.setAttribute('aria-label', `${coordinate(position)}，${piece ? sideName(piece) : '空位'}${isSelected ? '，已选中' : ''}${choice ? choice.capture ? '，可以吃羊' : '，可以移动到此' : ''}`);
      cell.setAttribute('aria-pressed', String(isSelected));
      cell.setAttribute('aria-disabled', String(thinking || !!state.result));
      // Preserve images between selections; moves only replace changed cells.
      if (cell.dataset.piece !== (piece || '')) {
        cell.dataset.piece = piece || '';
        cell.replaceChildren();
        if (piece) {
          const base = document.createElement('span');
          base.className = `piece ${piece}`;
          const image = document.createElement('img');
          image.src = `./assets/${piece}.png`;
          image.alt = '';
          image.draggable = false;
          base.append(image);
          cell.append(base);
        }
      }
    }
    $('sheep-count').textContent = count;
    $('captured-count').textContent = captured;
    $('capture-fill').style.width = `${Math.min(100, captured * 10)}%`;
    $('capture-progress').setAttribute('aria-valuenow', Math.min(10, captured));
    $('step-count').textContent = state.steps;
    $('mobile-stats').textContent = `羊 ${count} 只 · ${state.steps}/100 步`;
    $('undo-button').disabled = undoIndex() < 0;
    $('turn-dot').className = `turn-dot ${state.turn}${thinking ? ' thinking' : ''}`;
    $('turn-title').textContent = state.result ? '本局已结束' : thinking ? '电脑思考中' : `轮到${sideName(state.turn)}方`;
    $('turn-owner').textContent = state.result ? '可以悔棋或重新开始' : settings.mode === 'local' ? '本地双人' : thinking ? `执${sideName(state.turn)}` : '由你走棋';
    $('board').setAttribute('aria-busy', String(thinking));
    $('board').classList.toggle('is-thinking', thinking);
    const last = state.lastMove;
    $('last-move-text').textContent = last ? `${sideName(last.side)}方 ${coordinate(last.from)} → ${coordinate(last.to)}${last.capture ? ' · 吃羊' : ''}` : '棋局刚刚开始';
    $('result-panel').hidden = !state.result;
    $('result-panel').dataset.winner = state.result?.winner || '';
    if (state.result) {
      const { winner, reason } = state.result;
      $('result-title').textContent = { wolf: '狼赢啦', sheep: '羊赢啦', draw: '和棋' }[winner];
      $('result-copy').textContent = {
        capture: '狼累计吃掉 10 只羊，捕猎成功。',
        trapped: '全部 3 只狼都无法行动，羊群围困成功。',
        'sheep-blocked': '轮到羊方，但所有羊均无棋可走。',
        limit: '双方已完成 100 步，仍未分出胜负。'
      }[reason];
      $('game-message').textContent = '再想一手？可以悔棋继续，也可以重新开始。';
    } else if (thinking) {
      $('game-message').textContent = '电脑思考中，正在寻找下一步…';
    } else if (selected) {
      const captures = choices.some(move => move.capture);
      $('game-message').textContent = !choices.length ? '这枚棋子暂时无法行动，请选择另一枚。' : captures ? '点击绿点移动，或点击红色圈出的羊进行隔空吃羊。' : '点击绿点移动，或选择另一枚己方棋子。';
    } else {
      $('game-message').textContent = `点击一只${sideName(state.turn)}，再点击提示位置走棋。`;
    }
  }

  function handleCell(row, col) {
    if (state.result || thinking || (settings.mode === 'ai' && state.turn !== settings.humanSide)) return;
    const position = { row, col };
    if (selected) {
      const move = R.movesFrom(state.board, selected.row, selected.col).find(item => R.samePosition(item.to, position));
      if (move) { commitMove(move); return; }
    }
    if (state.board[row][col] === state.turn) {
      selected = R.samePosition(selected, position) ? null : position;
      render();
    }
  }

  function commitMove(move) {
    const next = R.applyMove(state, move);
    if (!next) return false;
    history.push(state); // Immutable snapshots include turn, steps, result, lastMove.
    state = next;
    selected = null;
    render();
    scheduleAI();
    return true;
  }

  function cancelAI() {
    generation++;
    clearTimeout(aiTimer);
    aiTimer = null;
    if (worker) worker.terminate();
    worker = null;
    if (abortController) abortController.abort();
    abortController = null;
    thinking = false;
  }

  function scheduleAI() {
    if (state.result || settings.mode !== 'ai' || state.turn === settings.humanSide) return;
    thinking = true;
    render();
    const ticket = generation;
    const snapshot = state;
    const options = { difficulty: settings.difficulty, timeLimit: 750, maxDepth: 5,
      recentPositions: history.slice(-6).map(item => WolfSheepAI.positionKey(item)) };
    const finish = move => {
      if (ticket !== generation || state !== snapshot) return;
      if (worker) worker.terminate();
      worker = null;
      abortController = null;
      thinking = false;
      const legal = R.legalMoves(state);
      const verified = legal.find(item => R.sameMove(item, move)) || legal[0];
      if (verified) commitMove(verified);
      else { state = { ...state, result: R.getResult(state) }; render(); }
    };
    const fallback = () => {
      if (ticket !== generation) return;
      abortController = new AbortController();
      // Local file URLs often disallow Workers. The cooperative search yields
      // to the browser and also checks cancellation, so double-click works too.
      WolfSheepAI.chooseMove(snapshot, { ...options, signal: abortController.signal })
        .then(finish).catch(error => { if (error.name !== 'AbortError') finish(null); });
    };
    aiTimer = setTimeout(() => {
      if (ticket !== generation) return;
      if (location.protocol !== 'file:' && typeof Worker !== 'undefined') {
        try {
          const runningWorker = new Worker('./ai-worker.js');
          worker = runningWorker;
          runningWorker.onmessage = event => finish(event.data.move);
          runningWorker.onerror = event => {
            event.preventDefault();
            if (ticket !== generation || state !== snapshot || worker !== runningWorker) return;
            runningWorker.terminate();
            worker = null;
            fallback();
          };
          runningWorker.postMessage({ state: snapshot, options });
        } catch { fallback(); }
      } else fallback();
    }, 280);
  }

  function restart() {
    cancelAI();
    state = R.createInitialState();
    history = [];
    selected = null;
    render();
    scheduleAI();
  }

  function updateSettings() {
    for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode));
    for (const button of document.querySelectorAll('[data-side]')) button.setAttribute('aria-pressed', String(button.dataset.side === settings.humanSide));
    for (const button of document.querySelectorAll('[data-difficulty]')) button.setAttribute('aria-pressed', String(button.dataset.difficulty === settings.difficulty));
    const isLocal = settings.mode === 'local';
    $('ai-settings').hidden = isLocal;
    $('config-note').textContent = isLocal ? '两人共用一台设备，狼先行。更改设置会开始新的一局。' : `你执${sideName(settings.humanSide)}${settings.humanSide === R.WOLF ? '先行' : '后行'}，电脑执${sideName(R.otherSide(settings.humanSide))}。更改设置会开始新的一局。`;
    $('goal-title').textContent = isLocal ? '落子之间，各有谋略' : settings.humanSide === R.WOLF ? '以少胜多，寻找破绽' : '步步为营，合力围困';
    $('goal-copy').textContent = isLocal ? '狼吃 10 只羊获胜；羊围住全部 3 只狼获胜。' : settings.humanSide === R.WOLF ? '隔一空位吃掉终点的羊，累计吃掉 10 只即获胜。' : '用羊群封住去路，让全部 3 只狼都无棋可走。';
    restart();
  }

  for (const button of document.querySelectorAll('[data-mode], [data-side], [data-difficulty]')) {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      if (button.dataset.mode) settings.mode = button.dataset.mode;
      if (button.dataset.side) settings.humanSide = button.dataset.side;
      if (button.dataset.difficulty) settings.difficulty = button.dataset.difficulty;
      updateSettings();
    });
  }
  $('undo-button').addEventListener('click', () => {
    const index = undoIndex();
    if (index < 0) return;
    cancelAI();
    state = history[index];
    history = history.slice(0, index);
    selected = null;
    render();
  });
  $('restart-button').addEventListener('click', restart);
  const dialog = $('rules-dialog');
  $('rules-button').addEventListener('click', () => dialog.showModal());
  $('close-rules').addEventListener('click', () => dialog.close());
  $('got-it').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected) { selected = null; render(); }
    const current = document.activeElement;
    if (!current?.classList.contains('cell') || !event.key.startsWith('Arrow')) return;
    const deltas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const row = Number(current.dataset.row) + delta[0], col = Number(current.dataset.col) + delta[1];
    if (R.inside(row, col)) cells[row * 5 + col].focus();
  });
  window.addEventListener('pagehide', cancelAI);
  updateSettings();
})();
