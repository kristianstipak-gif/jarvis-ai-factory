export function createMemoryStore() {
  const rows = [];

  return {
    async append(observations = []) {
      const safe = normalizeStorageRows(observations);
      rows.push(...safe);
      return { added: safe.length, total: rows.length };
    },
    async read({ mint = null, since = null, limit = 5000 } = {}) {
      let result = mint ? rows.filter((x) => x?.mint === mint) : [...rows];
      if (since) {
        const t = Date.parse(since);
        if (Number.isFinite(t)) result = result.filter((x) => Date.parse(x.observedAt) >= t);
      }
      return result
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
        .slice(-limit);
    },
    async count() {
      return rows.length;
    },
    async clear() {
      rows.length = 0;
    },
  };
}

export function createStorageAdapter({ durableStore = null } = {}) {
  const fallback = createMemoryStore();
  return {
    append: (rows) => (durableStore ? durableStore.append(rows) : fallback.append(rows)),
    read: (options) => (durableStore ? durableStore.read(options) : fallback.read(options)),
    count: () => (durableStore ? durableStore.count() : fallback.count()),
    clear: () => (durableStore ? durableStore.clear() : fallback.clear()),
  };
}

export function normalizeStorageRows(rows = []) {
  return rows.filter((x) => x?.mint && x?.observedAt);
}
