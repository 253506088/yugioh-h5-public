(function (root) {
  'use strict';
  const NAME = 'duel-sanctuary-tournaments-v1';
  const meta = data => ({id:data.id, name:data.name, updatedAt:data.updatedAt, status:data.status, count:data.participants.length,
    played:data.matches.filter(m => m.status === 'complete').length, champion:data.participants.find(p => p.id === data.championId)?.name || ''});
  class Repository {
    constructor() { this.db = null; this.opening = null; this.fallback = !root.indexedDB; }
    async open() {
      if (this.fallback || this.db) return;
      if (!this.opening) this.opening = new Promise((resolve, reject) => {
        const request = root.indexedDB.open(NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('cups', {keyPath:'id'});
          db.createObjectStore('index', {keyPath:'id'});
          db.createObjectStore('settings');
        };
        request.onsuccess = () => { this.db = request.result; this.db.onversionchange = () => { this.db.close(); this.db = null; this.opening = null; }; resolve(); };
        request.onerror = () => { this.opening = null; reject(new Error('无法打开赛事存档：' + request.error?.message)); };
        request.onblocked = () => { this.opening = null; reject(new Error('赛事存档被其他页面占用，请关闭旧页面后重试。')); };
      });
      await this.opening;
    }
    async save(data) {
      await this.open();
      if (this.fallback) {
        const index = JSON.parse(root.localStorage.getItem(NAME + ':index') || '[]').filter(m => m.id !== data.id);
        root.localStorage.setItem(NAME + ':' + data.id, JSON.stringify(data));
        root.localStorage.setItem(NAME + ':index', JSON.stringify([meta(data), ...index]));
        root.localStorage.setItem(NAME + ':latest', data.id);
        return;
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['cups', 'index', 'settings'], 'readwrite');
        tx.objectStore('cups').put(data); tx.objectStore('index').put(meta(data)); tx.objectStore('settings').put(data.id, 'latest');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error('赛事保存失败：' + (tx.error?.message || '本地空间不足')));
      });
    }
    async read(store, key) {
      await this.open();
      return new Promise((resolve, reject) => {
        const request = this.db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }
    async load(id) {
      await this.open();
      if (this.fallback) return JSON.parse(root.localStorage.getItem(NAME + ':' + id) || 'null');
      return this.read('cups', id);
    }
    async latest() {
      await this.open();
      const id = this.fallback ? root.localStorage.getItem(NAME + ':latest') : await this.read('settings', 'latest');
      return id ? this.load(id) : null;
    }
    async list() {
      await this.open();
      if (this.fallback) return JSON.parse(root.localStorage.getItem(NAME + ':index') || '[]').sort((a, b) => b.updatedAt - a.updatedAt);
      return new Promise((resolve, reject) => {
        const request = this.db.transaction('index').objectStore('index').getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
        request.onerror = () => reject(request.error);
      });
    }
  }
  root.DuelTournamentStorage = {Repository, NAME};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DuelTournamentStorage;
})(globalThis);
