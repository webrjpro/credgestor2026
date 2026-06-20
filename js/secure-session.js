(function () {
    'use strict';

    if (typeof window === 'undefined' || typeof Storage === 'undefined') return;

    const sensitiveKeys = new Set(['adminToken', 'adminUser']);
    const local = window.localStorage;
    const session = window.sessionStorage;
    if (!local || !session) return;

    const native = {
        getItem: Storage.prototype.getItem,
        setItem: Storage.prototype.setItem,
        removeItem: Storage.prototype.removeItem,
        clear: Storage.prototype.clear,
    };

    function isSensitive(key) {
        return sensitiveKeys.has(String(key));
    }

    function migrateKey(key) {
        try {
            const oldValue = native.getItem.call(local, key);
            const currentValue = native.getItem.call(session, key);
            if (oldValue !== null && currentValue === null) {
                native.setItem.call(session, key, oldValue);
            }
            if (oldValue !== null) {
                native.removeItem.call(local, key);
            }
        } catch (error) {
            console.warn('[secure-session] Falha ao migrar chave sensivel:', key, error.message);
        }
    }

    for (const key of sensitiveKeys) migrateKey(key);

    Storage.prototype.getItem = function (key) {
        if (this === local && isSensitive(key)) {
            return native.getItem.call(session, String(key));
        }
        return native.getItem.call(this, key);
    };

    Storage.prototype.setItem = function (key, value) {
        if (this === local && isSensitive(key)) {
            native.removeItem.call(local, String(key));
            return native.setItem.call(session, String(key), String(value));
        }
        return native.setItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function (key) {
        if (this === local && isSensitive(key)) {
            native.removeItem.call(session, String(key));
            return native.removeItem.call(local, String(key));
        }
        return native.removeItem.call(this, key);
    };

    Storage.prototype.clear = function () {
        if (this === local) {
            for (const key of sensitiveKeys) native.removeItem.call(session, key);
        }
        return native.clear.call(this);
    };

    window.CrediSecureSession = Object.freeze({
        get: (key) => native.getItem.call(session, String(key)),
        set: (key, value) => native.setItem.call(session, String(key), String(value)),
        remove: (key) => native.removeItem.call(session, String(key)),
        keys: Array.from(sensitiveKeys),
    });
})();
