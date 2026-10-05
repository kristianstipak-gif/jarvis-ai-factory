export function createMemoryStore() {
  const rows = [];

  return {
    async append(observations = []) {
      rows.push(...observations);
      return { added: observations.length, total: rows.length };
    },
    async read({ mint = null, limit = 1000 } = {}) {
      const filtered = mint ? rows.filter((x) => x?.mint === mint) : rows;
      return filtered.slice(Math.max(0, filtered.length - limit));
    },
    async count() {
      return rows.length;
    },
  };
}

export function normalizeStorageRows(rows = []) {
  return rows.filter((x) => x?.mint && x?.observedAt);
}
