/* hub.js: shared by every page.
   - Accounts (username + password, stored server-side as a salted hash) so your identity and history follow you.
   - Lobby: one 4-letter code. Host picks a game, everyone readies up, host starts, everyone jumps in together.
   - In a game: a slim top bar with Return to lobby, who is here, and (host only) quick-jump to another game.
   - The lobby page (index.html) uses HUB.* for logic and draws its own UI. Games just load this file.
   Hand-off to games: HUB.entry() -> {code, role:"host"|"join"} | null, HUB.waitRoom(table, code, ms). */
(function () {
  "use strict";
  if (window.HUB) return;

  var SB_URL = "https://gyvgzeculdaxcwinblld.supabase.co";
  var SB_KEY = "sb_publishable_kS8hQSqZR8Sog9imuq8dCg_-6iBy2Hi";
  var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var POLL_MS = 2500, PRESENCE_MS = 10000, ACTIVE_MS = 45000, FOLLOW_SECS = 4, FRESH_START_MS = 60000;

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function rnd(n) { var s = ""; for (var i = 0; i < n; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function base(u) { return String(u || "").split("?")[0].split("#")[0].split("/").pop().toLowerCase() || "index.html"; }
  function here() { return base(location.pathname); }
  var ROOT = (function () {
    var p = location.pathname.replace(/[^\/]*$/, "");
    p = p.replace(/\/(Buddy|Data)\/$/i, "/");
    return location.origin + p;
  })();
  function resolve(u) { try { return new URL(u, ROOT).href; } catch (e) { return u; } }

  /* ---------- identity (shared with every game) ---------- */
  function uid() {
    var v = ls.get("hub_uid");
    if (!v) { v = "u" + Math.random().toString(36).slice(2, 11); ls.set("hub_uid", v); }
    return v;
  }
  function myName() { return (ls.get("hub_name") || "").trim(); }

  /* ---------- games ---------- */
  var FALLBACK = [
    { name: "Cold Read", emoji: "◍", url: "coldcase.html", status: "demo" },
    { name: "Liar's Dice", emoji: "🎲", url: "liars-dice.html", status: "demo" },
    { name: "Last Man Standing", emoji: "🏆", url: "lastman.html", status: "demo" },
    { name: "Whatcha Thinking", emoji: "🤔", url: "whatcha.html", status: "demo" },
    { name: "Wits & Wagers", emoji: "🎯", url: "wagers.html", status: "demo" },
    { name: "Gut Check", emoji: "🎚️", url: "gutcheck.html", status: "demo" },
    { name: "The Herd", emoji: "🐑", url: "herd.html", status: "demo" },
    { name: "Kindred", emoji: "🧵", url: "kindred.html", status: "demo" },
    { name: "Pillow Talk", emoji: "💕", url: "pillowtalk.html", status: "demo" },
    { name: "Blood on the Clocktower", emoji: "🕯️", url: "clocktower.html", status: "demo" },
    { name: "Brainy Bender", emoji: "🧠", url: "brainybender.html", status: "demo" },
    { name: "TV Companion", emoji: "📺", url: "tv_companion.html", status: "demo" },
    { name: "Office Buddy", emoji: "🙂", url: "Buddy/buddy.html", status: "demo" }
  ];
  var catalog = FALLBACK.slice();
  var MAXP = { "pillowtalk.html": 2 };
  /* games that keep a room per code; the host's arrival wipes any stale room so the lobby code can be reused */
  var CFG = {
    "coldcase.html": { players: [{ table: "players", nullCol: "game_key" }], rooms: ["games"] },
    "liars-dice.html": { players: [{ table: "ld_players" }], rooms: ["ld_games"] },
    "lastman.html": { players: [{ table: "players", eq: { game_key: "lastman" } }], rooms: ["lms_rooms"] },
    "whatcha.html": { players: [{ table: "wt_players" }], rooms: ["wt_rooms"] },
    "wagers.html": { players: [{ table: "wag_players" }], rooms: ["wag_rooms"] },
    "gutcheck.html": { players: [{ table: "gc_players" }], rooms: ["gc_rooms"] },
    "herd.html": { players: [{ table: "hm_players" }], rooms: ["hm_rooms"] },
    "kindred.html": { players: [{ table: "kd_players" }], rooms: ["kd_rooms"] },
    "pillowtalk.html": { players: [{ table: "pt_answers", by: "room" }, { table: "pt_players", by: "room" }], rooms: ["pt_rooms"] },
    "clocktower.html": { players: [{ table: "botc_players" }], rooms: ["botc_rooms"] }
  };
  function gameByFile(f) { for (var i = 0; i < catalog.length; i++) if (base(catalog[i].url) === f) return catalog[i]; return null; }
  function gameName(f) { var g = gameByFile(f); return g ? g.name : String(f || "").replace(".html", ""); }
  function gameEmoji(f) { var g = gameByFile(f); return (g && g.emoji) || "🎮"; }
  function playable() { return catalog.filter(function (g) { return g.url && (g.status === "live" || g.status === "demo" || !g.status); }); }

  /* ---------- supabase ---------- */
  var _sb = null, _sbWait = null;
  function sb() {
    if (_sb) return _sb;
    if (window.supabase && window.supabase.createClient) {
      try { _sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); } catch (e) {}
    }
    return _sb;
  }
  function ensureSb() {
    if (sb()) return Promise.resolve(sb());
    if (_sbWait) return _sbWait;
    _sbWait = new Promise(function (res) {
      var t0 = Date.now(), injected = false;
      var iv = setInterval(function () {
        if (sb()) { clearInterval(iv); res(sb()); return; }
        if (!injected && Date.now() - t0 > 1200) {
          injected = true;
          var s = document.createElement("script"); s.src = "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"; document.head.appendChild(s);
        }
        if (Date.now() - t0 > 12000) { clearInterval(iv); res(null); }
      }, 120);
    });
    return _sbWait;
  }

  /* ---------- accounts ---------- */
  var acct = null;   // {uid, display_name, username}
  function applyAccount(a, token) {
    acct = { uid: a.uid, display_name: a.display_name, username: a.username };
    if (token) ls.set("hub_token", token);
    ls.set("hub_uid", a.uid); ls.set("hub_name", a.display_name); ls.set("hub_user", a.username);
  }
  function rpc(fn, args) {
    return ensureSb().then(function (cl) {
      if (!cl) return { error: "Can't reach the server. Check your connection." };
      return cl.rpc(fn, args).then(function (r) {
        if (r.error) return { error: r.error.message || "Something went wrong." };
        var d = r.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
        return d || { error: "No response." };
      }, function () { return { error: "Can't reach the server." }; });
    });
  }
  var account = {
    user: function () { return acct; },
    login: function (username, password) {
      return rpc("hub_login", { p_username: username, p_password: password }).then(function (d) { if (!d.error) applyAccount(d, d.token); notify(); return d; });
    },
    register: function (username, password, display, email, phone) {
      return rpc("hub_register", { p_username: username, p_password: password, p_display: display, p_email: email || null, p_phone: phone || null }).then(function (d) { if (!d.error) applyAccount(d, d.token); notify(); return d; });
    },
    resume: function () {
      var t = ls.get("hub_token"); if (!t) return Promise.resolve(null);
      return rpc("hub_resume", { p_token: t }).then(function (d) {
        if (d && !d.error) { applyAccount(d, null); notify(); return acct; }
        if (d && d.error && /session/i.test(d.error)) { ls.del("hub_token"); ls.del("hub_user"); }
        return null;
      });
    },
    logout: function () {
      var t = ls.get("hub_token"); acct = null;
      ls.del("hub_token"); ls.del("hub_user");
      ls.set("hub_uid", "u" + Math.random().toString(36).slice(2, 11));   // never leave the account's id on a shared phone
      ls.del("hub_name");
      notify();
      return t ? rpc("hub_logout", { p_token: t }) : Promise.resolve({});
    },
    profile: function () { var t = ls.get("hub_token"); return t ? rpc("hub_get_profile", { p_token: t }) : Promise.resolve({ error: "Log in first." }); },
    updateProfile: function (display, email, phone, profile) {
      var t = ls.get("hub_token"); if (!t) return Promise.resolve({ error: "Log in first." });
      return rpc("hub_update_profile", { p_token: t, p_display: display || null, p_email: email || null, p_phone: phone || null, p_profile: profile || null }).then(function (d) { if (d && !d.error && d.display_name) { ls.set("hub_name", d.display_name); if (acct) acct.display_name = d.display_name; } notify(); return d; });
    }
  };

  /* ---------- lobby ---------- */
  var S = { lobby: null, members: [], me: null, isHost: false, hostActive: true, ready: false, loaded: false };
  var listeners = [], startHandlers = [];
  var prevNonce = null, lastBeat = 0, chan = null, chanCode = null, refreshing = false;
  function notify() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](S); } catch (e) {} } }
  function code() { return (ls.get("hub_lobby") || "").toUpperCase(); }
  function setCode(c) { if (c) ls.set("hub_lobby", c.toUpperCase()); else ls.del("hub_lobby"); }
  function inviteLink(c) { return resolve("index.html") + "?lobby=" + (c || code()); }
  function nowISO() { return new Date().toISOString(); }
  function isActive(m) { return m && m.last_seen && (Date.now() - new Date(m.last_seen).getTime() < ACTIVE_MS); }

  function heartbeat(cl, force) {
    var now = Date.now();
    if (!force && now - lastBeat < PRESENCE_MS) return Promise.resolve();
    lastBeat = now;
    return cl.from("hub_members").upsert({ uid: uid(), code: code(), name: myName() || "Player", here: here(), last_seen: nowISO() }, { onConflict: "uid" });
  }

  function refresh(force) {
    var c = code();
    if (!c) { S = { lobby: null, members: [], me: null, isHost: false, hostActive: true, ready: false, loaded: true }; prevNonce = null; unsubscribe(); notify(); return Promise.resolve(S); }
    if (refreshing && !force) return Promise.resolve(S);
    refreshing = true;
    return ensureSb().then(function (cl) {
      if (!cl) { refreshing = false; notify(); return S; }
      subscribe(cl, c);
      return heartbeat(cl, force).then(function () {
        return Promise.all([
          cl.from("hub_lobbies").select("*").eq("code", c).maybeSingle(),
          cl.from("hub_members").select("*").eq("code", c).order("joined_at")
        ]);
      }).then(function (rs) {
        var lr = rs[0], mr = rs[1];
        if (lr && !lr.error && lr.data === null) {          // lobby no longer exists
          setCode(""); refreshing = false; return refresh(true);
        }
        if (lr && lr.data) {
          var lobby = lr.data, members = ((mr && mr.data) || []).filter(isActive);
          var me = members.filter(function (m) { return m.uid === uid(); })[0] || null;
          var host = members.filter(function (m) { return m.uid === lobby.host_uid; })[0] || null;
          S = { lobby: lobby, members: members, me: me, isHost: lobby.host_uid === uid(), hostActive: !!host, ready: !!(me && me.ready), loaded: true };
          var n = Number(lobby.nonce) || 0;
          if (prevNonce === null) prevNonce = n;
          else if (n !== prevNonce) {
            prevNonce = n;
            var fresh = lobby.updated_at && (Date.now() - new Date(lobby.updated_at).getTime() < FRESH_START_MS);
            if (lobby.phase === "playing" && lobby.game && fresh && lobby.host_uid !== uid()) {
              for (var i = 0; i < startHandlers.length; i++) { try { startHandlers[i](lobby); } catch (e) {} }
            }
          }
        }
        refreshing = false; notify(); return S;
      });
    }).catch(function () { refreshing = false; notify(); return S; });
  }

  function subscribe(cl, c) {
    if (chan && chanCode === c) return;
    unsubscribe();
    try {
      chanCode = c;
      chan = cl.channel("hub:" + c)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_lobbies", filter: "code=eq." + c }, function () { refresh(false); })
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_members", filter: "code=eq." + c }, function () { refresh(false); })
        .subscribe();
    } catch (e) { chan = null; chanCode = null; }
  }
  function unsubscribe() { try { if (chan && sb()) sb().removeChannel(chan); } catch (e) {} chan = null; chanCode = null; }

  function pickCode(cl, i) {
    var c = rnd(4);
    if (i >= 8) return Promise.resolve(c);
    return cl.from("hub_lobbies").select("code,updated_at").eq("code", c).maybeSingle().then(function (r) {
      if (!r.data) return c;
      var old = Date.now() - new Date(r.data.updated_at).getTime() > 12 * 3600 * 1000;
      return old ? c : pickCode(cl, i + 1);
    });
  }
  var lobby = {
    state: function () { return S; },
    code: code,
    inviteLink: inviteLink,
    onChange: function (fn) { listeners.push(fn); },
    onStart: function (fn) { startHandlers.push(fn); },
    refresh: refresh,
    create: function (name) {
      name = (name || myName()).trim();
      if (!name) return Promise.resolve({ error: "Enter your name first." });
      ls.set("hub_name", name);
      return ensureSb().then(function (cl) {
        if (!cl) return { error: "Can't reach the server. Check your connection." };
        return pickCode(cl, 0).then(function (c) {
          return cl.from("hub_lobbies").upsert({ code: c, host_uid: uid(), game: null, phase: "idle", nonce: 0, updated_at: nowISO() }, { onConflict: "code" }).then(function (r) {
            if (r.error) return { error: r.error.message + " (Run supabase_setup.sql in Supabase.)" };
            return cl.from("hub_members").delete().eq("code", c).then(function () {
              return cl.from("hub_members").upsert({ uid: uid(), code: c, name: name, ready: false, here: here(), joined_at: nowISO(), last_seen: nowISO() }, { onConflict: "uid" });
            }).then(function (m) {
              if (m.error) return { error: m.error.message };
              setCode(c); prevNonce = null; lastBeat = Date.now();
              return refresh(true).then(function () { return { code: c }; });
            });
          });
        });
      });
    },
    join: function (c, name) {
      c = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      name = (name || myName()).trim();
      if (c.length < 4) return Promise.resolve({ error: "Enter the 4-letter lobby code." });
      if (!name) return Promise.resolve({ error: "Enter your name first." });
      ls.set("hub_name", name);
      return ensureSb().then(function (cl) {
        if (!cl) return { error: "Can't reach the server. Check your connection." };
        return cl.from("hub_lobbies").select("code").eq("code", c).maybeSingle().then(function (r) {
          if (r.error) return { error: r.error.message + " (Run supabase_setup.sql in Supabase.)" };
          if (!r.data) return { error: "No lobby with that code." };
          return cl.from("hub_members").upsert({ uid: uid(), code: c, name: name, ready: false, here: here(), joined_at: nowISO(), last_seen: nowISO() }, { onConflict: "uid" }).then(function (m) {
            if (m.error) return { error: m.error.message };
            setCode(c); prevNonce = null; lastBeat = Date.now();
            return refresh(true).then(function () { return { code: c }; });
          });
        });
      });
    },
    leave: function () {
      var c = code(), st = S, me = uid();
      setCode("");
      return ensureSb().then(function (cl) {
        if (!cl || !c) return;
        var others = (st.members || []).filter(function (m) { return m.uid !== me; });
        var chain = cl.from("hub_members").delete().eq("uid", me);
        return chain.then(function () {
          if (st.lobby && st.lobby.host_uid === me) {
            if (others.length) return cl.from("hub_lobbies").update({ host_uid: others[0].uid, updated_at: nowISO() }).eq("code", c).eq("host_uid", me);
            return cl.from("hub_lobbies").delete().eq("code", c);
          }
        });
      }).then(function () { return refresh(true); }, function () { return refresh(true); });
    },
    giveHost: function (toUid) {
      var c = code(); if (!c || !S.isHost) return Promise.resolve();
      return ensureSb().then(function (cl) { return cl.from("hub_lobbies").update({ host_uid: toUid, updated_at: nowISO() }).eq("code", c).eq("host_uid", uid()); }).then(function () { return refresh(true); });
    },
    claimHost: function () {
      var c = code(); if (!c || S.isHost || S.hostActive || !S.lobby) return Promise.resolve();
      return ensureSb().then(function (cl) { return cl.from("hub_lobbies").update({ host_uid: uid(), updated_at: nowISO() }).eq("code", c).eq("host_uid", S.lobby.host_uid); }).then(function () { return refresh(true); });
    },
    pickGame: function (file) {
      var c = code(); if (!c || !S.isHost) return Promise.resolve();
      return ensureSb().then(function (cl) {
        return cl.from("hub_members").update({ ready: false }).eq("code", c).then(function () {
          return cl.from("hub_lobbies").update({ game: file, phase: "ready", updated_at: nowISO() }).eq("code", c).eq("host_uid", uid());
        });
      }).then(function () { return refresh(true); });
    },
    unpick: function () {
      var c = code(); if (!c || !S.isHost) return Promise.resolve();
      return ensureSb().then(function (cl) { return cl.from("hub_lobbies").update({ game: null, phase: "idle", updated_at: nowISO() }).eq("code", c).eq("host_uid", uid()); }).then(function () { return refresh(true); });
    },
    setReady: function (v) {
      var c = code(); if (!c) return Promise.resolve();
      return ensureSb().then(function (cl) { return cl.from("hub_members").update({ ready: !!v, last_seen: nowISO() }).eq("uid", uid()); }).then(function () { return refresh(true); });
    },
    /* host: start (or quick-jump to) a game for everyone */
    start: function (file) {
      var c = code(); file = file || (S.lobby && S.lobby.game);
      if (!c || !file || !S.isHost) return Promise.resolve({ error: "Only the host can start a game." });
      var g = gameByFile(file); var url = g ? g.url : file;
      return Promise.resolve(CFG[file] ? resetRoom(file, c) : null).then(function () {
        return ensureSb();
      }).then(function (cl) {
        return cl.from("hub_lobbies").update({ game: file, phase: "playing", nonce: Date.now(), updated_at: nowISO() }).eq("code", c).eq("host_uid", uid());
      }).then(function (r) {
        if (r && r.error) return { error: r.error.message };
        location.href = resolve(url) + (CFG[file] ? "?lobby=" + c + "&role=host" : "");
        return { ok: true };
      });
    },
    joinGameNow: function (file) {
      var g = gameByFile(file), url = g ? g.url : file;
      location.href = resolve(url) + (CFG[file] ? "?lobby=" + code() + "&role=join" : "");
    },
    toLobby: function () { location.href = resolve("index.html"); }
  };

  /* ---------- hand-off into a game ---------- */
  var _entry;
  function entry() {
    if (_entry !== undefined) return _entry;
    var p, L, role;
    try { p = new URLSearchParams(location.search); } catch (e) { _entry = null; return null; }
    L = (p.get("lobby") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    role = p.get("role");
    if (!L) { _entry = null; return null; }
    if (here() !== "index.html") {
      setCode(L);
      _entry = (role === "host" || role === "join") ? { code: L, role: role } : null;
      p.delete("lobby"); p.delete("role");
      var q = p.toString();
      try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); } catch (e) {}
    } else { _entry = null; }
    return _entry;
  }
  function waitRoom(table, c, ms) {
    return ensureSb().then(function (cl) {
      if (!cl) return false;
      var t0 = Date.now();
      return new Promise(function (res) {
        (function loop() {
          cl.from(table).select("code").eq("code", c).maybeSingle().then(function (r) {
            if (r && r.data) return res(true);
            if (Date.now() - t0 > (ms || 15000)) return res(false);
            setTimeout(loop, 700);
          }, function () { if (Date.now() - t0 > (ms || 15000)) res(false); else setTimeout(loop, 900); });
        })();
      });
    });
  }
  function resetRoom(file, c) {
    var cfg = CFG[file];
    if (!cfg) return Promise.resolve();
    return ensureSb().then(function (cl) {
      if (!cl) return;
      var chain = Promise.resolve();
      (cfg.players || []).forEach(function (t) {
        chain = chain.then(function () {
          var q = cl.from(t.table).delete().eq(t.by || "code", c);
          if (t.nullCol) q = q.is(t.nullCol, null);
          if (t.eq) Object.keys(t.eq).forEach(function (k) { q = q.eq(k, t.eq[k]); });
          return q;
        }).catch(function () {});
      });
      (cfg.rooms || []).forEach(function (t) { chain = chain.then(function () { return cl.from(t).delete().eq("code", c); }).catch(function () {}); });
      return chain;
    });
  }

  /* ---------- catalog from the pages table (admin.html manages it) ---------- */
  function loadCatalog() {
    try { var c = JSON.parse(sessionStorage.getItem("hub_catalog") || "null"); if (c && c.length) catalog = c; } catch (e) {}
    return ensureSb().then(function (cl) {
      if (!cl) return;
      return cl.from("pages").select("name,emoji,url,status,sort,tag,descr").neq("status", "off").order("sort").order("name").then(function (r) {
        if (r && r.data && r.data.length) {
          var list = r.data.filter(function (g) { return g.url; });
          if (list.length) { catalog = list; try { sessionStorage.setItem("hub_catalog", JSON.stringify(list)); } catch (e) {} notify(); }
        }
      });
    }).catch(function () {});
  }

  /* ---------- the in-game bar (not drawn on the lobby page) ---------- */
  var css = ".hb-bar{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 4px) 10px 4px;background:rgba(14,11,26,.95);border-bottom:1px solid #332853;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:'Space Grotesk',system-ui,sans-serif;color:#E9E3F6;height:calc(env(safe-area-inset-top,0px) + 42px);box-sizing:border-box}" +
    ".hb-sp{height:calc(env(safe-area-inset-top,0px) + 42px)}.hb-bar button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".hb-b{background:#1E1735;color:#E9E3F6;border:1px solid #332853;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;white-space:nowrap}.hb-b.acc{background:#F5B14C;color:#0E0B1A;border-color:#F5B14C}" +
    ".hb-cur{flex:1;min-width:0;text-align:center;font-size:12px;color:#8B82A6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".hb-sheet{position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 46px);z-index:2147483001;background:#171126;border:1px solid #332853;border-radius:16px;box-shadow:0 20px 50px -10px #000;color:#E9E3F6;font-family:'Space Grotesk',system-ui,sans-serif;display:none;max-width:460px;margin:0 auto;padding:14px;max-height:78vh;overflow:auto}.hb-sheet.on{display:block}" +
    ".hb-lab{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B82A6;margin:12px 0 6px}.hb-lab:first-child{margin-top:0}" +
    ".hb-mem{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px}.hb-dot{width:8px;height:8px;border-radius:50%;background:#7DF0A6}" +
    ".hb-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:10px;border-radius:12px;font-size:15px;font-family:inherit;cursor:pointer}.hb-row:active{background:#1E1735}.hb-row .em{width:28px;text-align:center;font-size:20px}" +
    ".hb-go{background:#F5B14C;color:#0E0B1A;border:0;border-radius:12px;padding:12px 16px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;width:100%}" +
    ".hb-ghost{background:#1E1735;color:#E9E3F6;border:1px solid #332853;border-radius:12px;padding:12px 16px;font-size:14px;font-family:inherit;cursor:pointer;width:100%;margin-top:8px}" +
    ".hb-toast{position:fixed;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:2147483002;background:#1E1735;border:1px solid #F5B14C;border-radius:16px;padding:14px;box-shadow:0 20px 50px -10px #000;color:#E9E3F6;font-family:'Space Grotesk',system-ui,sans-serif;display:none;max-width:460px;margin:0 auto}.hb-toast.on{display:block}.hb-tt{font-size:15px;margin-bottom:10px}.hb-tb{display:flex;gap:8px}.hb-tb .hb-ghost{margin-top:0;width:auto}";
  var els = {};
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function mountBar() {
    if (document.getElementById("hub-bar") || here() === "index.html") return;
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    var bar = el("div", "hb-bar"); bar.id = "hub-bar";
    els.home = el("button", "hb-b", "🏠 Lobby");
    els.cur = el("div", "hb-cur", "");
    els.chip = el("button", "hb-b acc", "Lobby");
    bar.appendChild(els.home); bar.appendChild(els.cur); bar.appendChild(els.chip);
    var sp = el("div", "hb-sp"); sp.id = "hub-spacer";
    els.sheet = el("div", "hb-sheet"); els.toast = el("div", "hb-toast"); els.toast.id = "hub-toast";
    document.body.insertBefore(sp, document.body.firstChild);
    document.body.appendChild(bar); document.body.appendChild(els.sheet); document.body.appendChild(els.toast);
    els.home.onclick = function () { lobby.toLobby(); };
    els.chip.onclick = function (e) { e.stopPropagation(); if (!code()) { lobby.toLobby(); return; } els.sheet.classList.toggle("on"); drawSheet(); };
    document.addEventListener("click", function (e) { if (e.target.closest && !e.target.closest(".hb-sheet") && !e.target.closest(".hb-bar")) els.sheet.classList.remove("on"); });
    renderBar();
  }
  function renderBar() {
    if (!els.chip) return;
    var g = gameByFile(here());
    els.cur.textContent = g ? (g.emoji || "🎮") + " " + g.name : "";
    var n = S.members.length;
    els.chip.textContent = code() ? (code() + (n ? " · " + n : "") + " ▾") : "Start a lobby";
    if (els.sheet.classList.contains("on")) drawSheet();
  }
  function hostName() { var m = S.members.filter(function (x) { return S.lobby && x.uid === S.lobby.host_uid; })[0]; return m ? m.name : "the host"; }
  function drawSheet() {
    var h = '<div class="hb-lab">Lobby ' + esc(code()) + " · host: " + esc(hostName()) + "</div>";
    S.members.forEach(function (m) {
      var f = base(m.here || ""), g = gameByFile(f);
      h += '<div class="hb-mem"><span class="hb-dot"></span><span>' + (S.lobby && m.uid === S.lobby.host_uid ? "👑 " : "") + esc(m.name || "Player") + (m.uid === uid() ? " (you)" : "") + '</span><span style="margin-left:auto;color:#8B82A6;font-size:12px">' + (g ? esc((g.emoji || "") + " " + g.name) : "🏠 lobby") + "</span></div>";
    });
    h += '<button class="hb-go" id="hb-tolobby" style="margin-top:12px">🏠 Return to lobby</button>';
    var L = S.lobby;
    if (L && L.phase === "playing" && L.game && base(L.game) !== here() && !S.isHost) {
      h += '<button class="hb-ghost" id="hb-follow">' + esc(gameEmoji(L.game) + " Join " + gameName(L.game)) + "</button>";
    }
    if (S.isHost) {
      h += '<div class="hb-lab">You are the host. Jump everyone to:</div>';
      playable().forEach(function (g) {
        var f = base(g.url), cur = f === here();
        h += '<button class="hb-row" data-f="' + esc(f) + '"' + (cur ? ' style="opacity:.5"' : "") + '><span class="em">' + esc(g.emoji || "🎮") + "</span><span>" + esc(g.name) + (cur ? " · here" : "") + "</span></button>";
      });
    }
    els.sheet.innerHTML = h;
    var a = document.getElementById("hb-tolobby"); if (a) a.onclick = function () { lobby.toLobby(); };
    var fb = document.getElementById("hb-follow"); if (fb) fb.onclick = function () { lobby.joinGameNow(base(L.game)); };
    Array.prototype.forEach.call(els.sheet.querySelectorAll(".hb-row"), function (b) {
      b.onclick = function () { var f = b.getAttribute("data-f"); if (f === here()) { els.sheet.classList.remove("on"); return; } els.sheet.classList.remove("on"); lobby.start(f); };
    });
  }
  function offerFollow(L) {
    var f = base(L.game), left = FOLLOW_SECS, stay = false, t = els.toast; if (!t) return;
    function draw() {
      t.innerHTML = '<div class="hb-tt"><b>' + esc(hostName()) + "</b> is starting <b>" + esc(gameEmoji(f) + " " + gameName(f)) + '</b></div><div class="hb-tb"><button class="hb-go" id="hb-jn">Join now' + (stay ? "" : " (" + left + ")") + '</button><button class="hb-ghost" id="hb-st">Stay here</button></div>';
      t.classList.add("on");
      document.getElementById("hb-jn").onclick = go;
      document.getElementById("hb-st").onclick = function () { stay = true; clearInterval(iv); t.classList.remove("on"); };
    }
    function go() { clearInterval(iv); lobby.joinGameNow(f); }
    var iv = setInterval(function () { if (stay) return; left--; if (left <= 0) { go(); return; } draw(); }, 1000);
    draw();
  }

  function boot() {
    entry();
    loadCatalog();
    if (here() !== "index.html") {
      mountBar();
      lobby.onChange(renderBar);
      lobby.onStart(function (L) { if (base(L.game) !== here()) offerFollow(L); });
    }
    account.resume();
    if (code()) refresh(true);
    setInterval(function () { if (!document.hidden && code()) refresh(false); }, POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && code()) refresh(true); });
  }

  window.HUB = {
    uid: uid, name: myName, code: code, resolve: resolve, here: here, base: base, esc: esc,
    account: account, lobby: lobby, entry: entry, waitRoom: waitRoom, resetRoom: resetRoom,
    games: playable, gameByFile: gameByFile, gameName: gameName, gameEmoji: gameEmoji, maxPlayers: function (f) { return MAXP[f] || null; },
    onCatalog: function (fn) { listeners.push(fn); }
  };
  entry();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
