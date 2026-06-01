document.addEventListener("DOMContentLoaded", () => {
  const state = {
    senGoals: 0,
    fraGoals: 0,
    senShots: 0,
    fraShots: 0,
    cards: 0,
    subs: 0,
    timer: 0,
    running: false,
    intervalId: null,
    targetMargin: 2,
  };

  const scoreEl    = document.getElementById("score");
  const phaseEl    = document.getElementById("phase-lbl");
  const timerDisp  = document.getElementById("timer-disp");
  const senShotsEl = document.getElementById("stat-sen-shots");
  const fraShotsEl = document.getElementById("stat-fra-shots");
  const cardsEl    = document.getElementById("stat-cards");
  const subsEl     = document.getElementById("stat-subs");
  const evlistEl   = document.getElementById("evlist");
  const noEventEl  = document.getElementById("no-event");
  const ball       = document.querySelector("#pitch .ball");
  const pitch      = document.getElementById("pitch");
  const senPlayers = Array.from(document.querySelectorAll(".player.sen"));
  const fraPlayers = Array.from(document.querySelectorAll(".player.fra"));
  const allPlayers = Array.from(document.querySelectorAll(".player"));

  const btnStart  = document.getElementById("btn-start");
  const btnPause  = document.getElementById("btn-pause");
  const btnButSen = document.getElementById("btn-but-sen");
  const btnButFra = document.getElementById("btn-but-fra");
  const btnSubSen = document.getElementById("btn-sub-sen");
  const btnSubFra = document.getElementById("btn-sub-fra");
  const btnReset  = document.getElementById("btn-reset");

  const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomFloat  = (min, max) => Math.random() * (max - min) + min;
  const chooseRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wait         = (ms) => new Promise(r => setTimeout(r, ms));

  // ── Positions de base ──
  const basePositions = new Map();

  function initBasePositions() {
    allPlayers.forEach(p => {
      const pitchW = pitch.offsetWidth;
      const pitchH = pitch.offsetHeight;
      const leftPx = parseFloat(window.getComputedStyle(p).left);
      const topPx  = parseFloat(window.getComputedStyle(p).top);
      basePositions.set(p, {
        left: (leftPx / pitchW) * 100,
        top:  (topPx  / pitchH) * 100,
      });
    });
  }

  // ── Rôles par classe CSS ──
  const ROLES = {
    "sen-gk":  { role: "gk",  team: "sen" },
    "sen-df1": { role: "def", team: "sen" },
    "sen-df2": { role: "def", team: "sen" },
    "sen-df3": { role: "def", team: "sen" },
    "sen-df4": { role: "def", team: "sen" },
    "sen-mf1": { role: "mid", team: "sen" },
    "sen-mf2": { role: "mid", team: "sen" },
    "sen-mf3": { role: "mid", team: "sen" },
    "sen-fw1": { role: "fwd", team: "sen" },
    "sen-fw2": { role: "fwd", team: "sen" },
    "sen-fw3": { role: "fwd", team: "sen" },
    "fra-gk":  { role: "gk",  team: "fra" },
    "fra-df1": { role: "def", team: "fra" },
    "fra-df2": { role: "def", team: "fra" },
    "fra-df3": { role: "def", team: "fra" },
    "fra-df4": { role: "def", team: "fra" },
    "fra-mf1": { role: "mid", team: "fra" },
    "fra-mf2": { role: "mid", team: "fra" },
    "fra-mf3": { role: "mid", team: "fra" },
    "fra-fw1": { role: "fwd", team: "fra" },
    "fra-fw2": { role: "fwd", team: "fra" },
    "fra-fw3": { role: "fwd", team: "fra" },
  };

  function getPlayerRole(player) {
    for (const cls of player.classList) {
      if (ROLES[cls]) return ROLES[cls];
    }
    return { role: "mid", team: "sen" };
  }

  function getPosClass(player) {
    return Array.from(player.classList).find(c =>
      c.startsWith("sen-") || c.startsWith("fra-")
    );
  }

  // ── Limites de déplacement par rôle et phase ──
  // phase : "attack" | "defense" | "neutral"
  // team sen joue de gauche à droite, fra de droite à gauche
  function getMoveBounds(player, phase) {
    const { role, team } = getPlayerRole(player);
    const base = basePositions.get(player);
    if (!base) return { minL: 5, maxL: 95, minT: 5, maxT: 95 };

    const isSen = team === "sen";

    // en attaque l'équipe monte, en défense elle recule
    const attackShift   = isSen ? 12 : -12;
    const defenseShift  = isSen ? -8 : 8;

    let shift = 0;
    if (phase === "attack")  shift = attackShift;
    if (phase === "defense") shift = defenseShift;

    // limites de déplacement selon le rôle
    const spread = role === "gk" ? 3 : role === "def" ? 10 : role === "mid" ? 16 : 20;
    const tSpread = role === "gk" ? 10 : 20;

    return {
      minL: Math.max(5,  base.left + shift - spread),
      maxL: Math.min(95, base.left + shift + spread),
      minT: Math.max(5,  base.top  - tSpread),
      maxT: Math.min(95, base.top  + tSpread),w
    };
  }

  // ── Déplacer un joueur ──
  function movePlayerTo(player, leftPct, topPct, duration = 350) {
    player.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    player.style.left = `${Math.min(Math.max(leftPct, 2), 98)}%`;
    player.style.top  = `${Math.min(Math.max(topPct,  2), 98)}%`;
  }

  function resetPlayerPos(player, duration = 600) {
    const base = basePositions.get(player);
    if (!base) return;
    player.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    player.style.left = `${base.left}%`;
    player.style.top  = `${base.top}%`;
  }

  function resetAllPositions(duration = 700) {
    allPlayers.forEach(p => resetPlayerPos(p, duration));
  }

  // ── Repositionner toute une équipe selon la phase ──
  function repositionTeam(teamPlayers, phase, duration = 400) {
    teamPlayers.forEach(p => {
      const { role } = getPlayerRole(p);
      if (role === "gk") return; // gardien reste en place
      const bounds = getMoveBounds(p, phase);
      movePlayerTo(p,
        randomFloat(bounds.minL, bounds.maxL),
        randomFloat(bounds.minT, bounds.maxT),
        duration
      );
    });
  }

  // ── Pression adverse (équipe qui défend se repositionne) ──
  function pressDefense(defendTeam, ballLeft, ballTop, phase, duration = 450) {
    defendTeam.forEach(p => {
      const { role } = getPlayerRole(p);
      if (role === "gk") return;
      const base   = basePositions.get(p);
      if (!base) return;
      const bounds = getMoveBounds(p, phase);

      // défenseurs se rapprochent du ballon latéralement
      const pressX = role === "def"
        ? randomFloat(bounds.minL, bounds.maxL)
        : base.left + (ballLeft - base.left) * 0.25 + randomFloat(-3, 3);
      const pressY = base.top + (ballTop - base.top) * 0.3 + randomFloat(-5, 5);

      movePlayerTo(p,
        Math.min(Math.max(pressX, bounds.minL), bounds.maxL),
        Math.min(Math.max(pressY, bounds.minT), bounds.maxT),
        duration
      );
    });
  }

  // ── Déplacer le ballon ──
  function moveBallTo(leftPct, topPct, duration = 380) {
    return new Promise(resolve => {
      ball.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
      ball.style.left = `${leftPct}%`;
      ball.style.top  = `${topPct}%`;
      setTimeout(resolve, duration);
    });
  }

  // ── Passe réaliste : porteur court, receveur se démarque ──
  async function pass(carrier, receiver, phase, duration = 300) {
    const recvBase    = basePositions.get(receiver);
    const carrierBase = basePositions.get(carrier);
    if (!recvBase) return receiver;

    const recvBounds = getMoveBounds(receiver, phase);

    // receveur se démarque dans sa zone
    const demarcLeft = randomFloat(recvBounds.minL, recvBounds.maxL);
    const demarcTop  = randomFloat(recvBounds.minT, recvBounds.maxT);
    movePlayerTo(receiver, demarcLeft, demarcTop, duration * 0.7);

    // porteur oriente son corps vers le receveur
    if (carrierBase) {
      const runLeft = carrierBase.left + (demarcLeft - carrierBase.left) * 0.25;
      const runTop  = carrierBase.top  + (demarcTop  - carrierBase.top)  * 0.25;
      movePlayerTo(carrier, runLeft, runTop, duration * 0.6);
    }

    // coéquipiers créent de l'espace
    const attackTeam = senPlayers.includes(carrier) ? senPlayers : fraPlayers;
    attackTeam.forEach(p => {
      if (p === carrier || p === receiver) return;
      const { role } = getPlayerRole(p);
      const b = getMoveBounds(p, phase);
      movePlayerTo(p,
        randomFloat(b.minL, b.maxL),
        randomFloat(b.minT, b.maxT),
        duration
      );
    });

    // défenseurs pressent vers le receveur
    const defendTeam = senPlayers.includes(carrier) ? fraPlayers : senPlayers;
    pressDefense(defendTeam, demarcLeft, demarcTop, phase === "attack" ? "defense" : "attack", duration * 1.1);

    // ballon vole vers le receveur
    receiver.classList.add("active");
    await moveBallTo(demarcLeft, demarcTop, duration);
    carrier.classList.remove("active");
    setTimeout(() => receiver.classList.remove("active"), 250);

    return receiver;
  }

  // ── Séquence de passes avec phase de jeu ──
  async function passBall(players, steps = 3, duration = 280, phase = "neutral") {
    let carrier = chooseRandom(players);
    carrier.classList.add("active");
    for (let i = 0; i < steps; i++) {
      let next;
      // progression logique : le ballon avance vers l'avant
      const isSen = senPlayers.includes(carrier);
      const carrierBase = basePositions.get(carrier);

      // favoriser les passes vers l'avant dans la phase d'attaque
      let candidates;
      if (phase === "attack" && carrierBase) {
        const forward = players.filter(p => {
          if (p === carrier) return false;
          const b = basePositions.get(p);
          if (!b) return false;
          return isSen ? b.left > carrierBase.left - 5 : b.left < carrierBase.left + 5;
        });
        candidates = forward.length >= 2 ? forward : players.filter(p => p !== carrier);
      } else {
        candidates = players.filter(p => p !== carrier);
      }

      next    = chooseRandom(candidates.length ? candidates : players.filter(p => p !== carrier));
      carrier = await pass(carrier, next, phase, duration) || next;
    }
  }

  // ── Maps noms et badges ──
  const senNameMap = {
    "sen-gk":  "Mendy E.",   "sen-df1": "S.Ciss",
    "sen-df2": "Koulibaly",  "sen-df3": "A.Diallo",
    "sen-df4": "Ballo-T.",   "sen-mf1": "Gueye",
    "sen-mf2": "N.Mendy",   "sen-mf3": "PM.Sarr",
    "sen-fw1": "I.Sarr",     "sen-fw2": "B.Dia",
    "sen-fw3": "Mané",
  };
  const fraNameMap = {
    "fra-gk":  "Lloris",     "fra-df1": "Pavard",
    "fra-df2": "Varane",     "fra-df3": "Saliba",
    "fra-df4": "T.Hernandez","fra-mf1": "Tchouaméni",
    "fra-mf2": "Rabiot",     "fra-mf3": "Griezmann",
    "fra-fw1": "Dembélé",    "fra-fw2": "Mbappé",
    "fra-fw3": "Coman",
  };
  const senBadgeMap = {
    "sen-gk":  "badges-sen-1",  "sen-df1": "badges-sen-2",
    "sen-df2": "badges-sen-3",  "sen-df3": "badges-sen-4",
    "sen-df4": "badges-sen-23", "sen-mf1": "badges-sen-5",
    "sen-mf2": "badges-sen-6",  "sen-mf3": "badges-sen-17",
    "sen-fw1": "badges-sen-11", "sen-fw2": "badges-sen-9",
    "sen-fw3": "badges-sen-7",
  };
  const fraBadgeMap = {
    "fra-gk":  "badges-fra-1",  "fra-df1": "badges-fra-2",
    "fra-df2": "badges-fra-4",  "fra-df3": "badges-fra-6",
    "fra-df4": "badges-fra-22", "fra-mf1": "badges-fra-8",
    "fra-mf2": "badges-fra-14", "fra-mf3": "badges-fra-7",
    "fra-fw1": "badges-fra-11", "fra-fw2": "badges-fra-20",
    "fra-fw3": "badges-fra-10",
  };

  function addGoalBadge(team, posClass) {
    const map     = team === "sen" ? senBadgeMap : fraBadgeMap;
    const badgeEl = document.getElementById(map[posClass]);
    if (badgeEl) badgeEl.textContent += "⚽";
  }

  // ── Animation but ──
  async function animateGoal(scoringTeam) {
    const attackPlayers = scoringTeam === "sen" ? senPlayers : fraPlayers;
    const defendPlayers = scoringTeam === "sen" ? fraPlayers : senPlayers;
    const gkClass       = scoringTeam === "sen" ? "fra-gk" : "sen-gk";
    const gk            = defendPlayers.find(p => p.classList.contains(gkClass));
    const fwClasses     = scoringTeam === "sen"
      ? ["sen-fw1","sen-fw2","sen-fw3"]
      : ["fra-fw1","fra-fw2","fra-fw3"];

    const shooterClass    = fwClasses[randomInt(0, 2)];
    const shooter         = attackPlayers.find(p => p.classList.contains(shooterClass))
                            || chooseRandom(attackPlayers);
    const shooterPosClass = getPosClass(shooter);
    const nameMap         = scoringTeam === "sen" ? senNameMap : fraNameMap;
    const scorerName      = nameMap[shooterPosClass] || "Inconnu";
    const teamLabel       = scoringTeam === "sen" ? "🇸🇳 Sénégal" : "🇫🇷 France";

    // phase 1 : construction depuis l'arrière
    repositionTeam(attackPlayers, "neutral", 300);
    repositionTeam(defendPlayers, "defense", 300);
    await wait(300);

    // phase 2 : passes progressives vers l'avant
    await passBall(attackPlayers, 4, 220, "attack");

    // phase 3 : montée vers la cage
    const goalLeft = scoringTeam === "sen" ? 88 : 12;
    const goalTop  = randomInt(35, 65);

    // toute l'attaque monte
    repositionTeam(attackPlayers, "attack", 350);
    shooter.classList.add("active");
    movePlayerTo(shooter, goalLeft, goalTop, 350);

    // défenseurs reculent en bloc
    defendPlayers
      .filter(p => !p.classList.contains(gkClass))
      .forEach(p => {
        const { role } = getPlayerRole(p);
        const base = basePositions.get(p);
        if (!base) return;
        const retreatLeft = scoringTeam === "sen"
          ? Math.max(base.left - 8, 60)
          : Math.min(base.left + 8, 40);
        movePlayerTo(p, retreatLeft, base.top + randomFloat(-5, 5), 350);
      });

    await moveBallTo(goalLeft, goalTop, 350);

    // phase 4 : tir — gardien plonge
    if (gk) {
      const gkBase = basePositions.get(gk);
      if (gkBase) movePlayerTo(gk, gkBase.left, goalTop + randomFloat(-8, 8), 220);
      gk.classList.add("active");
    }

    // ballon dans le filet
    const netLeft = scoringTeam === "sen" ? 99 : 1;
    await moveBallTo(netLeft, randomInt(38, 62), 260);

    if (gk) {
      gk.classList.remove("active");
      const gkBase = basePositions.get(gk);
      if (gkBase) movePlayerTo(gk, gkBase.left, gkBase.top + 10, 200);
    }
    shooter.classList.remove("active");

    // badge + événement
    if (shooterPosClass) addGoalBadge(scoringTeam, shooterPosClass);
    addEvent(`⚽ But de ${scorerName} (${teamLabel}) — ${state.senGoals}–${state.fraGoals} | ${state.timer}'`);

    // flash
    ball.style.transition = "none";
    ball.style.boxShadow  = scoringTeam === "sen"
      ? "0 0 32px 10px rgba(100,255,100,1)"
      : "0 0 32px 10px rgba(255,100,100,1)";

    // célébration : tout le monde converge
    attackPlayers.forEach(p => {
      const side = scoringTeam === "sen" ? randomInt(72, 90) : randomInt(10, 28);
      movePlayerTo(p, side, randomInt(25, 75), 500);
    });

    await wait(800);

    // retour au centre
    ball.style.transition = "left 0.6s ease, top 0.6s ease, box-shadow 0.5s ease";
    ball.style.boxShadow  = "";
    ball.style.left = "50%";
    ball.style.top  = "50%";

    await wait(600);
    resetAllPositions(700);
    await wait(700);
  }

  // ── Animation tir arrêté ──
  async function animateShot(attackTeam) {
    const attackPlayers = attackTeam === "sen" ? senPlayers : fraPlayers;
    const defendPlayers = attackTeam === "sen" ? fraPlayers : senPlayers;
    const gkClass       = attackTeam === "sen" ? "fra-gk" : "sen-gk";
    const gk            = defendPlayers.find(p => p.classList.contains(gkClass));

    // montée progressive
    repositionTeam(attackPlayers, "attack", 300);
    repositionTeam(defendPlayers, "defense", 300);
    await wait(300);

    await passBall(attackPlayers, 3, 240, "attack");

    const shotLeft = attackTeam === "sen" ? randomInt(80, 92) : randomInt(8, 20);
    const shotTop  = randomInt(28, 72);

    // défenseurs se jettent
    defendPlayers
      .filter(p => !p.classList.contains(gkClass))
      .slice(0, 3)
      .forEach(p => {
        movePlayerTo(p,
          shotLeft + (attackTeam === "sen" ? -5 : 5),
          shotTop  + randomFloat(-10, 10),
          300
        );
      });

    await moveBallTo(shotLeft, shotTop, 300);

    // gardien plonge
    if (gk) {
      const gkBase = basePositions.get(gk);
      if (gkBase) movePlayerTo(gk, gkBase.left, shotTop, 220);
      gk.classList.add("active");
      await moveBallTo(gkBase ? gkBase.left : shotLeft, shotTop + randomFloat(-5, 5), 220);
      setTimeout(() => {
        gk.classList.remove("active");
        resetPlayerPos(gk, 500);
      }, 300);
    }

    // dégagement — ballon repart vers l'arrière
    const clearLeft = attackTeam === "sen" ? randomInt(30, 55) : randomInt(45, 70);
    const clearTop  = randomInt(20, 80);
    await moveBallTo(clearLeft, clearTop, 400);

    await wait(300);
    resetAllPositions(600);
    await wait(500);
  }

  // ── Possession : aller-retour réaliste ──
  async function animatePossession(team, zone) {
    const players   = team === "sen" ? senPlayers : fraPlayers;
    const opponents = team === "sen" ? fraPlayers : senPlayers;

    const phase = zone === "attaque" ? "attack" : zone === "defense" ? "defense" : "neutral";
    const oppPhase = phase === "attack" ? "defense" : phase === "defense" ? "attack" : "neutral";

    // les deux équipes se repositionnent
    repositionTeam(players, phase, 350);
    repositionTeam(opponents, oppPhase, 350);
    await wait(350);

    // passes dans la zone
    const zonePlayers = players.filter(p => {
      const b = basePositions.get(p);
      if (!b) return false;
      if (zone === "defense") return b.left < 38;
      if (zone === "milieu")  return b.left >= 28 && b.left <= 72;
      if (zone === "attaque") return b.left > 42;
      return true;
    });
    const pool = zonePlayers.length >= 2 ? zonePlayers : players;

    await passBall(pool, 2, 290, phase);

    // parfois contre-pressing : l'adversaire récupère brièvement puis reperd
    if (Math.random() < 0.3) {
      const pressPlayer = chooseRandom(
        opponents.filter(p => !p.classList.contains("fra-gk") && !p.classList.contains("sen-gk"))
      );
      if (pressPlayer) {
        const ballLeft = parseFloat(ball.style.left);
        const ballTop  = parseFloat(ball.style.top);
        pressPlayer.classList.add("active");
        movePlayerTo(pressPlayer, ballLeft + randomFloat(-5, 5), ballTop + randomFloat(-5, 5), 250);
        await wait(250);
        pressPlayer.classList.remove("active");
        // récupération ratée, ballon revient
        await passBall(pool, 1, 250, phase);
      }
    }

    ball.classList.remove("current-sen", "current-fra");
    ball.classList.add(team === "sen" ? "current-sen" : "current-fra");

    await wait(200);
    resetAllPositions(600);
    await wait(400);
  }

  // ── Affichage ──
  function updateScoreboard() {
    scoreEl.textContent = `${state.senGoals} – ${state.fraGoals}`;
  }

  function updateStats() {
    senShotsEl.textContent = state.senShots;
    fraShotsEl.textContent = state.fraShots;
    cardsEl.textContent    = state.cards;
    subsEl.textContent     = state.subs;
  }

  function addEvent(text) {
    if (noEventEl && noEventEl.parentNode) noEventEl.remove();
    const el = document.createElement("div");
    el.textContent = text;
    el.className   = "event-item";
    evlistEl.prepend(el);
    while (evlistEl.children.length > 30) {
      evlistEl.removeChild(evlistEl.lastChild);
    }
  }

  function clearHighlights() {
    allPlayers.forEach(p => p.classList.remove("active"));
    ball.classList.remove("current-sen", "current-fra");
    ball.style.transition = "left 0.5s ease, top 0.5s ease";
    ball.style.left = "50%";
    ball.style.top  = "50%";
    resetAllPositions(600);
  }

  // ── Équilibrage score ──
  async function adjustScore() {
    if (state.fraGoals >= state.senGoals) {
      const extra = state.fraGoals - state.senGoals + 1;
      state.senGoals += extra;
      state.senShots += extra;
      addEvent(`⚡ Sénégal réagit ! ${state.senGoals}–${state.fraGoals}`);
      await animateGoal("sen");
    }
    if (state.timer >= 70 && state.senGoals - state.fraGoals < state.targetMargin) {
      state.senGoals++;
      state.senShots++;
      addEvent(`🔥 Sénégal creuse l'écart ! ${state.senGoals}–${state.fraGoals}`);
      await animateGoal("sen");
    }
  }

  // ── Action principale ──
  let actionRunning = false;

  async function matchAction() {
    if (actionRunning) return;
    actionRunning = true;

    const attackTeam = Math.random() < 0.58 ? "sen" : "fra";
    const eventRoll  = Math.random();

    if (attackTeam === "sen") {
      if (eventRoll < 0.18) {
        state.senShots++;
        if (Math.random() < 0.48) {
          state.senGoals++;
          await animateGoal("sen");
        } else {
          addEvent("🧤 Tir de Sénégal repoussé !");
          await animateShot("sen");
        }
      } else if (eventRoll < 0.35) {
        state.senShots++;
        addEvent("🟡 Sénégal attaque !");
        await animatePossession("sen", "attaque");
      } else if (eventRoll < 0.46) {
        state.cards++;
        addEvent("🟨 Carton jaune — faute sénégalaise.");
        await animatePossession("sen", "milieu");
      } else {
        addEvent("🔵 Sénégal conserve le ballon.");
        await animatePossession("sen", "milieu");
      }
    } else {
      if (eventRoll < 0.14) {
        state.fraShots++;
        if (Math.random() < 0.32) {
          state.fraGoals++;
          await animateGoal("fra");
        } else {
          addEvent("🧤 Tir de France arrêté !");
          await animateShot("fra");
        }
      } else if (eventRoll < 0.32) {
        state.fraShots++;
        addEvent("🔴 France construit une attaque.");
        await animatePossession("fra", "attaque");
      } else if (eventRoll < 0.43) {
        state.cards++;
        addEvent("🟨 Carton jaune — faute française.");
        await animatePossession("fra", "milieu");
      } else {
        addEvent("🔴 France en possession.");
        await animatePossession("fra", "milieu");
      }
    }

    if (Math.random() < 0.05) {
      state.subs++;
      addEvent(attackTeam === "sen" ? "🔄 Remplacement Sénégal." : "🔄 Remplacement France.");
    }

    await adjustScore();
    updateScoreboard();
    updateStats();

    actionRunning = false;
  }

  // ── Démarrer ──
  function startMatch() {
    if (state.running) return;
    initBasePositions();
    state.running       = true;
    state.timer         = 0;
    state.targetMargin  = randomInt(1, 2);
    phaseEl.textContent = "1ère mi-temps";
    addEvent("🟢 Coup d'envoi !");

    state.intervalId = setInterval(async () => {
      if (!state.running) return;
      state.timer++;
      timerDisp.textContent = `${state.timer}'`;

      if (state.timer === 45) {
        phaseEl.textContent = "mi-temps";
        addEvent("⏸ Mi-temps.");
        resetAllPositions(800);
      }
      if (state.timer === 46) {
        phaseEl.textContent = "2ème mi-temps";
        addEvent("▶ Reprise !");
      }
      if (state.timer >= 90) {
        state.running = false;
        phaseEl.textContent = "fin de match";
        addEvent(`🏁 Fin : Sénégal ${state.senGoals} – ${state.fraGoals} France`);
        clearInterval(state.intervalId);
        setTimeout(clearHighlights, 1500);
        return;
      }

      await matchAction();
    }, 1500);
  }

  // ── Pause ──
  function pauseMatch() {
    if (!state.running) return;
    state.running = false;
    phaseEl.textContent = "pause";
    clearInterval(state.intervalId);
    addEvent("⏸ Match en pause.");
  }

  // ── Reset ──
  function resetMatch() {
    clearInterval(state.intervalId);
    actionRunning         = false;
    state.senGoals        = 0;
    state.fraGoals        = 0;
    state.senShots        = 0;
    state.fraShots        = 0;
    state.cards           = 0;
    state.subs            = 0;
    state.timer           = 0;
    state.running         = false;
    state.targetMargin    = 2;
    phaseEl.textContent   = "avant le match";
    timerDisp.textContent = "0'";
    scoreEl.textContent   = "0 – 0";
    document.querySelectorAll("[id^='badges-']").forEach(el => el.textContent = "");
    updateStats();
    clearHighlights();
    addEvent("↺ Match remis à zéro.");
  }

  // ── Buts manuels ──
  async function addSenGoal() {
    if (!state.running) { addEvent("⚠️ Lance le match d'abord."); return; }
    state.senShots++;
    state.senGoals++;
    updateScoreboard();
    updateStats();
    await animateGoal("sen");
  }

  async function addFraGoal() {
    if (!state.running) { addEvent("⚠️ Lance le match d'abord."); return; }
    state.fraShots++;
    state.fraGoals++;
    await animateGoal("fra");
    await adjustScore();
    updateScoreboard();
    updateStats();
  }

  function subSen() {
    if (!state.running) { addEvent("⚠️ Lance le match d'abord."); return; }
    state.subs++;
    updateStats();
    addEvent("🔄 Remplacement Sénégal.");
  }

  function subFra() {
    if (!state.running) { addEvent("⚠️ Lance le match d'abord."); return; }
    state.subs++;
    updateStats();
    addEvent("🔄 Remplacement France.");
  }

  btnStart.addEventListener("click", startMatch);
  btnPause.addEventListener("click", pauseMatch);
  btnReset.addEventListener("click", resetMatch);
  btnButSen.addEventListener("click", addSenGoal);
  btnButFra.addEventListener("click", addFraGoal);
  btnSubSen.addEventListener("click", subSen);
  btnSubFra.addEventListener("click", subFra);

  updateScoreboard();
  updateStats();
});