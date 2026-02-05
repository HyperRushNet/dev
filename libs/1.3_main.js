(function (window) {
    const GAME_JSON_URL =
        "https://cdn.jsdelivr.net/gh/HyperRushNet/hyperrushnet.github.io/assets/json/games.json";
    
    let cachedGames = null;
    let ongoingFetch = null;
    
    async function fetchGames() {
        if (cachedGames !==
            null)
        return cachedGames;
        if (ongoingFetch)
        return ongoingFetch;
        
        ongoingFetch = fetch(
                GAME_JSON_URL)
            .then(r => r.ok ? r
                .json() :
                Promise.reject(
                    new Error(
                        "Games fetch failed"
                        )))
            .then(data => {
                cachedGames
                    = Array
                    .isArray(
                        data
                        ) ?
                    data :
                    [];
                return cachedGames;
            })
            .catch(() => {
                cachedGames
                    = [];
                return cachedGames;
            })
            .finally(() => {
                ongoingFetch
                    = null;
            });
        
        return ongoingFetch;
    }
    
    const toLowerTrim = str =>
        String(str ?? "")
        .toLowerCase()
        .trim();
    
    window.hrn = {
        db: {
            all: async () => [
                ...(
                await fetchGames())
                ]
            , search: async (
                    query = ""
                    ) => {
                    const
                        games =
                        await fetchGames();
                    const term =
                        toLowerTrim(
                            query
                            );
                    if (!term)
                        return [...
                            games
                            ];
                    
                    return games
                        .filter(
                            g =>
                            toLowerTrim(
                                g
                                .name
                                )
                            .includes(
                                term
                                ) ||
                            toLowerTrim(
                                g
                                .category ??
                                ""
                                )
                            .includes(
                                term
                                ) ||
                            (g.device ??
                                []
                                )
                            .some(
                                d =>
                                toLowerTrim(
                                    d
                                    )
                                .includes(
                                    term
                                    )
                                )
                        )
                        .sort((a,
                            b
                            ) => {
                            const
                                posA =
                                toLowerTrim(
                                    a
                                    .name
                                    )
                                .indexOf(
                                    term
                                    );
                            const
                                posB =
                                toLowerTrim(
                                    b
                                    .name
                                    )
                                .indexOf(
                                    term
                                    );
                            return (posA <
                                    0 ?
                                    999 :
                                    posA
                                    ) -
                                (posB <
                                    0 ?
                                    999 :
                                    posB
                                    );
                        });
                }
        }
    };
    
    class GamePortal extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({
                mode: "open"
            });
            this._debounceTimer =
                null;
        }
        
        connectedCallback() {
            this.render();
            this.initialize();
        }
        
        render() {
            const accent = this
                .getAttribute(
                    "accent") ||
                "#4169E1";
            const isDark = (this
                    .getAttribute(
                        "theme"
                        ) ||
                    "dark") ===
                "dark";
            const bg = isDark ?
                "#000" : "#fff";
            const fg = isDark ?
                "#fff" : "#000";
            const border =
                isDark ?
                "rgba(255,255,255,0.1)" :
                "rgba(0,0,0,0.1)";
            const cardSize =
                this
                .getAttribute(
                    "card-size"
                    ) ||
                "220px";
            const height = this
                .getAttribute(
                    "height") ||
                "600px";
            const width = this
                .getAttribute(
                    "width") ||
                "100%";
            
            const scrollbar = `
        .w::-webkit-scrollbar { width: 10px; }
        .w::-webkit-scrollbar-track { background: ${isDark ? "#111" : "#f5f5f5"}; }
        .w::-webkit-scrollbar-thumb { background: ${isDark ? "#555" : "#bbb"}; border-radius: 5px; border: 2px solid ${isDark ? "#111" : "#f5f5f5"}; }
        .w::-webkit-scrollbar-thumb:hover { background: ${accent}; }
        .w { scrollbar-width: thin; scrollbar-color: ${isDark ? "#555 #111" : "#bbb #f5f5f5"}; }
      `;
            
            const styles = `
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
}
hrn-game {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
`;
            
            this.shadowRoot
                .innerHTML = `
<style>${styles}</style>
<div class="w" id="main-wrapper">
  <div class="h">
    <div class="sh" id="search-wrapper">
      <input type="text" class="i" id="search-input" placeholder="Search..." aria-label="Search games">
      <div class="tr" id="search-toggle" role="button" tabindex="0" aria-label="Toggle search bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
    </div>
  </div>
  <div class="g" id="games-grid" role="list"></div>
  <div class="ov" id="overlay">
    <div class="sb">
      <button class="cl" id="close-btn" aria-label="Close game">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="pc" id="player-container"></div>
    </div>
  </div>
</div>
<div class="msg ldr" id="loading"></div>
<div class="msg err-msg" id="error-state" style="display:none;">
  Failed to load games.<br>Please check your internet connection.
</div>
`;
        }
        
        async initialize() {
            const root = this
                .shadowRoot;
            const grid = root
                .getElementById(
                    "games-grid"
                    );
            const input = root
                .getElementById(
                    "search-input"
                    );
            const wrapper = root
                .getElementById(
                    "search-wrapper"
                    );
            const overlay = root
                .getElementById(
                    "overlay");
            const player = root
                .getElementById(
                    "player-container"
                    );
            const main = root
                .getElementById(
                    "main-wrapper"
                    );
            const loading = root
                .getElementById(
                    "loading");
            const errorEl = root
                .getElementById(
                    "error-state"
                    );
            
            const provider =
                this
                .getAttribute(
                    "provider"
                    ) ||
                "https://hyperrushnet.github.io";
            const showCredits =
                this
                .getAttribute(
                    "credits"
                    ) !==
                "false";
            
            const toggleSearch =
                () => {
                    const
                        isActive =
                        wrapper
                        .classList
                        .toggle(
                            "active"
                            );
                    if (
                        isActive)
                        input
                        .focus();
                };
            
            root.getElementById(
                    "search-toggle"
                    )
                .onclick =
                toggleSearch;
            root.getElementById(
                    "search-toggle"
                    )
                .onkeydown =
                e => {
                    if (e
                        .key ===
                        "Enter" ||
                        e
                        .key ===
                        " ") {
                        e
                    .preventDefault();
                        toggleSearch
                            ();
                    }
                };
            
            root.getElementById(
                    "close-btn")
                .onclick =
            () => {
                    overlay
                        .classList
                        .remove(
                            "active"
                            );
                    main.classList
                        .remove(
                            "lock"
                            );
                    player
                        .innerHTML =
                        "";
                };
            
            const renderGames =
                (games) => {
                    if (games
                        .length ===
                        0) {
                        grid.innerHTML =
                            '<div class="msg">No games found</div>';
                        return;
                    }
                    
                    grid.innerHTML =
                        games
                        .map(
                            game => `
          <div class="c" 
               data-id="${game.number}"
               role="button"
               tabindex="0"
               aria-label="Play ${game.name}">
            <h3 class="ct">${game.name}</h3>
            <span class="cn">#${String(game.number).padStart(2, "0")}</span>
          </div>
        `)
                        .join(
                            "");
                    
                    grid.querySelectorAll(
                            ".c"
                            )
                        .forEach(
                            card => {
                                const
                                    openGame =
                                    () => {
                                        player
                                            .innerHTML =
                                            `<hrn-game nr="${card.dataset.id}" provider="${provider}" credits="${showCredits}"></hrn-game>`;
                                        overlay
                                            .classList
                                            .add(
                                                "active"
                                                );
                                        main.classList
                                            .add(
                                                "lock"
                                                );
                                        main.scrollTo({
                                            top: 0
                                            , behavior: "smooth"
                                        });
                                    };
                                
                                card.onclick =
                                    openGame;
                                card.onkeydown =
                                    e => {
                                        if (e
                                            .key ===
                                            "Enter" ||
                                            e
                                            .key ===
                                            " "
                                            ) {
                                            e
                                        .preventDefault();
                                            openGame
                                                ();
                                        }
                                    };
                            });
                };
            
            try {
                const all =
                    await window
                    .hrn.db
                    .all();
                loading
            .remove();
                renderGames(
                all);
                
                input.oninput =
                    () => {
                        clearTimeout
                            (this
                                ._debounceTimer
                                );
                        this._debounceTimer =
                            setTimeout(
                                async () => {
                                        const
                                            results =
                                            await window
                                            .hrn
                                            .db
                                            .search(
                                                input
                                                .value
                                                );
                                        renderGames
                                            (
                                                results);
                                    },
                                    300);
                    };
            }
            catch {
                loading
            .remove();
                errorEl.style
                    .display =
                    "flex";
            }
        }
    }
    
    customElements.define(
        "hrn-game-portal",
        GamePortal);
    
    class HrnGame extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({
                mode: "open"
            });
        }
        
        connectedCallback() {
            const observer =
                new IntersectionObserver(
                    ([
                    entry]) => {
                        if (entry
                            .isIntersecting
                            ) {
                            this
                        .load();
                            observer
                                .disconnect();
                        }
                    }, {
                        threshold: 0.1
                    });
            
            observer.observe(
                this);
        }
        
        async load() {
            const nr = this
                .getAttribute(
                    "nr");
            const provider =
                this
                .getAttribute(
                    "provider"
                    ) ||
                "https://hyperrushnet.github.io";
            const showCredits =
                this
                .getAttribute(
                    "credits"
                    ) !==
                "false";
            const
                strictRedirect =
                this
                .getAttribute(
                    "redirectblock"
                    ) !==
                "false";
            
            let gameUrl =
                `${provider}/games-1/404.html`;
            
            try {
                const games =
                    await fetchGames();
                const match =
                    games.find(
                        g =>
                        Number(g
                            .number
                            ) ===
                        Number(
                            nr)
                        );
                if (match?.link)
                    gameUrl =
                    provider +
                    match.link;
            }
            catch {
                
            }
            
            const sandbox = [
        "allow-scripts"
        , "allow-same-origin"
        , "allow-pointer-lock"
        , "allow-forms"
      ];
            
            if (!
                strictRedirect) {
                sandbox.push(
                    "allow-popups",
                    "allow-popups-to-escape-sandbox"
                    );
                
            }
            
            this.shadowRoot
                .innerHTML = `
<style>
  :host { display: block; width: 100%; height: 100%; }
  .container {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: none;
    opacity: 0;
    transition: opacity 0.9s;
  }
  .frame.visible { opacity: 1; }
  .loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000;
    color: #fff;
    gap: 20px;
    z-index: 10;
    transition: opacity 0.6s;
  }
  .loader.hidden { opacity: 0; pointer-events: none; }
  .spinner {
    width: 64px;
    height: 64px;
    border: 4px solid rgba(255,255,255,0.1);
    border-top-color: #4169E1;
    border-right-color: #4169E1;
    border-radius: 50%;
    animation: spin 1.2s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .text {
    font-size: 14px;
    opacity: 0.7;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 700;
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
  }
  .credits a {
    color: #4169E1;
    text-decoration: none;
    font-weight: 700;
  }
  @keyframes fadeout { 0%, 85% { opacity: 1 } 100% { opacity: 0; visibility: hidden } }
</style>
<div class="container">
  <div class="loader" id="load-screen">
    <div class="spinner"></div>
    <div class="text">Loading...</div>
  </div>
  ${showCredits ? `
  <div class="credits">
    Powered by <a href="https://hyperrushnet.github.io/" target="_blank" rel="noopener">HyperRush</a>
  </div>` : ""}
  <iframe class="frame" 
          allow="autoplay; fullscreen; gamepad" 
          sandbox="${sandbox.join(" ")}"></iframe>
</div>`;
            
            const iframe = this
                .shadowRoot
                .querySelector(
                    "iframe");
            const loaderEl =
                this.shadowRoot
                .getElementById(
                    "load-screen"
                    );
            
            iframe.src =
            gameUrl;
            iframe.onload =
            () => {
                    iframe
                        .classList
                        .add(
                            "visible"
                            );
                    if (
                        loaderEl) {
                        loaderEl
                            .classList
                            .add(
                                "hidden"
                                );
                        setTimeout
                            (() =>
                                loaderEl
                                .remove(),
                                700
                                );
                    }
                };
        }
    }
    
    customElements.define(
        "hrn-game", HrnGame);
})(window);
