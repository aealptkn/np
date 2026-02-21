const DBManager = {
    dbName: "vaultDB",
    dbVersion: 2, // Migration sistemi için Versiyon 2
    db: null,
    initPromise: null, // Init Guard (Çoklu başlatma engeli)

    async init() {
        if (this.db) {
            return this.db;
        }
        
        // Eğer zaten başlatılıyorsa mevcut işlemi bekle
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Versiyon 1 (İlk Kurulum)
                if (oldVersion < 1) {
                    if (!db.objectStoreNames.contains("metadata")) {
                        db.createObjectStore("metadata", { keyPath: "id" });
                    }
                    if (!db.objectStoreNames.contains("vaultItems")) {
                        const vaultStore = db.createObjectStore("vaultItems", { keyPath: "id" });
                        // Index Planlaması (Performans için)
                        vaultStore.createIndex("type_idx", "type", { unique: false });
                        vaultStore.createIndex("created_idx", "createdAt", { unique: false });
                    }
                }

                // Versiyon 2 Migration (Önceden kuranlar için Index güncellemesi)
                if (oldVersion >= 1 && oldVersion < 2) {
                    const transaction = event.target.transaction;
                    const vaultStore = transaction.objectStore("vaultItems");
                    if (!vaultStore.indexNames.contains("type_idx")) {
                        vaultStore.createIndex("type_idx", "type", { unique: false });
                    }
                    if (!vaultStore.indexNames.contains("created_idx")) {
                        vaultStore.createIndex("created_idx", "createdAt", { unique: false });
                    }
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                
                // Genel Transaction Hata Yakalayıcı (Error Handling)
                this.db.onerror = (e) => {
                    console.error("Global DB Hatası:", e.target.error);
                };

                resolve(this.db);
            };

            request.onerror = (event) => {
                this.initPromise = null;
                reject(new Error("Veritabanı başlatılamadı: " + event.target.error));
            };
        });

        return this.initPromise;
    },

    // API Return Standardı İyileştirmesi
    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], "readonly");
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                transaction.onerror = (e) => {
                    reject(new Error("İşlem hatası (getAll): " + e.target.error));
                };
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error("Sorgu hatası (getAll): " + request.error));
            } catch (e) {
                reject(new Error("Transaction başlatılamadı: " + e.message));
            }
        });
    },

    async save(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], "readwrite");
                const store = transaction.objectStore(storeName);
                const request = store.put(item);
                
                transaction.oncomplete = () => {
                    resolve({ success: true, id: item.id });
                };
                
                transaction.onerror = (e) => {
                    reject(new Error("İşlem hatası (save): " + e.target.error));
                };
                
                request.onerror = () => {
                    reject(new Error("Kayıt hatası (save): " + request.error));
                };
            } catch (e) {
                reject(new Error("Transaction başlatılamadı: " + e.message));
            }
        });
    },
    
    async clear(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], "readwrite");
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                transaction.oncomplete = () => {
                    resolve({ success: true });
                };
                
                transaction.onerror = (e) => {
                    reject(new Error("İşlem hatası (clear): " + e.target.error));
                };
            } catch (e) {
                reject(new Error("Transaction başlatılamadı: " + e.message));
            }
        });
    },

    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], "readwrite");
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);
                
                transaction.oncomplete = () => {
                    resolve({ success: true });
                };
                
                transaction.onerror = (e) => {
                    reject(new Error("İşlem hatası (delete): " + e.target.error));
                };
            } catch (e) {
                reject(new Error("Transaction başlatılamadı: " + e.message));
            }
        });
    }
};