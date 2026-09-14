import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// A committed room is the recovery boundary. Tokens are stored only as hashes.
export class Store {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY, data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY, finished_at INTEGER NOT NULL, data TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    this.writeSession = this.db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)');
    this.writeRoom = this.db.prepare('INSERT OR REPLACE INTO rooms VALUES (?, ?)');
    this.writeGame = this.db.prepare('INSERT OR REPLACE INTO games VALUES (?, ?, ?)');
  }

  load() {
    return {
      sessions: this.db.prepare('SELECT data FROM sessions').all().map(row => JSON.parse(row.data)),
      rooms: this.db.prepare('SELECT data FROM rooms').all().map(row => JSON.parse(row.data))
    };
  }

  commit({ sessions = [], rooms = [], games = [], deleteRooms = [], deleteSessions = [] } = {}) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const s of sessions) this.writeSession.run(s.id, s.tokenHash, JSON.stringify(s));
      for (const r of rooms) this.writeRoom.run(r.code, JSON.stringify(r));
      for (const g of games) this.writeGame.run(g.id, g.finishedAt, JSON.stringify(g));
      for (const code of deleteRooms) this.db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
      for (const id of deleteSessions) this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  pruneGames(before) {
    this.db.prepare('DELETE FROM games WHERE finished_at < ?').run(before);
  }

  close() { this.db.close(); }
}
