const CalendarApp = {
    currentDate: new Date(),
    selectedDate: new Date(),
    calItems: [],
    editingItemId: null,
    alarmCheckerId: null,

    init() {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
        
        // Alarm Gün Seçici Butonlarının Tıklama Mantığı
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                this.classList.toggle('active');
            });
        });

        this.startAlarmChecker();
    },

    loadItems() {
        if (typeof AppState !== 'undefined' && AppState.decryptedItems) {
            this.calItems = AppState.decryptedItems.filter(i => i.type === 'calendar');
            const calCountEl = document.getElementById('count-takvim');
            if (calCountEl) calCountEl.textContent = this.calItems.length;
            
            const yearView = document.getElementById("calYearView");
            const weekView = document.getElementById("calWeekView");
            const listView = document.getElementById("calListView");
            
            // Elemanlar DOM'da gerçekten varsa işlem yap (Çökme Koruması)
            if (yearView && !yearView.classList.contains("hidden")) this.renderYear();
            else if (weekView && !weekView.classList.contains("hidden")) this.renderWeek();
            else if (listView && !listView.classList.contains("hidden")) this.renderAllList();
            else this.renderMonth();
        }
    },

    openCalendarScreen() {
        try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch(e){}
        window.showScreen('calendarSection');
        this.switchView('month');
    },

    switchView(view) {
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        document.getElementById("calYearView").classList.add("hidden");
        document.getElementById("calMonthView").classList.add("hidden");
        document.getElementById("calWeekView").classList.add("hidden");
        document.getElementById("calListView").classList.add("hidden");

        if (view === 'year') {
            document.getElementById("calTabYear").classList.add("active");
            document.getElementById("calYearView").classList.remove("hidden");
            this.renderYear();
        } else if (view === 'month') {
            document.getElementById("calTabMonth").classList.add("active");
            document.getElementById("calMonthView").classList.remove("hidden");
            this.renderMonth();
        } else if (view === 'week') {
            document.getElementById("calTabWeek").classList.add("active");
            document.getElementById("calWeekView").classList.remove("hidden");
            this.renderWeek();
        } else {
            document.getElementById("calTabList").classList.add("active");
            document.getElementById("calListView").classList.remove("hidden");
            this.renderAllList();
        }
    },

    changeYear(dir) { this.currentDate.setFullYear(this.currentDate.getFullYear() + dir); this.renderYear(); },
    changeMonth(dir) { this.currentDate.setMonth(this.currentDate.getMonth() + dir); this.renderMonth(); },
    changeWeek(dir) { this.currentDate.setDate(this.currentDate.getDate() + (dir * 7)); this.renderWeek(); },

    // Sadece "Etkinlik" ve "Anımsatıcılar" takvimde gün işaretler, Alarmlar işaretlemez
    hasEventOnDate(year, month, day) {
        const targetDate = new Date(year, month, day).toDateString();
        return this.calItems.some(item => {
            if (item.calType === 'alarm') return false; 
            return new Date(item.start).toDateString() === targetDate;
        });
    },

    selectDateAndAdd(year, month, day) {
        this.selectedDate = new Date(year, month, day);
        this.currentDate = new Date(year, month, day); 
        
        if (!document.getElementById("calMonthView").classList.contains("hidden")) this.renderMonth();
        if (!document.getElementById("calWeekView").classList.contains("hidden")) this.renderWeek();
        
        this.openAddChoice();
    },

    // --- TAKVİM RENDER (Görsel İşlemler) ---
    renderYear() {
        const year = this.currentDate.getFullYear();
        document.getElementById("calYearTitle").textContent = year;
        const grid = document.getElementById("yearGrid");
        grid.innerHTML = "";
        const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
        
        for(let m = 0; m < 12; m++) {
            let html = `<div style="font-size:11px; text-align:center; background:var(--card); padding:10px; border-radius:10px;"><div style="font-weight:bold; color:var(--red); margin-bottom:8px; font-size:14px;">${monthNames[m]}</div><div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">`;
            html += `<div style="color:var(--subtext)">Pt</div><div style="color:var(--subtext)">Sl</div><div style="color:var(--subtext)">Çr</div><div style="color:var(--subtext)">Pr</div><div style="color:var(--subtext)">Cm</div><div style="color:var(--subtext)">Ct</div><div style="color:var(--subtext)">Pz</div>`;

            const firstDay = new Date(year, m, 1).getDay();
            const daysInMonth = new Date(year, m+1, 0).getDate();
            let startOffset = firstDay === 0 ? 6 : firstDay - 1; 
            
            for(let i=0; i<startOffset; i++) html += `<div></div>`;
            
            for(let d=1; d<=daysInMonth; d++) {
                const hasEvt = this.hasEventOnDate(year, m, d);
                let bg = hasEvt ? "border: 1.5px solid var(--red); color: var(--text); border-radius: 50%; font-weight: bold; box-sizing: border-box;" : "border: 1.5px solid transparent; color: var(--text); box-sizing: border-box;";
                html += `<div style="padding:4px 0; cursor:pointer; ${bg}" onclick="CalendarApp.selectDateAndAdd(${year}, ${m}, ${d})">${d}</div>`;
            }
            html += `</div></div>`;
            grid.innerHTML += html;
        }
    },

    renderMonth() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        document.getElementById("calMonthYearTitle").textContent = `${monthNames[month]} ${year}`;

        let startOffset = firstDay === 0 ? 6 : firstDay - 1; 
        const grid = document.getElementById("monthGrid");
        if (!grid) return;

        grid.innerHTML = `<div class="cal-day-header">Pzt</div><div class="cal-day-header">Sal</div><div class="cal-day-header">Çar</div><div class="cal-day-header">Per</div><div class="cal-day-header">Cum</div><div class="cal-day-header">Cmt</div><div class="cal-day-header">Paz</div>`;

        for (let i = 0; i < startOffset; i++) grid.innerHTML += `<div class="cal-day other-month"></div>`;

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === this.selectedDate.getDate() && month === this.selectedDate.getMonth() && year === this.selectedDate.getFullYear();
            const hasEvt = this.hasEventOnDate(year, month, day);

            let classes = "cal-day";
            if(isToday) classes += " today";
            if(isSelected) classes += " active";

            let dotHtml = hasEvt ? `<div class="event-dot has-event"></div>` : `<div class="event-dot"></div>`;
            grid.innerHTML += `<div class="${classes}" onclick="CalendarApp.selectDateAndAdd(${year}, ${month}, ${day})">${day}${dotHtml}</div>`;
        }
        this.renderSelectedDayList("calItemsContainer", "calSelectedDateTitle");
    },

    renderWeek() {
        const d = new Date(this.currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const startOfWeek = new Date(d.setDate(diff));
        
        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        document.getElementById("calWeekTitle").textContent = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]}`;
        
        const grid = document.getElementById("weekGrid");
        grid.innerHTML = `<div class="cal-day-header">Pzt</div><div class="cal-day-header">Sal</div><div class="cal-day-header">Çar</div><div class="cal-day-header">Per</div><div class="cal-day-header">Cum</div><div class="cal-day-header">Cmt</div><div class="cal-day-header">Paz</div>`;
        
        const today = new Date();
        
        for(let i=0; i<7; i++) {
            const cur = new Date(startOfWeek);
            cur.setDate(cur.getDate() + i);
            const cYear = cur.getFullYear(); const cMonth = cur.getMonth(); const cDay = cur.getDate();
            
            const isToday = cDay === today.getDate() && cMonth === today.getMonth() && cYear === today.getFullYear();
            const isSelected = cDay === this.selectedDate.getDate() && cMonth === this.selectedDate.getMonth() && cYear === this.selectedDate.getFullYear();
            const hasEvt = this.hasEventOnDate(cYear, cMonth, cDay);
            
            let classes = "cal-day";
            if(isToday) classes += " today";
            if(isSelected) classes += " active";
            let dotHtml = hasEvt ? `<div class="event-dot has-event"></div>` : `<div class="event-dot"></div>`;
            
            grid.innerHTML += `<div class="${classes}" onclick="CalendarApp.selectDateAndAdd(${cYear}, ${cMonth}, ${cDay})">${cDay}${dotHtml}</div>`;
        }
        this.renderSelectedDayList("calWeekItemsContainer", "calWeekSelectedDateTitle");
    },

    formatTime(dateStr) {
        const d = new Date(dateStr);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    },

    // Sıralama Kriteri (Alarmlar saattir, etkinlikler ISO date)
    getSortTime(item) {
        if(item.calType === 'alarm') return item.time;
        const d = new Date(item.start);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    },

    renderSelectedDayList(containerId, titleId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = "";
        const targetDate = this.selectedDate.toDateString();
        const currentDOW = this.selectedDate.getDay().toString(); // 0-6 string
        document.getElementById(titleId).textContent = `${this.selectedDate.getDate()} ${this.selectedDate.toLocaleString('tr-TR', {month:'long'})}`;

        // Hem o günkü etkinlikleri hem de o gün çalan alarmları topla
        const dayItems = this.calItems.filter(item => {
            if(item.calType === 'alarm') return item.days.includes(currentDOW);
            return new Date(item.start).toDateString() === targetDate;
        }).sort((a,b) => this.getSortTime(a).localeCompare(this.getSortTime(b)));

        if (dayItems.length === 0) {
            container.innerHTML = "<p style='color: var(--subtext); margin-top: 10px;'>Bugün için kayıt yok</p>";
            return;
        }

        dayItems.forEach(item => {
            const timeStr = item.calType === 'alarm' ? item.time : this.formatTime(item.start);
            let className = "cal-item";
            let typeStr = "Etkinlik";
            
            if (item.calType === 'reminder') { className += " reminder-type"; typeStr = "Anımsatıcı"; }
            else if (item.calType === 'alarm') { className += " alarm-type"; typeStr = "Alarm"; }
            
            container.innerHTML += `
                <div class="${className}" onclick="CalendarApp.editItem('${item.id}')">
                    <div style="font-size:12px; color:var(--subtext); margin-bottom:5px;">${timeStr} - ${typeStr}</div>
                    <div style="font-weight:bold; font-size:16px;">${item.title || item.label}</div>
                    ${item.note ? `<div style="font-size:13px; color:var(--subtext); margin-top:5px;">${item.note}</div>` : ''}
                </div>
            `;
        });
    },

    renderAllList() {
        const container = document.getElementById("calAllItemsContainer");
        if (!container) return;
        
        container.innerHTML = "";
        const sortedItems = [...this.calItems].sort((a,b) => {
            // Alarmları daima en üste veya zamana göre koyalım
            let tA = a.calType === 'alarm' ? `0000-${a.time}` : new Date(a.start).toISOString();
            let tB = b.calType === 'alarm' ? `0000-${b.time}` : new Date(b.start).toISOString();
            return tA.localeCompare(tB);
        });

        if (sortedItems.length === 0) {
            container.innerHTML = "<p style='color: var(--subtext); text-align:center; margin-top:30px;'>Kayıtlı veri yok.</p>";
            return;
        }

        sortedItems.forEach(item => {
            let dateStr = "";
            let className = "cal-item";
            let typeStr = "Etkinlik";

            if (item.calType === 'alarm') {
                className += " alarm-type"; typeStr = "Alarm";
                const dMap = {"1":"Pt","2":"Sl","3":"Ça","4":"Pe","5":"Cu","6":"Ct","0":"Pz"};
                const daysStr = item.days.length === 7 ? "Her Gün" : item.days.map(d=>dMap[d]).join(', ');
                dateStr = `${daysStr} | ${item.time}`;
            } else {
                if (item.calType === 'reminder') { className += " reminder-type"; typeStr = "Anımsatıcı"; }
                const d = new Date(item.start);
                dateStr = `${d.getDate()} ${d.toLocaleString('tr-TR', {month:'short', year:'numeric'})} - ${this.formatTime(item.start)}`;
            }
            
            container.innerHTML += `
                <div class="${className}" onclick="CalendarApp.editItem('${item.id}')">
                    <div style="font-size:12px; color:var(--subtext); margin-bottom:5px;">${dateStr} | ${typeStr}</div>
                    <div style="font-weight:bold; font-size:16px;">${item.title || item.label}</div>
                </div>
            `;
        });
    },

    // --- FORM MANTIĞI VE SEÇİM ---
    openAddChoice() {
        document.getElementById("addChoiceSheetOverlay").classList.add("show");
        document.getElementById("addChoiceSheet").classList.add("show");
    },
    
    closeAddChoice() {
        document.getElementById("addChoiceSheetOverlay").classList.remove("show");
        document.getElementById("addChoiceSheet").classList.remove("show");
    },

    closeForms() {
        this.editingItemId = null;
        if (history.state) history.back(); 
        else window.showScreen("calendarSection");
    },

    toInputLocalFormat(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    setCalType(type) {
        document.getElementById("segEvent").classList.remove("active");
        document.getElementById("segReminder").classList.remove("active");
        if (type === 'event') document.getElementById("segEvent").classList.add("active");
        else document.getElementById("segReminder").classList.add("active");
    },

    initEventForm() {
        this.closeAddChoice();
        this.editingItemId = null;
        document.getElementById("calTitle").value = "";
        document.getElementById("calNote").value = "";
        document.getElementById("calRepeat").value = "none";
        document.getElementById("calAlert").value = "-1";
        document.getElementById("calSound").value = "sounds/alarm_1.mp3";
        this.setCalType('event');
        
        const startD = new Date(this.selectedDate); startD.setHours(new Date().getHours()); startD.setMinutes(0);
        const endD = new Date(startD); endD.setHours(startD.getHours() + 1);
        document.getElementById("calStart").value = this.toInputLocalFormat(startD);
        document.getElementById("calEnd").value = this.toInputLocalFormat(endD);
        document.getElementById("calDeleteBtn").classList.add("hidden");
        window.showScreen("addCalendarItemSection");
    },

    initAlarmForm() {
        this.closeAddChoice();
        this.editingItemId = null;
        
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        document.getElementById("alarmTime").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        document.getElementById("alarmLabel").value = "";
        document.getElementById("alarmSound").value = "sounds/alarm_1.mp3";
        document.getElementById("alarmSnoozeToggle").checked = true;
        document.getElementById("alarmSnoozeTimeBox").style.display = 'flex';
        document.getElementById("alarmSnoozeTime").value = "5";
        
        // Günleri temizle
        document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById("alarmDeleteBtn").classList.add("hidden");
        window.showScreen("addAlarmSection");
    },

    editItem(id) {
        const item = this.calItems.find(i => i.id === id);
        if(!item) return;

        this.editingItemId = id;

        if (item.calType === 'alarm') {
            document.getElementById("alarmTime").value = item.time;
            document.getElementById("alarmLabel").value = item.label;
            document.getElementById("alarmSound").value = item.sound || "sounds/alarm_1.mp3";
            
            document.querySelectorAll('.day-btn').forEach(btn => {
                if(item.days && item.days.includes(btn.dataset.day)) btn.classList.add('active');
                else btn.classList.remove('active');
            });

            document.getElementById("alarmSnoozeToggle").checked = item.snoozeEnabled;
            document.getElementById("alarmSnoozeTimeBox").style.display = item.snoozeEnabled ? 'flex' : 'none';
            document.getElementById("alarmSnoozeTime").value = item.snoozeTime || "5";
            
            document.getElementById("alarmDeleteBtn").classList.remove("hidden");
            window.showScreen("addAlarmSection");

        } else {
            this.setCalType(item.calType || 'event');
            document.getElementById("calTitle").value = item.title;
            document.getElementById("calStart").value = this.toInputLocalFormat(new Date(item.start));
            document.getElementById("calEnd").value = this.toInputLocalFormat(new Date(item.end));
            document.getElementById("calRepeat").value = item.repeat || "none";
            document.getElementById("calAlert").value = item.alert || "-1";
            document.getElementById("calSound").value = item.sound || "sounds/alarm_1.mp3";
            document.getElementById("calNote").value = item.note || "";
            
            document.getElementById("calDeleteBtn").classList.remove("hidden");
            window.showScreen("addCalendarItemSection");
        }
    },

    async saveEvent() {
        const title = document.getElementById("calTitle").value;
        if(!title) { alert("Başlık zorunludur!"); return; }

        const plainData = {
            type: "calendar",
            calType: document.getElementById("segEvent").classList.contains("active") ? "event" : "reminder",
            title: title,
            start: new Date(document.getElementById("calStart").value).toISOString(),
            end: new Date(document.getElementById("calEnd").value).toISOString(),
            repeat: document.getElementById("calRepeat").value,
            alert: document.getElementById("calAlert").value,
            sound: document.getElementById("calSound").value,
            note: document.getElementById("calNote").value,
            alertTriggered: false, 
            snoozeUntil: null 
        };
        await this._saveToDB(plainData);
    },

    async saveAlarm() {
        const timeVal = document.getElementById("alarmTime").value;
        if(!timeVal) { alert("Lütfen bir saat seçin."); return; }

        let selectedDays = [];
        document.querySelectorAll('.day-btn.active').forEach(btn => {
            selectedDays.push(btn.dataset.day);
        });
        if(selectedDays.length === 0) { alert("Lütfen alarmın çalacağı en az bir gün seçin!"); return; }

        const plainData = {
            type: "calendar",
            calType: "alarm",
            label: document.getElementById("alarmLabel").value || "Alarm",
            time: timeVal,
            days: selectedDays,
            sound: document.getElementById("alarmSound").value,
            snoozeEnabled: document.getElementById("alarmSnoozeToggle").checked,
            snoozeTime: parseInt(document.getElementById("alarmSnoozeTime").value),
            snoozeUntil: null,
            lastTriggeredDate: null
        };
        await this._saveToDB(plainData);
    },

    async _saveToDB(plainData) {
        const idToSave = this.editingItemId || crypto.randomUUID();
        const nowIso = new Date().toISOString();
        try {
            const encResult = await CryptoManager.encryptData(AppState.encryptionKey, plainData);
            await DBManager.save("vaultItems", { id: idToSave, encryptedBlob: encResult.ciphertext, iv: encResult.iv, createdAt: nowIso, updatedAt: nowIso });
            await window.reloadVaultData(); 
            this.closeForms();
        } catch (e) { alert("Kaydedilirken hata oluştu!"); }
    },

    async deleteItem() {
        if(!this.editingItemId) return;
        if(confirm("Silmek istediğinize emin misiniz?")) {
            await DBManager.delete("vaultItems", this.editingItemId); 
            await window.reloadVaultData();
            this.closeForms();
        }
    },

    // --- 6. SES DİNLEME VE ALARM MOTORU ---
    currentAudio: null, // Çalan sesi hafızada tutmak için eklendi
    audioTimeout: null, // 35 saniyelik zamanlayıcı için eklendi

    previewSound(src) {
        if (!src || src === 'silent') return;
        try { 
            this.stopAudio(); // Eski çalan varsa sustur
            const audio = new Audio(src); 
            audio.play(); 
        } catch (e) { 
            console.error("Önizleme çalınamadı."); 
        }
    },

    playAudioFile(src) {
        if (!src || src === 'silent') return;
        try { 
            this.stopAudio(); // Üst üste binmemesi için öncekini sustur
            this.currentAudio = new Audio(src); 
            this.currentAudio.loop = true; // Alarmı DÖNGÜYE al (Sürekli çalsın)
            this.currentAudio.play(); 
            
            // 35 Saniye sonra alarmı otomatik sustur
            this.audioTimeout = setTimeout(() => {
                this.stopAudio();
            }, 35000);
        } catch(e) {}
    },

    stopAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        if (this.audioTimeout) {
            clearTimeout(this.audioTimeout);
            this.audioTimeout = null;
        }
    },

    showCustomAlert(item, callback) {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;";
        
        const box = document.createElement("div");
        box.style.cssText = "background:var(--card);padding:20px;border-radius:16px;text-align:center;width:100%;max-width:300px;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid #333;";
        
        const icon = item.calType === 'alarm' ? "⏰" : (item.calType === 'reminder' ? "🔔" : "📅");
        const title = item.title || item.label;
        const noteHtml = item.note ? `<p style="margin-bottom:20px;font-size:14px;color:var(--subtext);white-space:pre-wrap;">${item.note}</p>` : `<div style="height:15px;"></div>`;
        
        let snoozeBtnHtml = '';
        const canSnooze = item.calType !== 'alarm' || item.snoozeEnabled;
        if (canSnooze) {
            snoozeBtnHtml = `<button id="btnSnooze" style="background:var(--gray);color:white;border:none;padding:10px 15px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;flex:1;">Ertele</button>`;
        }
        
        box.innerHTML = `
            <div style="font-size:36px; margin-bottom:5px;">${icon}</div>
            <h3 style="margin:0 0 10px 0;color:white;font-size:18px;">${title}</h3>
            ${noteHtml}
            <div style="display:flex; gap:10px; justify-content:center;">
                ${snoozeBtnHtml}
                <button id="btnOk" style="background:var(--blue);color:white;border:none;padding:10px 15px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;flex:1;">Tamam</button>
            </div>
        `;
        
        if (canSnooze) {
            box.querySelector("#btnSnooze").onclick = () => { 
                CalendarApp.stopAudio(); // BUTONA BASILINCA SESİ KES
                document.body.removeChild(overlay); 
                callback('snooze'); 
            };
        }
        
        box.querySelector("#btnOk").onclick = () => { 
            CalendarApp.stopAudio(); // BUTONA BASILINCA SESİ KES
            document.body.removeChild(overlay); 
            callback('ok'); 
        };
        
        overlay.appendChild(box); 
        document.body.appendChild(overlay);
    },

    startAlarmChecker() {
        if (this.alarmCheckerId) clearInterval(this.alarmCheckerId);
        
        this.alarmCheckerId = setInterval(() => {
            if (!AppState.encryptionKey || !this.calItems || this.calItems.length === 0) return;
            
            const now = new Date();
            const todayStr = now.toDateString();
            const currentDOW = now.getDay().toString();
            const curTimeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

            this.calItems.forEach(async (item) => {
                let shouldTrigger = false;

                // 1. ERTELENMİŞ (SNOOZE) BİR ALARM/ETKİNLİK VARSA
                if (item.snoozeUntil) {
                    if (now >= new Date(item.snoozeUntil)) {
                        shouldTrigger = true;
                    }
                } 
                // 2. ALARM KONTROLÜ
                else if (item.calType === 'alarm') {
                    if (item.days.includes(currentDOW) && curTimeStr === item.time && item.lastTriggeredDate !== todayStr) {
                        shouldTrigger = true;
                    }
                }
                // 3. ETKİNLİK/ANIMSATICI KONTROLÜ
                else if (item.alert !== "-1" && !item.alertTriggered) {
                    const startDate = new Date(item.start);
                    const alertMins = parseInt(item.alert);
                    const alertTime = new Date(startDate.getTime() - (alertMins * 60000));
                    
                    if (now >= alertTime && (now.getTime() - alertTime.getTime() < 300000)) {
                        shouldTrigger = true;
                    }
                }

                if (shouldTrigger && !item.isModalOpen) {
                    item.isModalOpen = true; 

                    if (item.sound) this.playAudioFile(item.sound);
                    if (item.vibrate !== false && navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
                    
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification(item.calType === 'alarm' ? "⏰ Alarm" : "📅 Takvim", { body: item.title || item.label, icon: "logo-192.png" });
                    }

                    this.showCustomAlert(item, async (action) => {
                        item.isModalOpen = false;
                        let needsUpdate = false;
                        
                        if (action === 'snooze') {
                            const snoozeMins = item.calType === 'alarm' ? item.snoozeTime : 10;
                            item.snoozeUntil = new Date(now.getTime() + (snoozeMins * 60000)).toISOString();
                            if(item.calType !== 'alarm') item.alertTriggered = true; 
                            needsUpdate = true;
                        } 
                        else if (action === 'ok') {
                            item.snoozeUntil = null;
                            
                            if (item.calType === 'alarm') {
                                item.lastTriggeredDate = todayStr;
                                needsUpdate = true;
                            } else {
                                item.alertTriggered = true;
                                if (item.repeat && item.repeat !== 'none') {
                                    const s = new Date(item.start); const e = new Date(item.end);
                                    if (item.repeat === 'daily') { s.setDate(s.getDate()+1); e.setDate(e.getDate()+1); }
                                    else if (item.repeat === 'weekly') { s.setDate(s.getDate()+7); e.setDate(e.getDate()+7); }
                                    else if (item.repeat === 'biweekly') { s.setDate(s.getDate()+14); e.setDate(e.getDate()+14); }
                                    else if (item.repeat === 'monthly') { s.setMonth(s.getMonth()+1); e.setMonth(e.getMonth()+1); }
                                    else if (item.repeat === 'yearly') { s.setFullYear(s.getFullYear()+1); e.setFullYear(e.getFullYear()+1); }
                                    item.start = s.toISOString(); item.end = e.toISOString(); item.alertTriggered = false; 
                                }
                                needsUpdate = true;
                            }
                        }

                        if (needsUpdate) {
                            try {
                                const encResult = await CryptoManager.encryptData(AppState.encryptionKey, item);
                                await DBManager.save("vaultItems", { id: item.id, encryptedBlob: encResult.ciphertext, iv: encResult.iv, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
                                window.reloadVaultData(); 
                            } catch(e) {}
                        }
                    });
                }
            });
        }, 5000); 
    }
};