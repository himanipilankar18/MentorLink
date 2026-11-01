'use strict';

function mulberry32(seed) {
  let state = Number(seed) >>> 0;
  return function rng() {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { mulberry32 };
