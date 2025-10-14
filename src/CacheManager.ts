export class CacheManager {
    private dbName = 'SaltpeterCache';
    private dbVersion = 1;
    private db: IDBDatabase | null = null;

    constructor() {
        this.initDB();
        this.initDevKeybind(); // TODO: Delete
    }

    /**
     * Initializes the IndexedDB database
     */
    private async initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
            };
        });
    }

    /**
     * Writes any value to the cache
     */
    public async write(key: string, value: any): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put(value, key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Reads a value from the cache
     */
    public async read(key: string): Promise<any> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Deletes a value from the cache
     */
    public async delete(key: string): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Clears all cached data
     */
    public async clear(): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * DEV ONLY - Clears cache with tilde key
     * TODO: Remove this before production
     */
    private initDevKeybind(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                this.clear().then(() => {
                    console.log('Cache cleared! Reload the page.');
                    location.reload();
                });
            }
        });
    }
}