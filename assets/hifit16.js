(() => {
  "use strict";

  const DEFAULT_LOGO = "https://raw.githubusercontent.com/stella21142289-cloud/JEILPORTAL/main/jeil-green-bgx.png";
  const DEFAULT_SCALE = {
    1: "전혀 아님",
    2: "아닌 편",
    3: "보통",
    4: "그런 편",
    5: "매우 그럼"
  };
  const FALLBACK_AXES = [
    { axis:"HS", left:"H", right:"S", leftName:"사람·사회", rightName:"자연·시스템", description:"관심의 출발점이 사람과 맥락인지, 구조와 원리인지 살펴봅니다." },
    { axis:"AC", left:"A", right:"C", leftName:"분석·원리", rightName:"창작·실행", description:"문제를 이해하는 방식이 근거 중심인지, 시도와 구현 중심인지 살펴봅니다." },
    { axis:"FX", left:"F", right:"X", leftName:"집중·심화", rightName:"탐색·융합", description:"학습 경로가 한 분야를 깊게 파는 쪽인지, 여러 분야를 연결하는 쪽인지 살펴봅니다." },
    { axis:"RD", left:"R", right:"D", leftName:"소통·관계", rightName:"데이터·기술", description:"해결 방식이 관계와 설득 중심인지, 데이터와 도구 중심인지 살펴봅니다." }
  ];

  const config = window.HIFIT16_CONFIG || {};
  const state = {
    loaded: false,
    appVersion: "",
    questions: [],
    shuffledQuestions: [],
    axes: FALLBACK_AXES,
    scaleLabels: DEFAULT_SCALE,
    pageSize: Number(config.PAGE_SIZE) || 9,
    answers: {},
    currentPage: 0,
    result: null,
    sourceNotes: {},
    sessionId: getSessionId()
  };


  const MOTION_SESSION_KEY = "hifit16_intro_animation_seen";
  const motionConfig = {
    mode: String(config.ANIMATION_MODE || "intro-once"),
    introMs: Number(config.INTRO_ANIMATION_MS || 2600),
    confettiEnabled: config.RESULT_CONFETTI !== false,
    confettiPieces: Math.max(20, Math.min(160, Number(config.RESULT_CONFETTI_PIECES || 88))),
    confettiFrames: Math.max(40, Math.min(140, Number(config.RESULT_CONFETTI_FRAMES || 88)))
  };

  function prefersReducedMotion(){
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setMotionStage(stage){
    const body = document.body;
    if(!body) return;
    body.classList.remove("mode-intro", "mode-test", "mode-result");
    body.classList.add(`mode-${stage}`);

    if(prefersReducedMotion() || motionConfig.mode === "off"){
      body.classList.add("motion-off");
      body.classList.remove("motion-calm");
      return;
    }

    if(motionConfig.mode === "calm"){
      body.classList.add("motion-calm");
      return;
    }

    if(stage === "test"){
      body.classList.add("motion-calm");
      try { sessionStorage.setItem(MOTION_SESSION_KEY, "1"); } catch(e) {}
    } else if(stage === "result"){
      body.classList.add("motion-calm");
    }
  }

  function initAnimationComfort(){
    const body = document.body;
    if(!body) return;
    setMotionStage("intro");

    if(prefersReducedMotion() || motionConfig.mode === "off" || motionConfig.mode === "calm") return;
    if(motionConfig.mode !== "intro-once") return;

    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(MOTION_SESSION_KEY) === "1"; } catch(e) {}
    if(alreadySeen){
      body.classList.add("motion-calm");
      return;
    }

    window.setTimeout(() => {
      if(document.body && document.body.classList.contains("mode-intro")){
        document.body.classList.add("motion-calm");
      }
      try { sessionStorage.setItem(MOTION_SESSION_KEY, "1"); } catch(e) {}
    }, motionConfig.introMs);
  }

  const $ = (id) => document.getElementById(id);

  function getSessionId(){
    const key = "hifit16_session_id";
    let existing = "";
    try { existing = localStorage.getItem(key) || ""; } catch(e) {}
    if(existing) return existing;
    const id = "hf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(key, id); } catch(e) {}
    return id;
  }

  function backendUrl(){
    return String(config.BACKEND_URL || "").trim();
  }

  function backendConfigured(){
    const url = backendUrl();
    return Boolean(url && !url.includes("PASTE_GOOGLE_APPS_SCRIPT") && /^https?:\/\//i.test(url));
  }

  function showToast(message){
    const toast = $("toast");
    if(!toast) return;
    toast.textContent = message;
    toast.classList.add("active");
    window.setTimeout(() => toast.classList.remove("active"), 2400);
  }

  function scrollToEl(selector){
    const el = document.querySelector(selector);
    if(!el) return;
    const reduced = prefersReducedMotion() || document.body.classList.contains("motion-off") || document.body.classList.contains("mode-test");
    el.scrollIntoView({behavior: reduced ? "auto" : "smooth", block:"start"});
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function shuffle(arr){
    const copy = [...arr];
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function jsonp(action, params = {}){
    if(!backendConfigured()){
      return Promise.reject(new Error("백엔드 URL이 설정되지 않았습니다."));
    }

    return new Promise((resolve, reject) => {
      const cbName = "__hifit16_cb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
      const url = new URL(backendUrl());
      url.searchParams.set("action", action);
      url.searchParams.set("callback", cbName);
      Object.entries(params).forEach(([key, value]) => {
        if(value === undefined || value === null) return;
        url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
      });

      const script = document.createElement("script");
      let done = false;
      const timer = window.setTimeout(() => {
        if(done) return;
        done = true;
        cleanup();
        reject(new Error("백엔드 응답 시간이 초과되었습니다."));
      }, 16000);

      function cleanup(){
        window.clearTimeout(timer);
        try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
        script.remove();
      }

      window[cbName] = (payload) => {
        if(done) return;
        done = true;
        cleanup();
        if(!payload || payload.ok === false){
          reject(new Error(payload && payload.error ? payload.error : "백엔드 오류가 발생했습니다."));
          return;
        }
        resolve(payload);
      };

      script.onerror = () => {
        if(done) return;
        done = true;
        cleanup();
        reject(new Error("백엔드 스크립트를 불러오지 못했습니다."));
      };

      script.src = url.toString();
      document.body.appendChild(script);
    });
  }

  function setLogos(){
    const logoUrl = String(config.LOGO_URL || DEFAULT_LOGO);
    document.querySelectorAll("[data-logo]").forEach(img => {
      img.src = logoUrl;
    });
  }

  function renderAxis(axes = state.axes){
    state.axes = axes && axes.length ? axes : FALLBACK_AXES;
    const wrap = $("axisIntro");
    if(!wrap) return;
    wrap.innerHTML = state.axes.map(a => `
      <article class="axis-card">
        <span class="axis-code">${escapeHtml(a.axis)}</span>
        <strong>${escapeHtml(a.left)} ${escapeHtml(a.leftName)} / ${escapeHtml(a.right)} ${escapeHtml(a.rightName)}</strong>
        <span>${escapeHtml(a.description || a.desc || "")}</span>
      </article>
    `).join("");
  }

  function showSetupAlert(){
    const alert = $("setupAlert");
    if(alert && !backendConfigured()) alert.classList.remove("hidden");
  }

  async function loadQuestions(){
    if(state.loaded) return;
    if(!backendConfigured()){
      showSetupAlert();
      throw new Error("백엔드 URL이 설정되지 않았습니다.");
    }
    const payload = await jsonp("questions");
    state.questions = Array.isArray(payload.questions) ? payload.questions : [];
    state.axes = Array.isArray(payload.axes) ? payload.axes : FALLBACK_AXES;
    state.scaleLabels = payload.scaleLabels || DEFAULT_SCALE;
    state.pageSize = Number(payload.pageSize || config.PAGE_SIZE || 9) || 9;
    state.appVersion = payload.appVersion || "";
    state.sourceNotes = payload.sourceNotes || {};
    if(!state.questions.length) throw new Error("백엔드에서 문항을 불러오지 못했습니다.");
    state.loaded = true;
    renderAxis(state.axes);
  }

  function showTestLoading(){
    $("testSection").classList.add("active");
    $("resultSection").classList.remove("active");
    $("questionList").innerHTML = `
      <div class="loading-card">
        <div class="loader"></div>
        <p>Google Sheets 백엔드에서 문항을 불러오는 중입니다.</p>
      </div>
    `;
    scrollToEl("#testSection");
  }

  async function startTest(){
    try{
      setMotionStage("test");
      showTestLoading();
      await loadQuestions();
      state.shuffledQuestions = shuffle(state.questions);
      state.answers = {};
      state.currentPage = 0;
      try { localStorage.removeItem("hifit16_answers"); } catch(e) {}
      clearSharedQuery();
      renderQuestions();
      updateProgress();
      scrollToEl("#testSection");
    } catch(err){
      showErrorInQuestions(err.message);
    }
  }

  function clearSharedQuery(){
    const url = new URL(location.href);
    if(url.search){
      url.search = "";
      history.replaceState(null, "", url.toString());
    }
  }

  function showErrorInQuestions(message){
    $("testSection").classList.add("active");
    $("questionList").innerHTML = `
      <div class="loading-card">
        <p style="color:#8A2E0D">오류: ${escapeHtml(message)}</p>
        <p style="margin-top:8px;font-size:.9rem">config.js의 BACKEND_URL과 Apps Script 배포 권한을 확인하세요.</p>
      </div>
    `;
    showToast(message);
  }

  function renderQuestions(){
    const totalPages = Math.ceil(state.shuffledQuestions.length / state.pageSize);
    const start = state.currentPage * state.pageSize;
    const pageQuestions = state.shuffledQuestions.slice(start, start + state.pageSize);
    $("pageLabel").textContent = `${state.currentPage + 1} / ${totalPages}`;

    $("questionList").innerHTML = pageQuestions.map((q, idx) => {
      const globalNo = start + idx + 1;
      const selected = state.answers[q.id];
      const choices = [1,2,3,4,5].map(v => `
        <label class="choice ${selected === v ? "selected" : ""}" data-qid="${escapeHtml(q.id)}" data-value="${v}">
          <input type="radio" name="${escapeHtml(q.id)}" value="${v}" ${selected === v ? "checked" : ""} />
          <b>${v}</b>
          <span>${escapeHtml(state.scaleLabels[String(v)] || DEFAULT_SCALE[v])}</span>
        </label>
      `).join("");
      return `
        <article class="question-card">
          <div class="question-head">
            <div class="question-number">${globalNo}</div>
            <div style="flex:1">
              <p class="question-text">${escapeHtml(q.text)}</p>
              <div class="choice-grid">${choices}</div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    document.querySelectorAll(".choice").forEach(label => {
      label.addEventListener("click", () => {
        const qid = label.dataset.qid;
        const value = Number(label.dataset.value);
        state.answers[qid] = value;
        document.querySelectorAll(".choice").forEach(x => { if(x.dataset.qid === qid) x.classList.remove("selected"); });
        label.classList.add("selected");
        const input = label.querySelector("input");
        if(input) input.checked = true;
        updateProgress();
        try { localStorage.setItem("hifit16_answers", JSON.stringify(state.answers)); } catch(e) {}
      });
    });

    $("prevBtn").disabled = state.currentPage === 0;
    $("nextBtn").classList.toggle("hidden", state.currentPage === totalPages - 1);
    $("resultBtn").classList.toggle("hidden", state.currentPage !== totalPages - 1);
  }

  function updateProgress(){
    const answered = Object.keys(state.answers).length;
    const total = state.questions.length || 72;
    const pct = Math.round((answered / total) * 100);
    $("progressText").textContent = `${answered} / ${total} 응답`;
    $("progressPercent").textContent = `${pct}%`;
    $("progressFill").style.width = `${pct}%`;
    $("resultBtn").disabled = answered < total;
    $("resultBtn").textContent = answered < total ? `결과 보기 (${total - answered}개 남음)` : "결과 보기";
  }

  function goNext(){
    const totalPages = Math.ceil(state.shuffledQuestions.length / state.pageSize);
    if(state.currentPage < totalPages - 1){
      state.currentPage += 1;
      renderQuestions();
      updateProgress();
      scrollToEl("#testSection");
    }
  }

  function goPrev(){
    if(state.currentPage > 0){
      state.currentPage -= 1;
      renderQuestions();
      updateProgress();
      scrollToEl("#testSection");
    }
  }

  async function submitResult(){
    const total = state.questions.length;
    const answered = Object.keys(state.answers).length;
    if(answered < total){
      showToast(`${total - answered}개 문항이 남았습니다.`);
      return;
    }
    $("resultBtn").disabled = true;
    $("resultBtn").textContent = "채점 중...";
    try{
      const payload = await jsonp("score", {
        answers: JSON.stringify(state.answers),
        sessionId: state.sessionId,
        record: config.RESPONSE_LOG === false ? "0" : "1",
        source: "github"
      });
      state.result = payload.result;
      renderResult(payload.result, false);
      fireConfetti();
      scrollToEl("#resultSection");
    } catch(err){
      showToast(err.message);
    } finally {
      $("resultBtn").disabled = false;
      $("resultBtn").textContent = "결과 보기";
    }
  }

  function buildShareUrl(result){
    const configuredBase = String(config.SHARE_BASE_URL || "").trim();
    const url = configuredBase ? new URL(configuredBase) : new URL(location.href);
    url.search = "";
    url.searchParams.set("type", result.code);
    url.searchParams.set("h", result.pct.H);
    url.searchParams.set("a", result.pct.A);
    url.searchParams.set("f", result.pct.F);
    url.searchParams.set("r", result.pct.R);
    if(state.appVersion) url.searchParams.set("v", state.appVersion);
    return url.toString();
  }

  function resultText(result){
    const careers = (result.topCareers || []).map(x => `${x.career.name} ${x.score}%`).join(", ");
    return `나의 하이핏16 결과는 ${result.code} ${result.type.name}입니다. 추천 계열: ${careers}`;
  }

  function renderResult(result, shared){
    setMotionStage("result");
    $("resultSection").classList.add("active");
    $("testSection").classList.remove("active");
    const root = $("resultRoot");
    const shareUrl = buildShareUrl(result);

    const strengths = (result.type.strengths || []).map(x => `<span class="pill">${escapeHtml(x)}</span>`).join("");
    const learning = (result.type.learning || []).map(x => `<span class="pill gold">${escapeHtml(x)}</span>`).join("");
    const watch = (result.type.watch || []).map(x => `<span class="pill">${escapeHtml(x)}</span>`).join("");

    root.innerHTML = `
      <div class="result-shell">
        <div class="result-grid">
          <section class="result-hero">
            <div class="type-badge">${escapeHtml(result.type.emoji || "✨")}</div>
            <div class="type-code">${escapeHtml(result.code)}</div>
            <h2 class="type-name">${escapeHtml(result.type.name)}</h2>
            <p class="type-tagline">${escapeHtml(result.type.tagline || "")}</p>
            <p class="type-summary">${escapeHtml(result.type.summary || "")}</p>
            <p class="result-note">${escapeHtml(result.type.mbti || "")}<br>${escapeHtml((result.sourceNotes && result.sourceNotes.mbti) || "MBTI 유사 표기는 흥미 유발용 비유입니다.")}</p>
            <div class="result-actions">
              <button class="btn btn-secondary" type="button" id="printBtn">인쇄/PDF 저장</button>
              <button class="btn btn-secondary" type="button" id="retryBtn">다시 검사하기</button>
            </div>
          </section>

          <aside class="result-side">
            <div class="mini-card">
              <h3>진로핏 DNA</h3>
              <div class="axis-result-list">
                ${renderAxisBars(result.axisPercents || [])}
              </div>
            </div>
            <div class="mini-card">
              <h3>강점 키워드</h3>
              <div class="pill-list">${strengths || "<span class='pill'>탐색 중</span>"}</div>
            </div>
            <div class="mini-card">
              <h3>추천 학습 전략</h3>
              <div class="pill-list">${learning || "<span class='pill gold'>관심 과목 기록하기</span>"}</div>
            </div>
            <div class="mini-card">
              <h3>보완 포인트</h3>
              <div class="pill-list">${watch || "<span class='pill'>상담으로 구체화하기</span>"}</div>
            </div>
            <div class="share-box">
              <h3>결과 공유</h3>
              <div class="share-actions">
                <button class="btn btn-primary" type="button" id="shareBtn">공유하기</button>
                <button class="btn btn-secondary" type="button" id="copyLinkBtn">링크 복사</button>
                <button class="btn btn-secondary" type="button" id="copyTextBtn">텍스트 복사</button>
                <button class="btn btn-secondary" type="button" id="smsBtn">문자</button>
                <button class="btn btn-secondary" type="button" id="facebookBtn">Facebook</button>
                <button class="btn btn-secondary" type="button" id="threadsBtn">Threads</button>
              </div>
            </div>
          </aside>
        </div>

        <section class="career-section">
          <div class="panel">
            <div class="panel-title">
              <div>
                <h2>추천 계열과 선택 과목</h2>
                <p>본교 개설 여부와 관계없이 공동교육과정·온라인학교·학교 밖 교육까지 고려해 폭넓게 제안합니다.</p>
              </div>
            </div>
            <div class="course-grid">
              ${renderCareerCards(result.topCareers || [])}
            </div>
            <div class="admission-box">
              <h3>2028 대입·과목 설계 참고</h3>
              <p>${escapeHtml((result.sourceNotes && result.sourceNotes.admission) || "")}</p>
              <p style="margin-top:8px">${escapeHtml((result.sourceNotes && result.sourceNotes.curriculum) || "")}</p>
            </div>
          </div>
        </section>

        <section class="career-section">
          <div class="panel">
            <div class="panel-title">
              <div>
                <h2>9개 계열 일치도</h2>
                <p>1위만 확정하지 말고 상위 2~3개 계열을 함께 상담 자료로 활용하세요.</p>
              </div>
            </div>
            <div class="score-list">${renderCareerScores(result.allCareerScores || [])}</div>
          </div>
        </section>
      </div>
    `;

    bindResultButtons(result, shareUrl);
    if(shared) showToast("공유된 하이핏16 결과를 불러왔습니다.");
  }

  function renderAxisBars(axisPercents){
    return axisPercents.map((a, idx) => `
      <div class="split-axis" style="animation-delay:${idx * 70}ms">
        <div class="split-side">${escapeHtml(a.left)} ${escapeHtml(a.leftName)} ${a.leftPct}%</div>
        <div class="split-mid">${escapeHtml(a.axis)}</div>
        <div class="split-side right">${a.rightPct}% ${escapeHtml(a.right)} ${escapeHtml(a.rightName)}</div>
        <div class="split-track">
          <div class="split-left" style="width:${a.leftPct}%"></div>
          <div class="split-right" style="width:${a.rightPct}%"></div>
        </div>
      </div>
    `).join("");
  }

  function renderCareerCards(topCareers){
    return topCareers.map((item, idx) => {
      const c = item.career || {};
      return `
        <article class="career-card" style="animation-delay:${idx * 100}ms">
          <h3><span class="rank">#${idx + 1}</span>${escapeHtml(c.name || item.key)} <span style="color:var(--brand)">${item.score}%</span></h3>
          <p>${escapeHtml(c.summary || "")}</p>
          <p class="majors"><strong>관련 학과·전공:</strong> ${escapeHtml(c.majors || "")}</p>
          <div class="admission-box" style="margin-top:12px;padding:12px">
            <p>${escapeHtml(c.admission || "")}</p>
          </div>
          ${courseBlock("일반 선택", c.general)}
          ${courseBlock("진로 선택", c.career)}
          ${courseBlock("융합·공동교육과정 후보", [...(c.fusion || []), ...(c.community || [])])}
        </article>
      `;
    }).join("");
  }

  function courseBlock(title, arr){
    const list = Array.isArray(arr) ? arr : [];
    if(!list.length) return "";
    return `
      <div class="course-block">
        <strong>${escapeHtml(title)}</strong>
        <div class="chips">
          ${list.map(x => `<span class="chip">${escapeHtml(x)}</span>`).join("")}
        </div>
      </div>
    `;
  }

  function renderCareerScores(scores){
    return scores.map(row => `
      <div class="score-row">
        <span>${escapeHtml(row.name || row.key)}</span>
        <div class="score-track"><div class="score-fill" style="width:${row.score}%"></div></div>
        <strong>${row.score}%</strong>
      </div>
    `).join("");
  }

  function bindResultButtons(result, shareUrl){
    $("printBtn")?.addEventListener("click", () => window.print());
    $("retryBtn")?.addEventListener("click", startTest);

    $("shareBtn")?.addEventListener("click", async () => {
      const text = resultText(result);
      if(navigator.share){
        try{
          await navigator.share({ title: "하이핏16 결과", text, url: shareUrl });
          return;
        } catch(e) {}
      }
      await copyToClipboard(`${text}\n${shareUrl}`);
      showToast("공유 텍스트를 복사했습니다.");
    });

    $("copyLinkBtn")?.addEventListener("click", async () => {
      await copyToClipboard(shareUrl);
      showToast("결과 링크를 복사했습니다.");
    });

    $("copyTextBtn")?.addEventListener("click", async () => {
      await copyToClipboard(`${resultText(result)}\n${shareUrl}`);
      showToast("결과 텍스트를 복사했습니다.");
    });

    $("smsBtn")?.addEventListener("click", () => {
      const body = encodeURIComponent(`${resultText(result)}\n${shareUrl}`);
      location.href = `sms:?&body=${body}`;
    });

    $("facebookBtn")?.addEventListener("click", () => {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
    });

    $("threadsBtn")?.addEventListener("click", () => {
      const text = encodeURIComponent(`${resultText(result)} ${shareUrl}`);
      window.open(`https://www.threads.net/intent/post?text=${text}`, "_blank", "noopener,noreferrer");
    });
  }

  async function copyToClipboard(text){
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  async function showTypes(){
    const overlay = $("typesOverlay");
    const grid = $("typesGrid");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    grid.innerHTML = `<div class="loading-card"><div class="loader"></div><p>유형 정보를 불러오는 중입니다.</p></div>`;
    try{
      const payload = await jsonp("typesSummary");
      grid.innerHTML = (payload.types || []).map(t => `
        <article class="type-tile">
          <div class="tt-head">
            <span class="emoji">${escapeHtml(t.emoji || "✨")}</span>
            <span class="code">${escapeHtml(t.code)}</span>
          </div>
          <p><strong>${escapeHtml(t.name)}</strong></p>
          <p>${escapeHtml(t.tagline || "")}</p>
          <p class="mbti">${escapeHtml(t.mbti || "")}</p>
        </article>
      `).join("");
    } catch(err){
      grid.innerHTML = `<div class="loading-card"><p style="color:#8A2E0D">오류: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  function closeTypes(){
    const overlay = $("typesOverlay");
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }

  async function loadSharedResultIfAny(){
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if(!type) return false;
    if(!backendConfigured()){
      showSetupAlert();
      return false;
    }
    $("resultSection").classList.add("active");
    $("resultRoot").innerHTML = `<div class="loading-card"><div class="loader"></div><p>공유된 결과를 불러오는 중입니다.</p></div>`;
    try{
      const payload = await jsonp("sharedResult", {
        type,
        h: params.get("h") || "",
        a: params.get("a") || "",
        f: params.get("f") || "",
        r: params.get("r") || ""
      });
      state.result = payload.result;
      renderResult(payload.result, true);
      scrollToEl("#resultSection");
      return true;
    } catch(err){
      $("resultRoot").innerHTML = `<div class="loading-card"><p style="color:#8A2E0D">공유 결과 오류: ${escapeHtml(err.message)}</p></div>`;
      return false;
    }
  }

  function fireConfetti(){
    const canvas = $("confettiCanvas");
    if(!canvas || !motionConfig.confettiEnabled || prefersReducedMotion() || document.body.classList.contains("motion-off")) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.scale(dpr, dpr);

    const colors = ["#00683A","#0D8A55","#35B878","#D9A84E","#BEE8CF","#FFFFFF"];
    const pieces = Array.from({length: motionConfig.confettiPieces}, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * 80,
      size: 6 + Math.random() * 8,
      speed: 2 + Math.random() * 5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .22,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    let frame = 0;
    canvas.classList.add("active");
    function tick(){
      frame++;
      ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
      pieces.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(frame * .02 + p.angle) * 1.4;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * .58);
        ctx.restore();
      });
      if(frame < motionConfig.confettiFrames){
        requestAnimationFrame(tick);
      } else {
        canvas.classList.remove("active");
        ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
      }
    }
    tick();
  }

  function bindEvents(){
    document.querySelectorAll("[data-scroll]").forEach(btn => {
      btn.addEventListener("click", () => scrollToEl(btn.dataset.scroll));
    });
    $("startBtn")?.addEventListener("click", startTest);
    $("topStartBtn")?.addEventListener("click", startTest);
    $("viewAllTypesBtn")?.addEventListener("click", showTypes);
    $("topTypesBtn")?.addEventListener("click", showTypes);
    $("typesClose")?.addEventListener("click", closeTypes);
    $("typesOverlay")?.addEventListener("click", (e) => {
      if(e.target === $("typesOverlay")) closeTypes();
    });
    $("prevBtn")?.addEventListener("click", goPrev);
    $("nextBtn")?.addEventListener("click", goNext);
    $("resultBtn")?.addEventListener("click", submitResult);
    $("restartBtn")?.addEventListener("click", startTest);
    window.addEventListener("keydown", (e) => {
      if(e.key === "Escape") closeTypes();
    });
  }

  async function init(){
    initAnimationComfort();
    setLogos();
    renderAxis(FALLBACK_AXES);
    bindEvents();
    showSetupAlert();
    await loadSharedResultIfAny();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
