const AppState = {
    encryptionKey: null,
    inactivityTimer: null,
    TIMEOUT_MS: 3 * 60 * 1000,
    decryptedItems: [], 
    currentCategory: null,
    currentNoteId: null,
    noteTimestamp: null,
    sessionMasterPass: null,
    isDeletingProcess: false // Not silinirken çifte kaydı önleme kilidi
};

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 1. ÇEVRİMDIŞI ÇALIŞMA (SERVICE WORKER) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && !navigator.serviceWorker.controller) {
                        setTimeout(() => {
                            alert("✅ Sistem İndirildi!\nUygulama başarıyla telefonun önbelleğine kaydedildi. Artık 100% çevrimdışı (offline) olarak çalışacak. İnternetinizi kapatsanız dahi kullanabilirsiniz.");
                        }, 1000);
                    }
                });
            });
        }).catch((error) => {
            console.error("Service Worker Hatası:", error);
        });
    }

    await DBManager.init();
    
    if (typeof CalendarApp !== 'undefined') {
        CalendarApp.init();
    }

    const screens = {
        login: document.getElementById("loginSection"),
        dashboard: document.getElementById("dashboardSection"),
        list: document.getElementById("listSection"),
        add: document.getElementById("addSection"),
        bottomBar: document.getElementById("bottomBar"),
        calendarSection: document.getElementById("calendarSection"),
        addCalendarItemSection: document.getElementById("addCalendarItemSection"),
        addAlarmSection: document.getElementById("addAlarmSection")
    };

    window.reloadVaultData = async function() {
        if (!AppState.encryptionKey) {
            return;
        }
        
        const encryptedItems = await DBManager.getAll("vaultItems"); 
        AppState.decryptedItems = [];
        
        for (const item of encryptedItems) {
            try {
                const plainData = await CryptoManager.decryptData(AppState.encryptionKey, { 
                    ciphertext: item.encryptedBlob, 
                    iv: item.iv 
                });
                plainData.id = item.id; 
                plainData.timestamp = item.updatedAt || item.createdAt; 
                AppState.decryptedItems.push(plainData);
            } catch (e) { 
                console.error("Öge çözülemedi:", item.id); 
            }
        }
        
        AppState.decryptedItems.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)); 
        updateDashboardCounts();
        
        if (typeof CalendarApp !== 'undefined') {
            CalendarApp.loadItems(); 
        }
    };

    async function loadAllAndDecryptToRAM() {
        await window.reloadVaultData();
    }

    function updateStrengthBar(pass, barId) {
        const bar = document.getElementById(barId);
        if (!bar) {
            return;
        }
        
        if (pass.length === 0) { 
            bar.style.width = "0"; 
            return; 
        }
        
        let score = 0;
        if (pass.length >= 8) score++;
        if (pass.length >= 12) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 2) { 
            bar.style.width = "33%"; 
            bar.style.background = "var(--red)"; 
        } else if (score <= 4) { 
            bar.style.width = "66%"; 
            bar.style.background = "var(--yellow)"; 
        } else { 
            bar.style.width = "100%"; 
            bar.style.background = "var(--green)"; 
        }
    }

    let isInitialSetup = false;
    const passInput = document.getElementById("masterPassword");
    const masterStrengthContainer = document.getElementById("masterStrengthContainer");

    if (passInput) {
        passInput.addEventListener("input", (e) => {
            resetPasswordInput();
            
            if (isInitialSetup && masterStrengthContainer) {
                masterStrengthContainer.classList.remove("hidden");
                updateStrengthBar(e.target.value, "masterStrengthBar");
            }
            
            clearTimeout(window.typingTimer);
            if (!isInitialSetup && passInput.value.length > 0) {
                window.typingTimer = setTimeout(() => {
                    performLogin(passInput.value);
                }, 800);
            }
        });

        passInput.addEventListener("focus", resetPasswordInput); 
        passInput.addEventListener("click", resetPasswordInput);
        
        passInput.addEventListener("keyup", (e) => {
            if (e.key === 'Enter') {
                clearTimeout(window.typingTimer);
                if (isInitialSetup) {
                    const unlockBtn = document.getElementById("unlockBtn");
                    if (unlockBtn) {
                        unlockBtn.click();
                    }
                } else {
                    performLogin(passInput.value);
                }
            }
        });
    }

    async function checkSetupStatus() {
        const metadata = await DBManager.getAll("metadata");
        const hasMaster = metadata.some(m => m.id === "master_salt");
        const hasPattern = metadata.some(m => m.id === "pattern_data");
        const hasBio = metadata.some(m => m.id === "bio_data");

        resetPasswordInput();
        
        const patternToggleBtn = document.getElementById("patternToggleBtn");
        if (patternToggleBtn) {
            patternToggleBtn.checked = hasPattern;
        }
        
        const bioToggleBtn = document.getElementById("bioToggleBtn");
        if (bioToggleBtn) {
            bioToggleBtn.checked = hasBio;
        }

        if (hasMaster) {
            isInitialSetup = false;
            
            if (masterStrengthContainer) {
                masterStrengthContainer.classList.add("hidden");
            }
            
            const loginTitle = document.getElementById("loginTitle");
            if (loginTitle) {
                loginTitle.textContent = "AlpKasa";
            }
            
            let descStr = "Kasanızı açmak için şifrenizi girin";
            if (hasPattern && hasBio) {
                descStr += ", desen çizin veya biyometrik kullanın.";
            } else if (hasPattern) {
                descStr += " veya desen çizin.";
            } else if (hasBio) {
                descStr += " veya biyometrik kullanın.";
            } else {
                descStr += ".";
            }
            
            const loginDesc = document.getElementById("loginDesc");
            if (loginDesc) {
                loginDesc.textContent = descStr;
            }
            
            const unlockBtn = document.getElementById("unlockBtn");
            if (unlockBtn) {
                unlockBtn.classList.add("hidden"); 
            }
            
            const loginPatternContainer = document.getElementById("loginPatternContainer");
            if (loginPatternContainer) {
                loginPatternContainer.classList.toggle("hidden", !hasPattern);
            }
            
            const bioLoginBtn = document.getElementById("bioLoginBtn");
            if (hasBio && window.PublicKeyCredential) {
                if (bioLoginBtn) {
                    bioLoginBtn.classList.remove("hidden");
                }
            } else {
                if (bioLoginBtn) {
                    bioLoginBtn.classList.add("hidden");
                }
            }
        } else {
            isInitialSetup = true;
            
            const loginTitle = document.getElementById("loginTitle");
            if (loginTitle) {
                loginTitle.textContent = "Kurulum";
            }
            
            const loginDesc = document.getElementById("loginDesc");
            if (loginDesc) {
                loginDesc.textContent = "Yeni ve güçlü bir master şifre belirleyin.";
            }
            
            const loginPatternContainer = document.getElementById("loginPatternContainer");
            if (loginPatternContainer) {
                loginPatternContainer.classList.add("hidden");
            }
            
            const bioLoginBtn = document.getElementById("bioLoginBtn");
            if (bioLoginBtn) {
                bioLoginBtn.classList.add("hidden");
            }
            
            const unlockBtn = document.getElementById("unlockBtn");
            if (unlockBtn) {
                unlockBtn.classList.remove("hidden"); 
            }
        }
    }

    function resetPasswordInput() {
        if (passInput && passInput.classList.contains("error-state")) {
            passInput.value = ""; 
            passInput.type = "password";
            passInput.classList.remove("error-state"); 
            passInput.style.color = "var(--text)";
        }
    }

    const unlockBtn = document.getElementById("unlockBtn");
    if (unlockBtn) {
        unlockBtn.addEventListener("click", () => {
            if (passInput) {
                performLogin(passInput.value);
            }
        });
    }

    async function performLogin(password) {
        if (!password) {
            return;
        }
        
        try {
            let metadataList = await DBManager.getAll("metadata");
            let masterSaltData = metadataList.find(m => m.id === "master_salt");
            let verifierData = metadataList.find(m => m.id === "login_verifier");
            let salt;
            
            if (!masterSaltData) {
                salt = CryptoManager.generateSalt();
                const derivedKey = await CryptoManager.deriveKey(password, salt);
                
                const verifierResult = await CryptoManager.encryptData(derivedKey, { status: "valid_master_password" });
                
                await DBManager.save("metadata", { 
                    id: "master_salt", 
                    salt: Array.from(salt), 
                    createdAt: new Date().toISOString() 
                });
                
                await DBManager.save("metadata", { 
                    id: "login_verifier", 
                    blob: verifierResult.ciphertext, 
                    iv: verifierResult.iv 
                });
                
                AppState.encryptionKey = derivedKey;
            } else {
                salt = new Uint8Array(masterSaltData.salt);
                const testKey = await CryptoManager.deriveKey(password, salt);
                
                if (verifierData) {
                    try {
                        const decryptedVerifier = await CryptoManager.decryptData(testKey, { 
                            ciphertext: verifierData.blob, 
                            iv: verifierData.iv 
                        });
                        
                        if (decryptedVerifier.status !== "valid_master_password") {
                            throw new Error("Anahtar geçersiz");
                        }
                    } catch (e) {
                        throw new Error("Hatalı Şifre"); 
                    }
                } else {
                    const items = await DBManager.getAll("vaultItems");
                    if (items.length > 0) {
                        try { 
                            await CryptoManager.decryptData(testKey, { 
                                ciphertext: items[0].encryptedBlob, 
                                iv: items[0].iv 
                            }); 
                        } catch(e) { 
                            throw new Error("Hatalı Şifre"); 
                        }
                    }
                }
                AppState.encryptionKey = testKey;
            }
            
            if (passInput) {
                passInput.value = ""; 
            }
            
            AppState.sessionMasterPass = password; 
            
            await loadAllAndDecryptToRAM(); 
            showScreen('dashboard'); 
            resetInactivityTimer(); 
            isInitialSetup = false;
            
        } catch (error) {
            console.error("Giriş Hatası Detayı:", error); // Gerçek hatayı konsola basar
            AppState.encryptionKey = null; 
            
            if (passInput) {
                passInput.type = "text"; 
                // Sadece gerçekten şifre yanlışsa "Yanlış girdiniz" der, yoksa sistem hatasını belirtir
                passInput.value = (error.message === "Hatalı Şifre" || error.message === "Anahtar geçersiz") ? "Yanlış girdiniz!" : "Sistem Hatası!";
                passInput.classList.add("error-state"); 
                passInput.style.color = "var(--red)";
            }
            
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        }
    }

    function lockVault() {
        const itemType = document.getElementById("itemType");
        
        if (itemType && itemType.value === "note" && screens.add && !screens.add.classList.contains("hidden")) {
            saveNoteFromDOM(); 
        }
        
        AppState.encryptionKey = null; 
        AppState.sessionMasterPass = null; 
        AppState.decryptedItems = []; 
        
        const vaultList = document.getElementById("vaultList");
        if (vaultList) {
            vaultList.innerHTML = ""; 
        }
        
        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
            searchInput.value = "";
        }
        
        const dropdownMenu = document.getElementById("dropdownMenu");
        if (dropdownMenu) {
            dropdownMenu.classList.add("hidden"); 
        }
        
        const clearDbModal = document.getElementById("clearDbModal");
        if (clearDbModal) {
            clearDbModal.classList.add("hidden");
        }
        
        const settingsSheet = document.getElementById("settingsSheet");
        if (settingsSheet) {
            settingsSheet.classList.remove("show"); 
        }
        
        const settingsSheetOverlay = document.getElementById("settingsSheetOverlay");
        if (settingsSheetOverlay) {
            settingsSheetOverlay.classList.remove("show");
        }
        
        document.querySelectorAll('.pattern-dot').forEach(d => { 
            d.classList.remove('active', 'error'); 
        });
        
        checkSetupStatus(); 
        showScreen('login', true); 
    }

    const lockBtn = document.getElementById("lockBtn");
    if (lockBtn) {
        lockBtn.addEventListener("click", lockVault);
    }
    
    window.addEventListener("mousemove", resetInactivityTimer); 
    window.addEventListener("keypress", resetInactivityTimer); 
    window.addEventListener("touchstart", resetInactivityTimer);

    function resetInactivityTimer() {
        if (!AppState.encryptionKey) {
            return;
        }
        if (AppState.inactivityTimer) {
            clearTimeout(AppState.inactivityTimer);
        }
        AppState.inactivityTimer = setTimeout(lockVault, AppState.TIMEOUT_MS);
    }

    const menuToggleBtn = document.getElementById("menuToggleBtn");
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener("click", () => {
            const dropdownMenu = document.getElementById("dropdownMenu");
            if (dropdownMenu) {
                dropdownMenu.classList.toggle("hidden");
            }
        });
    }

    const openSettingsBtn = document.getElementById("openSettingsBtn");
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener("click", () => {
            const dropdownMenu = document.getElementById("dropdownMenu");
            if (dropdownMenu) {
                dropdownMenu.classList.add("hidden");
            }
            
            const settingsSheetOverlay = document.getElementById("settingsSheetOverlay");
            if (settingsSheetOverlay) {
                settingsSheetOverlay.classList.add("show");
            }
            
            const settingsSheet = document.getElementById("settingsSheet");
            if (settingsSheet) {
                settingsSheet.classList.add("show");
            }
            
            const oldMasterPass = document.getElementById("oldMasterPass");
            if (oldMasterPass) {
                oldMasterPass.value = ""; 
            }
            
            const newMasterPass = document.getElementById("newMasterPass");
            if (newMasterPass) {
                newMasterPass.value = ""; 
            }
            
            const confirmNewMasterPass = document.getElementById("confirmNewMasterPass");
            if (confirmNewMasterPass) {
                confirmNewMasterPass.value = "";
            }
            
            updateStrengthBar("", "changeStrengthBar");
        });
    }
    
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener("click", () => {
            const settingsSheet = document.getElementById("settingsSheet");
            if (settingsSheet) {
                settingsSheet.classList.remove("show"); 
            }
            
            const settingsSheetOverlay = document.getElementById("settingsSheetOverlay");
            if (settingsSheetOverlay) {
                settingsSheetOverlay.classList.remove("show");
            }
        });
    }

    const bioToggleBtn = document.getElementById("bioToggleBtn");
    if (bioToggleBtn) {
        bioToggleBtn.addEventListener("change", async (e) => {
            if (!window.PublicKeyCredential) {
                alert("Cihazınız Biyometrik doğrulamayı desteklemiyor.");
                e.target.checked = false; 
                return;
            }
            if (e.target.checked) {
                try {
                    const challenge = new Uint8Array(32); 
                    crypto.getRandomValues(challenge);
                    
                    const cred = await navigator.credentials.create({
                        publicKey: {
                            challenge: challenge, 
                            rp: { name: "AlpKasa" },
                            user: { 
                                id: Uint8Array.from("user", c=>c.charCodeAt(0)), 
                                name: "user", 
                                displayName: "Kasa Sahibi" 
                            },
                            pubKeyCredParams: [
                                { type: "public-key", alg: -7 }, 
                                { type: "public-key", alg: -257 }
                            ],
                            authenticatorSelection: { 
                                authenticatorAttachment: "platform", 
                                userVerification: "required" 
                            },
                            timeout: 60000
                        }
                    });
                    
                    if (cred) {
                        const bioSecret = crypto.randomUUID();
                        localStorage.setItem('bioSecretKey', bioSecret); 
                        
                        const bioSalt = CryptoManager.generateSalt();
                        const bioKey = await CryptoManager.deriveKey(bioSecret, bioSalt);
                        const encResult = await CryptoManager.encryptData(bioKey, { pass: AppState.sessionMasterPass });
                        
                        await DBManager.save("metadata", { 
                            id: "bio_data", 
                            salt: Array.from(bioSalt), 
                            blob: encResult.ciphertext, 
                            iv: encResult.iv 
                        });
                        
                        alert("Biyometrik giriş başarıyla aktifleştirildi.");
                    }
                } catch (err) {
                    alert("Biyometrik doğrulama iptal edildi veya başarısız oldu.");
                    e.target.checked = false;
                }
            } else {
                const metadata = await DBManager.getAll("metadata");
                const filtered = metadata.filter(m => m.id !== "bio_data");
                
                await DBManager.clear("metadata"); 
                for (const m of filtered) {
                    await DBManager.save("metadata", m);
                }
                
                localStorage.removeItem('bioSecretKey');
                alert("Biyometrik giriş kaldırıldı.");
            }
        });
    }

    const bioLoginBtn = document.getElementById("bioLoginBtn");
    if (bioLoginBtn) {
        bioLoginBtn.addEventListener("click", async () => {
            try {
                const challenge = new Uint8Array(32); 
                crypto.getRandomValues(challenge);
                
                await navigator.credentials.get({ 
                    publicKey: { 
                        challenge: challenge, 
                        userVerification: "required" 
                    } 
                });
                
                const bioSecret = localStorage.getItem('bioSecretKey');
                const metadata = await DBManager.getAll("metadata");
                const bioData = metadata.find(m => m.id === "bio_data");
                
                if (bioSecret && bioData) {
                    const bioKey = await CryptoManager.deriveKey(bioSecret, new Uint8Array(bioData.salt));
                    const plainObj = await CryptoManager.decryptData(bioKey, { 
                        ciphertext: bioData.blob, 
                        iv: bioData.iv 
                    });
                    await performLogin(plainObj.pass);
                } else {
                    throw new Error("Anahtar bulunamadı.");
                }
            } catch (e) { 
                alert("Biyometrik doğrulama başarısız. Lütfen şifre veya desen kullanın."); 
            }
        });
    }

    const newMasterPass = document.getElementById("newMasterPass");
    if (newMasterPass) {
        newMasterPass.addEventListener("input", (e) => {
            updateStrengthBar(e.target.value, "changeStrengthBar");
        });
    }

    const changeMasterBtn = document.getElementById("changeMasterBtn");
    if (changeMasterBtn) {
        changeMasterBtn.addEventListener("click", async () => {
            const oldPassInp = document.getElementById("oldMasterPass");
            const newPassInp = document.getElementById("newMasterPass");
            const confirmPassInp = document.getElementById("confirmNewMasterPass");
            
            const oldPass = oldPassInp ? oldPassInp.value : "";
            const newPass = newPassInp ? newPassInp.value : "";
            const confirmPass = confirmPassInp ? confirmPassInp.value : "";

            if (!oldPass || !newPass) { 
                alert("Lütfen tüm alanları doldurun."); 
                return; 
            }
            if (newPass !== confirmPass) { 
                alert("Yeni şifreler eşleşmiyor."); 
                return; 
            }
            if (oldPass !== AppState.sessionMasterPass) { 
                alert("Mevcut şifreniz hatalı!"); 
                return; 
            }
            if (newPass.length < 4) { 
                alert("Yeni şifre çok kısa! Lütfen daha güçlü bir şifre belirleyin."); 
                return; 
            }

            try {
                changeMasterBtn.textContent = "Şifreleniyor... Lütfen bekleyin"; 
                changeMasterBtn.disabled = true;
                
                const newSalt = CryptoManager.generateSalt();
                const newKey = await CryptoManager.deriveKey(newPass, newSalt);
                
                const verifierResult = await CryptoManager.encryptData(newKey, { status: "valid_master_password" });
                
                const newEncryptedItems = [];
                for (const item of AppState.decryptedItems) {
                    const encResult = await CryptoManager.encryptData(newKey, item);
                    newEncryptedItems.push({ 
                        id: item.id, 
                        encryptedBlob: encResult.ciphertext, 
                        iv: encResult.iv, 
                        createdAt: item.createdAt, 
                        updatedAt: new Date().toISOString() 
                    });
                }

                await DBManager.clear("vaultItems");
                for (const encItem of newEncryptedItems) {
                    await DBManager.save("vaultItems", encItem);
                }

                await DBManager.clear("metadata");
                
                await DBManager.save("metadata", { 
                    id: "master_salt", 
                    salt: Array.from(newSalt), 
                    createdAt: new Date().toISOString() 
                });
                
                await DBManager.save("metadata", { 
                    id: "login_verifier", 
                    blob: verifierResult.ciphertext, 
                    iv: verifierResult.iv 
                });
                
                localStorage.removeItem('patternFails'); 
                localStorage.removeItem('patternLockout'); 
                localStorage.removeItem('bioSecretKey');
                
                alert("Master şifreniz başarıyla değiştirildi! Güvenlik gereği Desen ve Biyometrik girişler sıfırlandı.");
                
                changeMasterBtn.textContent = "Şifreyi Değiştir"; 
                changeMasterBtn.disabled = false;
                
                lockVault(); 
            } catch (e) { 
                alert("Şifre değiştirilirken kritik bir hata oluştu!"); 
                changeMasterBtn.textContent = "Şifreyi Değiştir"; 
                changeMasterBtn.disabled = false;
            }
        });
    }

    function initPatternTracker(gridId, onComplete) {
        const grid = document.getElementById(gridId); 
        if (!grid) {
            return;
        }
        
        const dots = grid.querySelectorAll('.pattern-dot');
        let pattern = []; 
        let isDrawing = false;
        
        function addDot(dot) { 
            const val = dot.dataset.val; 
            if (!pattern.includes(val)) { 
                pattern.push(val); 
                dot.classList.add('active'); 
                if (gridId === "loginPatternGrid") {
                    resetInactivityTimer(); 
                }
            } 
        }
        
        function endDraw() { 
            if (isDrawing) { 
                isDrawing = false; 
                if (pattern.length > 0) {
                    onComplete(pattern.join('')); 
                }
            } 
        }
        
        grid.addEventListener('mousedown', (e) => { 
            if (isLockoutActive() && gridId === "loginPatternGrid") {
                return checkPatternLockout(); 
            }
            isDrawing = true; 
            pattern = []; 
            dots.forEach(d => { 
                d.classList.remove('active', 'error'); 
            }); 
            if (e.target.classList.contains('pattern-dot')) {
                addDot(e.target); 
            }
        });
        
        window.addEventListener('mouseup', endDraw);
        
        grid.addEventListener('mouseover', (e) => { 
            if (isDrawing && e.target.classList.contains('pattern-dot')) {
                addDot(e.target); 
            }
        });
        
        grid.addEventListener('touchstart', (e) => { 
            if (isLockoutActive() && gridId === "loginPatternGrid") { 
                checkPatternLockout(); 
                return; 
            } 
            isDrawing = true; 
            pattern = []; 
            dots.forEach(d => { 
                d.classList.remove('active', 'error'); 
            }); 
            const touch = e.touches[0]; 
            const target = document.elementFromPoint(touch.clientX, touch.clientY); 
            if (target && target.classList.contains('pattern-dot')) {
                addDot(target); 
            }
            e.preventDefault(); 
        }, {passive: false});
        
        grid.addEventListener('touchmove', (e) => { 
            if (!isDrawing) {
                return; 
            }
            const touch = e.touches[0]; 
            const target = document.elementFromPoint(touch.clientX, touch.clientY); 
            if (target && target.classList.contains('pattern-dot')) {
                addDot(target); 
            }
            e.preventDefault(); 
        }, {passive: false});
        
        window.addEventListener('touchend', endDraw);
    }

    let setupStep = 1; 
    let firstPattern = "";
    
    const patternToggleBtn = document.getElementById("patternToggleBtn");
    if (patternToggleBtn) {
        patternToggleBtn.addEventListener("change", async (e) => {
            const sheet = document.getElementById("patternSetupSheet");
            const setupMsg = document.getElementById("setupPatternMsg");
            
            if (e.target.checked) {
                const settingsSheet = document.getElementById("settingsSheet");
                if (settingsSheet) {
                    settingsSheet.classList.remove("show");
                }
                
                setupStep = 1; 
                firstPattern = ""; 
                
                if (setupMsg) { 
                    setupMsg.textContent = "Lütfen bir desen çizin"; 
                    setupMsg.style.color = "var(--blue)"; 
                }
                
                document.querySelectorAll('#setupPatternGrid .pattern-dot').forEach(d => { 
                    d.classList.remove('active', 'error'); 
                });
                
                if (sheet) {
                    sheet.classList.add("show");
                }
            } else {
                const metadata = await DBManager.getAll("metadata"); 
                const filtered = metadata.filter(m => m.id !== "pattern_data");
                
                await DBManager.clear("metadata"); 
                
                for (const m of filtered) {
                    await DBManager.save("metadata", m);
                }
                
                localStorage.removeItem('patternFails'); 
                localStorage.removeItem('patternLockout');
            }
        });
    }

    const cancelPatternBtn = document.getElementById("cancelPatternBtn");
    if (cancelPatternBtn) {
        cancelPatternBtn.addEventListener("click", () => {
            const sheet = document.getElementById("patternSetupSheet");
            if (sheet) {
                sheet.classList.remove("show"); 
            }
            
            const settingsSheet = document.getElementById("settingsSheet");
            if (settingsSheet) {
                settingsSheet.classList.add("show");
            }
            
            const pBtn = document.getElementById("patternToggleBtn");
            if(pBtn) {
                pBtn.checked = false; 
            }
        });
    }

    initPatternTracker("setupPatternGrid", async (patternStr) => {
        const setupMsg = document.getElementById("setupPatternMsg");
        const dots = document.querySelectorAll('#setupPatternGrid .pattern-dot');
        
        if (patternStr.length < 4) {
            if(setupMsg) { 
                setupMsg.textContent = "En az 4 nokta birleştirin!"; 
                setupMsg.style.color = "var(--red)"; 
            }
            dots.forEach(d => {
                d.classList.add('error');
            });
            setTimeout(() => { 
                dots.forEach(d => { 
                    d.classList.remove('active', 'error'); 
                }); 
            }, 800); 
            return;
        }
        
        if (setupStep === 1) { 
            firstPattern = patternStr; 
            setupStep = 2; 
            
            if (setupMsg) { 
                setupMsg.textContent = "Onaylamak için tekrar çizin"; 
                setupMsg.style.color = "var(--blue)"; 
            }
            
            setTimeout(() => { 
                dots.forEach(d => {
                    d.classList.remove('active');
                }); 
            }, 300);
        } else if (setupStep === 2) {
            if (patternStr === firstPattern) {
                if(setupMsg) { 
                    setupMsg.textContent = "Desen kaydediliyor..."; 
                    setupMsg.style.color = "var(--blue)"; 
                }
                
                const pSalt = CryptoManager.generateSalt(); 
                const pKey = await CryptoManager.deriveKey(patternStr, pSalt);
                const enc = await CryptoManager.encryptData(pKey, { pass: AppState.sessionMasterPass });
                
                await DBManager.save("metadata", { 
                    id: "pattern_data", 
                    salt: Array.from(pSalt), 
                    blob: enc.ciphertext, 
                    iv: enc.iv 
                });
                
                const sheet = document.getElementById("patternSetupSheet");
                if (sheet) {
                    sheet.classList.remove("show"); 
                }
                
                const settingsSheet = document.getElementById("settingsSheet");
                if (settingsSheet) {
                    settingsSheet.classList.add("show");
                }
                
                alert("Desen kilidi başarıyla ayarlandı!");
            } else {
                if(setupMsg) { 
                    setupMsg.textContent = "Desenler eşleşmedi. Baştan çizin."; 
                    setupMsg.style.color = "var(--red)"; 
                }
                
                dots.forEach(d => {
                    d.classList.add('error');
                }); 
                
                setupStep = 1; 
                firstPattern = ""; 
                
                setTimeout(() => { 
                    dots.forEach(d => { 
                        d.classList.remove('active', 'error'); 
                    }); 
                }, 1000);
            }
        }
    });

    const penaltyTimes = [1, 3, 5, 15]; 
    
    function isLockoutActive() { 
        return Date.now() < parseInt(localStorage.getItem('patternLockout') || "0"); 
    }
    
    function checkPatternLockout() {
        const msgEl = document.getElementById("loginPatternMsg"); 
        if(!msgEl) {
            return false;
        }
        
        const lockoutEnd = parseInt(localStorage.getItem('patternLockout') || "0"); 
        const now = Date.now();
        
        if (now < lockoutEnd) {
            const remainSec = Math.ceil((lockoutEnd - now) / 1000); 
            msgEl.textContent = `Çok fazla hata! ${remainSec} saniye bekleyin veya şifre ile girin.`; 
            msgEl.style.color = "var(--red)";
            
            document.querySelectorAll('#loginPatternGrid .pattern-dot').forEach(d => { 
                d.classList.add('error'); 
                setTimeout(() => { 
                    d.classList.remove('error'); 
                }, 500); 
            });
            return true;
        } else { 
            msgEl.textContent = "Girmek için desen çizin"; 
            msgEl.style.color = "var(--subtext)"; 
            return false; 
        }
    }

    initPatternTracker("loginPatternGrid", async (patternStr) => {
        if (isLockoutActive()) { 
            checkPatternLockout(); 
            return; 
        }
        
        const dots = document.querySelectorAll('#loginPatternGrid .pattern-dot'); 
        const msgEl = document.getElementById("loginPatternMsg");
        
        try {
            const metadata = await DBManager.getAll("metadata"); 
            const pData = metadata.find(m => m.id === "pattern_data");
            
            if (!pData) {
                return; 
            }
            
            const pKey = await CryptoManager.deriveKey(patternStr, new Uint8Array(pData.salt));
            const plain = await CryptoManager.decryptData(pKey, { 
                ciphertext: pData.blob, 
                iv: pData.iv 
            });
            
            localStorage.setItem('patternFails', "0"); 
            await performLogin(plain.pass);
            
        } catch (e) {
            let fails = parseInt(localStorage.getItem('patternFails') || "0") + 1; 
            localStorage.setItem('patternFails', fails.toString());
            
            dots.forEach(d => {
                d.classList.add('error');
            });
            
            if (fails > 0 && fails % 5 === 0) {
                const penaltyIndex = Math.min((fails / 5) - 1, penaltyTimes.length - 1); 
                localStorage.setItem('patternLockout', (Date.now() + (penaltyTimes[penaltyIndex] * 60000)).toString()); 
                checkPatternLockout();
            } else if (msgEl) { 
                msgEl.textContent = `Hatalı desen! (Kalan deneme: ${5 - (fails % 5)})`; 
                msgEl.style.color = "var(--red)"; 
            }
            
            setTimeout(() => { 
                dots.forEach(d => { 
                    d.classList.remove('active', 'error'); 
                }); 
            }, 600);
        }
    });

    const backupBtn = document.getElementById("backupBtn");
    if (backupBtn) {
        backupBtn.addEventListener("click", async () => {
            const dropdownMenu = document.getElementById("dropdownMenu");
            if (dropdownMenu) {
                dropdownMenu.classList.add("hidden"); 
            }
            
            const metadata = await DBManager.getAll("metadata"); 
            const vaultItems = await DBManager.getAll("vaultItems");
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ metadata, vaultItems }));
            
            // Bugünün tarihini oluştur (YYYY-AA-GG formatında)
            const date = new Date();
            const dateString = date.getFullYear() + "-" + 
                               String(date.getMonth() + 1).padStart(2, '0') + "-" + 
                               String(date.getDate()).padStart(2, '0');
            
            const anchor = document.createElement('a'); 
            anchor.href = dataStr; 
            // Dosya adının sonuna tarihi ekle yedek adı
            anchor.download = "alp-yedek-" + dateString + ".json"; 
            anchor.click();
        });
    }
    
    const restoreTriggerBtn = document.getElementById("restoreTriggerBtn");
    if (restoreTriggerBtn) {
        restoreTriggerBtn.addEventListener("click", () => { 
            const dropdownMenu = document.getElementById("dropdownMenu");
            if (dropdownMenu) {
                dropdownMenu.classList.add("hidden"); 
            }
            
            const restoreFile = document.getElementById("restoreFile");
            if (restoreFile) {
                restoreFile.click(); 
            }
        });
    }
    
    const restoreFileInp = document.getElementById("restoreFile");
    if (restoreFileInp) {
        restoreFileInp.addEventListener("change", (event) => {
            const file = event.target.files[0]; 
            if (!file) {
                return; 
            }
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result); 
                    await DBManager.clear("metadata"); 
                    await DBManager.clear("vaultItems");
                    
                    for (const m of data.metadata) {
                        await DBManager.save("metadata", m); 
                    }
                    for (const i of data.vaultItems) {
                        await DBManager.save("vaultItems", i);
                    }
                    
                    alert("Yedek başarıyla yüklendi. Lütfen tekrar giriş yapın."); 
                    lockVault();
                } catch(err) { 
                    alert("Yedek dosyası okunurken hata oluştu!"); 
                }
            }; 
            reader.readAsText(file);
        });
    }
    
    const clearDbBtn = document.getElementById("clearDbBtn");
    if (clearDbBtn) {
        clearDbBtn.addEventListener("click", () => { 
            const dropdownMenu = document.getElementById("dropdownMenu");
            if (dropdownMenu) {
                dropdownMenu.classList.add("hidden"); 
            }
            
            const passInp = document.getElementById("clearDbPassword");
            if (passInp) {
                passInp.value = ""; 
            }
            
            const clearDbModal = document.getElementById("clearDbModal");
            if (clearDbModal) {
                clearDbModal.classList.remove("hidden"); 
            }
        });
    }
    
    const confirmClearDbBtn = document.getElementById("confirmClearDbBtn");
    if (confirmClearDbBtn) {
        confirmClearDbBtn.addEventListener("click", async () => {
            const passInp = document.getElementById("clearDbPassword");
            const pwd = passInp ? passInp.value : ""; 
            
            if (!pwd) {
                return;
            }
            
            try {
                let metadataList = await DBManager.getAll("metadata"); 
                let masterSaltData = metadataList.find(m => m.id === "master_salt");
                let verifierData = metadataList.find(m => m.id === "login_verifier");
                
                if (masterSaltData) {
                    const salt = new Uint8Array(masterSaltData.salt); 
                    const testKey = await CryptoManager.deriveKey(pwd, salt);
                    
                    if (verifierData) {
                        try { 
                            await CryptoManager.decryptData(testKey, { 
                                ciphertext: verifierData.blob, 
                                iv: verifierData.iv 
                            }); 
                        } catch(e) { 
                            alert("Hatalı Master Şifre!"); 
                            return; 
                        }
                    } else {
                        const items = await DBManager.getAll("vaultItems");
                        if (items.length > 0) { 
                            try { 
                                await CryptoManager.decryptData(testKey, { 
                                    ciphertext: items[0].encryptedBlob, 
                                    iv: items[0].iv 
                                }); 
                            } catch(e) { 
                                alert("Hatalı Master Şifre!"); 
                                return; 
                            } 
                        }
                    }
                }
                
                await DBManager.clear("metadata"); 
                await DBManager.clear("vaultItems"); 
                localStorage.clear();
                
                const clearDbModal = document.getElementById("clearDbModal");
                if (clearDbModal) {
                    clearDbModal.classList.add("hidden"); 
                }
                
                alert("Kasa başarıyla sıfırlandı!"); 
                lockVault();
                
            } catch (e) { 
                alert("İşlem sırasında hata oluştu!"); 
            }
        });
    }

    window.showScreen = function(screenName, skipHistory = false) {
        if (!screens[screenName]) {
            return;
        }
        
        Object.values(screens).forEach(s => { 
            if (s) {
                s.classList.add("hidden"); 
            }
        }); 
        
        screens[screenName].classList.remove("hidden");
        
        const dropdownMenu = document.getElementById("dropdownMenu");
        if (dropdownMenu) {
            dropdownMenu.classList.add("hidden"); 
        }
        
        if (screenName !== 'login' && screens.bottomBar) {
            screens.bottomBar.classList.remove("hidden");
        }
        
        if (screenName === 'dashboard') { 
            const srch = document.getElementById("searchInput");
            if (srch) {
                srch.value = ""; 
            }
            updateDashboardCounts(); 
            AppState.currentCategory = null; 
        }
        
        if (!skipHistory) {
            history.pushState({ screen: screenName, category: AppState.currentCategory }, "");
        }
    }
    
    window.addEventListener("popstate", async (e) => {
        const iType = document.getElementById("itemType");
        
        if (iType && iType.value === "note" && screens.add && !screens.add.classList.contains("hidden")) {
            await saveNoteFromDOM();
        }
        
        const sSheet = document.getElementById("settingsSheet");
        if (sSheet && sSheet.classList.contains("show")) { 
            const closeBtn = document.getElementById("closeSettingsBtn");
            if (closeBtn) {
                closeBtn.click(); 
            }
            return; 
        } 
        
        if (e.state && e.state.screen) {
            AppState.currentCategory = e.state.category;
            
            if (e.state.screen === 'list') { 
                const lTitle = document.getElementById("listTitle");
                if (lTitle) {
                    lTitle.textContent = AppState.currentCategory || "Tümü"; 
                }
                renderList(); 
            } else if (e.state.screen === 'dashboard') {
                updateDashboardCounts();
            }
            
            showScreen(e.state.screen, true); 
        } else {
            showScreen('dashboard', true);
        }
    });
    
    window.goHome = async function() {
        const iType = document.getElementById("itemType");
        
        if (iType && iType.value === "note") {
            await saveNoteFromDOM();
        }
        
        if (history.state) {
            history.back(); 
        } else {
            showScreen('dashboard');
        }
    }
    
    window.showCategory = function(catName) {
        AppState.currentCategory = catName; 
        
        const lTitle = document.getElementById("listTitle");
        if (lTitle) {
            lTitle.textContent = catName; 
        }
        
        const srch = document.getElementById("searchInput");
        if (srch) {
            srch.value = "";
        }
        
        const addBtn = screens.bottomBar?.querySelector('.add-btn');
        if (addBtn) { 
            addBtn.style.color = (catName === "Notlar") ? "var(--yellow)" : "var(--blue)"; 
        }
        
        renderList(); 
        showScreen('list');
    }

    function updateDashboardCounts() {
        const cTumu = document.getElementById("count-tumu"); 
        if (cTumu) {
            cTumu.textContent = AppState.decryptedItems.filter(i => i.type === 'password').length;
        }
        
        const cWifi = document.getElementById("count-wifi"); 
        if (cWifi) {
            cWifi.textContent = AppState.decryptedItems.filter(i => i.type === 'wifi').length;
        }
        
        const cBanka = document.getElementById("count-banka"); 
        if (cBanka) {
            cBanka.textContent = AppState.decryptedItems.filter(i => i.type === 'bank').length;
        }
        
        const cNotlar = document.getElementById("count-notlar"); 
        if (cNotlar) {
            cNotlar.textContent = AppState.decryptedItems.filter(i => i.type === 'note').length;
        }
    }
    
    const searchInputEl = document.getElementById("searchInput");
    if (searchInputEl) {
        searchInputEl.addEventListener("input", (e) => {
            resetInactivityTimer(); 
            const term = e.target.value.toLowerCase();
            
            if (screens.dashboard && !screens.dashboard.classList.contains("hidden") && term.length > 0) { 
                AppState.currentCategory = "Tüm Kayıtlar"; 
                const lTitle = document.getElementById("listTitle");
                if (lTitle) {
                    lTitle.textContent = "Arama Sonuçları"; 
                }
                showScreen('list'); 
            }
            renderList(term);
        });
    }

    function getSiteIconHTML(title) {
        const match = title.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) {
            return `<img src="https://www.google.com/s2/favicons?domain=${match[0]}&sz=64" class="site-icon" onerror="this.outerHTML='<div class=\\'site-icon\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:16px;\\'>🔑</div>'">`;
        }
        return `<div class="site-icon" style="display:flex;align-items:center;justify-content:center;font-size:16px;">🔑</div>`;
    }

    function renderList(searchTerm = "") {
        const container = document.getElementById("vaultList"); 
        if (!container) {
            return;
        }
        
        container.innerHTML = "";
        let filtered = AppState.decryptedItems;
        
        if (AppState.currentCategory === "Tümü") {
            filtered = filtered.filter(i => i.type === 'password');
        } else if (AppState.currentCategory === "Wi-Fi") {
            filtered = filtered.filter(i => i.type === 'wifi');
        } else if (AppState.currentCategory === "Banka") {
            filtered = filtered.filter(i => i.type === 'bank');
        } else if (AppState.currentCategory === "Notlar") {
            filtered = filtered.filter(i => i.type === 'note');
        }

        if (searchTerm) {
            filtered = filtered.filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm));
        }
        
        if (filtered.length === 0) { 
            container.innerHTML = "<p style='color: var(--subtext); text-align: center;'>Kayıt bulunamadı.</p>"; 
            return; 
        }

        filtered.forEach(item => {
            const div = document.createElement("div");
            
            if (item.type === 'note') {
                div.className = "note-item"; 
                const d = new Date(item.timestamp); 
                const shortTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                const contentSnippet = item.content ? item.content.replace(/\n/g, " ").substring(0, 40) : "Ek metin yok";
                div.innerHTML = `
                    <div class="note-item-title">${item.title || "Yeni Not"}</div>
                    <div class="note-item-desc">${shortTime} ${contentSnippet}</div>
                `;
            } else {
                div.className = "list-item";
                div.style.cursor = "pointer"; // Tıklanabilir olduğunu belli et
                
                if (item.type === 'password') {
                    div.innerHTML = `
                        <div class="list-header">${getSiteIconHTML(item.title)}<h4>${item.title}</h4></div>
                        <span class="copyable" onclick="copyText('${item.username}')">Kullanıcı: <b>${item.username}</b></span>
                        <span class="copyable" onclick="copyText('${item.password}')">Şifre: <b>${item.password}</b></span>
                    `;
                } else if (item.type === 'wifi') {
                    div.innerHTML = `
                        <div class="list-header">
                            <div class="site-icon" style="display:flex;align-items:center;justify-content:center;font-size:16px;">📶</div>
                            <h4>${item.title}</h4>
                        </div>
                        <span class="copyable" onclick="copyText('${item.password}')">Parola: <b>${item.password}</b></span>
                    `;
                } else if (item.type === 'bank') {
                    div.innerHTML = `
                        <div class="list-header">
                            <div class="site-icon" style="display:flex;align-items:center;justify-content:center;font-size:16px;">💳</div>
                            <h4>${item.title}</h4>
                        </div>
                        <span class="copyable" onclick="copyText('${item.accountNo}')">Hesap No: <b>${item.accountNo}</b></span>
                        <span class="copyable" onclick="copyText('${item.iban}')">IBAN: <b>${item.iban}</b></span>
                        ${item.desc ? `<div style="color:var(--subtext); font-size:14px; margin-top:5px;">${item.desc}</div>` : ''}
                    `;
                }
            }

            // Kopya butonlarına (span) tıklanmadığı sürece DÜZENLE ekranını aç!
            div.onclick = (e) => {
                if (!e.target.closest('.copyable')) {
                    openItemEditor(item);
                }
            };

            container.appendChild(div);
        });
    }

    // --- TÜM ÖĞELER İÇİN DÜZENLEME VE SİLME FONKSİYONU ---
    window.openItemEditor = function(item) {
        AppState.currentNoteId = item.id; 
        AppState.noteTimestamp = item.timestamp;
        AppState.isDeletingProcess = false; 
        
        const iType = document.getElementById("itemType");
        if (iType) { 
            iType.value = item.type; 
            iType.style.display = item.type === "note" ? "none" : "block"; 
        }
        
        const aTitle = document.getElementById("addTitle");
        if (aTitle) {
            aTitle.textContent = "Düzenle";
        }
        
        // Formu seçilen tipe göre oluştur
        changeAddForm(); 
        
        // Verileri Formun İçine Doldur
        const fTitle = document.getElementById("f_title"); 
        if (fTitle) fTitle.value = item.title; 
        
        if (item.type === 'password') {
            const fUser = document.getElementById("f_user"); if (fUser) fUser.value = item.username || "";
            const fPass = document.getElementById("f_pass"); if (fPass) fPass.value = item.password || "";
            updateStrengthBar(item.password || "", "addStrengthBar");
        } else if (item.type === 'wifi') {
            const fPass = document.getElementById("f_pass"); if (fPass) fPass.value = item.password || "";
        } else if (item.type === 'bank') {
            const fAcc = document.getElementById("f_account"); if (fAcc) fAcc.value = item.accountNo || "";
            const fIban = document.getElementById("f_iban"); if (fIban) fIban.value = item.iban || "";
            const fDesc = document.getElementById("f_desc"); if (fDesc) fDesc.value = item.desc || "";
        } else if (item.type === 'note') {
            const nContent = document.getElementById("noteContent"); if (nContent) nContent.value = item.content || ""; 
        }
        
        // Silme Butonunu Göster ve İşlevini Bağla
        const deleteBtn = document.getElementById("deleteVaultItemBtn");
        if (deleteBtn) {
            deleteBtn.classList.remove("hidden");
            deleteBtn.onclick = async () => {
                if (confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) {
                    AppState.isDeletingProcess = true; 
                    await DBManager.delete("vaultItems", item.id);
                    await window.reloadVaultData();
                    goHome();
                }
            };
        }
        
        showScreen('add');
    }

    window.copyText = function(text) { 
        navigator.clipboard.writeText(text).then(() => { 
            const toast = document.getElementById("toast"); 
            if (toast) { 
                toast.style.opacity = "1"; 
                setTimeout(() => { 
                    toast.style.opacity = "0"; 
                }, 1500); 
            }
            resetInactivityTimer(); 
        }); 
    }

    const addNewBtn = document.getElementById("addNewBtn");
    if (addNewBtn) {
        addNewBtn.addEventListener("click", () => {
            AppState.currentNoteId = null; 
            AppState.noteTimestamp = null; 
            
            let defaultType = "password";
            if (AppState.currentCategory === "Wi-Fi") defaultType = "wifi"; 
            if (AppState.currentCategory === "Banka") defaultType = "bank"; 
            if (AppState.currentCategory === "Notlar") defaultType = "note";
            
            const iType = document.getElementById("itemType");
            if (iType) { 
                iType.value = defaultType; 
                iType.style.display = defaultType === "note" ? "none" : "block"; 
            }
            
            const aTitle = document.getElementById("addTitle");
            if (aTitle) {
                aTitle.textContent = defaultType === "note" ? "Notlar" : "Yeni Ekle";
            }
            
            const deleteBtn = document.getElementById("deleteVaultItemBtn");
            if (deleteBtn) {
                deleteBtn.classList.add("hidden");
            }
            
            changeAddForm(); 
            showScreen('add');
        });
    }

    window.changeAddForm = function() {
        const iType = document.getElementById("itemType");
        const type = iType ? iType.value : "password"; 
        
        const container = document.getElementById("formContainer"); 
        if (!container) {
            return;
        }
        
        const saveBtn = document.getElementById("saveItemBtn");
        if (saveBtn) {
            saveBtn.classList.remove("hidden"); 
        }
        
        if (type === 'password') {
            container.innerHTML = `
                <input type="text" id="f_title" placeholder="Site (örn: google.com)">
                <input type="text" id="f_user" placeholder="Kullanıcı Adı / E-posta">
                <div style="display:flex; gap:10px; margin-bottom:0;">
                    <input type="text" id="f_pass" placeholder="Şifre" style="flex:1; margin-bottom:0;">
                    <button class="btn" onclick="generatePass()" style="width: auto; padding: 0 15px; background:var(--card); color:var(--blue); margin-bottom:0;">Üret</button>
                </div>
                <div class="strength-container" style="margin-top:5px; margin-bottom:15px;">
                    <div id="addStrengthBar" class="strength-bar"></div>
                </div>
            `;
            const fPass = document.getElementById("f_pass");
            if (fPass) {
                fPass.addEventListener("input", (e) => { 
                    updateStrengthBar(e.target.value, "addStrengthBar"); 
                });
            }
        } else if (type === 'wifi') { 
            container.innerHTML = `
                <input type="text" id="f_title" placeholder="Wi-Fi Adı">
                <input type="text" id="f_pass" placeholder="Wi-Fi Parolası">
            `;
        } else if (type === 'bank') { 
            container.innerHTML = `
                <input type="text" id="f_title" placeholder="Banka Adı">
                <input type="text" id="f_account" placeholder="Hesap No">
                <input type="text" id="f_iban" placeholder="IBAN No">
                <textarea id="f_desc" placeholder="Açıklama"></textarea>
            `;
        } else if (type === 'note') {
            const d = AppState.noteTimestamp ? new Date(AppState.noteTimestamp) : new Date(); 
            const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            
            container.innerHTML = `
                <div class="note-editor-date">${dateStr}</div>
                <input type="text" id="f_title" class="note-editor-title" placeholder="Başlık">
                <textarea id="noteContent" class="note-editor-content" placeholder="Bir şeyler yaz..."></textarea>
            `;
            if (saveBtn) {
                saveBtn.classList.add("hidden"); 
            }
        }
    }

    window.generatePass = function() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"; 
        let pass = ""; 
        for (let i = 0; i < 16; i++) { 
            pass += chars.charAt(Math.floor(Math.random() * chars.length)); 
        }
        
        const fPass = document.getElementById("f_pass");
        if (fPass) { 
            fPass.value = pass; 
            updateStrengthBar(pass, "addStrengthBar"); 
        }
    }

    const saveItemBtn = document.getElementById("saveItemBtn");
    if (saveItemBtn) {
        saveItemBtn.addEventListener("click", async () => { 
            const success = await processSave();
            if (success) {
                goHome(); 
            }
        });
    }

    async function processSave(specificData = null) {
        if (!AppState.encryptionKey) {
            return false; 
        }
        
        let plainData = specificData;
        
        if (!plainData) {
            const iType = document.getElementById("itemType");
            const type = iType ? iType.value : "password"; 
            
            const fTitle = document.getElementById("f_title");
            plainData = { 
                type: type, 
                title: fTitle ? fTitle.value : "İsimsiz" 
            };
            
            if (!plainData.title) { 
                alert("Ad/Başlık zorunludur!"); 
                return false; 
            }
            
            if (type === 'password') { 
                const fUser = document.getElementById("f_user"); 
                const fPass = document.getElementById("f_pass");
                plainData.username = fUser ? fUser.value : ""; 
                plainData.password = fPass ? fPass.value : ""; 
            } else if (type === 'wifi') { 
                const fPass = document.getElementById("f_pass"); 
                plainData.password = fPass ? fPass.value : ""; 
            } else if (type === 'bank') { 
                const fAcc = document.getElementById("f_account"); 
                const fIban = document.getElementById("f_iban"); 
                const fDesc = document.getElementById("f_desc");
                plainData.accountNo = fAcc ? fAcc.value : ""; 
                plainData.iban = fIban ? fIban.value : ""; 
                plainData.desc = fDesc ? fDesc.value : ""; 
            } else if (type === 'note') { 
                const nContent = document.getElementById("noteContent"); 
                plainData.content = nContent ? nContent.value : ""; 
            }
        }
        
        const idToSave = AppState.currentNoteId || crypto.randomUUID(); 
        const nowIso = new Date().toISOString();
        
        try {
            const encResult = await CryptoManager.encryptData(AppState.encryptionKey, plainData);
            
            await DBManager.save("vaultItems", { 
                id: idToSave, 
                encryptedBlob: encResult.ciphertext, 
                iv: encResult.iv, 
                createdAt: specificData && AppState.noteTimestamp ? AppState.noteTimestamp : nowIso, 
                updatedAt: nowIso 
            });
            
            await loadAllAndDecryptToRAM(); 
            return true;
        } catch (error) { 
            return false; 
        }
    }

    // --- TÜM ÖĞELER İÇİN DÜZENLEME VE SİLME FONKSİYONU ---
    window.openItemEditor = function(item) {
        AppState.currentNoteId = item.id; 
        AppState.noteTimestamp = item.timestamp;
        AppState.isDeletingProcess = false; 
        
        const iType = document.getElementById("itemType");
        if (iType) { 
            iType.value = item.type; 
            iType.style.display = item.type === "note" ? "none" : "block"; 
        }
        
        const aTitle = document.getElementById("addTitle");
        if (aTitle) {
            aTitle.textContent = "Düzenle";
        }
        
        // Formu seçilen tipe göre oluştur
        changeAddForm(); 
        
        // Verileri Formun İçine Doldur
        const fTitle = document.getElementById("f_title"); 
        if (fTitle) fTitle.value = item.title; 
        
        if (item.type === 'password') {
            const fUser = document.getElementById("f_user"); if (fUser) fUser.value = item.username || "";
            const fPass = document.getElementById("f_pass"); if (fPass) fPass.value = item.password || "";
            updateStrengthBar(item.password || "", "addStrengthBar");
        } else if (item.type === 'wifi') {
            const fPass = document.getElementById("f_pass"); if (fPass) fPass.value = item.password || "";
        } else if (item.type === 'bank') {
            const fAcc = document.getElementById("f_account"); if (fAcc) fAcc.value = item.accountNo || "";
            const fIban = document.getElementById("f_iban"); if (fIban) fIban.value = item.iban || "";
            const fDesc = document.getElementById("f_desc"); if (fDesc) fDesc.value = item.desc || "";
        } else if (item.type === 'note') {
            const nContent = document.getElementById("noteContent"); if (nContent) nContent.value = item.content || ""; 
        }
        
        // Silme Butonunu Göster ve İşlevini Bağla
        const deleteBtn = document.getElementById("deleteVaultItemBtn");
        if (deleteBtn) {
            deleteBtn.classList.remove("hidden");
            deleteBtn.onclick = async () => {
                if (confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) {
                    AppState.isDeletingProcess = true; 
                    await DBManager.delete("vaultItems", item.id);
                    await window.reloadVaultData();
                    goHome();
                }
            };
        }
        
        showScreen('add');
    }

    // --- NOTLARI OTOMATİK KAYDETME FONKSİYONU ---
    window.saveNoteFromDOM = async function() {
        if (AppState.isDeletingProcess) {
            return; 
        }
        
        const iType = document.getElementById("itemType");
        if (iType && iType.value !== "note") {
            return;
        }
        
        const titleInput = document.getElementById("f_title"); 
        const contentInput = document.getElementById("noteContent"); 
        
        if (!titleInput || !contentInput) {
            return; 
        }
        
        const title = titleInput.value; 
        const content = contentInput.value;
        
        if (title.trim() !== "" || content.trim() !== "") { 
            await processSave({ 
                type: 'note', 
                title: title || "İsimsiz Not", 
                content: content 
            }); 
            
            titleInput.value = ""; 
            contentInput.value = ""; 
        }
        
        AppState.currentNoteId = null; 
        AppState.noteTimestamp = null;
    }

    window.saveNoteFromDOM = async function() {
        if (AppState.isDeletingProcess) {
            return; 
        }
        
        const iType = document.getElementById("itemType");
        if (iType && iType.value !== "note") {
            return;
        }
        
        const titleInput = document.getElementById("f_title"); 
        const contentInput = document.getElementById("noteContent"); 
        
        if (!titleInput || !contentInput) {
            return; 
        }
        
        const title = titleInput.value; 
        const content = contentInput.value;
        
        if (title.trim() !== "" || content.trim() !== "") { 
            await processSave({ 
                type: 'note', 
                title: title || "İsimsiz Not", 
                content: content 
            }); 
            
            titleInput.value = ""; 
            contentInput.value = ""; 
        }
        
        AppState.currentNoteId = null; 
        AppState.noteTimestamp = null;
    }
    
    checkSetupStatus();
});