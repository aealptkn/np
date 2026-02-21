const CryptoManager = {
    // 1. PBKDF2 ile Key Türetme (Salt ile)
    async deriveKey(masterPassword, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(masterPassword),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    // 2. AES-256-GCM ile Şifreleme
    async encryptData(key, plainData) {
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertextBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(JSON.stringify(plainData))
        );

        return {
            ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
            iv: Array.from(iv)
        };
    },

    // 3. AES-256-GCM ile Şifre Çözme
    async decryptData(key, encryptedObj) {
        const iv = new Uint8Array(encryptedObj.iv);
        const ciphertext = new Uint8Array(encryptedObj.ciphertext);
        
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    },

    // Rastgele Salt Üretici
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    }
};