/* Safe localStorage wrapper — private mode / quota fall back to memory. */
(function attachTurdanoidStorage(root) {
  'use strict';

  function probeStorage(owner) {
    try {
      const storage = owner && owner.localStorage;
      if (!storage) {
        return null;
      }
      void storage.length;
      return storage;
    } catch {
      return null;
    }
  }

  function createSafeStorage(primary) {
    const memory = Object.create(null);

    function getItem(key) {
      const name = String(key);
      if (Object.prototype.hasOwnProperty.call(memory, name)) {
        return memory[name];
      }
      if (!primary) {
        return null;
      }
      try {
        const value = primary.getItem(name);
        if (value === null || value === undefined) {
          return null;
        }
        return String(value);
      } catch {
        return null;
      }
    }

    function setItem(key, value) {
      const name = String(key);
      const str = String(value);
      if (primary) {
        try {
          primary.setItem(name, str);
          delete memory[name];
          return;
        } catch {
          /* quota / private mode — keep the write in memory */
        }
      }
      memory[name] = str;
    }

    function removeItem(key) {
      const name = String(key);
      delete memory[name];
      if (!primary) {
        return;
      }
      try {
        primary.removeItem(name);
      } catch {
        /* ignore */
      }
    }

    return {
      getItem,
      setItem,
      removeItem
    };
  }

  root.TurdanoidStorage = {
    probeStorage,
    createSafeStorage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
