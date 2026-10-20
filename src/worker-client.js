(function (root) {
  'use strict';
  class Client {
    constructor() { this.jobs = new Map(); this.serial = 0; this.ready = null; this.worker = null; this.closed=false; }
    async open() {
      if(this.closed)throw Error('Worker cancelled');
      if (!this.ready) this.ready = (async () => {
        if (!root.Worker) throw Error('This browser does not support Web Workers.');
        let items;
        if (root.DuelWeb) {
          const manifest = root.DuelWeb.manifest;
          this.worker = new Worker(new URL(manifest.workerURL, document.baseURI), { type: 'module' });
          items = [...manifest.worker, { script: manifest.workerTournament }].map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, Array.isArray(value) ? value.map(p => new URL(p, document.baseURI).href) : new URL(value, document.baseURI).href])));
        } else {
          const encoded = root.DUEL_WORKER_BUNDLE;
          if (!encoded) throw Error('Worker bundle is missing. Please rebuild this page.');
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
          if(this.closed)throw Error('Worker cancelled');
          const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
          try { this.worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
        }
        this.worker.onmessage = ({ data }) => {
          const job = this.jobs.get(data.id); if (!job) return;
          if (data.progress) { job.progress?.(data.progress); return; }
          this.jobs.delete(data.id); data.error ? job.reject(Error(data.error)) : job.resolve(data.result);
        };
        this.worker.onerror = event => this.fail(Error(event.message || 'Worker failed'));
        this.worker.onmessageerror = () => this.fail(Error('Could not decode worker response'));
        await this.send('init', { items });
      })();
      return this.ready;
    }
    send(type, payload, progress) { return new Promise((resolve, reject) => { const id = ++this.serial; this.jobs.set(id, { resolve, reject, progress }); this.worker.postMessage({ id, type, payload }); }); }
    async request(type, payload, progress) { await this.open(); return this.send(type, payload, progress); }
    fail(error) { for (const job of this.jobs.values()) job.reject(error); this.jobs.clear(); this.worker?.terminate(); this.worker = null; this.ready = null; }
    close() { this.closed=true;this.fail(Error('Worker cancelled')); }
  }
  root.DuelWorkers = { Client };
})(globalThis);
