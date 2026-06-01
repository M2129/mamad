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

  // ── Positions de base mémorisées au démarrage ──
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

  // ── Déplacer un joueur ──
  function movePlayerTo(player, leftPct, topPct, duration = 350) {
    player.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    player.style.left = `${leftPct}%`;
    player.style.top  = `${topPct}%`;
  }

  // ── Ramener un joueur à sa base ──
  function resetPlayerPos(player, duration = 600) {
    const base = basePositions.get(player);
    if (!base) return;
    player.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    player.style.left = `${base.left}%`;
    player.style.top  = `${base.top}%`;
  }

  // ── Ramener tous les joueurs à leur base ──
  function resetAllPositions(duration = 700) {
    allPlayers.forEach(p => resetPlayerPos(p, duration));
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

  // ── Passe entre deux joueurs ──
  async function pass(carrier, receiver, duration = 300) {
    const recvBase    = basePositions.get(receiver);
    const carrierBase = basePositions.get(carrier);
    if (!recvBase) return receiver;

    // porteur court vers le receveur
    if (carrierBase) {
      const midLeft = carrierBase.left + (recvBase.left - carrierBase.left) * 0.35;
      const midTop  = carrierBase.top  + (recvBase.top  - carrierBase.top)  * 0.35;
      movePlayerTo(carrier, midLeft, midTop, duration * 0.8);
    }

    // coéquipiers s'écartent
    const team = senPlayers.includes(carrier) ? senPlayers : fraPlayers;
    team.forEach(p => {
      if (p === carrier || p === receiver) return;
      const base = basePositions.get(p);
      if (!base) return;
      movePlayerTo(p,
        base.left + randomFloat(-2.5, 2.5),
        base.top  + randomFloat(-2.5, 2.5),
        duration
      );
    });

    // adversaires pressent
    const opponents = senPlayers.includes(carrier) ? fraPlayers : senPlayers;
    opponents
      .filter(p => !p.classList.contains("fra-gk") && !p.classList.contains("sen-gk"))
      .slice(0, 2)
      .forEach(p => {
        const base = basePositions.get(p);
        if (!base) return;
        movePlayerTo(p,
          base.left + (recvBase.left - base.left) * 0.2,
          base.top  + (recvBase.top  - base.top)  * 0.2,
          duration * 1.2
        );
      });

    // ballon va vers le receveur
    receiver.classList.add("active");
    await moveBallTo(recvBase.left, recvBase.top, duration);
    carrier.classList.remove("active");
    setTimeout(() => receiver.classList.remove("active"), 200);

    return receiver;
  }

  // ── Séquence de passes ──
  async function passBall(players, steps = 3, duration = 280) {
    let carrier = chooseRandom(players);
    carrier.classList.add("active");
    for (let i = 0; i < steps; i++) {
      let next;
      do { next = chooseRandom(players); } while (next === carrier);
      carrier = await pass(carrier, next, duration) || next;
    }
  }

  // ── Badge ⚽ dans le panel joueurs ──
  function addGoalBadge(team, playerPosClass) {
    const senBadgeMap = {
      "sen-gk":  "badges-sen-1",
      "sen-df1": "badges-sen-2",
      "sen-df2": "badges-sen-3",
      "sen-df3": "badges-sen-4",
      "sen-df4": "badges-sen-23",
      "sen-mf1": "badges-sen-5",
      "sen-mf2": "badges-sen-6",
      "sen-mf3": "badges-sen-17",
      "sen-fw1": "badges-sen-11",
      "sen-fw2": "badges-sen-9",
      "sen-fw3": "badges-sen-7",
    };
    const fraBadgeMap = {
      "fra-gk":  "badges-fra-1",
      "fra-df1": "badges-fra-2",
      "fra-df2": "badges-fra-4",
      "fra-df3": "badges-fra-6",
      "fra-df4": "badges-fra-22",
      "fra-mf1": "badges-fra-8",
      "fra-mf2": "badges-fra-14",
      "fra-mf3": "badges-fra-7",
      "fra-fw1": "badges-fra-11",
      "fra-fw2": "badges-fra-20",
      "fra-fw3": "badges-fra-10",
    };

    const map     = team === "sen" ? senBadgeMap : fraBadgeMap;
    const badgeId = map[playerPosClass];
    if (!badgeId) return;

    const badgeEl = document.getElementById(badgeId);
    if (!badgeEl) return;

    badgeEl.textContent += "⚽";
  }

  // ── Animation but ──
  async function animateGoal(scoringTeam) {
  const attackPlayers = scoringTeam === "sen" ? senPlayers : fraPlayers;
  const defendPlayers = scoringTeam === "sen" ? fraPlayers : senPlayers;
  const gkClass       = scoringTeam === "sen" ? "fra-gk" : "sen-gk";
  const gk            = defendPlayers.find(p => p.classList.contains(gkClass));
  const fwClasses     = scoringTeam === "sen"
    ? ["sen-fw1", "sen-fw2", "sen-fw3"]
    : ["fra-fw1", "fra-fw2", "fra-fw3"];

  // choisir un buteur
  const shooterClass    = fwClasses[randomInt(0, fwClasses.length - 1)];
  const shooter         = attackPlayers.find(p => p.classList.contains(shooterClass))
                          || chooseRandom(attackPlayers);

  // classe position du buteur pour le badge
  const shooterPosClass = Array.from(shooter.classList).find(c =>
    c.startsWith("sen-") || c.startsWith("fra-")
  );

  // ── récupérer le nom du buteur depuis le panel ──
  const senNameMap = {
    "sen-gk":  "Mendy E.",
    "sen-df1": "S.Ciss",
    "sen-df2": "Koulibaly",
    "sen-df3": "A.Diallo",
    "sen-df4": "Ballo-T.",
    "sen-mf1": "Gueye",
    "sen-mf2": "N.Mendy",
    "sen-mf3": "PM.Sarr",
    "sen-fw1": "I.Sarr",
    "sen-fw2": "B.Dia",
    "sen-fw3": "Mané",
  };
  const fraNameMap = {
    "fra-gk":  "Lloris",
    "fra-df1": "Pavard",
    "fra-df2": "Varane",
    "fra-df3": "Saliba",
    "fra-df4": "T.Hernandez",
    "fra-mf1": "Tchouaméni",
    "fra-mf2": "Rabiot",
    "fra-mf3": "Griezmann",
    "fra-fw1": "Dembélé",
    "fra-fw2": "Mbappé",
    "fra-fw3": "Coman",
  };

  const nameMap    = scoringTeam === "sen" ? senNameMap : fraNameMap;
  const scorerName = shooterPosClass ? (nameMap[shooterPosClass] || "Inconnu") : "Inconnu";
  const teamLabel  = scoringTeam === "sen" ? "🇸🇳 Sénégal" : "🇫🇷 France";

  // passes vers l'attaque
  await passBall(attackPlayers, 3, 240);

  // buteur fonce vers la cage
  const goalLeft = scoringTeam === "sen" ? 88 : 12;
  const goalTop  = randomInt(35, 65);
  shooter.classList.add("active");
  movePlayerTo(shooter, goalLeft, goalTop, 350);

  // défenseurs tentent de bloquer
  defendPlayers
    .filter(p => !p.classList.contains(gkClass))
    .slice(0, 2)
    .forEach(p => {
      movePlayerTo(p,
        goalLeft + (scoringTeam === "sen" ? -8 : 8),
        goalTop  + randomFloat(-10, 10),
        350
      );
    });

  await moveBallTo(goalLeft, goalTop, 350);

  // gardien se positionne
  if (gk) {
    const gkBase = basePositions.get(gk);
    if (gkBase) movePlayerTo(gk, gkBase.left, goalTop, 200);
    gk.classList.add("active");
  }

  // ballon entre dans le filet
  const netLeft = scoringTeam === "sen" ? 99 : 1;
  await moveBallTo(netLeft, randomInt(40, 60), 280);

  if (gk) {
    gk.classList.remove("active");
    const gkBase = basePositions.get(gk);
    if (gkBase) movePlayerTo(gk, gkBase.left, gkBase.top + 8, 200);
  }
  shooter.classList.remove("active");

  // ── badge ⚽ + événement avec nom du buteur ──
  if (shooterPosClass) {
    addGoalBadge(scoringTeam, shooterPosClass);
  }
  addEvent(`⚽ But de ${scorerName} (${teamLabel}) — ${state.senGoals}–${state.fraGoals} | ${state.timer}'`);

  // flash
  ball.style.transition = "none";
  ball.style.boxShadow  = scoringTeam === "sen"
    ? "0 0 32px 10px rgba(100,255,100,1)"
    : "0 0 32px 10px rgba(255,100,100,1)";

  // célébration
  attackPlayers.forEach(p => {
    const side = scoringTeam === "sen" ? randomInt(75, 92) : randomInt(8, 25);
    movePlayerTo(p, side, randomInt(25, 75), 500);
  });

  await wait(700);

  // retour centre
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

    await passBall(attackPlayers, 2, 260);

    const shotLeft = attackTeam === "sen" ? randomInt(82, 92) : randomInt(8, 18);
    const shotTop  = randomInt(30, 70);

    // défenseurs se jettent devant
    defendPlayers
      .filter(p => !p.classList.contains(gkClass))
      .slice(0, 2)
      .forEach(p => {
        movePlayerTo(p,
          shotLeft + (attackTeam === "sen" ? -6 : 6),
          shotTop  + randomFloat(-8, 8),
          300
        );
      });

    await moveBallTo(shotLeft, shotTop, 320);

    // gardien plonge
    if (gk) {
      const gkBase = basePositions.get(gk);
      if (gkBase) movePlayerTo(gk, gkBase.left, shotTop, 250);
      gk.classList.add("active");
      await moveBallTo(gkBase ? gkBase.left : shotLeft, shotTop, 250);
      setTimeout(() => {
        gk.classList.remove("active");
        resetPlayerPos(gk, 500);
      }, 300);
    }

    // dégagement
    ball.style.transition = "left 0.5s ease, top 0.5s ease";
    ball.style.left = "50%";
    ball.style.top  = "50%";

    await wait(500);
    resetAllPositions(600);
    await wait(600);
  }

  // ── Possession avec mouvement collectif ──
  async function animatePossession(team, zone) {
    const players   = team === "sen" ? senPlayers : fraPlayers;
    const opponents = team === "sen" ? fraPlayers : senPlayers;

    const zonePlayers = players.filter(p => {
      const base = basePositions.get(p);
      if (!base) return false;
      if (zone === "defense") return base.left < 35;
      if (zone === "milieu")  return base.left >= 25 && base.left <= 75;
      if (zone === "attaque") return base.left > 40;
      return true;
    });
    const pool = zonePlayers.length >= 2 ? zonePlayers : players;

    // équipe monte collectivement
    const pushDir = team === "sen" ? 1 : -1;
    const push    = zone === "attaque" ? 6 * pushDir : zone === "milieu" ? 3 * pushDir : 0;

    players.forEach(p => {
      if (p.classList.contains("sen-gk") || p.classList.contains("fra-gk")) return;
      const base = basePositions.get(p);
      if (!base) return;
      movePlayerTo(p,
        Math.min(Math.max(base.left + push + randomFloat(-2, 2), 5), 95),
        base.top + randomFloat(-3, 3),
        350
      );
    });

    // pression adverse
    opponents
      .filter(p => !p.classList.contains("fra-gk") && !p.classList.contains("sen-gk"))
      .slice(0, 3)
      .forEach(p => {
        const base = basePositions.get(p);
        if (!base) return;
        movePlayerTo(p,
          Math.min(Math.max(base.left - push * 0.4 + randomFloat(-2, 2), 5), 95),
          base.top + randomFloat(-2, 2),
          400
        );
      });

    await passBall(pool, 2, 300);

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
          addEvent(`⚽ But Sénégal ! ${state.senGoals}–${state.fraGoals}`);
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
          addEvent(`⚽ France marque. ${state.senGoals}–${state.fraGoals}`);
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
    }, 1400);
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

    // vider tous les badges ⚽
    document.querySelectorAll("[id^='badges-']").forEach(el => {
      el.textContent = "";
    });

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
    addEvent(`⚽ But Sénégal (manuel) ! ${state.senGoals}–${state.fraGoals}`);
    await animateGoal("sen");
  }

  async function addFraGoal() {
    if (!state.running) { addEvent("⚠️ Lance le match d'abord."); return; }
    state.fraShots++;
    state.fraGoals++;
    addEvent(`⚽ France marque (manuel). ${state.senGoals}–${state.fraGoals}`);
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