(function (window) {
    const GAME_JSON_URL = "https://cdn.jsdelivr.net/gh/HyperRushNet/hyperrushnet.github.io/assets/json/games.json";

    let cachedGames = null;
    let ongoingFetch = null;

    async function fetchGames() {
        if (cachedGames !== null) return cachedGames;
        if (ongoingFetch) return ongoingFetch;

        ongoingFetch = fetch(GAME_JSON_URL)
            .then(r => r.ok ? r.json() : Promise.reject(new Error("Games fetch failed")))
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
            search: async (q = "") => {
                const gs = await fetchGames();
                const term = norm(q);
                if (!term) return [...gs];
                return gs
                    .filter(g =>
                        norm(g.name).includes(term) ||
                        norm(g.category ?? "").includes(term) ||
                        (g.device ?? []).some(d => norm(d).includes(term))
                    )
                    .sort((a, b) => {
                        const pa = norm(a.name).indexOf(term);
                        const pb = norm(b.name).indexOf(term);
                        return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb);
                    });
            }
        },
        stats: {
            get: () => {
                let s = JSON.parse(localStorage.getItem('hrn_stats') || '{}');
                s.xp = Number(s.xp) || 0;
                s.lvl = Number(s.lvl) || 1;
                s.history = Array.isArray(s.history) ? s.history : [];
                s.counts = s.counts || {};
                return s;
            },
            save: s => localStorage.setItem('hrn_stats', JSON.stringify(s)),
            recordPlay(id) {
                id = Number(id);
                const s = this.get();
                s.counts[id] = (s.counts[id] || 0) + 1;
                s.xp += 10;
                s.lvl = Math.floor(s.xp / 100) + 1;
                s.history = [id, ...s.history.filter(x => x !== id)].slice(0, 10);
                this.save(s);
            },
            getTop: async (limit = 5) => {
                const s = window.hrn.stats.get();
                const sortedIds = Object.entries(s.counts || {})
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, limit)
                    .map(([id]) => Number(id));
                const games = await fetchGames();
                return sortedIds.map(id => games.find(g => g.number === id)).filter(Boolean);
            },
            getHistory: async () => {
                const s = window.hrn.stats.get();
                const ids = s.history || [];
                const games = await fetchGames();
                return ids.map(id => games.find(g => g.number === id)).filter(Boolean);
            },
            reset: () => localStorage.removeItem('hrn_stats')
        }
    };

    class GamePortal extends HTMLElement {
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
            const bg = isDark ? "#000" : "#fff";
            const fg = isDark ? "#fff" : "#000";
            const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
            const cardSize = this.getAttribute("card-size") || "220px";
            const height = this.getAttribute("height") || "600px";
            const width = this.getAttribute("width") || "100%";

            const scrollbar = `
                .w::-webkit-scrollbar { width: 10px; }
                .w::-webkit-scrollbar-track { background: ${isDark ? "#111" : "#f5f5f5"}; }
                .w::-webkit-scrollbar-thumb { background: ${isDark ? "#555" : "#bbb"}; border-radius: 5px; border: 2px solid ${isDark ? "#111" : "#f5f5f5"}; }
                .w::-webkit-scrollbar-thumb:hover { background: ${accent}; }
                .w { scrollbar-width: thin; scrollbar-color: ${isDark ? "#555 #111" : "#bbb #f5f5f5"}; }
            `;

            const css = `
                :host {
                    display: block;
                    position: relative;
                    width: ${width};
                    height: ${height};
                    background: ${bg};
                    color: ${fg};
                    font-family: sans-serif;
                    overflow: hidden;
                    border: 1px solid ${border};
                }
                .msg {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                }
                .ldr {
                    width: 40px;
                    height: 40px;
                    border: 2px solid ${fg}22;
                    border-top-color: ${accent};
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg) } }
                .err-msg {
                    color: #ff6b6b;
                    font-size: 1.1rem;
                    text-align: center;
                    padding: 1.5rem;
                }
                .w {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .w.lock { overflow: hidden; }
                ${scrollbar}
                .h {
                    position: sticky;
                    top: 0;
                    z-index: 150;
                    display: flex;
                    justify-content: flex-end;
                    padding: 15px;
                    pointer-events: none;
                }
                .sh {
                    display: flex;
                    pointer-events: auto;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                }
                .i {
                    width: 0;
                    opacity: 0;
                    border: 1px solid ${accent};
                    border-right: none;
                    background: rgba(0,0,0,0.7);
                    color: #fff;
                    transition: .3s;
                    outline: none;
                    font-size: 14px;
                    backdrop-filter: blur(5px);
                }
                .sh.active .i {
                    width: clamp(150px, 25vw, 250px);
                    opacity: 1;
                    padding: 0 15px;
                }
                .tr {
                    width: 45px;
                    height: 45px;
                    border: 1px solid ${accent};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: ${accent};
                    background: rgba(0,0,0,0.5);
                    transition: .2s;
                    backdrop-filter: blur(5px);
                }
                .tr:hover {
                    background: rgba(0,0,0,0.8);
                    color: #fff;
                }
                .g {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(100%, ${cardSize}), 1fr));
                    width: 100%;
                    margin-top: -75px;
                }
                .c {
                    aspect-ratio: 1/1;
                    border: 1px solid ${border};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: .2s;
                    text-align: center;
                    padding: 20px;
                    margin: -0.5px;
                }
                .c:hover {
                    border-color: ${accent};
                    z-index: 5;
                    background: ${accent}11;
                }
                .ct {
                    font-size: 1.1rem;
                    text-transform: uppercase;
                    margin: 0;
                    font-weight: 900;
                }
                .cn {
                    font-size: 11px;
                    margin-top: 8px;
                    color: ${accent};
                    font-family: monospace;
                    font-weight: 700;
                    opacity: .7;
                }
                .ov {
                    position: absolute;
                    inset: 0;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                }
                .ov.active {
                    display: block;
                    pointer-events: auto;
                }
                .sb {
                    position: absolute;
                    inset: 0;
                    background: #000;
                    pointer-events: auto;
                    display: flex;
                    flex-direction: column;
                }
                .cl {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    width: 40px;
                    height: 40px;
                    border: 1px solid rgba(255,255,255,0.4);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    background: rgba(0,0,0,0.5);
                    z-index: 1100;
                    transition: .2s;
                    backdrop-filter: blur(5px);
                }
                .cl:hover {
                    border-color: #ff4444;
                    color: #ff4444;
                    background: rgba(255,0,0,0.2);
                }
                .pc {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    display: block;
                }
                .credits {
                    position: absolute;
                    bottom: 12px;
                    right: 16px;
                    z-index: 20;
                    font-size: 11px;
                    color: #999;
                    background: rgba(0,0,0,0.7);
                    padding: 4px 10px;
                    border-radius: 5px;
                    border: 1px solid #333;
                    animation: fadeout 8s forwards;
                    pointer-events: none;
                }
                .credits a {
                    color: #4169E1;
                    text-decoration: none;
                    font-weight: 700;
                }
                @keyframes fadeout {
                    0%, 85% { opacity: 1 }
                    100% { opacity: 0; visibility: hidden }
                }
            `;

            this.shadowRoot.innerHTML = `
                <style>${css}</style>
                <div class="w" id="w">
                    <div class="h">
                        <div class="sh" id="sh">
                            <input type="text" class="i" id="q" placeholder="Search..." aria-label="Search games">
                            <div class="tr" id="toggle" role="button" tabindex="0" aria-label="Toggle search">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div class="g" id="grid" role="list"></div>
                    <div class="ov" id="ov">
                        <div class="sb">
                            <button class="cl" id="close" aria-label="Close game">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                            <div class="pc" id="pc"></div>
                        </div>
                    </div>
                </div>
                <div class="msg ldr" id="ld"></div>
                <div class="msg err-msg" id="err" style="display:none;">
                    Failed to load games.<br>Please check your internet connection.
                </div>
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
            const noRedirect = this.getAttribute("redirectblock") !== "false";

            const toggle = () => {
                const act = sh.classList.toggle("active");
                if (act) q.focus();
            };

            root.getElementById("toggle").onclick = toggle;
            root.getElementById("toggle").onkeydown = e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                }
            };

            root.getElementById("close").onclick = () => {
                ov.classList.remove("active");
                w.classList.remove("lock");
                pc.innerHTML = "";
            };

            const render = games => {
                if (!games.length) {
                    grid.innerHTML = '<div class="msg">No games found</div>';
                    return;
                }

                grid.innerHTML = games.map(g => `
                    <div class="c" data-id="${g.number}" role="button" tabindex="0" aria-label="Play ${g.name}">
                        <h3 class="ct">${g.name}</h3>
                        <span class="cn">#${String(g.number).padStart(2,"0")}</span>
                    </div>
                `).join("");

                grid.querySelectorAll(".c").forEach(c => {
                    const open = async () => {
                        let url = `${provider}/games-1/404.html`;
                        try {
                            const all = await fetchGames();
                            const match = all.find(x => x.number == c.dataset.id);
                            if (match?.link) url = provider + match.link;
                        } catch {}

                        const sbx = ["allow-scripts","allow-same-origin","allow-pointer-lock","allow-forms"];
                        if (!noRedirect) sbx.push("allow-popups","allow-popups-to-escape-sandbox");

                        pc.innerHTML = `
                            <iframe src="${url}" allow="autoplay; fullscreen; gamepad" sandbox="${sbx.join(" ")}"></iframe>
                            ${credits ? `<div class="credits">Powered by <a href="https://hyperrushnet.github.io/" target="_blank" rel="noopener">HyperRush</a></div>` : ""}
                        `;

                        ov.classList.add("active");
                        w.classList.add("lock");
                        w.scrollTop = 0;

                        window.hrn.stats.recordPlay(c.dataset.id);
                        this.dispatchEvent(new CustomEvent("game:ready", {detail:{id:Number(c.dataset.id)},bubbles:true}));
                    };

                    c.onclick = open;
                    c.onkeydown = e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                        }
                    };
                });
            };

            try {
                const data = await fetchGames();
                ld.remove();
                render(data);

                q.oninput = () => {
                    clearTimeout(this._debounceTimer);
                    this._debounceTimer = setTimeout(async () => {
                        render(await window.hrn.db.search(q.value));
                    }, 300);
                };
            } catch {
                ld.remove();
                err.style.display = "flex";
            }
        }
    }

    customElements.define("hrn-game-portal", GamePortal);

})(window);
