// OFFLINE FALLBACK ONLY. Your real games list lives in the Supabase "pages" table,
// managed from admin.html. This is just what the hub shows if Supabase is unreachable.
window.GAMES = [
  { name:"Cold Case", tag:"Psychic detective", emoji:"◍", url:"coldcase.html", status:"live",
    desc:"A crime, a lineup of strangers, and a pendulum that only says yes or no. Name the guilty — from their face alone." },
  { name:"Office Buddy", tag:"Comic relief", emoji:"🕶️", url:"buddy.html", status:"live",
    desc:"A cartoon Aaron who never shuts up — puns, bad math, pie-chart slander, and love for Queen Emma. Poke him." },
  { name:"Jamar — Wolfpack", tag:"Hype companion", emoji:"🐺", url:"jamar.html", status:"live",
    desc:"An NC State-red hype man for Jamar — good dad, deep listener, powerful, empathetic, and all Wolfpack. Poke him." },
  { name:"Liar's Dice", tag:"Bluff & bid", emoji:"🎲", url:"", status:"soon", desc:"Roll, hide, and bluff — call the bluff or get called out." },
  { name:"Liar's Poker", tag:"Bluff & bid", emoji:"🃏", url:"", status:"soon", desc:"Bluff your way through serial-number poker hands." },
  { name:"Last Man Standing", tag:"Survival party", emoji:"🏆", url:"", status:"soon", desc:"Outlast everyone — the last one in wins." },
  { name:"TV Companion", tag:"Reality-TV game", emoji:"📺", url:"", status:"soon", desc:"Rate the cast, predict the eliminations, score as the season plays out." },
];
