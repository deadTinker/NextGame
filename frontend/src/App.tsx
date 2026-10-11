
import { useEffect, useState, type FormEvent } from "react";
import {
  Gamepad2, Home, Library, BookOpen, ChartNoAxesColumn,
  Settings, Search, ChevronRight, Clock3, Compass,
  CheckCircle2, Circle, Menu, X, Star, Trophy, History, Send, Database
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import "./index.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
type AuthUser = { id: string; email: string };
type CloudState = { activeGame: Game; tasks: Task[]; completedGames: CompletedGame[] };


const games = [
  { id: 1, name: "Hollow Knight", genre: "Metroidvania", platform: "Steam", time: "25–35 hrs", color: "#24352D", tag: "Exploration", description: "Explore a vast, interconnected underground kingdom." },
  { id: 2, name: "Stardew Valley", genre: "Simulation", platform: "Steam", time: "20–40 hrs", color: "#536B43", tag: "Progression", description: "Build a farm, develop relationships, and explore." },
  { id: 3, name: "Portal 2", genre: "Puzzle", platform: "Steam", time: "8–12 hrs", color: "#315A71", tag: "Problem-solving", description: "Solve physics-based puzzles using a portal gun." },
  { id: 4, name: "Undertale", genre: "RPG", platform: "PC", time: "6–8 hrs", color: "#51415D", tag: "Story", description: "Explore a strange underground world where choices matter." },
  { id: 5, name: "Celeste", genre: "Platformer", platform: "Steam", time: "8–10 hrs", color: "#385B88", tag: "Precision", description: "Climb a mountain in a challenging platforming adventure." },
  { id: 6, name: "Pokémon Emerald", genre: "RPG", platform: "GBA", time: "25–35 hrs", color: "#376A4A", tag: "Team building", description: "Build a Pokémon team and explore the Hoenn region." },
  { id: 7, name: "A Short Hike", genre: "Adventure", platform: "PC", time: "2–4 hrs", color: "#BA8C55", tag: "Exploration", description: "Explore a peaceful island at your own pace." },
  { id: 8, name: "Slay the Spire", genre: "Strategy", platform: "Steam", time: "15–25 hrs", color: "#714B40", tag: "Deck building", description: "Build a deck and adapt your strategy on every run." },
];


type Game = (typeof games)[number];
type Task = { id: number; title: string; done: boolean };
type CompletedGame = {
  id: string;
  game: Game;
  completedAt: string;
  rating: number;
  liked: string[];
  disliked: string[];
  review: string;
};

const mechanicOptions = [
  "Exploration", "Combat", "Puzzle-solving", "Team building", "Story", "Progression",
  "Customization", "Strategy", "Relaxing pace", "Challenge", "Characters", "World design",
];

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};


const initialTasks = [
  { id: 1, title: "Escape the first area", done: true },
  { id: 2, title: "Complete 5 main objectives", done: true },
  { id: 3, title: "Discover 3 new areas", done: false },
  { id: 4, title: "Defeat the next major boss", done: false },
  { id: 5, title: "Finish the main story", done: false },
];

const navItems = [
  { name: "Home", icon: Home },
  { name: "My Library", icon: Library },
  { name: "Journal", icon: BookOpen },
  { name: "Reports", icon: ChartNoAxesColumn },
  { name: "Settings", icon: Settings },
];

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("nextquest-token") || "");
  const [user, setUser] = useState<AuthUser | null>(() => readStorage<AuthUser | null>("nextquest-user", null));
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [activeGame, setActiveGame] = useState<Game>(() => readStorage<Game>("nextquest-active-game", games[0]));
  const [tasks, setTasks] = useState<Task[]>(() => readStorage<Task[]>("nextquest-tasks", initialTasks));
  const [completedGames, setCompletedGames] = useState<CompletedGame[]>(() => readStorage<CompletedGame[]>("nextquest-completed-games", []));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [storageNotice, setStorageNotice] = useState("Saved on this device");

  useEffect(() => {
    try {
      localStorage.setItem("nextquest-active-game", JSON.stringify(activeGame));
      localStorage.setItem("nextquest-tasks", JSON.stringify(tasks));
      localStorage.setItem("nextquest-completed-games", JSON.stringify(completedGames));
      if (!token) setStorageNotice("Saved on this device");
    } catch {
      setStorageNotice("Browser storage unavailable");
    }
  }, [activeGame, tasks, completedGames, token]);

  async function requestApi(path: string, options: RequestInit = {}, authToken = token) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function applyCloudState(state: CloudState) {
    if (state.activeGame) setActiveGame(state.activeGame);
    if (Array.isArray(state.tasks)) setTasks(state.tasks);
    if (Array.isArray(state.completedGames)) setCompletedGames(state.completedGames);
  }

  async function connectAccount(nextToken: string, nextUser: AuthUser) {
    localStorage.setItem("nextquest-token", nextToken);
    localStorage.setItem("nextquest-user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setStorageNotice("Loading cloud save…");
    try {
      const data = await requestApi("/sync", {}, nextToken);
      if (data.state) {
        applyCloudState(data.state as CloudState);
        setStorageNotice("Synced from cloud");
      } else {
        // A brand-new account must start with a clean save.
        // Never import this browser's shared localStorage into another account.
        const localState: CloudState = {
          activeGame: games[0],
          tasks: initialTasks,
          completedGames: [],
        };
        await requestApi("/sync", { method: "PUT", body: JSON.stringify({ state: localState }) }, nextToken);
        applyCloudState(localState);
        setStorageNotice("New account save initialized");
      }
      setSyncReady(true);
    } catch (error) {
      setStorageNotice("Cloud connection failed");
      setAuthError(error instanceof Error ? error.message : "Could not load your cloud save.");
      setSyncReady(false);
    }
  }

  useEffect(() => {
    if (!token || !user) {
      setSyncReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setStorageNotice("Connecting to cloud…");
      try {
        const data = await requestApi("/sync", {}, token);
        if (cancelled) return;
        if (data.state) {
          applyCloudState(data.state as CloudState);
          setStorageNotice("Synced from cloud");
        } else {
          // A brand-new account must start with a clean save.
          // Never import this browser's shared localStorage into another account.
          const localState: CloudState = {
            activeGame: games[0],
            tasks: initialTasks,
            completedGames: [],
          };
          await requestApi("/sync", { method: "PUT", body: JSON.stringify({ state: localState }) }, token);
          if (cancelled) return;
          applyCloudState(localState);
          setStorageNotice("New account save initialized");
        }
        setSyncReady(true);
      } catch (error) {
        if (!cancelled) {
          setStorageNotice("Cloud connection failed");
          setAuthError(error instanceof Error ? error.message : "Could not connect to the backend.");
          setSyncReady(false);
        }
      }
    })();
    return () => { cancelled = true; };
  // Run when the active account changes; requestApi is intentionally kept local to this component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !user || !syncReady) return;
    const timeout = window.setTimeout(async () => {
      setStorageNotice("Syncing…");
      try {
        await requestApi("/sync", {
          method: "PUT",
          body: JSON.stringify({ state: { activeGame, tasks, completedGames } satisfies CloudState }),
        }, token);
        setStorageNotice("Synced to cloud");
      } catch (error) {
        setStorageNotice("Sync failed");
        setAuthError(error instanceof Error ? error.message : "Could not sync your save.");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame, tasks, completedGames, token, user?.id, syncReady]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const data = await requestApi(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      }, "");
      await connectAccount(data.token as string, data.user as AuthUser);
      setAuthPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem("nextquest-token");
    localStorage.removeItem("nextquest-user");
    setToken("");
    setUser(null);
    setSyncReady(false);
    setStorageNotice("Saved on this device");
    setAuthError("");
  }
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const completed = tasks.filter((task) => task.done).length;
  const progress = Math.round((completed / tasks.length) * 100);
  const chartData = [
    { name: "Completed", value: completed },
    { name: "Remaining", value: tasks.length - completed },
  ];

  const filteredGames = games.filter((game) =>
    `${game.name} ${game.genre} ${game.tag}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  
const [platformFilter, setPlatformFilter] = useState("All");
const [genreFilter, setGenreFilter] = useState("All");

const libraryGames = games.filter((game) => {
  const matchesSearch =
    `${game.name} ${game.genre} ${game.tag}`
      .toLowerCase()
      .includes(query.toLowerCase());

  const matchesPlatform =
    platformFilter === "All" || game.platform === platformFilter;

  const matchesGenre =
    genreFilter === "All" || game.genre === genreFilter;

  return matchesSearch && matchesPlatform && matchesGenre;
});

const platforms = ["All", ...new Set(games.map((game) => game.platform))];
const genres = ["All", ...new Set(games.map((game) => game.genre))];


  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function startChallenge(game: Game) {
    setActiveGame(game);
    setTasks([
      { id: 1, title: "Start the game and learn the basics", done: false },
      { id: 2, title: "Explore the main gameplay systems", done: false },
      { id: 3, title: "Complete a major milestone", done: false },
      { id: 4, title: "Try optional content or a side objective", done: false },
      { id: 5, title: "Reach the ending or finish the main story", done: false },
    ]);
    setActiveNav("Home");
  }

  function toggleMechanic(value: string, group: "liked" | "disliked") {
    const setter = group === "liked" ? setLiked : setDisliked;
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function saveCompletion() {
    if (rating < 1) return;
    const entry: CompletedGame = {
      id: `${activeGame.id}-${Date.now()}`,
      game: activeGame,
      completedAt: new Date().toISOString(),
      rating,
      liked,
      disliked,
      review: review.trim(),
    };
    setCompletedGames((current) => [entry, ...current.filter((item) => item.game.id !== activeGame.id)]);
    setReviewOpen(false);
    setRating(0);
    setLiked([]);
    setDisliked([]);
    setReview("");
    setActiveNav("Journal");
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand auth-brand"><div className="brand-icon"><Gamepad2 size={23} /></div><span>Next<span className="brand-accent">Game</span></span></div>
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR GAMING JOURNEY, SYNCED</div>
          <h1>{authMode === "signup" ? <>Create your <span>account.</span></> : <>Welcome <span>back.</span></>}</h1>
          <p className="welcome-description">Sign in to keep your active game, checklist, reviews, and journal available across devices.</p>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>Email address<input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={72} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            {authError && <p className="auth-error">{authError}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Connecting…" : authMode === "signup" ? "Create account" : "Sign in"} <ChevronRight size={16} /></button>
          </form>
          <p className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to NextGame?"} <button type="button" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{authMode === "signup" ? "Sign in" : "Create account"}</button></p>
          <p className="auth-footnote">Backend: {API_BASE}. The API must be running for sign-in and cloud sync.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button className="mobile-backdrop" onClick={() => setMobileMenu(false)} aria-label="Close menu" />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Gamepad2 size={23} /></div>
          <span>Next<span className="brand-accent">Game</span></span>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${activeNav === name ? "nav-active" : ""}`}
              onClick={() => { setActiveNav(name); setMobileMenu(false); }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Home" && <span className="active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">G</div>
          <div className="profile-info">
            <strong>{user.email.split("@")[0]}</strong>
            <span>Level 01 · Explorer</span>
          </div>
          <Settings size={17} className="profile-settings" />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
            <div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{activeNav}</strong></div>
          </div>
          <div className="topbar-right">
            <span className="status-indicator"><span /> {storageNotice}</span>
            <div className="profile-avatar small-avatar">G</div>
          </div>
        </header>

        <div className="page-content">
          
{activeNav === "My Library" ? (
  <section className="library-page">
    <div className="eyebrow">
      <span className="eyebrow-line" /> YOUR GAME COLLECTION
    </div>
    <h1>My <span>library.</span></h1>
    <p className="welcome-description">
      Find your next challenge across genres and platforms.
    </p>

    <label className="search-box library-search">
      <Search size={17} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search games, genres, or mechanics..."
      />
    </label>

    <div className="library-filters">
      <label>
        <span>Platform</span>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          {platforms.map((platform) => (
            <option key={platform}>{platform}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Genre</span>
        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          {genres.map((genre) => (
            <option key={genre}>{genre}</option>
          ))}
        </select>
      </label>

      <span className="library-count">{libraryGames.length} games</span>
    </div>

    <div className="library-grid">
      {libraryGames.map((game) => (
        <article className="library-card" key={game.id}>
          <div className="library-art" style={{ background: game.color }}>
            <Gamepad2 size={38} strokeWidth={1.2} />
            <span>{game.platform}</span>
          </div>

          <div className="library-card-body">
            <div className="library-card-tag">{game.genre}</div>
            <h3>{game.name}</h3>
            <p>{game.description}</p>
            <div className="library-card-footer">
              <span><Clock3 size={14} /> {game.time}</span>
              <button className="primary-button" onClick={() => startChallenge(game)}>
                Start challenge <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </article>
      ))}

      {libraryGames.length === 0 && (
        <p className="empty-state">No games match these filters.</p>
      )}
    </div>
  </section>
) : (
  <>
    {activeNav === "Journal" ? (
      <section className="library-page">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR PLAY HISTORY</div>
        <h1>Game <span>journal.</span></h1>
        <p className="welcome-description">Finished games, your ratings, and what you learned about your preferences.</p>
        <div className="journal-summary"><History size={20} /><div><strong>{completedGames.length} games finished</strong><span>Only games you explicitly mark as finished appear here.</span></div></div>
        {completedGames.length ? <div className="history-list">{completedGames.map((entry) => (
          <article className="history-card" key={entry.id}>
            <div className="history-art" style={{ background: entry.game.color }}><Trophy size={25} /></div>
            <div className="history-content"><div className="library-card-tag">{entry.game.genre} · {entry.game.platform}</div><h3>{entry.game.name}</h3><div className="history-meta"><span>{new Date(entry.completedAt).toLocaleDateString()}</span><span className="rating-display">{"★".repeat(entry.rating)}{"☆".repeat(5-entry.rating)} <small>{entry.rating}/5</small></span></div>
              {entry.review && <p>{entry.review}</p>}
              {entry.liked.length > 0 && <div className="tag-line"><strong>Liked:</strong> {entry.liked.join(", ")}</div>}
              {entry.disliked.length > 0 && <div className="tag-line"><strong>Less liked:</strong> {entry.disliked.join(", ")}</div>}
            </div>
          </article>
        ))}</div> : <div className="empty-panel"><Trophy size={28} /><h2>Your story starts at the ending.</h2><p>When you finish a game's main story, select “I finished this game” on the Home page and leave your first review.</p><button className="secondary-button" onClick={() => setActiveNav("Home")}>Back to current game</button></div>}
      </section>
    ) : activeNav === "Reports" ? (
      <section className="library-page"><div className="eyebrow"><span className="eyebrow-line" /> YOUR PROGRESS</div><h1>Monthly <span>report.</span></h1><p className="welcome-description">A simple snapshot of your finished games and ratings, based on your saved journal.</p>
        <div className="report-grid"><div className="stat-card"><div className="stat-top">Games finished <Trophy size={18}/></div><div className="stat-value">{completedGames.length.toString().padStart(2,"0")}</div><div className="stat-foot">All-time completions</div></div><div className="stat-card"><div className="stat-top">Average rating <Star size={18}/></div><div className="stat-value">{completedGames.length ? (completedGames.reduce((sum, item) => sum + item.rating, 0) / completedGames.length).toFixed(1) : "—"}<span className="stat-muted"> / 5</span></div><div className="stat-foot">From your reviews</div></div><div className="stat-card"><div className="stat-top">Most explored genre <Compass size={18}/></div><div className="stat-value report-genre">{completedGames.length ? Object.entries(completedGames.reduce<Record<string, number>>((acc, item) => ({...acc, [item.game.genre]: (acc[item.game.genre] || 0) + 1}), {})).sort((a,b) => b[1]-a[1])[0][0] : "—"}</div><div className="stat-foot">Among completed games</div></div></div>
        <div className="panel report-note"><h2>Next step</h2><p>Once you have several reviews, NextGame can use liked and disliked mechanics to make more informed recommendations. Reports currently summarize only data you have saved.</p></div>
      </section>
    ) : activeNav === "Settings" ? (
      <section className="library-page"><div className="eyebrow"><span className="eyebrow-line" /> APP PREFERENCES</div><h1>Settings<span>.</span></h1><p className="welcome-description">Manage where your progress is stored.</p><div className="panel settings-panel"><Database size={23} className="muted-icon"/><div><h2>Local storage</h2><p>Your account is <strong>{user.email}</strong>. Progress and reviews are saved locally and synced to your PostgreSQL-backed account when the API is reachable.</p><span className="settings-status">{storageNotice}</span><div><button className="secondary-button signout-button" onClick={signOut}>Sign out</button></div></div></div><div className="panel settings-panel"><h2>Cross-device sync</h2><p>Your account syncs the active game, checklist, completed games, ratings, and reviews. Sign in with the same account on another device to load this save.</p><span className={`settings-status ${storageNotice.includes("failed") || storageNotice.includes("Failed") ? "pending" : ""}`}>{storageNotice}</span></div></section>
    ) : (
      <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL GAMING JOURNAL</div>
              <h1>{activeNav === "Home" ? <>Your next adventure<br /><span>starts here.</span></> : activeNav}</h1>
              <p className="welcome-description">
                {activeNav === "Home"
                  ? "One game at a time. Discover something new, and see it through."
                  : `Your ${activeNav.toLowerCase()} will grow as you play, review, and complete games.`}
              </p>
            </div>
            <button className="secondary-button" onClick={() => setActiveNav("My Library")}>
              <Library size={17} /> My library
            </button>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top"><span>Active challenge</span><Gamepad2 size={18} /></div>
              <div className="stat-value">01</div>
              <div className="stat-foot">Your current game</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Objectives cleared</span><CheckCircle2 size={18} /></div>
              <div className="stat-value">{completed}<span className="stat-muted"> / {tasks.length}</span></div>
              <div className="stat-foot">Across your active challenge</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Games completed</span><Compass size={18} /></div>
              <div className="stat-value">{completedGames.length.toString().padStart(2, "0")}</div>
              <div className="stat-foot">Finished games in your journal</div>
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <div className="section-kicker">IN PROGRESS</div>
                <h2>Current challenge</h2>
              </div>
              <span className="playing-badge"><span /> Playing</span>
            </div>

            <div className="challenge-card">
              <div className="challenge-art">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <Gamepad2 size={72} strokeWidth={0.8} />
                <span className="art-caption">YOUR ACTIVE QUEST</span>
              </div>
              <div className="challenge-main">
                <div className="game-platform">{activeGame.platform.toUpperCase()} <span /> {activeGame.genre.toUpperCase()}</div>
                <h3>{activeGame.name}</h3>
                <p className="game-description">{activeGame.description}</p>
                <div className="challenge-meta">
                  <span><Clock3 size={15} /> Est. {activeGame.time}</span>
                  <span><CheckCircle2 size={15} /> {completed} of {tasks.length} objectives</span>
                </div>
                <div className="progress-label"><span>Overall completion</span><strong>{progress}%</strong></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <button className="primary-button" onClick={() => document.getElementById("objectives")?.scrollIntoView({ behavior: "smooth" })}>
                  Continue challenge <ChevronRight size={17} />
                </button>
                <button className="finish-button" onClick={() => setReviewOpen(true)}>
                  <Trophy size={16} /> I finished this game
                </button>
              </div>
              <div className="challenge-chart">
                <div className="chart-title">COMPLETION</div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" innerRadius="76%" outerRadius="94%" startAngle={90} endAngle={-270} paddingAngle={3} stroke="none">
                        <Cell fill="#34D399" />
                        <Cell fill="#29352F" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="chart-center"><strong>{progress}%</strong><span>complete</span></div>
                </div>
                <div className="chart-legend"><span className="legend-dot" /> Objectives</div>
              </div>
            </div>
          </section>

          <section className="lower-grid">
            <div className="panel objectives-panel" id="objectives">
              <div className="panel-heading">
                <div><div className="section-kicker">YOUR CHECKLIST</div><h2>Quest objectives</h2></div>
                <span className="count-pill">{completed}/{tasks.length}</span>
              </div>
              <div className="task-list">
                {tasks.map((task) => (
                  <button key={task.id} className={`task-row ${task.done ? "task-done" : ""}`} onClick={() => toggleTask(task.id)}>
                    {task.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                    <span>{task.title}</span>
                    <span className="task-status">{task.done ? "DONE" : "TODO"}</span>
                  </button>
                ))}
              </div>
              <div className="panel-footnote">Your progress updates as you check off objectives.</div>
            </div>

            <div className="panel discover-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">STEP OUTSIDE YOUR COMFORT ZONE</div><h2>Discover next</h2></div>
                <Compass size={19} className="muted-icon" />
              </div>
              <p className="discover-description">A few starting points across different genres. Your feedback will shape future picks.</p>
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games or genres..." />
                {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
              </label>
              <div className="game-list">
                {filteredGames.slice(0, showAll ? undefined : 3).map((game, i) => (
                  <div className="game-row" key={game.name}>
                    <div className="game-cover" style={{ background: game.color }}>
                      <span>{game.name.split(" ").map((word) => word[0]).join("")}</span>
                    </div>
                    <div className="game-row-info">
                      <strong>{game.name}</strong>
                      <span>{game.genre} · {game.platform}</span>
                      <small>{game.tag}</small>
                    </div>
                    <span className="game-time">{game.time}</span>
                  </div>
                ))}
                {filteredGames.length === 0 && <p className="empty-state">No matches. Try another title or genre.</p>}
              </div>
              <button className="text-button" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show less" : "Explore all suggestions"} <ChevronRight size={16} />
              </button>
            </div>
          </section>

          <footer className="footer"><span>NEXTGAME <span className="footer-dot">/</span> YOUR GAME, YOUR JOURNEY</span><span>Built for the joy of finishing.</span></footer>
      </>
    )}
  </>
)}
        </div>
      </main>
      {reviewOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
          <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <button className="modal-close" onClick={() => setReviewOpen(false)} aria-label="Close review"><X size={19}/></button>
            <div className="eyebrow"><span className="eyebrow-line" /> QUEST COMPLETE</div>
            <h2 id="review-title">You finished <span>{activeGame.name}.</span></h2>
            <p className="review-intro">A few quick notes help build your gaming profile. Your rating is required; the rest is optional.</p>
            <div className="rating-picker"><span>Overall rating</span><div>{[1,2,3,4,5].map((value) => <button key={value} aria-label={`Rate ${value} out of 5`} className={value <= rating ? "star-selected" : ""} onClick={() => setRating(value)}><Star size={27} fill={value <= rating ? "currentColor" : "none"}/></button>)}</div><small>{rating ? `${rating} out of 5` : "Select a rating"}</small></div>
            <div className="mechanic-group"><label>What did you like?</label><div className="mechanic-options">{mechanicOptions.map((item) => <button key={item} className={liked.includes(item) ? "mechanic-selected" : ""} onClick={() => toggleMechanic(item, "liked")}>{item}</button>)}</div></div>
            <div className="mechanic-group"><label>What did you like less?</label><div className="mechanic-options">{mechanicOptions.map((item) => <button key={item} className={disliked.includes(item) ? "mechanic-disliked" : ""} onClick={() => toggleMechanic(item, "disliked")}>{item}</button>)}</div></div>
            <label className="review-label">Your thoughts <span>Optional</span><textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="What stood out? Would you recommend it?" rows={3}/></label>
            {rating === 0 && <p className="form-hint">Choose a star rating to save your review.</p>}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setReviewOpen(false)}>Cancel</button><button className="primary-button" disabled={rating === 0} onClick={saveCompletion}><Send size={15}/> Save review</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
