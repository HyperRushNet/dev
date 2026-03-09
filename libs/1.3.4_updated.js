(function (window) {
    "use strict";

    const GAME_JSON_URL = "https://cdn.jsdelivr.net/gh/HyperRushNet/hyperrushnet.github.io/assets/json/games.json";
    let cachedGames = null;
    let ongoingFetch = null;

    async function fetchGames() {
        if (cachedGames !== null) return cachedGames;
        if (ongoingFetch) return ongoingFetch;
        ongoingFetch = fetch(GAME_JSON_URL)
            .then(r => r.ok ? r.json() : Promise.reject("Failed"))
            .then(data => {
                cachedGames = Array.isArray(data) ? data : [];
                return cachedGames;
            })
            .catch(() => {
                cachedGames = [];
                return cachedGames;
            })
            .finally(() => { ongoingFetch = null; });
        return ongoingFetch;
    }

    const norm = str => String(str ?? "").toLowerCase().trim();

    window.hrn = {
        db: {
            all: async () => [...(await fetchGames())],
            search: async (query = "") => {
                const games = await fetchGames();
                const q = norm(query);
                if (!q) return [...games];
                return games
                    .filter(g => norm(g.name).includes(q) || norm(g.category ?? "").includes(q) || (g.device ?? []).some(d => norm(d).includes(q)))
                    .sort((a, b) => (norm(a.name).indexOf(q) || 999) - (norm(b.name).indexOf(q) || 999));
            },
            find: async criteria => {
                const games = await fetchGames();
                return games.filter(g => Object.entries(criteria).every(([k, v]) => Array.isArray(g[k]) ? g[k].includes(v) : g[k] === v));
            },
            random: async () => {
                const games = await fetchGames();
                return games[Math.floor(Math.random() * games.length)];
            },
            toggleFav: id => {
                const favs = JSON.parse(localStorage.getItem("hrn_favs") || "[]");
                const idx = favs.indexOf(id);
                if (idx > -1) favs.splice(idx, 1); else favs.push(id);
                localStorage.setItem("hrn_favs", JSON.stringify(favs));
            },
            getFavs: async () => {
                const favs = JSON.parse(localStorage.getItem("hrn_favs") || "[]");
                const games = await fetchGames();
                return favs.map(id => games.find(g => g.number === id)).filter(Boolean);
            },
            getMeta: async () => {
                const games = await fetchGames();
                const categories = [...new Set(games.map(g => g.category).filter(Boolean))];
                const devices = [...new Set(games.flatMap(g => g.device || []))];
                return { total: games.length, categories, devices };
            }
        },
        stats: {
            get: () => {
                const s = JSON.parse(localStorage.getItem("hrn_stats") || "{}");
                return { xp: Number(s.xp) || 0, lvl: Number(s.lvl) || 1, history: Array.isArray(s.history) ? s.history : [], counts: s.counts || {} };
            },
            save: s => localStorage.setItem("hrn_stats", JSON.stringify(s)),
            recordPlay: id => {
                id = Number(id);
                const s = window.hrn.stats.get();
                s.counts[id] = (s.counts[id] || 0) + 1;
                s.xp += 10;
                s.lvl = Math.floor(s.xp / 100) + 1;
                s.history = [id, ...s.history.filter(x => x !== id)].slice(0, 10);
                window.hrn.stats.save(s);
            },
            getTop: async (limit = 5) => {
                const s = window.hrn.stats.get();
                const topIds = Object.entries(s.counts || {}).sort(([, a], [, b]) => b - a).slice(0, limit).map(([id]) => Number(id));
                const games = await fetchGames();
                return topIds.map(id => games.find(g => g.number === id)).filter(Boolean);
            },
            getHistory: async () => {
                const s = window.hrn.stats.get();
                const games = await fetchGames();
                return s.history.map(id => games.find(g => g.number === id)).filter(Boolean);
            },
            reset: () => localStorage.removeItem("hrn_stats")
        }
    };

    class HRNGame extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
        }
        connectedCallback() {
            this.nr = this.getAttribute("nr");
            if (!this.nr) return;
            this.credits = this.getAttribute("credits") !== "false";
            this.redirectblock = this.getAttribute("redirectblock") !== "false";
            this.provider = this.getAttribute("provider") || "https://hyperrushnet.github.io";
            this.render();
            this.loadGame();
        }
        render() {
            const accent = getComputedStyle(this).getPropertyValue("--hrn-color") || "#4169E1";
            const css = `
                :host { display: block; width: 100%; height: 600px; position: relative; background: #000; contain: content; }
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                .ldr { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1); border-top-color: ${accent.trim()}; border-radius: 50%; animation: spin 0.8s linear infinite; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
                @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
                .pc { width: 100%; height: 100%; position: relative; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; display: block; background: #000; }
                .credits { position: absolute; bottom: 16px; right: 16px; z-index: 20; font-family: sans-serif; font-size: 11px; color: rgba(255,255,255,0.6); background: rgba(0,0,0,0.8); padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); animation: fadeout 8s forwards; pointer-events: none; backdrop-filter: blur(4px); }
                .credits a { color: ${accent.trim()}; text-decoration: none; font-weight: 700; }
                @keyframes fadeout { 0%, 80% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
            `;
            this.shadowRoot.innerHTML = `<style>${css}</style><div class="ldr" id="loader"></div><div class="pc" id="pc"></div>`;
        }
        async loadGame() {
            const loader = this.shadowRoot.getElementById("loader");
            const pc = this.shadowRoot.getElementById("pc");
            let url = `${this.provider}/games-1/404.html`;
            try {
                const games = await fetchGames();
                const match = games.find(g => g.number == this.nr);
                if (match?.link) url = this.provider + match.link;
            } catch (e) { console.error(e); }
            const sandbox = ["allow-scripts", "allow-same-origin", "allow-pointer-lock", "allow-forms"];
            if (!this.redirectblock) sandbox.push("allow-popups", "allow-popups-to-escape-sandbox");
            pc.innerHTML = `<iframe src="${url}" allow="autoplay; fullscreen; gamepad" sandbox="${sandbox.join(" ")}"></iframe>${this.credits ? `<div class="credits">Powered by <a href="https://hyperrushnet.github.io/" target="_blank" rel="noopener">HyperRush</a></div>` : ""}`;
            loader.style.display = "none";
            window.hrn.stats.recordPlay(this.nr);
            this.dispatchEvent(new CustomEvent("game:ready", { detail: { id: Number(this.nr) }, bubbles: true }));
        }
    }
    customElements.define("hrn-game", HRNGame);

    class HRNGamePortal extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this._debounceTimer = null;
        }
        connectedCallback() {
            this.render();
            this.initialize();
        }
        render() {
            const accent = this.getAttribute("accent") || "#4169E1";
            const isDark = (this.getAttribute("theme") || "dark") === "dark";
            const bg = isDark ? "#0a0a0a" : "#ffffff";
            const fg = isDark ? "#ffffff" : "#1a1a1a";
            const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
            const cardSize = this.getAttribute("card-size") || "230px";
            const height = this.getAttribute("height") || "650px";
            const width = this.getAttribute("width") || "100%";

            const scrollbar = `
                .w::-webkit-scrollbar { width: 8px; }
                .w::-webkit-scrollbar-track { background: transparent; }
                .w::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}; border-radius: 10px; }
                .w { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.2) transparent" : "rgba(0,0,0,0.15) transparent"}; }
            `;
            const css = `
                :host { display: block; position: relative; width: ${width}; height: ${height}; background: ${bg}; color: ${fg}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; border: 1px solid ${border}; contain: layout style; }
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                .msg { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; }
                .ldr { width: 44px; height: 44px; border: 3px solid ${border}; border-top-color: ${accent}; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .err-msg { color: #ff6b6b; font-size: 1rem; }
                .w { position: relative; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; }
                .w.lock { overflow: hidden; }
                ${scrollbar}
                .h { position: sticky; top: 0; z-index: 100; display: flex; justify-content: flex-end; padding: 20px; background: linear-gradient(to bottom, ${bg} 70%, transparent); pointer-events: none; }
                .sh { display: flex; pointer-events: auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.25); }
                .i { width: 0; opacity: 0; border: none; background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}; color: ${fg}; transition: width 0.3s, opacity 0.3s; outline: none; font-size: 14px; font-family: inherit; backdrop-filter: blur(10px); }
                .sh.active .i { width: 200px; opacity: 1; padding: 0 16px; }
                .tr { width: 46px; height: 46px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${fg}; background: ${accent}; transition: filter 0.2s; backdrop-filter: blur(10px); }
                .tr:hover { filter: brightness(1.1); }
                .g { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, ${cardSize}), 1fr)); width: 100%; padding: 15px; gap: 1px; }
                .c { aspect-ratio: 1/1; border: 1px solid ${border}; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s, border-color 0.2s, background 0.2s; text-align: center; padding: 30px 20px; background: ${bg}; position: relative; }
                .c:hover { transform: scale(1.03); z-index: 5; border-color: ${accent}; background: ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"}; }
                .c:active { transform: scale(0.98); }
                .ct { font-size: 1.1rem; text-transform: uppercase; margin: 0; font-weight: 800; letter-spacing: 0.5px; line-height: 1.3; }
                .cn { font-size: 11px; margin-top: 10px; color: ${accent}; font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Mono", monospace; font-weight: 600; opacity: 0.7; padding: 4px 8px; background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}; border-radius: 4px; }
                .ov { position: absolute; inset: 0; z-index: 200; display: none; pointer-events: none; }
                .ov.active { display: flex; flex-direction: column; pointer-events: auto; animation: fadeIn 0.3s ease; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .sb { position: absolute; inset: 0; background: #000; display: flex; flex-direction: column; }
                .cl { position: absolute; top: 16px; right: 16px; width: 44px; height: 44px; border: 1px solid rgba(255,255,255,0.3); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(0,0,0,0.6); z-index: 210; transition: all 0.2s; border-radius: 8px; backdrop-filter: blur(8px); }
                .cl:hover { border-color: #ff4444; color: #ff4444; background: rgba(255,50,50,0.15); transform: rotate(90deg); }
                .pc { width: 100%; height: 100%; position: relative; background: #000; flex-grow: 1; }
            `;
            this.shadowRoot.innerHTML = `
                <style>${css}</style>
                <div class="w" id="w">
                    <div class="h">
                        <div class="sh" id="sh">
                            <input type="text" class="i" id="q" placeholder="Search games..." aria-label="Search games">
                            <div class="tr" id="toggle" role="button" tabindex="0" aria-label="Toggle search">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                        </div>
                    </div>
                    <div class="g" id="grid" role="list"></div>
                    <div class="ov" id="ov">
                        <div class="sb">
                            <button class="cl" id="close" aria-label="Close game">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                            <div class="pc" id="pc"></div>
                        </div>
                    </div>
                </div>
                <div class="msg ldr" id="ld"></div>
                <div class="msg err-msg" id="err" style="display:none;">Failed to load games.<br>Please check your internet connection.</div>
            `;
        }
        async initialize() {
            const root = this.shadowRoot;
            const w = root.getElementById("w");
            const grid = root.getElementById("grid");
            const q = root.getElementById("q");
            const sh = root.getElementById("sh");
            const ov = root.getElementById("ov");
            const pc = root.getElementById("pc");
            const ld = root.getElementById("ld");
            const err = root.getElementById("err");
            const provider = this.getAttribute("provider") || "https://hyperrushnet.github.io";
            const credits = this.getAttribute("credits") !== "false";
            const toggle = () => { if (sh.classList.toggle("active")) q.focus(); };
            root.getElementById("toggle").onclick = toggle;
            root.getElementById("toggle").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
            root.getElementById("close").onclick = () => { ov.classList.remove("active"); w.classList.remove("lock"); pc.innerHTML = ""; };
            const render = games => {
                if (!games.length) { grid.innerHTML = '<div class="msg" style="grid-column: 1/-1; padding: 40px;">No games found</div>'; return; }
                grid.innerHTML = games.map(g => `
                    <div class="c" data-id="${g.number}" role="button" tabindex="0" aria-label="Play ${g.name}">
                        <h3 class="ct">${g.name}</h3>
                        <span class="cn">#${String(g.number).padStart(2, "0")}</span>
                    </div>
                `).join("");
                grid.querySelectorAll(".c").forEach(c => {
                    const open = () => {
                        pc.innerHTML = `<hrn-game nr="${c.dataset.id}" provider="${provider}" credits="${credits}"></hrn-game>`;
                        ov.classList.add("active");
                        w.classList.add("lock");
                        w.scrollTop = 0;
                    };
                    c.onclick = open;
                    c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
                });
            };
            try {
                const data = await fetchGames();
                ld.remove();
                render(data);
                q.oninput = () => {
                    clearTimeout(this._debounceTimer);
                    this._debounceTimer = setTimeout(async () => render(await window.hrn.db.search(q.value)), 250);
                };
            } catch {
                ld.remove();
                err.style.display = "flex";
            }
        }
    }
    customElements.define("hrn-game-portal", HRNGamePortal);

})(window);
