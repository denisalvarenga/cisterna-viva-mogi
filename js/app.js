/* Cisterna Viva — aplicação */
(function () {
  'use strict';
  const CV = window.CV;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const nf = new Intl.NumberFormat('pt-BR');
  const fmt = v => nf.format(Math.round(v));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const normalize = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const el = (tag, props, children) => {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(c => n.append(c));
    return n;
  };

  /* =============== Estado e persistência =============== */
  const KEY = 'cisterna-viva:v2';
  const DEFAULTS = {
    nome: '', area: 60, roof: 'ceramica', uf: 'PE', cidade: 'Petrolina', perfil: null,
    chuvaAno: null, perdas: 10, mes: null,
    res: { cap: null, nivel: null, entrada: null, uso: { domestico: 120, higiene: 40, irrigacao: 60 } }
  };
  const num = (v, min, max, fallback) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? clamp(n, min, max) : fallback;
  };
  function loadState() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { raw = {}; }
    const s = JSON.parse(JSON.stringify(DEFAULTS));
    s.nome = typeof raw.nome === 'string' ? raw.nome.slice(0, 40) : '';
    s.area = num(raw.area, 10, 500, 60);
    s.roof = CV.ROOFS[raw.roof] ? raw.roof : 'ceramica';
    s.uf = CV.STATES.some(x => x.id === raw.uf) ? raw.uf : 'PE';
    s.cidade = typeof raw.cidade === 'string' ? raw.cidade : 'Petrolina';
    s.perfil = CV.PROFILES[raw.perfil] ? raw.perfil : null;
    s.chuvaAno = num(raw.chuvaAno, 100, 6000, null);
    s.perdas = num(raw.perdas, 0, 40, 10);
    s.mes = Number.isInteger(raw.mes) && raw.mes >= 0 && raw.mes < 12 ? raw.mes : null;
    const r = raw.res || {};
    s.res.cap = num(r.cap, 0, 1e7, null);
    s.res.nivel = num(r.nivel, 0, 1e7, null);
    s.res.entrada = num(r.entrada, 0, 1e8, null);
    ['domestico', 'higiene', 'irrigacao'].forEach(k => { s.res.uso[k] = num(r.uso && r.uso[k], 0, 1e6, DEFAULTS.res.uso[k]); });
    return s;
  }
  const S = loadState();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível */ } }

  const stateInfo = () => CV.STATES.find(s => s.id === S.uf) || CV.STATES[0];
  const profileKey = () => S.perfil || stateInfo().perfil;
  const monthIndex = () => (S.mes === null ? new Date().getMonth() : S.mes);

  /* =============== Fotografias =============== */
  function paintPhotos(root) {
    $$('img[data-photo]', root || document).forEach(img => {
      const p = CV.PHOTOS[img.dataset.photo];
      if (!p) return;
      const widths = (img.dataset.widths || '600,1000,1600').split(',').map(Number);
      const mid = widths[Math.floor(widths.length / 2)];
      img.alt = p.alt;
      img.sizes = img.dataset.sizes || '100vw';
      img.srcset = p.srcset(widths);
      img.src = p.src(mid);
      img.decoding = 'async';
      if ('eager' in img.dataset) img.setAttribute('fetchpriority', 'high');
      else img.loading = img.loading || 'lazy';
      if (!img.hasAttribute('width')) { img.width = 1200; img.height = 800; }
    });
    watchBroken(root);
  }
  function markBroken(img) { const f = img.closest('.ph'); if (f) f.classList.add('is-broken'); }
  function watchBroken(root) {
    $$('img', root || document).forEach(img => {
      if (img.dataset.watched) return;
      img.dataset.watched = '1';
      img.addEventListener('error', () => markBroken(img));
      img.addEventListener('load', () => { const f = img.closest('.ph'); if (f) f.classList.remove('is-broken'); });
      if (img.complete && img.src && img.naturalWidth === 0) markBroken(img);
    });
  }

  /* =============== Municípios (IBGE) =============== */
  const MUNI_KEY = 'cisterna-viva:municipios:v2';
  const MUNI_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
  const MUNI_MAX_AGE = 7 * 24 * 3600 * 1000;
  const MUNI_MIN_TOTAL = 5500, MUNI_MAX_TOTAL = 5700;
  const muni = { byUF: CV.FALLBACK_MUNICIPIOS, source: 'fallback', total: 0, savedAt: null, loading: false, error: '' };
  muni.total = Object.values(muni.byUF).reduce((a, l) => a + l.length, 0);

  function validateMuni(byUF) {
    if (!byUF || typeof byUF !== 'object') return false;
    let total = 0;
    for (const st of CV.STATES) {
      const l = byUF[st.id];
      if (!Array.isArray(l) || l.length === 0 || !l.every(n => typeof n === 'string' && n.length > 1)) return false;
      total += l.length;
    }
    return total >= MUNI_MIN_TOTAL && total <= MUNI_MAX_TOTAL;
  }
  function parseIBGE(rows) {
    if (!Array.isArray(rows)) throw new Error('Resposta inesperada do IBGE');
    const out = {};
    rows.forEach(m => {
      const uf = (m && m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF && m.microrregiao.mesorregiao.UF.sigla) ||
        (m && m['regiao-imediata'] && m['regiao-imediata']['regiao-intermediaria'] && m['regiao-imediata']['regiao-intermediaria'].UF && m['regiao-imediata']['regiao-intermediaria'].UF.sigla);
      if (uf && m.nome) (out[uf] = out[uf] || []).push(m.nome);
    });
    Object.keys(out).forEach(k => out[k].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    return out;
  }
  function readMuniCache() {
    try {
      const c = JSON.parse(localStorage.getItem(MUNI_KEY));
      if (c && validateMuni(c.byUF) && typeof c.savedAt === 'number') return c;
    } catch (e) { /* ignora */ }
    return null;
  }
  async function loadMunicipios(force) {
    const cache = readMuniCache();
    if (cache) {
      muni.byUF = cache.byUF; muni.source = 'cache'; muni.savedAt = cache.savedAt;
      muni.total = Object.values(cache.byUF).reduce((a, l) => a + l.length, 0);
      if (!force && Date.now() - cache.savedAt < MUNI_MAX_AGE) { refreshMuniUI(); return; }
    }
    muni.loading = true; muni.error = ''; refreshMuniUI();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(MUNI_URL, { signal: ctl.signal });
      if (!res.ok) throw new Error('IBGE respondeu com erro ' + res.status);
      const byUF = parseIBGE(await res.json());
      if (!validateMuni(byUF)) { const ve = new Error('invalid'); ve.code = 'invalid'; throw ve; }
      muni.byUF = byUF; muni.source = 'ibge'; muni.savedAt = Date.now();
      muni.total = Object.values(byUF).reduce((a, l) => a + l.length, 0);
      try { localStorage.setItem(MUNI_KEY, JSON.stringify({ savedAt: muni.savedAt, byUF })); } catch (e) { /* sem espaço */ }
    } catch (e) {
      muni.error = e && e.code === 'invalid' ? 'Os dados recebidos do IBGE estavam incompletos e foram descartados.' : e && e.name === 'AbortError' ? 'A conexão demorou demais.' : (navigator.onLine === false ? 'Sem conexão com a internet.' : 'Não foi possível falar com o IBGE.');
      if (!cache) { muni.byUF = CV.FALLBACK_MUNICIPIOS; muni.source = 'fallback'; muni.total = Object.values(muni.byUF).reduce((a, l) => a + l.length, 0); }
    } finally {
      clearTimeout(timer); muni.loading = false; refreshMuniUI();
    }
  }
  const dateBR = ts => new Date(ts).toLocaleDateString('pt-BR');
  function muniStatusText() {
    if (muni.loading) return 'Carregando a lista oficial de municípios do IBGE…';
    if (muni.source === 'ibge') return `${fmt(muni.total)} municípios sincronizados com o IBGE em ${dateBR(muni.savedAt)}.`;
    if (muni.source === 'cache') return `${fmt(muni.total)} municípios (cópia salva em ${dateBR(muni.savedAt)}).` + (muni.error ? ` ${muni.error} Usando a cópia salva.` : '');
    return `Lista de contingência com ${fmt(muni.total)} cidades de exemplo — não é a lista completa. ${muni.error || ''} Conecte-se para carregar os ${fmt(5570)} municípios do IBGE.`.replace('  ', ' ');
  }

  /* =============== Combobox de município =============== */
  const cityInput = $('#cityInput'), cityList = $('#cityList'), cityErr = $('#cityErr');
  let comboIndex = -1, comboItems = [];
  function currentCities() { return muni.byUF[S.uf] || []; }
  function setCityError(msg) {
    cityErr.hidden = !msg; cityErr.textContent = msg || '';
    cityInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function openCombo(list) {
    comboItems = list; comboIndex = -1; cityList.replaceChildren();
    list.forEach((name, i) => {
      const li = el('li', { role: 'option', id: 'city-opt-' + i, 'aria-selected': 'false', text: name });
      li.addEventListener('mousedown', ev => { ev.preventDefault(); chooseCity(name); });
      cityList.append(li);
    });
    if (!list.length) cityList.append(el('li', { class: 'empty', role: 'presentation', text: 'Nenhum município encontrado neste estado.' }));
    cityList.hidden = false; cityInput.setAttribute('aria-expanded', 'true');
  }
  function closeCombo() { cityList.hidden = true; cityInput.setAttribute('aria-expanded', 'false'); cityInput.removeAttribute('aria-activedescendant'); comboIndex = -1; }
  function filterCities(q) {
    const all = currentCities(), n = normalize(q);
    if (!n) return all.slice(0, 60);
    const starts = [], contains = [];
    for (const c of all) { const nc = normalize(c); if (nc.startsWith(n)) starts.push(c); else if (nc.includes(n)) contains.push(c); }
    return starts.concat(contains).slice(0, 60);
  }
  function highlight(i) {
    $$('li[role=option]', cityList).forEach((li, k) => { const on = k === i; li.setAttribute('aria-selected', on ? 'true' : 'false'); li.classList.toggle('on', on); if (on) li.scrollIntoView({ block: 'nearest' }); });
    comboIndex = i;
    if (i >= 0) cityInput.setAttribute('aria-activedescendant', 'city-opt-' + i); else cityInput.removeAttribute('aria-activedescendant');
  }
  function chooseCity(name) {
    S.cidade = name; cityInput.value = name; setCityError(''); closeCombo(); save(); renderCalc();
  }
  cityInput.addEventListener('input', () => { setCityError(''); openCombo(filterCities(cityInput.value)); });
  cityInput.addEventListener('focus', () => { if (!cityInput.disabled) { cityInput.select(); openCombo(filterCities('')); } });
  cityInput.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (cityList.hidden) openCombo(filterCities(cityInput.value)); highlight(Math.min(comboItems.length - 1, comboIndex + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); highlight(Math.max(0, comboIndex - 1)); }
    else if (ev.key === 'Enter') { if (!cityList.hidden && comboIndex >= 0) { ev.preventDefault(); chooseCity(comboItems[comboIndex]); } else if (!cityList.hidden && comboItems.length === 1) { ev.preventDefault(); chooseCity(comboItems[0]); } else if (!cityList.hidden) { ev.preventDefault(); } }
    else if (ev.key === 'Escape') { if (!cityList.hidden) { ev.preventDefault(); closeCombo(); cityInput.value = S.cidade; } }
  });
  cityInput.addEventListener('blur', () => {
    closeCombo();
    const typed = cityInput.value.trim();
    if (!typed) { cityInput.value = S.cidade; return; }
    const hit = currentCities().find(c => normalize(c) === normalize(typed));
    if (hit) { if (hit !== S.cidade) { S.cidade = hit; save(); renderCalc(); } cityInput.value = hit; setCityError(''); }
    else { setCityError(`“${typed}” não está na lista de ${stateInfo().name}. Escolha um município da lista.`); }
  });

  function refreshMuniUI() {
    $('#cityStatus').textContent = muniStatusText();
    $('#cityStatus').dataset.source = muni.loading ? 'loading' : muni.source;
    $('#cityRetry').hidden = muni.loading || muni.source === 'ibge' || (muni.source === 'cache' && !muni.error);
    cityInput.disabled = false;
    cityInput.placeholder = `Digite para buscar em ${stateInfo().name}`;
    const list = currentCities();
    if (!list.includes(S.cidade)) { S.cidade = list[0] || ''; save(); }
    if (document.activeElement !== cityInput) cityInput.value = S.cidade;
    renderCalc();
  }

  /* =============== Cálculo =============== */
  function monthMm(profile, m) { const r = CV.PROFILES[profile].mm[m]; return r; }
  function monthsMm() {
    const prof = profileKey(), base = CV.PROFILES[prof].mm;
    if (S.chuvaAno) {
      const mid = base.map(r => (r[0] + r[1]) / 2), tot = mid.reduce((a, b) => a + b, 0) || 1;
      return mid.map(v => { const mm = S.chuvaAno * v / tot; return [mm, mm]; });
    }
    return base;
  }
  function litersFor(mm) {
    const c = CV.ROOFS[S.roof].c, k = c * (1 - S.perdas / 100);
    return [mm[0] * S.area * k, mm[1] * S.area * k];
  }
  function compute() {
    const mm = monthsMm(), litres = mm.map(litersFor), m = monthIndex();
    const annual = [litres.reduce((a, l) => a + l[0], 0), litres.reduce((a, l) => a + l[1], 0)];
    return { mm, litres, m, annual, avgMonthly: (annual[0] + annual[1]) / 2 / 12 };
  }
  const rangeText = (a, b) => Math.round(a) === Math.round(b) ? `${fmt(a)} L` : `${fmt(a)} – ${fmt(b)} L`;
  const mmText = r => Math.round(r[0]) === Math.round(r[1]) ? `${fmt(r[0])} mm` : `${fmt(r[0])}–${fmt(r[1])} mm`;

  function renderCalc() {
    if (!$('#view-calculadora') || !S) return;
    const r = compute(), M = CV.MONTHS, own = !!S.chuvaAno;
    $('#resLabel').textContent = `Captação estimada em ${M[r.m]} — ${cityLabel()}`;
    $('#resBig').textContent = rangeText(r.litres[r.m][0], r.litres[r.m][1]);
    const dia = (r.litres[r.m][0] + r.litres[r.m][1]) / 2 / 30;
    $('#resSub').textContent = `Cerca de ${fmt(dia)} L por dia neste mês. No ano: ${rangeText(r.annual[0], r.annual[1])}.`;
    const c = CV.ROOFS[S.roof].c, kk = Math.round(c * (1 - S.perdas / 100) * 100) / 100;
    $('#formula').textContent = `${mmText(r.mm[r.m])} × ${fmt(S.area)} m² × ${String(c).replace('.', ',')} × (1 − ${S.perdas}%) = ${rangeText(r.litres[r.m][0], r.litres[r.m][1])}  (fator de aproveitamento total ≈ ${String(kk).replace('.', ',')})`;
    // barras
    const max = Math.max(1, ...r.litres.map(l => l[1]));
    const bars = $('#bars'); bars.replaceChildren();
    r.litres.forEach((l, i) => {
      const col = el('div', { class: 'bar' + (i === r.m ? ' cur' : '') });
      const hi = el('span', { class: 'hi' }); hi.style.setProperty('--v', l[1] / max);
      const lo = el('span', { class: 'lo' }); lo.style.setProperty('--v', l[0] / max);
      col.append(hi, lo, el('i', { text: CV.MONTHS_SHORT[i] }));
      bars.append(col);
    });
    bars.setAttribute('aria-label', 'Gráfico de barras da captação estimada por mês. ' + r.litres.map((l, i) => `${M[i]}: ${rangeText(l[0], l[1])}`).join('; ') + '.');
    const tb = $('#resTable tbody'); tb.replaceChildren();
    r.litres.forEach((l, i) => tb.append(el('tr', null, [el('th', { scope: 'row', text: M[i] }), el('td', { text: mmText(r.mm[i]) }), el('td', { text: rangeText(l[0], l[1]) })])));
    // aviso de confiabilidade
    const prof = CV.PROFILES[profileKey()].label;
    $('#resNotice').textContent = own
      ? `Usando a chuva anual que você informou (${fmt(S.chuvaAno)} mm), distribuída pelo formato do perfil “${prof}”. Ainda é uma estimativa.`
      : `Estimativa com faixa de referência regional (“${prof}”). Não é o histórico de ${S.cidade || 'seu município'}: a chuva real pode ser bem diferente. Informe a média anual do INMET para refinar.`;
  }
  const cityLabel = () => (S.cidade ? `${S.cidade} (${S.uf})` : S.uf);

  /* =============== Reservatório =============== */
  const USO_LABEL = { domestico: 'Uso doméstico', higiene: 'Higiene', irrigacao: 'Irrigação' };
  function resMetrics() {
    const R = S.res, total = R.uso.domestico + R.uso.higiene + R.uso.irrigacao;
    const ok = R.cap > 0 && R.nivel !== null;
    const nivel = ok ? Math.min(R.nivel, R.cap) : null;
    const pct = ok ? nivel / R.cap * 100 : null;
    const dias = ok && total > 0 ? nivel / total : null;
    return { R, total, ok, nivel, pct, dias };
  }
  function statusFor(dias) {
    if (dias === null) return { k: 'none', t: 'Sem dados' };
    if (dias < 7) return { k: 'crit', t: 'Crítico' };
    if (dias < 15) return { k: 'warn', t: 'Atenção' };
    return { k: 'ok', t: 'Confortável' };
  }
  function gaugeNode(m) {
    const st = statusFor(m.dias);
    const g = el('div', { class: 'gauge st-' + st.k });
    g.style.setProperty('--p', m.pct === null ? 0 : m.pct);
    g.append(el('div', { class: 'gauge-in' }, [el('strong', { text: m.pct === null ? '—' : Math.round(m.pct) + '%' }), el('span', { text: 'cheio' })]));
    return g;
  }
  function renderRes() {
    const m = resMetrics(), st = statusFor(m.dias);
    const wrap = $('#resGauge'); wrap.replaceChildren(gaugeNode(m));
    const info = el('div', { class: 'gauge-info' });
    if (!m.ok) {
      info.append(el('p', { class: 'days', text: 'Informe a capacidade e o nível.' }), el('p', { class: 'muted', text: 'Assim calculamos quantos dias a água dura.' }));
    } else if (m.dias === null) {
      info.append(el('p', { class: 'days', text: 'Informe o consumo diário.' }));
    } else {
      info.append(el('span', { class: 'chip st-' + st.k, text: st.t }),
        el('p', { class: 'days', text: m.dias < 1 ? 'Menos de 1 dia de água' : `≈ ${Math.floor(m.dias)} ${Math.floor(m.dias) === 1 ? 'dia' : 'dias'} de água` }),
        el('p', { class: 'muted', text: `${fmt(m.nivel)} L de ${fmt(m.R.cap)} L · consumo de ${fmt(m.total)} L/dia, sem chuva` }));
    }
    wrap.append(info);
    const split = $('#resSplit'); split.replaceChildren();
    Object.keys(USO_LABEL).forEach(k => {
      const share = m.total ? m.R.uso[k] / m.total * 100 : 0;
      const row = el('div', { class: 'srow' });
      row.append(el('div', { class: 'stop' }, [el('span', { text: USO_LABEL[k] }), el('span', { text: `${fmt(m.R.uso[k])} L/dia · ${Math.round(share)}%` })]));
      const bar = el('div', { class: 'sbar' }, [el('b', { class: 'k-' + k })]);
      bar.firstChild.style.width = share + '%';
      row.append(bar); split.append(row);
    });
    const bal = $('#resBalance');
    if (m.R.entrada && m.total) {
      const diff = m.R.entrada - m.total * 30;
      bal.textContent = diff >= 0
        ? `Com a captação média estimada (${fmt(m.R.entrada)} L/mês), a entrada cobre o consumo de 30 dias (${fmt(m.total * 30)} L). Mas a chuva se concentra em poucos meses: nos meses secos, conte só com o que está guardado.`
        : `A captação média estimada (${fmt(m.R.entrada)} L/mês) não cobre o consumo de 30 dias (${fmt(m.total * 30)} L): faltam cerca de ${fmt(-diff)} L por mês. Reduzir o consumo ou aumentar a área de captação ajuda.`;
    } else {
      bal.textContent = 'Informe a captação média estimada (use a calculadora) para ver se a chuva cobre o seu consumo.';
    }
    $('#entradaHelp').textContent = m.R.entrada ? 'Média mensal ao longo do ano, vinda da calculadora ou digitada por você.' : 'Ainda não definida. Faça a estimativa na calculadora e use o botão “Usar no meu reservatório”.';
  }
  function renderSnap() {
    const m = resMetrics(), st = statusFor(m.dias), box = $('#homeSnap'); box.replaceChildren();
    box.append(gaugeNode(m));
    const info = el('div', { class: 'gauge-info' });
    if (m.ok && m.dias !== null) {
      info.append(el('span', { class: 'chip st-' + st.k, text: st.t }),
        el('p', { class: 'days', text: m.dias < 1 ? 'Menos de 1 dia de água' : `≈ ${Math.floor(m.dias)} ${Math.floor(m.dias) === 1 ? 'dia' : 'dias'} de água` }),
        el('p', { class: 'muted', text: `${fmt(m.nivel)} L armazenados · consumo de ${fmt(m.total)} L/dia` }),
        el('a', { class: 'link', href: '#/reservatorio', text: 'Atualizar nível →' }));
    } else {
      info.append(el('p', { class: 'days', text: 'Você ainda não cadastrou seu reservatório.' }),
        el('p', { class: 'muted', text: 'Informe capacidade, nível e consumo para ver quantos dias a água dura.' }),
        el('a', { class: 'btn btn-quiet', href: '#/reservatorio', text: 'Cadastrar reservatório' }));
    }
    box.append(info);
  }

  /* =============== Guias, apoio, fontes =============== */
  function guideCard(g, big) {
    const a = el('a', { class: 'gcard', href: '#/guias/' + g.id });
    const fig = el('figure', { class: 'ph', 'data-fallback': 'Fotografia indisponível no momento' });
    fig.append(el('img', { 'data-photo': g.photo, 'data-widths': '400,640,900', 'data-sizes': big ? '(min-width:900px) 30vw, 90vw' : '(min-width:900px) 28vw, 90vw', loading: 'lazy' }));
    a.append(fig, el('div', { class: 'gtxt' }, [el('span', { class: 'tag', text: 'Resumo orientativo' }), el('h3', { text: g.title }), el('p', { text: g.summary })]));
    return a;
  }
  function renderGuideLists() {
    [['#homeGuides', false], ['#guiasList', true]].forEach(([sel, big]) => {
      const box = $(sel); box.replaceChildren(...CV.GUIDES.map(g => guideCard(g, big))); paintPhotos(box);
    });
  }
  function renderGuide(id) {
    const g = CV.GUIDES.find(x => x.id === id);
    if (!g) { location.hash = '#/guias'; return false; }
    $('#h-guia').textContent = g.title; $('#guiaSummary').textContent = g.summary;
    const img = $('#guiaImg'); img.dataset.photo = g.photo; img.dataset.widths = '600,1000,1400'; img.dataset.sizes = '(min-width:900px) 760px, 100vw'; img.removeAttribute('width'); img.dataset.watched = '';
    $('#guiaPh').classList.remove('is-broken'); paintPhotos($('#guiaPh'));
    $('#guiaSteps').replaceChildren(...g.steps.map(s => el('li', { text: s })));
    $('#guiaCaution').replaceChildren(el('strong', { text: 'Atenção. ' }), document.createTextNode(g.caution));
    const src = $('#guiaSource'); src.replaceChildren(document.createTextNode('Referência: '), el('a', { href: g.url, target: '_blank', rel: 'noopener', text: g.source }), document.createTextNode('. Este resumo não foi revisado por profissional.'));
    const p = CV.PHOTOS[g.photo]; $('#guiaPhotoNote').textContent = `Foto: ${p.author}, Pexels. ${p.note}`;
    document.title = g.title + ' — Cisterna Viva';
    return true;
  }
  let tipI = Math.floor(Math.random() * CV.TIPS.length);
  function renderTip() {
    const t = CV.TIPS[tipI];
    $('#tipText').textContent = t.text; $('#tipCat').textContent = t.cat;
    const a = $('#tipSrc'); a.textContent = 'Fonte: ' + t.source; a.href = t.url;
    $('#tipCount').textContent = `${CV.TIPS.length} dicas, todas disponíveis offline.`;
  }
  function renderSources() {
    $('#sourcesList').replaceChildren(...CV.SOURCES.map(s => el('div', { class: 'src-card' }, [
      el('h3', { text: s.name }), el('p', { text: s.desc }),
      el('a', { class: 'link', href: s.url, target: '_blank', rel: 'noopener', text: 'Abrir fonte oficial ↗' })
    ])));
    $('#creditList').replaceChildren(...Object.keys(CV.PHOTOS).map(k => {
      const p = CV.PHOTOS[k];
      return el('li', null, [document.createTextNode(`${p.alt}. Foto de ${p.author} — `), el('a', { href: p.page, target: '_blank', rel: 'noopener', text: 'página no Pexels' }), document.createTextNode(`. ${p.note} Acesso em 12/10/2026.`)]);
    }));
  }

  /* =============== Formulários =============== */
  function periodGreeting() {
    const h = new Date().getHours(), g = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
    $('#greeting').textContent = S.nome ? `${g}, ${S.nome}` : 'Captação de água da chuva';
  }
  function setArea(v, fromInput) {
    const n = parseFloat(v), err = $('#areaErr');
    if (!Number.isFinite(n) || n < 10 || n > 500) {
      err.hidden = false; err.textContent = 'Informe uma área entre 10 e 500 m².'; $('#area').setAttribute('aria-invalid', 'true');
      return;
    }
    err.hidden = true; $('#area').setAttribute('aria-invalid', 'false');
    S.area = n; if (!fromInput) $('#area').value = n; $('#areaRange').value = n; save(); renderCalc();
  }
  function fillSelects() {
    $('#roof').replaceChildren(...Object.keys(CV.ROOFS).map(k => el('option', { value: k, text: `${CV.ROOFS[k].label} (coef. ${String(CV.ROOFS[k].c).replace('.', ',')})` })));
    $('#uf').replaceChildren(...CV.STATES.map(s => el('option', { value: s.id, text: s.name })));
    $('#perfil').replaceChildren(...Object.keys(CV.PROFILES).map(k => el('option', { value: k, text: CV.PROFILES[k].label })));
    $('#mes').replaceChildren(...CV.MONTHS.map((m, i) => el('option', { value: String(i), text: m.charAt(0).toUpperCase() + m.slice(1) })));
  }
  function syncCalcForm() {
    $('#area').value = S.area; $('#areaRange').value = S.area; $('#roof').value = S.roof; $('#uf').value = S.uf;
    $('#perfil').value = profileKey(); $('#chuvaAno').value = S.chuvaAno || ''; $('#perdas').value = S.perdas; $('#perdasOut').textContent = S.perdas + '%';
    $('#mes').value = String(monthIndex());
    $('#roofHelp').textContent = 'Coeficiente de escoamento típico: parte da chuva que realmente escorre para a calha.';
    $('#perfilHelp').textContent = S.perfil ? 'Você escolheu este perfil manualmente.' : `Sugerido para ${stateInfo().name}. Dentro de um mesmo estado a chuva varia muito: troque se o seu município for diferente.`;
    cityInput.value = S.cidade;
  }
  function wireForms() {
    $('#area').addEventListener('input', e => setArea(e.target.value, true));
    $('#areaRange').addEventListener('input', e => setArea(e.target.value, false));
    $$('.step').forEach(b => b.addEventListener('click', () => setArea(clamp((parseFloat($('#area').value) || S.area) + parseInt(b.dataset.step, 10), 10, 500), false)));
    $('#roof').addEventListener('change', e => { S.roof = e.target.value; save(); renderCalc(); });
    $('#uf').addEventListener('change', e => {
      S.uf = e.target.value; S.cidade = (muni.byUF[S.uf] || [])[0] || ''; save(); setCityError('');
      $('#perfil').value = profileKey(); syncCalcForm(); refreshMuniUI();
    });
    $('#perfil').addEventListener('change', e => { S.perfil = e.target.value === stateInfo().perfil ? null : e.target.value; save(); syncCalcForm(); renderCalc(); });
    $('#chuvaAno').addEventListener('input', e => { S.chuvaAno = num(e.target.value, 100, 6000, null); save(); renderCalc(); });
    $('#perdas').addEventListener('input', e => { S.perdas = num(e.target.value, 0, 40, 10); $('#perdasOut').textContent = S.perdas + '%'; save(); renderCalc(); });
    $('#mes').addEventListener('change', e => { S.mes = parseInt(e.target.value, 10); save(); renderCalc(); });
    $('#calcForm').addEventListener('submit', e => e.preventDefault());
    $('#cityRetry').addEventListener('click', () => loadMunicipios(true));
    $('#saveEst').addEventListener('click', () => {
      const r = compute(); S.res.entrada = Math.round(r.avgMonthly); save();
      $('#saveMsg').textContent = `Salvo: entrada média de ${fmt(S.res.entrada)} L/mês. Veja em “Reservatório”.`;
    });

    // reservatório
    const capEl = $('#cap'), nivelEl = $('#nivel');
    const readRes = () => {
      S.res.cap = num(capEl.value, 0, 1e7, null);
      S.res.nivel = num(nivelEl.value, 0, 1e7, null);
      const err = $('#nivelErr');
      if (S.res.cap !== null && S.res.nivel !== null && S.res.nivel > S.res.cap) {
        err.hidden = false; err.textContent = `O nível não pode passar da capacidade (${fmt(S.res.cap)} L). Usando ${fmt(S.res.cap)} L nos cálculos.`; nivelEl.setAttribute('aria-invalid', 'true');
      } else { err.hidden = true; nivelEl.setAttribute('aria-invalid', 'false'); }
      S.res.entrada = num($('#entrada').value, 0, 1e8, null);
      $$('[data-uso]').forEach(i => { S.res.uso[i.dataset.uso] = num(i.value, 0, 1e6, 0); });
      save(); renderRes(); renderSnap();
    };
    $('#resForm').addEventListener('input', readRes);
    $('#resForm').addEventListener('submit', e => e.preventDefault());

    $('#quickForm').addEventListener('submit', e => {
      e.preventDefault();
      const n = parseFloat($('#quickArea').value);
      if (Number.isFinite(n) && n >= 10 && n <= 500) { S.area = n; save(); }
      location.hash = '#/calculadora';
    });
    $('#nameForm').addEventListener('submit', e => { e.preventDefault(); S.nome = $('#nome').value.trim().slice(0, 40); save(); periodGreeting(); });
    const enter = save_name => {
      if (save_name) { S.nome = $('#nomeEntrada').value.trim().slice(0, 40); save(); }
      markWelcome(); location.hash = '#/inicio';
    };
    $('#entryForm').addEventListener('submit', e => { e.preventDefault(); enter(true); });
    $('#entrySkip').addEventListener('click', () => enter(false));
    $('#nextTip').addEventListener('click', () => { let n = tipI; while (CV.TIPS.length > 1 && n === tipI) n = Math.floor(Math.random() * CV.TIPS.length); tipI = n; renderTip(); });
  }
  function syncResForm() {
    const R = S.res;
    $('#cap').value = R.cap === null ? '' : R.cap; $('#nivel').value = R.nivel === null ? '' : R.nivel; $('#entrada').value = R.entrada === null ? '' : R.entrada;
    $$('[data-uso]').forEach(i => { i.value = R.uso[i.dataset.uso]; });
    $('#nome').value = S.nome; $('#quickArea').value = S.area;
  }

  /* =============== Rotas =============== */
  const WELCOME_KEY = 'cisterna-viva:welcome:v1';
  const welcomeSeen = () => { try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch (e) { return false; } };
  const markWelcome = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* sem armazenamento */ } };
  const VIEWS = ['entrar', 'inicio', 'calculadora', 'reservatorio', 'guias', 'guia', 'apoio', 'fontes'];
  function route() {
    // Primeira visita sem rota: mostra a tela de boas-vindas (opcional, sai com um toque).
    if (!location.hash.replace(/^#\/?/, '') && !welcomeSeen()) history.replaceState(null, '', '#/entrar');
    const parts = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
    let name = VIEWS.includes(parts[0]) && parts[0] !== 'guia' ? parts[0] : 'inicio';
    if (parts[0] === 'guias' && parts[1]) { if (!renderGuide(parts[1])) return; name = 'guia'; }
    VIEWS.forEach(v => { const sec = $('#view-' + v); if (sec) sec.hidden = v !== name; });
    $$('[data-nav]').forEach(a => {
      const on = a.dataset.nav === (name === 'guia' ? 'guias' : name);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.body.classList.toggle('is-entrar', name === 'entrar');
    const sec = $('#view-' + name);
    if (name === 'entrar') $('#nomeEntrada').value = S.nome;
    if (name !== 'guia') document.title = (name === 'inicio' ? 'Cisterna Viva — água da chuva que dura' : sec.dataset.title + ' — Cisterna Viva');
    if (name === 'calculadora') { syncCalcForm(); renderCalc(); }
    if (name === 'reservatorio') { syncResForm(); renderRes(); }
    if (name === 'inicio') { syncResForm(); renderSnap(); periodGreeting(); }
    if (name === 'apoio') renderTip();
    if (name === 'fontes') renderSources();
    paintPhotos(sec);
    window.scrollTo(0, 0);
    if (route.first) { route.first = false; } else { $('#main').focus({ preventScroll: true }); }
  }
  route.first = true;

  /* =============== Conexão / offline =============== */
  function netState() {
    const n = $('#netState'), on = navigator.onLine !== false;
    n.textContent = on ? '' : 'Sem conexão — modo offline';
    n.classList.toggle('off', !on);
  }
  window.addEventListener('online', () => { netState(); if (muni.source !== 'ibge') loadMunicipios(false); });
  window.addEventListener('offline', netState);

  /* =============== Início =============== */
  fillSelects();
  wireForms();
  renderGuideLists();
  netState();
  window.addEventListener('hashchange', route);
  route();
  refreshMuniUI();
  loadMunicipios(false);
  watchBroken();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  // utilitário para testes
  window.__cv = { S, muni, compute, loadMunicipios, parseIBGE, validateMuni };
})();
