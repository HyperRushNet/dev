// HyperRushNet Library Core
// MIT License

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export class HyperRushNet {
    constructor(customConfig = {}) {
        this.CONFIG = {
            supabaseUrl: customConfig.supabaseUrl || "https://jnhsuniduzvhkpexorqk.supabase.co",
            supabaseKey: customConfig.supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaHN1bmlkdXp2aGtwZXhvcnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjAxMDYsImV4cCI6MjA4NzEzNjEwNn0.9I5bbqskCgksUaNWYlFFo0-6Odht28pOMdxTGZECahY",
            mailApi: customConfig.mailApi || "https://vercel-serverless-gray-sigma.vercel.app/api/mailAPI",
            maxMessages: customConfig.maxMessages || 15,
            historyLoadLimit: customConfig.historyLoadLimit || 10,
            rateLimitMs: customConfig.rateLimitMs || 1000,
            presenceHeartbeatMs: customConfig.presenceHeartbeatMs || 10000,
            verificationCodeExpiry: customConfig.verificationCodeExpiry || 600,
        };

        this.state = {
            user: null,
            currentRoomId: null,
            chatChannel: null,
            presenceChannel: null,
            isPresenceSubscribed: false,
            lastReconnectAttempt: 0,
            heartbeatInterval: null,
            sessionStartTime: null,
            processingAction: false,
            serverFull: false,
            isLoadingHistory: false,
            oldestMessageTimestamp: null,
            hasMoreHistory: true,
            lastMessageTime: 0,
            isChatChannelReady: false,
            currentRoomData: null,
            tempRegData: null, // Stores temporary registration data
        };

        this.listeners = {
            message: [], // (messageObj) => void
            presence: [], // (count) => void
            authChange: [], // (user) => void
            error: [], // (errorMessage) => void
        };

        this.db = createClient(this.CONFIG.supabaseUrl, this.CONFIG.supabaseKey, {
            auth: { persistSession: true, autoRefreshToken: true },
            realtime: { params: { eventsPerSecond: 10 } }
        });

        this._initCryptoWorker();
        this._monitorConnection();
    }

    // --- Event System ---
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    // --- Crypto Worker ---
    _initCryptoWorker() {
        const workerCode = `self.onmessage = async (e) => {
            const { type, payload } = e.data;
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            try {
                if (type === 'deriveKey') {
                    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(payload.password), { name: 'PBKDF2' }, false, ['deriveKey']);
                    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: encoder.encode(payload.salt), iterations: 300000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
                    self.cryptoKey = key;
                    self.postMessage({ type: 'keyDerived', success: true });
                } else if (type === 'encrypt') {
                    if (!self.cryptoKey) throw new Error("Key not derived");
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const encoded = encoder.encode(payload.text);
                    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, self.cryptoKey, encoded);
                    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
                    combined.set(iv, 0);
                    combined.set(new Uint8Array(ciphertext), iv.length);
                    const base64 = btoa(String.fromCharCode(...combined));
                    self.postMessage({ type: 'encrypted', result: base64 });
                } else if (type === 'decryptHistory') {
                    if (!self.cryptoKey) throw new Error("Key not derived");
                    const results = [];
                    for (const m of payload.messages) {
                        try {
                            const binary = atob(m.content);
                            const bytes = new Uint8Array(binary.length);
                            for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
                            const iv = bytes.slice(0, 12);
                            const ciphertext = bytes.slice(12);
                            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, self.cryptoKey, ciphertext);
                            const text = decoder.decode(decrypted);
                            const parts = text.split('|');
                            results.push({ id: m.id, time: parts[0], text: parts.slice(1).join('|'), user_id: m.user_id, user_name: m.user_name, created_at: m.created_at });
                        } catch (err) {
                            results.push({ id: m.id, error: true });
                        }
                    }
                    self.postMessage({ type: 'historyDecrypted', results });
                } else if (type === 'decryptSingle') {
                    if (!self.cryptoKey) throw new Error("Key not derived");
                    try {
                        const binary = atob(payload.content);
                        const bytes = new Uint8Array(binary.length);
                        for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        const iv = bytes.slice(0, 12);
                        const ciphertext = bytes.slice(12);
                        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, self.cryptoKey, ciphertext);
                        const text = decoder.decode(decrypted);
                        const parts = text.split('|');
                        self.postMessage({ type: 'singleDecrypted', result: { time: parts[0], text: parts.slice(1).join('|') } });
                    } catch(e) {
                        self.postMessage({ type: 'singleDecrypted', error: e.message });
                    }
                }
            } catch (error) {
                self.postMessage({ type: 'error', message: error.message });
            }
        };`;

        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        this.cryptoWorker = new Worker(URL.createObjectURL(workerBlob));
        this.pendingCallbacks = {};

        this.cryptoWorker.onmessage = (e) => {
            const { type } = e.data;
            if (this.pendingCallbacks[type]) {
                this.pendingCallbacks[type](e.data);
                delete this.pendingCallbacks[type];
            }
        };
    }

    _workerPost(type, payload, callbackType) {
        return new Promise((resolve, reject) => {
            this.pendingCallbacks[callbackType] = (data) => {
                if (data.error && !data.results) reject(data.message || data.error);
                else resolve(data);
            };
            this.cryptoWorker.postMessage({ type, payload });
        });
    }

    // --- Internal Helpers ---
    _generateSalt() {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }

    async _sha256(text) {
        const buffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    _safeAwait(promise) {
        return promise.then(data => [data, null]).catch(error => [null, error]);
    }

    _applyRateLimit() {
        const now = Date.now();
        if (now - this.state.lastMessageTime < this.CONFIG.rateLimitMs) {
            return false;
        }
        return true;
    }

    // --- Presence System ---
    async _initPresence(force = false) {
        if (!this.state.user) return;
        const now = Date.now();
        if (!force && (now - this.state.lastReconnectAttempt < 3000)) return;

        this.state.lastReconnectAttempt = now;
        if(this.state.presenceChannel) this.state.presenceChannel.unsubscribe();

        const myId = this.state.user.id;
        this.state.presenceChannel = this.db.channel('online-users', {
            config: { presence: { key: myId } }
        });

        this.state.presenceChannel
            .on('presence', { event: 'sync' }, () => {
                this._queryOnlineCount();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    this.state.isPresenceSubscribed = true;
                    await this.state.presenceChannel.track({
                        user_id: myId,
                        online_at: new Date().toISOString()
                    });
                    this._startHeartbeat();
                } else {
                    this.state.isPresenceSubscribed = false;
                }
            });
    }

    _startHeartbeat() {
        if (this.state.heartbeatInterval) clearInterval(this.state.heartbeatInterval);
        this.state.heartbeatInterval = setInterval(async () => {
            if (this.state.presenceChannel && this.state.user) {
                await this.state.presenceChannel.track({
                    user_id: this.state.user.id,
                    online_at: new Date().toISOString()
                });
            }
        }, this.CONFIG.presenceHeartbeatMs);
    }

    _queryOnlineCount() {
        if (!this.state.presenceChannel) return;
        const presState = this.state.presenceChannel.presenceState();
        const allPresences = Object.values(presState).flat();
        const uniqueUserIds = new Set(allPresences.map(p => p.user_id));
        this._emit('presence', uniqueUserIds.size);
    }

    _monitorConnection() {
        setInterval(async () => {
            if (!navigator.onLine) return;
            if (!this.state.user) return;
            
            // Basic check to reconnect presence if needed
            if (!this.state.isPresenceSubscribed) {
                await this._initPresence(true);
            }
        }, 5000);
    }

    // --- Public API: Auth ---

    async getSession() {
        const { data } = await this.db.auth.getSession();
        if (data.session) {
            this.state.user = data.session.user;
            this._initPresence();
        }
        return data.session;
    }

    async login(email, password) {
        const { data, error } = await this.db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.state.user = data.user;
        this._initPresence();
        this._emit('authChange', this.state.user);
        return data.user;
    }

    async requestVerification(email, name, password, avatarUrl = null) {
        // Step 1 of registration
        const response = await fetch(this.CONFIG.mailApi, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "send", email })
        });

        if (response.status === 429) throw new Error("Rate limited");
        const j = await response.json();
        
        if (j.message === "Code sent") {
            // Store temp data for the next step
            this.state.tempRegData = { name, email, password, avatar: avatarUrl };
            return true;
        } else {
            throw new Error(j.message || "Failed to send code");
        }
    }

    async verifyAndSignUp(code) {
        if (!this.state.tempRegData) throw new Error("Session expired");

        const temp = this.state.tempData;
        
        // Verify code via Mail API
        const r = await fetch(this.CONFIG.mailApi, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify", email: temp.email, code: code })
        });
        
        if (r.status === 429) throw new Error("Rate limited");
        const j = await r.json();

        if (j.message !== "Verified") throw new Error(j.message || "Wrong code");

        // Create Supabase Auth User
        const { data, error } = await this.db.auth.signUp({
            email: temp.email,
            password: temp.password,
            options: {
                data: {
                    full_name: temp.name,
                    avatar_url: temp.avatar
                }
            }
        });

        if (error) throw error;

        this.state.user = data.user;
        this.state.tempRegData = null;
        this._initPresence();
        this._emit('authChange', this.state.user);
        return data.user;
    }

    async logout() {
        if (this.state.heartbeatInterval) clearInterval(this.state.heartbeatInterval);
        if (this.state.presenceChannel) await this.state.presenceChannel.unsubscribe();
        if (this.state.chatChannel) await this.state.chatChannel.unsubscribe();
        
        this.state.user = null;
        await this.db.auth.signOut();
        this._emit('authChange', null);
    }

    // --- Public API: Rooms ---

    async getRooms() {
        if (!this.state.user) throw new Error("Not authenticated");
        const { data, error } = await this.db.from('rooms').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async createRoom(options) {
        // options: { name, type: 'group'|'direct', targetUserId (if direct), password, isPrivate, allowedUserIds, avatarUrl }
        if (!this.state.user) throw new Error("Not authenticated");
        
        const isDirect = options.type === 'direct';
        let name = options.name;
        let allowedUsers = options.allowedUserIds || ['*'];

        if (isDirect && options.targetUserId) {
            // In DMs, usually the name is generated or irrelevant, but logic requires it
            name = `DM ${options.targetUserId}`;
            allowedUsers = [this.state.user.id, options.targetUserId];
        }

        const roomSalt = this._generateSalt();
        const insertData = {
            name: name,
            avatar_url: options.avatarUrl || null,
            has_password: !!options.password,
            is_private: options.isPrivate || false,
            salt: roomSalt,
            created_by: this.state.user.id,
            allowed_users: allowedUsers,
            is_direct: isDirect
        };

        const { data, error } = await this.db.from('rooms').insert([insertData]).select();
        if (error) throw error;

        const newRoom = data[0];

        if (options.password) {
            const accessHash = await this._sha256(options.password + roomSalt);
            await this.db.rpc('set_room_password', { p_room_id: newRoom.id, p_hash: accessHash });
        }

        return newRoom;
    }

    async joinRoom(roomId, password = null) {
        if (!this.state.user) throw new Error("Not authenticated");
        
        // Check access
        const { data: canAccess } = await this.db.rpc('can_access_room', { p_room_id: roomId });
        if (!canAccess) throw new Error("Access denied");

        // Fetch room data
        const { data: room, error } = await this.db.from('rooms').select('*').eq('id', roomId).single();
        if (error) throw error;

        // Verify password if needed
        if (room.has_password) {
            if (!password) throw new Error("Password required");
            const inputHash = await this._sha256(password + room.salt);
            const { data: valid } = await this.db.rpc('verify_room_password', { p_room_id: roomId, p_hash: inputHash });
            if (!valid) throw new Error("Incorrect password");
        }

        // Setup Crypto Key
        const keySource = password ? (password + roomId) : roomId;
        try {
            await this._workerPost('deriveKey', { password: keySource, salt: room.salt }, 'keyDerived');
        } catch(e) {
            throw new Error("Key derivation failed");
        }

        // Setup Realtime Channel
        this.state.currentRoomId = roomId;
        this.state.currentRoomData = room;
        this.state.lastMessageTime = 0; // Reset rate limit
        
        if (this.state.chatChannel) await this.state.chatChannel.unsubscribe();

        this.state.chatChannel = this.db.channel(`room_chat_${roomId}`, { config: { broadcast: { self: true } } });
        
        this.state.chatChannel.on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, 
            async (payload) => {
                const m = payload.new;
                try {
                    const decRes = await this._workerPost('decryptSingle', { content: m.content }, 'singleDecrypted');
                    if(decRes.result) {
                        const msgObj = { ...m, time: decRes.result.time, text: decRes.result.text };
                        this._emit('message', msgObj);
                    }
                } catch(e) {
                    console.error("Decrypt error", e);
                }
            }
        ).subscribe();

        // Fetch History
        const history = await this.loadHistory(true);
        return { room, history };
    }

    async loadHistory(initial = false) {
        if (!this.state.currentRoomId) return [];
        
        // Logic for pagination could be added here using this.state.oldestMessageTimestamp
        const query = this.db.from('messages').select('*').eq('room_id', this.state.currentRoomId).order('created_at', { ascending: false });
        
        if (!initial && this.state.oldestMessageTimestamp) {
            query.lt('created_at', this.state.oldestMessageTimestamp);
        }
        
        const { data, error } = await query.limit(this.CONFIG.historyLoadLimit);
        if (error || !data) return [];

        data.reverse(); // Chronological order
        
        // Decrypt
        const decRes = await this._workerPost('decryptHistory', { messages: data }, 'historyDecrypted');
        const validMsgs = decRes.results.filter(m => !m.error);

        if (validMsgs.length > 0) {
            this.state.oldestMessageTimestamp = validMsgs[0].created_at;
        }

        return validMsgs;
    }

    async sendMessage(text) {
        if (!this.state.user || !this.state.currentRoomId || !this.state.chatChannel) {
            throw new Error("Not in a room");
        }
        if (!this._applyRateLimit()) {
            throw new Error("Rate limit exceeded");
        }

        this.state.lastMessageTime = Date.now();
        
        const time = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
        const encryptedContent = await this._workerPost('encrypt', { text: time + "|" + text }, 'encrypted');

        const { error } = await this.db.from('messages').insert([{
            room_id: this.state.currentRoomId,
            user_id: this.state.user.id,
            user_name: this.state.user.user_metadata?.full_name,
            content: encryptedContent.result
        }]);

        if (error) throw error;
        return true;
    }

    async leaveRoom() {
        if (this.state.chatChannel) {
            await this.state.chatChannel.unsubscribe();
            this.state.chatChannel = null;
        }
        this.state.currentRoomId = null;
        this.state.currentRoomData = null;
    }
}
