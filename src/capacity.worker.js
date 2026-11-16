// Runs the layout optimisation off the main thread so the UI stays responsive.
import { WAREHOUSES } from './data.js';
import { planAll } from './capacity.js';

self.onmessage = (e) => {
  const { seq, params } = e.data;
  try {
    self.postMessage({ seq, results: planAll(WAREHOUSES, params) });
  } catch (err) {
    self.postMessage({ seq, error: String(err) });
  }
};
