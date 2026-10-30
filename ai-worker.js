'use strict';
importScripts('./rules.js', './ai.js');
self.onmessage = async event => {
  const { state, options } = event.data;
  const move = await WolfSheepAI.chooseMove(state, options);
  self.postMessage({ move });
};
