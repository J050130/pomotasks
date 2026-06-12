const KEY = 'pomotasks_v2';
let data = JSON.parse(localStorage.getItem(KEY) || '{"tasks":[],"scheduled":[],"focusPath":null,"focusType":"task","collapsed":{}}');
let tasks = data.tasks, scheduled = data.scheduled || [], focusPath = data.focusPath, focusType = data.focusType || 'task', collapsed = data.collapsed || {};
let timer = null, running = false, paused = false;
let totalSec = 0, remaining = 0, phase = 'work', round = 0, phaseStart = 0;
let sessionLog = JSON.parse(localStorage.getItem('pomotasks_log') || '[]');
let trashBin = null; // { item, parentArr, parentPath, idx, timer }

function logAction(msg) {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const entry = { time, msg, ts: now.getTime() };
  sessionLog.unshift(entry);
  if (sessionLog.length > 200) sessionLog.length = 200;
  localStorage.setItem('pomotasks_log', JSON.stringify(sessionLog));
  refreshUI();
}

function saveData() { data.tasks = tasks; data.scheduled = scheduled; data.focusPath = focusPath; data.focusType = focusType; data.collapsed = collapsed; localStorage.setItem(KEY, JSON.stringify(data)); }
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function getByPath(path) {
  if (!path) return null;
  let node = null, arr = tasks;
  for (const i of path) { node = arr[i]; arr = node.children; }
  return node;
}

function calcPct(t) {
  if (t.done) return 100;
  if (!t.children || t.children.length === 0) return t.pct;
  let totalW = 0, weighted = 0;
  for (const c of t.children) { const w = c.weight || 0; totalW += w; weighted += calcPct(c) * w; }
  if (totalW > 0) return Math.round(weighted / totalW * 10) / 10;
  return Math.round(t.children.reduce((s, c) => s + calcPct(c), 0) / t.children.length * 10) / 10;
}

function setPct(t, v) {
  if (!t.children || t.children.length === 0) { t.pct = v; return; }
  for (const c of t.children) setPct(c, v);
}

function weightSum(t) { return t.children ? t.children.reduce((s, c) => s + (c.weight || 0), 0) : 0; }

function ddlLabel(ddl) {
  if (!ddl) return { text: '', cls: '' };
  const now = new Date(), d = new Date(ddl);
  const diffMs = d - now, diffMin = Math.floor(diffMs / 60000), diffHr = Math.floor(diffMs / 3600000), diffDay = Math.floor(diffMs / 86400000);
  if (diffMs < 0) return { text: '⚠ 已过期 '+Math.abs(diffHr)+'h', cls: 'ddl-overdue' };
  if (diffDay === 0) return { text: (diffMin < 60 ? diffMin+'分钟后' : diffHr+'小时后'), cls: diffMin < 60 ? 'ddl-overdue' : 'ddl-today' };
  const t = d.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
  if (diffDay === 1) return { text: '明天 '+t, cls: 'ddl-tomorrow' };
  if (diffDay <= 7) return { text: diffDay+'天后 '+t, cls: 'ddl-future' };
  return { text: (d.getMonth()+1)+'/'+d.getDate()+' '+t, cls: 'ddl-future' };
}

function effortLabel(min) {
  if (!min || min === 0) return '';
  if (min <= 30) return '🟢 ⭐';
  if (min <= 75) return '🟢 ⭐⭐';
  if (min <= 120) return '🟢 ⭐⭐⭐';
  if (min <= 240) return '🟡 ⭐';
  if (min <= 360) return '🟡 ⭐⭐';
  if (min <= 480) return '🟡 ⭐⭐⭐';
  if (min <= 660) return '🔴 ⭐';
  if (min <= 840) return '🔴 ⭐⭐';
  return '🔴 ⭐⭐⭐';
}

function barColor(pct) {
  if (pct >= 100) return '#22c55e';
  if (pct >= 60)  return '#f59e0b';
  if (pct >= 30)  return '#f97316';
  return '#7c6ff7';
}

// Actions
function addTask(parentPath) {
  const name = document.getElementById('input').value.trim();
  if (!name) return;
  if (name.length > 100) { toast('⚠ 任务名不能超过100个字'); return; }
  let ddl = document.getElementById('inputDdl').value;
  if (!ddl && Array.isArray(parentPath) && parentPath.length > 0) {
    const parent = getByPath(parentPath);
    if (parent && parent.ddl) ddl = parent.ddl;
  }
  const cat = document.getElementById('taskCat') ? document.getElementById('taskCat').value : 'daily';
  const est = document.getElementById('inputEst') ? parseInt(document.getElementById('inputEst').value) || 0 : 0;
  const t = { name, pct: 0, ddl, children: [], weight: 0, done: false, cat, note: '', estMin: est, actualMin: 0 };
  if (parentPath < 0 || parentPath === null) { tasks.unshift(t); }
  else { const p = getByPath(parentPath); p.children.push(t); collapsed[parentPath.join(',')] = false; autoBalanceWeights(p); }
  document.getElementById('input').value = '';
  document.getElementById('inputDdl').value = '';
  const estEl = document.getElementById('inputEst');
  if (estEl) estEl.value = '0';
  saveData(); refreshUI();
  logAction('➕ 添加任务 [' + name + ']');
  document.getElementById('input').focus();
}

function addSubtask(path) {
  collapsed[path.join(',')] = false;
  saveData(); refreshUI();
  // Show inline input
  setTimeout(() => {
    const div = document.getElementById('subtask_input_' + path.join('_'));
    if (div) {
      div.style.display = 'flex';
      const inp = div.querySelector('input');
      if (inp) { inp.value = ''; inp.focus(); }
    }
  }, 50);
}

function confirmSubtask(path) {
  const div = document.getElementById('subtask_input_' + path.join('_'));
  if (!div) return;
  const inp = div.querySelector('input');
  const name = (inp?.value || '').trim();
  if (!name) { div.style.display = 'none'; return; }
  addTask(path);
  // Clear the name field after addTask consumes it... wait, addTask reads from main input
  // Let's do it differently - add directly
  const ddl = getByPath(path)?.ddl || '';
  const parent = getByPath(path);
  const t = { name, pct: 0, ddl, children: [], weight: 0, done: false, cat: parent?.cat || 'daily', note: '', estMin: 0 };
  parent.children.push(t);
  autoBalanceWeights(parent);
  logAction('➕ 添加子任务 [' + name + ']');
  saveData(); refreshUI();
  div.style.display = 'none';
}

function updatePct(path, v) {
  const t = getByPath(path);
  const oldPct = calcPct(t);
  setPct(t, Math.min(100, Math.max(0, parseFloat(v) || 0)));
  const newPct = parseFloat(v) || 0;
  if (oldPct !== newPct) logAction('📊 ['+t.name+'] '+oldPct+'% → '+newPct+'%');
  saveData(); refreshUI();
}
function calcWeight(t, siblings) {
  if (!siblings || siblings.length === 0) return 0;
  const total = siblings.reduce((s, c) => s + (c.estMin || 0), 0);
  if (total === 0) {
    const each = Math.floor(100 / siblings.length);
    return each;
  }
  return Math.round((t.estMin || 0) / total * 100);
}

function autoBalanceWeights(parent) {
  const kids = parent.children;
  if (kids.length === 0) return;
  kids.forEach(c => { c.weight = calcWeight(c, kids); });
  // Ensure sum is 100 by adjusting the last one
  const sum = kids.reduce((s, c) => s + (c.weight || 0), 0);
  if (kids.length > 0 && sum !== 100) {
    kids[kids.length - 1].weight += (100 - sum);
  }
}

function updateActual(path, v) {
  const t = getByPath(path);
  if (!t) return;
  t.actualMin = Math.max(0, parseInt(v) || 0);
  saveData(); refreshUI();
}

function addActualMin(path, min) {
  if (!min || min <= 0) return;
  const t = getByPath(path);
  if (!t) return;
  t.actualMin = (t.actualMin || 0) + min;
  saveData();
}

function updateEstMin(path, v) {
  const t = getByPath(path);
  if (!t) return;
  const oldVal = t.estMin || 0;
  const newVal = Math.max(0, parseInt(v) || 0);
  t.estMin = newVal;
  // Rebalance parent weights
  if (path.length > 1) {
    const parent = getByPath(path.slice(0, -1));
    if (parent && parent.children) autoBalanceWeights(parent);
  }
  if (oldVal !== newVal) logAction('⏱ ['+t.name+'] 预估 '+oldVal+'分 → '+newVal+'分');
  saveData(); refreshUI();
}

function updateDdl(path, v) {
  const t = getByPath(path); t.ddl = v;
  if (v) logAction('📅 ['+t.name+'] 截止 '+v);
  saveData(); refreshUI();
}
function updateTaskNote(path, note) {
  const t = getByPath(path);
  t.note = note;
  logAction('📝 备注 ['+t.name+'] '+(note||'清空'));
  saveData(); refreshUI();
}

function cycleTaskCat(path) {
  const t = getByPath(path);
  const cats = ['important','daily','flexible'];
  const labels = {important:'重要',daily:'日常',flexible:'弹性'};
  const i = cats.indexOf(t.cat || 'daily');
  t.cat = cats[(i+1)%3];
  logAction('🏷 分类 ['+t.name+'] → '+labels[t.cat]);
  saveData(); refreshUI();
}

function updateName(path, v) {
  const t = getByPath(path);
  const newName = v.trim();
  if (!newName || newName.length > 100) return;
  if (newName === t.name) return;
  const oldName = t.name;
  t.name = newName;
  logAction('✏ 重命名 [' + oldName + '] → [' + newName + ']');
  saveData(); refreshUI();
}

function removeTask(path) {
  const t = getByPath(path);
  let parentArr, idx;
  if (path.length === 1) { parentArr = tasks; idx = path[0]; }
  else { parentArr = getByPath(path.slice(0, -1)).children; idx = path[path.length-1]; }

  // Store for undo
  if (trashBin && trashBin.timer) clearTimeout(trashBin.timer);
  trashBin = { item: t, parentArr, parentPath: path.slice(0, -1), idx, timer: null };

  // Remove
  parentArr.splice(idx, 1);
  if (path.length > 1) autoBalanceWeights(getByPath(path.slice(0, -1)));
  if (focusPath && focusPath.join(',')===path.join(',')) focusPath = null;
  saveData(); refreshUI();

  // Show undo toast
  const toastEl = document.getElementById('toast');
  toastEl.innerHTML = '🗑 已删除 [' + t.name + '] <button onclick="undoDelete()" style="background:#fff;color:#7c6ff7;border:none;padding:3px 10px;border-radius:6px;cursor:pointer;font-weight:700;margin-left:8px;">撤销</button>';
  toastEl.classList.add('show');
  trashBin.timer = setTimeout(() => {
    if (trashBin) { logAction('🗑 删除任务 [' + trashBin.item.name + ']'); trashBin = null; }
    toastEl.classList.remove('show');
    toastEl.textContent = '';
  }, 4000);
}

function undoDelete() {
  if (!trashBin) return;
  clearTimeout(trashBin.timer);
  trashBin.parentArr.splice(trashBin.idx, 0, trashBin.item);
  if (trashBin.parentPath && trashBin.parentPath.length > 0) autoBalanceWeights(getByPath(trashBin.parentPath));
  const name = trashBin.item.name;
  trashBin = null;
  const toastEl = document.getElementById('toast');
  toastEl.classList.remove('show'); toastEl.textContent = '';
  saveData(); refreshUI();
  logAction('↩ 撤销删除 [' + name + ']');
}

function markDone(path) {
  const t = getByPath(path);
  if (t.done) return;
  if (calcPct(t) < 100) { toast('⚠ 进度未达100%，不能标记完成'); return; }
  t.done = true;
  logAction('🎉 完成 [' + t.name + ']');
  toast('🎉 ' + t.name + ' 完成！');
  saveData(); refreshUI();
  // Auto-remove after 1.5s
  setTimeout(() => {
    let arr, idx;
    if (path.length === 1) { arr = tasks; idx = path[0]; }
    else { arr = getByPath(path.slice(0,-1)).children; idx = path[path.length-1]; }
    if (arr[idx] && arr[idx].done) { arr.splice(idx,1); if (path.length>1) autoBalanceWeights(getByPath(path.slice(0,-1))); saveData(); refreshUI(); }
  }, 1500);
}

function selectTask(path) {
  const t = getByPath(path);
  if (t.done) { toast('⚠ 已完成的任务不能选中'); return; }
  if (t.children && t.children.length > 0) { toast('⚠ 大任务不能直接选中，请选子任务'); return; }
  focusPath = path; focusType = 'task';
  saveData(); refreshUI();
}

// ── Scheduled tasks ──

function markSchedDone(idx) {
  scheduled[idx].done = true;
  sortScheduled();
  logAction('🎉 完成定时任务 [' + scheduled[idx].name + ']');
  saveData(); refreshUI();
}

function removeScheduled(idx) {
  logAction('🗑 删除定时任务 [' + scheduled[idx].name + ']');
  scheduled.splice(idx, 1);
  saveData(); refreshUI();
}

function selectScheduled(idx) {
  if (scheduled[idx].done) { toast('⚠ 已完成的任务不能选中'); return; }
  focusPath = [idx]; focusType = 'scheduled';
  saveData(); refreshUI();
}

function getSchedStatus(s) {
  if (s.done) return { text: '已完成', cls: 'sched-done' };
  if (!s.start) return { text: '待排期', cls: 'sched-upcoming' };
  const now = new Date();
  const start = new Date(s.start);
  const end = new Date(start.getTime() + s.dur * 60000);
  if (now < start) {
    const diffMin = Math.floor((start - now) / 60000);
    if (diffMin < 60) return { text: diffMin + '分钟后', cls: 'sched-upcoming' };
    const diffHr = Math.floor(diffMin / 60);
    return { text: diffHr + '小时后', cls: 'sched-upcoming' };
  }
  if (now < end) {
    const remain = Math.floor((end - now) / 60000);
    return { text: '进行中 · 剩' + remain + '分', cls: 'sched-live' };
  }
  return { text: '已过期', cls: 'sched-past' };
}

// Called by app.js to trigger re-render after data changes
let refreshUI = function() {};
