!function(w) {
    'use strict';

    let cache = null;
    let pending = null;

    const fetchGames = async () => {
        if (cache) return cache;
        if (pending) return pending;
        const url = 'https://cdn.jsdelivr.net/gh/HyperRushNet/hyperrushnet.github.io/assets/json/games.json';
        pending = fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {
                cache = Array.isArray(data) ? data : [];
                pending = null;
                return cache;
            })
            .catch(err => {
                console.error(err);
                pending = null;
                return [];
            });
        return pending;
    };

    const cleanStr = str => (str || '').toLowerCase().trim();

    w.hrn = w.hrn || {};

    w.hrn.db = {
        all: async () => [...await fetchGames()],
        search: async (query = '') => {
            const games = await fetchGames();
            const q = cleanStr(query);
            if (!q) return games;
            return games.filter(g => 
                cleanStr(g.name).includes(q) || 
                cleanStr(g.category).includes(q) ||
                (g.device || []).some(d => cleanStr(d).includes(q))
            ).sort((a, b) => cleanStr(a.name).indexOf(q) - cleanStr(b.name).indexOf(q));
        },
        find: async (criteria) => {
            const games = await fetchGames();
            return games.filter(g => Object.entries(criteria).every(([k, v]) => 
                Array.isArray(g[k]) ? g[k].includes(v) : g[k] === v
            ));
        },
        random: async () => {
            const games = await fetchGames();
            return games[Math.floor(Math.random() * games.length)];
        },
        getMeta: async () => {
            const games = await fetchGames();
            return {
                total: games.length,
                categories: [...new Set(games.map(g => g.category).filter(Boolean))],
                devices: [...new Set(games.flatMap(g => g.device || []))]
            };
        }
    };

    w.hrn.stats = {
        get: () => {
            const raw = localStorage.getItem('hrn_stats');
            const data = raw ? JSON.parse(raw) : {};
            return {
                xp: Number(data.xp) || 0,
                lvl: Number(data.lvl) || 1,
                history: Array.isArray(data.history) ? data.history : [],
                counts: data.counts || {}
            };
        },
        save: (data) => localStorage.setItem('hrn_stats', JSON.stringify(data)),
        recordPlay: (id) => {
            const stats = w.hrn.stats.get();
            const numId = Number(id);
            stats.counts[numId] = (stats.counts[numId] || 0) + 1;
            stats.xp += 10;
            stats.lvl = Math.floor(stats.xp / 100) + 1;
            stats.history = [numId, ...stats.history.filter(h => h !== numId)].slice(0, 10);
            w.hrn.stats.save(stats);
        },
        getTop: async (count = 5) => {
            const stats = w.hrn.stats.get();
            const ids = Object.entries(stats.counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, count)
                .map(([id]) => Number(id));
            const games = await fetchGames();
            return ids.map(id => games.find(g => g.number === id)).filter(Boolean);
        },
        getHistory: async () => {
            const stats = w.hrn.stats.get();
            const games = await fetchGames();
            return stats.history.map(id => games.find(g => g.number === id)).filter(Boolean);
        },
        reset: () => localStorage.removeItem('hrn_stats')
    };

    class HRNGame extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
            this.gameId = this.getAttribute('nr');
            if (!this.gameId) return;

            const showCredits = this.getAttribute('credits') !== 'false';
            const provider = this.getAttribute('provider') || 'https://hyperrushnet.github.io';
            const blockRedirect = this.getAttribute('redirectblock') !== 'false';
            const color = getComputedStyle(this).getPropertyValue('--hrn-color') || '#4169E1';

            const css = `
                :host {
                    all: initial;
                    display: block;
                    width: 100%;
                    height: 600px;
                    position: relative;
                    background: #000;
                    font-family: sans-serif;
                    box-sizing: border-box;
                }
                *, *::before, *::after { box-sizing: inherit; }
                .loader {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.9);
                }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid #222;
                    border-top-color: ${color};
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    display: block;
                }
                .credits {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    padding: 8px 15px;
                    background: rgba(0,0,0,0.8);
                    color: #888;
                    font-size: 12px;
                    border-radius: 6px;
                    animation: fadeOut 8s forwards;
                    z-index: 10;
                }
                .credits a { color: ${color}; text-decoration: none; font-weight: bold; }
                @keyframes fadeOut { 0%, 80% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
            `;

            this.shadowRoot.innerHTML = `<style>${css}</style><div class="loader"><div class="spinner"></div></div><div class="container"></div>`;
            
            this.loadGame(this.shadowRoot.querySelector('.container'), this.shadowRoot.querySelector('.loader'), provider, showCredits, blockRedirect);
        }

        async loadGame(container, loader, provider, showCredits, blockRedirect) {
            let src = `${provider}/games-1/404.html`;
            
            try {
                const games = await fetchGames();
                const game = games.find(g => g.number == this.gameId);
                if (game?.link) src = provider + game.link;
            } catch (e) {
                console.error(e);
            }

            const sandbox = [
                'allow-scripts', 'allow-same-origin', 'allow-pointer-lock', 'allow-forms'
            ];
            if (!blockRedirect) sandbox.push('allow-popups', 'allow-popups-to-escape-sandbox');

            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.allow = 'autoplay; fullscreen; gamepad';
            iframe.sandbox = sandbox.join(' ');
            
            container.appendChild(iframe);

            if (showCredits) {
                const creditDiv = document.createElement('div');
                creditDiv.className = 'credits';
                creditDiv.innerHTML = 'Powered by <a href="https://hyperrushnet.github.io/" target="_blank" rel="noopener">HyperRush</a>';
                container.appendChild(creditDiv);
            }

            iframe.onload = () => {
                loader.style.display = 'none';
                w.hrn.stats.recordPlay(this.gameId);
                this.dispatchEvent(new CustomEvent('game:ready', { detail: { id: Number(this.gameId) }, bubbles: true }));
            };
            iframe.onerror = () => loader.innerHTML = '<div style="color:white;text-align:center;padding:20px;">Failed to load</div>';
        }
    }

    class HRNPortal extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.debounceTimer = null;
        }

        connectedCallback() {
            const accent = this.getAttribute('accent') || '#4169E1';
            const theme = this.getAttribute('theme') || 'dark';
            const cardSize = this.getAttribute('card-size') || '240px';
            const height = this.getAttribute('height') || '700px';
            const width = this.getAttribute('width') || '100%';
            const provider = this.getAttribute('provider') || 'https://hyperrushnet.github.io';
            const showCredits = this.getAttribute('credits') !== 'false';

            const isDark = theme === 'dark';
            const bg = isDark ? '#0a0a0a' : '#ffffff';
            const text = isDark ? '#f0f0f0' : '#111111';
            const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

            const css = `
                :host {
                    all: initial;
                    display: block;
                    width: ${width};
                    height: ${height};
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: ${bg};
                    color: ${text};
                    border: 1px solid ${border};
                    overflow: hidden;
                    box-sizing: border-box;
                    position: relative;
                }
                *, *::before, *::after { box-sizing: inherit; margin: 0; padding: 0; }
                
                .wrapper {
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    overflow-x: hidden;
                    position: relative;
                    scrollbar-width: thin;
                    scrollbar-color: ${accent} ${bg};
                }
                .wrapper::-webkit-scrollbar { width: 8px; }
                .wrapper::-webkit-scrollbar-track { background: ${bg}; }
                .wrapper::-webkit-scrollbar-thumb { background: ${accent}; border-radius: 4px; }

                .header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    display: flex;
                    justify-content: flex-end;
                    padding: 20px;
                    background: ${bg};
                    border-bottom: 1px solid ${border};
                }

                .search-container {
                    display: flex;
                    align-items: center;
                    background: ${inputBg};
                    border-radius: 8px;
                    border: 1px solid ${border};
                    transition: border-color 0.2s, box-shadow 0.2s;
                    overflow: hidden;
                }
                .search-container:focus-within {
                    border-color: ${accent};
                    box-shadow: 0 0 0 3px ${accent}33;
                }
                
                input {
                    width: 200px;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: ${text};
                    font-size: 14px;
                    outline: none;
                }
                input::placeholder { color: ${isDark ? '#666' : '#999'}; }

                .search-btn {
                    padding: 12px 16px;
                    background: transparent;
                    border: none;
                    border-left: 1px solid ${border};
                    color: ${accent};
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(${cardSize}, 1fr));
                    gap: 15px;
                    padding: 20px;
                }

                .card {
                    aspect-ratio: 16/10;
                    background: ${isDark ? '#111' : '#f5f5f5'};
                    border: 1px solid ${border};
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
                }
                .card:hover {
                    transform: translateY(-3px);
                    border-color: ${accent};
                    box-shadow: 0 5px 15px ${accent}22;
                }
                .card h3 { font-size: 1.1rem; text-align: center; margin-bottom: 8px; font-weight: 600; }
                .card span { font-size: 0.8rem; color: ${accent}; opacity: 0.8; font-family: monospace; }

                .overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.85);
                    backdrop-filter: blur(5px);
                    display: none;
                    flex-direction: column;
                    z-index: 200;
                }
                .overlay.active { display: flex; }

                .close-btn {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 210;
                    transition: background 0.2s;
                }
                .close-btn:hover { background: rgba(255,0,0,0.5); border-color: #ff0000; }

                .game-container {
                    flex: 1;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                hrn-game {
                    width: 100%;
                    max-width: 1200px;
                    height: 80%;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 0 30px rgba(0,0,0,0.5);
                }

                .status-msg {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    font-size: 1.2rem;
                    color: ${text};
                }
                .error-msg { color: #ff6b6b; text-align: center; padding: 40px; }
            `;

            this.shadowRoot.innerHTML = `
                <style>${css}</style>
                <div class="wrapper" id="wrapper">
                    <div class="header">
                        <div class="search-container">
                            <input type="text" id="searchInput" placeholder="Search games...">
                            <button class="search-btn" id="searchBtn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="grid" id="grid"></div>
                    <div class="overlay" id="overlay">
                        <button class="close-btn" id="closeBtn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <div class="game-container" id="gameContainer"></div>
                    </div>
                </div>
                <div class="status-msg" id="loader">Loading...</div>
                <div class="status-msg error-msg" id="errorBox" style="display:none;">Connection error. Please try again.</div>
            `;

            this.initLogic(provider, showCredits);
        }

        async initLogic(provider, showCredits) {
            const root = this.shadowRoot;
            const grid = root.getElementById('grid');
            const searchInput = root.getElementById('searchInput');
            const overlay = root.getElementById('overlay');
            const gameContainer = root.getElementById('gameContainer');
            const closeBtn = root.getElementById('closeBtn');
            const loader = root.getElementById('loader');
            const errorBox = root.getElementById('errorBox');

            const renderGames = (games) => {
                grid.innerHTML = '';
                if (!games.length) {
                    grid.innerHTML = '<div class="status-msg">No games found</div>';
                    return;
                }
                games.forEach(game => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    card.setAttribute('role', 'button');
                    card.tabIndex = 0;
                    card.innerHTML = `<h3>${game.name}</h3><span>#${String(game.number).padStart(2, '0')}</span>`;
                    
                    const playGame = () => {
                        gameContainer.innerHTML = '';
                        const gameEl = document.createElement('hrn-game');
                        gameEl.setAttribute('nr', game.number);
                        gameEl.setAttribute('provider', provider);
                        gameEl.setAttribute('credits', showCredits);
                        gameContainer.appendChild(gameEl);
                        overlay.classList.add('active');
                    };

                    card.onclick = playGame;
                    card.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), playGame());
                    grid.appendChild(card);
                });
            };

            try {
                const games = await fetchGames();
                loader.remove();
                renderGames(games);

                searchInput.addEventListener('input', () => {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(async () => {
                        const results = await w.hrn.db.search(searchInput.value);
                        renderGames(results);
                    }, 300);
                });
            } catch {
                loader.remove();
                errorBox.style.display = 'flex';
            }

            closeBtn.onclick = () => {
                overlay.classList.remove('active');
                gameContainer.innerHTML = '';
            };
        }
    }

    customElements.define('hrn-game', HRNGame);
    customElements.define('hrn-game-portal', HRNPortal);

}(window);
