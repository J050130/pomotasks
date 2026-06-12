// Set data change callback
refreshUI = function() { renderAll(); };


function toggleExpand(path) { collapsed[path.join(',')] = !collapsed[path.join(',')]; saveData(); renderAll(); }
function onPickTask() {
  const v = document.getElementById('taskSelect').value;
  if (!v) { focusPath = null; focusType = 'task'; }
  else if (v.startsWith('s:')) { focusPath = [parseInt(v.slice(2))]; focusType = 'scheduled'; }
  else { focusPath = v.split(',').map(Number); focusType = 'task'; }
  saveData(); renderAll();
}

// Render helpers
function flattenTasks(list, path, result) {
  for (let i = 0; i < list.length; i++) {
    const t = list[i], p = [...path, i];
    result.push({ task:t, path:p, depth:path.length });
    if (t.children?.length && !collapsed[p.join(',')]) flattenTasks(t.children, p, result);
  }
}
function buildSelectOptions(list, path, pre) {
  let o = '';
  for (let i = 0; i < list.length; i++) {
    const t = list[i], p = [...path, i], pk = p.join(','), isLeaf = !t.children?.length, sel = focusPath && focusPath.join(',')===pk ? 'selected' : '';
    if (isLeaf) o += `<option value="${pk}" ${sel}>${pre}${t.name} (${calcPct(t)}%)</option>`;
    if (t.children?.length) o += buildSelectOptions(t.children, p, pre+'  └ ');
  }
  return o;
}

function renderTasks() {
  const list = document.getElementById('list');
  const flat = []; flattenTasks(tasks, [], flat);
  if (flat.length === 0) { list.innerHTML = '<div class="empty">✨ 还没有任务，在上面添加一个吧</div>'; }
  else {
    list.innerHTML = flat.map(({task:t, path:p, depth}) => {
      const pk = p.join(','), pct = calcPct(t), isPar = t.children?.length > 0, isSel = focusPath && focusPath.join(',')===pk, dl = ddlLabel(t.ddl), ws = weightSum(t);
      const canSelect = depth === 0 && !isPar;
      return `<div class="task${t.done?' done':''}" style="padding-left:${depth*22}px"
        draggable="true" ondragstart="dragStart(event,${JSON.stringify(p)})" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropTask(event,${JSON.stringify(p)})">
        ${canSelect ? `<input type="checkbox" class="merge-cb" onchange="toggleMergeSelect(this,${JSON.stringify(p)})" style="display:none;width:14px;height:14px;cursor:pointer;accent-color:#7c6ff7;flex-shrink:0;">` : ''}
        <span class="drag-handle" style="cursor:grab;color:#d5cee0;display:inline-block;width:14px;flex-shrink:0;" title="拖动排序">*</span>
        ${isPar ? `<button class="expand-btn" onclick="toggleExpand(${JSON.stringify(p)})">${collapsed[pk] ? '▶' : '▼'}</button>` : '<span style="width:22px;flex-shrink:0"></span>'}
        ${isPar
          ? `<span style="width:16px;flex-shrink:0;text-align:center;color:#d5cee0;font-size:12px;" title="大任务不能选中">—</span>`
          : `<input type="radio" class="task-sel" name="focus" ${isSel?'checked':''} onclick="selectTask(${JSON.stringify(p)})" title="选中关联番茄钟">`}
        <input type="number" min="0" max="100" step="0.1" value="${(isPar ? pct : t.pct).toFixed(1)}" class="task-num-pct"
          onchange="updatePct(${JSON.stringify(p)}, this.value)" onfocus="this.select()"
          title="${isPar ? '自动=加权均值' : '完成百分比'}">
        <span style="font-size:11px;color:#a89cc4;">%</span>
        ${!isPar && depth>0 ? `<span style="font-size:11px;color:#a89cc4;min-width:36px;text-align:center;">${t.weight||0}%</span>` : ''}
        <div class="task-bar-col"><div class="task-bar-wrap"><div class="task-bar" style="width:${pct}%; background:${barColor(pct)}"></div></div></div>
        <div class="task-name ${isPar?'parent':'child'}" ondblclick="editName(this,${JSON.stringify(p)})" title="双击编辑名称">
          <span onclick="event.stopPropagation();cycleTaskCat(${JSON.stringify(p)})" title="切换分类" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${({important:'#ef4444',daily:'#7c6ff7',flexible:'#22c55e'})[t.cat||'daily']};margin-right:4px;vertical-align:middle;cursor:pointer;flex-shrink:0;"></span>
          ${isPar?'📁 ':''}${t.name}
          <span onclick="event.stopPropagation();editTaskNote(${JSON.stringify(p)})" title="编辑备注" style="cursor:pointer;font-size:13px;${t.note?'opacity:1':'opacity:0.35'};margin-left:4px;">📝</span>
          ${isPar && t.children?.length ? `<span class="wt-sum ${ws===100?'good':'warn'}">(${ws}%)</span>` : ''}
          ${t.note ? '<div style=\"font-size:11px;color:#a89cc4;margin-top:1px;\">'+t.note+'</div>' : ''}</div>
        ${(isPar
          ? '<span style=font-size:11px;color:#a89cc4;min-width:52px;text-align:center;>'+t.children.reduce((s,c)=>s+(c.estMin||0),0)+'</span><span style=font-size:12px;white-space:nowrap;>'+effortLabel(t.children.reduce((s,c)=>s+(c.estMin||0),0))+'</span>'
          : '<input type=number min=0 max=1080 value='+(t.estMin||0)+' class=task-num-pct onchange="updateEstMin('+JSON.stringify(p)+', this.value)" onfocus=this.select() title=预估分钟 style=width:52px;font-weight:400;font-size:11px;><span style=font-size:12px;white-space:nowrap;>'+effortLabel(t.estMin||0)+'</span> <input type=number min=0 value='+(t.actualMin||0)+' class=task-num-pct onchange="updateActual('+JSON.stringify(p)+', this.value)" onfocus=this.select() title=已花分钟 style=width:48px;font-weight:400;font-size:10px;color:#a89cc4;>')}
        <input type="datetime-local" value="${t.ddl||''}" class="task-num-pct"
          onchange="updateDdl(${JSON.stringify(p)}, this.value)" title="截止时间" style="width:180px; font-weight:400; font-size:11px;">
        ${dl.cls ? `<span class="task-ddl ${dl.cls}">${dl.text}</span>` : '<span class="ddl-none" title="点击日期可设置" style="color:#c8bdd8;font-size:11px;">待定</span>'}
        ${t.done ? '' :
          (isPar
            ? (pct >= 100
                ? `<button class="task-add-sub" onclick="markDone(${JSON.stringify(p)})" title="标记完成" style="color:#22c55e;">✅</button>`
                : `<button class="task-add-sub" title="进度不足100%，还不能完成" style="color:#d5cee0; cursor:not-allowed;">🔒</button>`)
            : (t.pct >= 100
                ? `<button class="task-add-sub" onclick="markDone(${JSON.stringify(p)})" title="标记完成" style="color:#22c55e;">✅</button>`
                : '')
          )}
        ${depth === 0 ? `<button class="task-add-sub" onclick="addSubtask(${JSON.stringify(p)})" title="添加子任务">⊕</button>` : ''}
        <button class="task-del" onclick="removeTask(${JSON.stringify(p)})" title="删除">✕</button>
      </div>
      <div id="subtask_input_${pk.replace(/,/g,'_')}" style="display:none;padding:4px 0 4px ${depth*22+24}px;gap:6px;">
        <input onkeydown="if(event.key==='Enter')confirmSubtask(${JSON.stringify(p)});if(event.key==='Escape')this.parentElement.style.display='none';" placeholder="子任务名，回车确认..." style="flex:1;padding:6px 10px;border:1.5px solid #7c6ff7;border-radius:8px;font-size:13px;outline:none;background:#fff;">
        <button onclick="confirmSubtask(${JSON.stringify(p)})" style="padding:6px 12px;border:none;border-radius:8px;background:#7c6ff7;color:#fff;font-size:12px;cursor:pointer;font-weight:600;">添加</button>
        <button onclick="document.getElementById('subtask_input_${pk.replace(/,/g,'_')}').style.display='none'" style="padding:6px 10px;border:none;border-radius:8px;background:#f3f0fa;color:#888;font-size:12px;cursor:pointer;">取消</button>
      </div>`;
    }).join('');
  }
  let selOpts = '<option value="">⋯ 选择要做的任务 ⋯</option>';
  selOpts += '<optgroup label="📋 普通任务">' + buildSelectOptions(tasks, [], '') + '</optgroup>';
  selOpts += '<optgroup label="⏰ 定时任务">' +
    scheduled.filter(s => !s.done).map((s, i) => {
      const st = getSchedStatus(s);
      const sel = focusType==='scheduled' && focusPath && focusPath[0]===i ? 'selected' : '';
      return `<option value="s:${i}" ${sel}>${s.name} (${st.text})</option>`;
    }).join('') + '</optgroup>';
  document.getElementById('taskSelect').innerHTML = selOpts;
}

// Timer
function pad(n) { return n<10?'0'+n:''+n; }
function fmt(s) { return pad(Math.floor(s/60))+':'+pad(s%60); }
function renderTimer() {
  document.getElementById('timeDisplay').textContent = fmt(remaining);
  const pct = totalSec>0 ? ((totalSec-remaining)/totalSec*100) : 0;
  const bar = document.getElementById('timerBar'); bar.style.width = pct+'%';
  bar.style.background = phase==='work'?'#7c6ff7':'#22c55e';
  document.getElementById('phaseLabel').textContent = phase==='work'?'🔴 专注工作':'🟢 休息一下';
  document.getElementById('btnPause').textContent = paused?'继续':'暂停';
  document.getElementById('timerInfo').textContent = `Work ${document.getElementById('workMin').value} 分钟 / Break ${document.getElementById('breakMin').value} 分钟 · 第 ${round} 轮`;
  document.getElementById('pausedTag').innerHTML = paused ? '<span class="paused-tag">⏸ 已暂停</span>' : '';
}
function tick() {
  if (paused) return;
  const elapsed = Math.floor((Date.now() - phaseStart) / 1000);
  remaining = Math.max(0, totalSec - elapsed);
  renderTimer();
  if (remaining <= 0) { clearInterval(timer); timer=null; running=false; onPhaseEnd(); }
}
function onPhaseEnd() {
  if (phase==='work') {
    const actual = Math.round((Date.now() - phaseStart) / 60000);
    logAction('✅ Work完成 第'+round+'轮 '+actual+'分钟');
    playChime(); toast('🍅 专注完成！休息一下吧~');
    if (focusPath && focusType === 'task') { addActualMin(focusPath, actual); const t = getByPath(focusPath); if (t) { const oldPct = calcPct(t); const pr = prompt(t.name+' — 现在完成到多少了？(0-100)', oldPct); if (pr!==null && pr!=='') { updatePct(focusPath, parseInt(pr)||0); logAction('📊 ['+t.name+'] '+oldPct+'% → '+(parseInt(pr)||0)+'%'); } } }
    if (focusPath && focusType === 'scheduled') { const s = scheduled[focusPath[0]]; if (s && !s.done) { const pr = prompt(s.name+' — 标记为完成？(y/n)', 'y'); if (pr && pr.toLowerCase()==='y') { markSchedDone(focusPath[0]); } } }
    phase='break'; totalSec = parseInt(document.getElementById('breakMin').value)*60; remaining = totalSec; phaseStart = Date.now(); renderTimer(); timer = setInterval(tick, 200);
    logAction('☕ Break开始 '+document.getElementById('breakMin').value+'min');
  } else { logAction('☕ Break结束'); playChime(); toast('☕ 休息结束！'); finishSession(); }
}
function startTimer() {
  if (running) return;
  if (!focusPath) { toast('⚠ 请先选中一个任务'); return; }

  // Check for suspended session
  const suspended = JSON.parse(localStorage.getItem('pomotasks_suspended') || 'null');
  if (suspended && suspended.taskName) {
    const resume = confirm('上次「'+suspended.taskName+'」还剩 '+Math.ceil(suspended.remaining/60)+' 分钟，要继续吗？\n\n确定=继续上次  |  取消=重新开始');
    if (resume) {
      focusPath = suspended.path; focusType = suspended.type;
      totalSec = suspended.total; remaining = suspended.remaining;
      localStorage.removeItem('pomotasks_suspended');
    } else {
      localStorage.removeItem('pomotasks_suspended');
    }
    if (!resume) { renderAll(); startTimer(); return; }
  }

  let tname;
  if (focusType === 'scheduled') { tname = scheduled[focusPath[0]].name; }
  else { tname = getByPath(focusPath).name; }

  if (!totalSec || totalSec <= 0) {
    totalSec = parseInt(document.getElementById('workMin').value)*60;
    remaining = totalSec;
    round++;
  }
  running=true; paused=false; phase='work';
  if (!phaseStart || phaseStart === 0) phaseStart = Date.now();
  renderTimer();
  document.getElementById('btnStart').disabled=true; document.getElementById('btnPause').disabled=false; timer = setInterval(tick, 200);
  logAction('🍅 开始 [' + tname + '] 第'+round+'轮 Work'+Math.round(totalSec/60)+'min');
}
function togglePause() {
  if (!running) return;
  paused=!paused;
  if (paused) {
    remaining = Math.max(0, totalSec - Math.floor((Date.now() - phaseStart) / 1000));
  } else {
    phaseStart = Date.now() - (totalSec - remaining) * 1000;
  }
  renderTimer(); logAction(paused ? '⏸ 暂停 @ '+fmt(remaining) : '▶ 继续 @ '+fmt(remaining));
}
function quitTimer() {
  if (!running) return;
  clearInterval(timer); timer=null; running=false; paused=false;
  remaining = Math.max(0, totalSec - Math.floor((Date.now() - phaseStart) / 1000));
  const elapsed = Math.round((Date.now() - phaseStart) / 60000);

  const choice = confirm('提前完成了？\n\n「确定」= 提前完成，进入休息\n「取消」= 中止，下次继续');
  if (choice) {
    // 提前完成
    logAction('✅ Work完成 第'+round+'轮 '+elapsed+'分钟 (提前结束)');
    if (focusPath && focusType === 'task') { addActualMin(focusPath, elapsed); const t = getByPath(focusPath); if (t) { const oldPct = calcPct(t); const pr = prompt(t.name+' — 现在完成到多少了？(0-100)', oldPct); if (pr!==null && pr!=='') { updatePct(focusPath, parseInt(pr)||0); logAction('📊 ['+t.name+'] '+oldPct+'% → '+(parseInt(pr)||0)+'%'); } } }
    finishSession();
  } else {
    // 中止，下次继续 - 保存进度
    const suspended = { path: focusPath, type: focusType, remaining, total: totalSec, elapsed };
    if (focusType === 'task' && focusPath) { const t = getByPath(focusPath); if (t) suspended.taskName = t.name; }
    else if (focusType === 'scheduled' && focusPath) suspended.taskName = scheduled[focusPath[0]].name;
    localStorage.setItem('pomotasks_suspended', JSON.stringify(suspended));
    logAction('⏹ 中止 第'+round+'轮 @ '+elapsed+'分钟 (下次继续)');
    toast('⏹ 已保存进度，下次可继续');
    finishSession();
  }
}
function finishSession() {
  clearInterval(timer); timer=null; running=false; paused=false;
  document.getElementById('btnStart').disabled=false; document.getElementById('btnPause').disabled=true;
  document.getElementById('phaseLabel').textContent='准备就绪'; document.getElementById('timeDisplay').textContent = fmt(parseInt(document.getElementById('workMin').value)*60);
  document.getElementById('timerBar').style.width='0%'; document.getElementById('pausedTag').innerHTML='';
  document.getElementById('timerInfo').textContent = `Work ${document.getElementById('workMin').value} 分钟 / Break ${document.getElementById('breakMin').value} 分钟 · 第 ${round} 轮`;
  logAction('🏁 会话结束 共'+round+'轮');
  renderLog();
}

async function downloadLog() {
  if (sessionLog.length === 0) { toast('暂无日志可导出'); return; }
  const now = new Date().toISOString().slice(0,10);
  let md = '# PomoTasks 操作日志\n\n> ' + now + '\n\n| 时间 | 操作 |\n|---|\n';
  sessionLog.forEach(e => { md += '| ' + e.time + ' | ' + e.msg + ' |\n'; });
  const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});

  // Try Save As dialog first (lets user pick Desktop)
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'PomoTasks-日志-' + now + '.md',
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    toast('⬇ 日志已保存');
  } catch {
    // Fallback: browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'PomoTasks-日志-' + now + '.md';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('⬇ 日志已下载（浏览器下载目录）');
  }
}

// ── Backup / Restore ──
let dataFileHandle = null;
const DB_NAME = 'pomotasks-fs';

// Try to get stored file handle from IndexedDB
async function initFileStorage() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore('handles'); };
    req.onsuccess = async (e) => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const getReq = store.get('dataFile');
      getReq.onsuccess = async () => {
        if (getReq.result) {
          try {
            // Verify permission
            const opts = { mode: 'readwrite' };
            const ok = await getReq.result.handle.queryPermission(opts);
            if (ok === 'granted') {
              dataFileHandle = getReq.result.handle;
              await loadFromFile();
              const btn = document.getElementById('btnSetupStorage');
              if (btn) { btn.textContent = '💾 已连接'; btn.style.background = '#22c55e'; btn.style.color = '#fff'; btn.style.border = 'none'; }
            }
          } catch(e) { /* handle expired */ }
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

async function loadFromFile() {
  if (!dataFileHandle) return;
  try {
    const file = await dataFileHandle.getFile();
    const text = await file.text();
    const backup = JSON.parse(text);
    if (backup.tasks) tasks = backup.tasks;
    if (backup.scheduled) scheduled = backup.scheduled;
    if (backup.log) sessionLog = backup.log;
    saveData();
    localStorage.setItem('pomotasks_log', JSON.stringify(sessionLog));
    renderAll();
  } catch(e) { /* corrupted file, skip */ }
}

async function saveToFile() {
  if (!dataFileHandle) return;
  try {
    const backup = { version:2, exported:new Date().toISOString(), tasks, scheduled, log:sessionLog };
    const json = JSON.stringify(backup, null, 2);
    const writable = await dataFileHandle.createWritable();
    await writable.write(json);
    await writable.close();
  } catch(e) { dataFileHandle = null; /* handle expired, will re-prompt */ }
}

async function pickDataFile() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'PomoTasks-data.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      startIn: 'desktop'
    });
    dataFileHandle = handle;
    // Store handle in IndexedDB
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put({ key: 'dataFile', handle });
    };
    await saveToFile();
    const btn = document.getElementById('btnSetupStorage');
    if (btn) { btn.textContent = '💾 已连接'; btn.style.background = '#22c55e'; btn.style.color = '#fff'; btn.style.border = 'none'; }
    toast('💾 数据自动保存到桌面！关浏览器也不丢');
  } catch(e) { /* user cancelled */ }
}

// Override saveData to auto-save to file
const _origSaveData = saveData;
saveData = function() {
  _origSaveData();
  saveToFile(); // fire-and-forget
};

async function exportAll() {
  const backup = { version:2, exported:new Date().toISOString(), tasks, scheduled, log:sessionLog };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const now = new Date().toISOString().slice(0,10);
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'PomoTasks-备份-' + now + '.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    toast('💾 备份已保存');
  } catch {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'PomoTasks-备份-'+now+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('💾 备份已下载');
  }
}

function importAll(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup.tasks) throw new Error('Invalid backup');
      tasks = backup.tasks;
      scheduled = backup.scheduled || [];
      if (backup.log) sessionLog = backup.log;
      saveData();
      localStorage.setItem('pomotasks_log', JSON.stringify(sessionLog));
      toast('📥 数据已恢复！刷新生效');
      setTimeout(() => renderAll(), 200);
    } catch(e) {
      toast('⚠ 无效的备份文件');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function editName(el, path) {
  const t = getByPath(path);
  const origHTML = el.innerHTML;
  const w = el.offsetWidth;
  el.innerHTML = `<input value="${t.name.replace(/"/g,'&quot;')}" style="width:${w}px; padding:2px 4px; border:1.5px solid #7c6ff7; border-radius:6px; font-size:inherit; font-weight:inherit; color:inherit; background:#fff; outline:none;" onblur="saveEditName(this,${JSON.stringify(path)},'${t.name.replace(/'/g,"\\'")}')" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.parentElement.innerHTML='${origHTML.replace(/'/g,"\\'").replace(/"/g,'&quot;')}';}">`;
  el.querySelector('input').focus();
  el.querySelector('input').select();
}

let taskNotePath = null;
// ── Merge tasks ──
let mergeMode = false;
let mergeSelected = [];
function toggleMergeMode() {
  mergeMode = !mergeMode;
  clearMergeSelect();
  const btn = document.getElementById('btnMergeMode');
  document.querySelectorAll('.merge-cb').forEach(cb => { cb.style.display = mergeMode ? 'inline' : 'none'; });
  if (btn) { btn.style.color = mergeMode ? '#7c6ff7' : '#888'; btn.style.borderColor = mergeMode ? '#7c6ff7' : '#e0d8f0'; }
}
function toggleMergeSelect(cb, path) {
  if (cb.checked) mergeSelected.push(path);
  else mergeSelected = mergeSelected.filter(p => p.join(',') !== path.join(','));
  document.getElementById('mergeBar').style.display = mergeSelected.length >= 2 ? 'block' : 'none';
}
function clearMergeSelect() {
  mergeSelected = [];
  document.querySelectorAll('.merge-cb').forEach(cb => cb.checked = false);
  document.getElementById('mergeBar').style.display = 'none';
}
function mergeTasks() {
  if (mergeSelected.length < 2) return;
  const name = prompt('父任务名称');
  if (!name || !name.trim()) return;
  const parent = { name: name.trim(), pct: 0, ddl: '', children: [], weight: 0, done: false, cat: 'daily', note: '', estMin: 0, actualMin: 0 };
  // Sort selected by their position in tasks array (descending to splice correctly)
  const indices = mergeSelected.map(p => p[0]).sort((a, b) => b - a);
  indices.forEach(i => { parent.children.unshift(tasks.splice(i, 1)[0]); });
  tasks.push(parent);
  autoBalanceWeights(parent);
  logAction('🔗 合并任务 → [' + parent.name + ']');
  clearMergeSelect();
  saveData(); refreshUI();
}

function editTaskNote(path) {
  taskNotePath = path;
  const t = getByPath(path);
  document.getElementById('taskNoteTitle').textContent = '📝 ' + t.name;
  document.getElementById('taskNoteText').value = t.note || '';
  document.getElementById('taskNoteModal').style.display = 'flex';
  document.getElementById('taskNoteText').focus();
}
function closeTaskNote() { document.getElementById('taskNoteModal').style.display = 'none'; taskNotePath = null; }
function saveTaskNote() {
  if (taskNotePath === null) return;
  updateTaskNote(taskNotePath, document.getElementById('taskNoteText').value.trim());
  closeTaskNote();
}

function saveEditName(input, path, oldName) {
  const newName = input.value.trim();
  if (newName && newName !== oldName) {
    updateName(path, newName);
  } else {
    refreshUI();
  }
}

function renderLog() {
  const el = document.getElementById('logList');
  if (!el) return;
  if (sessionLog.length === 0) { el.innerHTML = '<div style="color:#d5cee0; padding:8px;">暂无记录</div>'; return; }
  el.innerHTML = sessionLog.slice(0, 50).map(e =>
    '<div style="padding:3px 0; border-bottom:1px solid #faf8ff;">' +
    '<span style="color:#b8a8d8;">'+e.time+'</span> ' + e.msg + '</div>'
  ).join('');
}

// Init
function renderAll() { renderTasks(); if (!running) renderTimer(); renderLog(); }
document.getElementById('input').addEventListener('keydown', e => { if (e.key==='Enter') addTask(-1); });
['workMin','breakMin'].forEach(id => { document.getElementById(id).addEventListener('change', () => { if (!running) { document.getElementById('timeDisplay').textContent = fmt(parseInt(document.getElementById('workMin').value)*60); document.getElementById('timerInfo').textContent = `Work ${document.getElementById('workMin').value} 分钟 / Break ${document.getElementById('breakMin').value} 分钟 · 第 ${round} 轮`; } }); });


// ── Sound ──
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.3, ctx.currentTime + i*0.15);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i*0.15 + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i*0.15); o.stop(ctx.currentTime + i*0.15 + 0.5);
    });
  } catch(e) {}
}

// ── Drag & Drop ──
let dragSrcPath = null;
function dragStart(e, path) { dragSrcPath = path; e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.5'; }
function dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.style.background = 'rgba(124,111,247,0.08)'; }
function dragLeave(e) { e.currentTarget.style.background = ''; }
function dropTask(e, targetPath) {
  e.preventDefault(); e.currentTarget.style.background = '';
  if (!dragSrcPath || JSON.stringify(dragSrcPath)===JSON.stringify(targetPath)) return;
  const src = getByPath(dragSrcPath); if (!src) return;
  // Only reorder within same parent
  const srcParent = dragSrcPath.slice(0,-1), tgtParent = targetPath.slice(0,-1);
  const srcIdx = dragSrcPath[dragSrcPath.length-1], tgtIdx = targetPath[targetPath.length-1];
  let srcArr, tgtArr;
  if (srcParent.length===0) srcArr = tasks; else srcArr = getByPath(srcParent).children;
  if (tgtParent.length===0) tgtArr = tasks; else tgtArr = getByPath(tgtParent).children;
  if (JSON.stringify(srcParent)!==JSON.stringify(tgtParent)) return;
  // Move within array
  const [item] = srcArr.splice(srcIdx, 1);
  const newIdx = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
  srcArr.splice(newIdx, 0, item);
  logAction('↕ 移动任务 ['+src.name+']');
  saveData(); renderAll();
}

// ── Scheduled task reminders ──
let schedNotified = {};
if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
setInterval(() => {
  const now = new Date();
  scheduled.forEach((s, i) => {
    if (s.done || !s.start) return;
    const start = new Date(s.start);
    const diffMin = Math.floor((start - now) / 60000);
    const key = i + ':' + s.start;
    if (diffMin <= 1 && diffMin >= -1 && !schedNotified[key]) {
      schedNotified[key] = true;
      const active = diffMin <= 0;
      toast('⏰ ' + s.name + (active ? ' 开始了！' : ' 1分钟后开始'));
      if (Notification.permission === 'granted') {
        new Notification('⏰ 定时任务', { body: s.name + (active ? ' 现在开始' : ' 即将开始') + ' (' + s.dur + '分钟)', icon: '🍅' });
      }
    }
  });
}, 30000);

// ── Week calendar ──
let weekOffset = 0;
const BLOCK_COLORS = [
  '#7c6ff7','#f59e0b','#22c55e','#ef4444','#3b82f6','#ec4899','#14b8a6',
  '#f97316','#8b5cf6','#06b6d4','#e11d48','#6366f1','#0ea5e9'
];
let blockColorIdx = {};

function getBlockColor(key) {
  if (!blockColorIdx[key]) {
    blockColorIdx[key] = BLOCK_COLORS[Object.keys(blockColorIdx).length % BLOCK_COLORS.length];
  }
  return blockColorIdx[key];
}

function changeWeek(n) { weekOffset += n; renderAll(); }

function weekStart() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
  monday.setHours(0,0,0,0);
  return monday;
}

function renderWeek() {
  const ws = weekStart();
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(ws); weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = d => (d.getMonth()+1)+'/'+d.getDate();
  document.getElementById('weekLabel').textContent = fmt(ws) + ' - ' + fmt(weekEnd);

  const dayNames = ['周一','周二','周三','周四','周五','周六','周日'];
  const START_HOUR = 6, END_HOUR = 23;
  const PX_PER_HOUR = 44;
  const colHeight = (END_HOUR - START_HOUR) * PX_PER_HOUR;

  let html = '';
  // Header row
  html += '<div style="display:flex;">';
  html += '<div style="width:44px;flex-shrink:0;"></div>';
  for (let d = 0; d < 7; d++) {
    const date = new Date(ws); date.setDate(ws.getDate() + d);
    const isToday = date.getTime() === today.getTime();
    html += `<div class="week-hdr${isToday?' today':''}" style="flex:1;">${dayNames[d]}<br>${date.getDate()}日</div>`;
  }
  html += '</div>';

  // Time labels + columns
  html += '<div style="display:flex; position:relative;">';
  // Time labels
  html += '<div style="width:44px;flex-shrink:0;">';
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    html += `<div class="time-label" style="height:${PX_PER_HOUR}px; line-height:1;">${h}:00</div>`;
  }
  html += '</div>';

  // Day columns
  for (let d = 0; d < 7; d++) {
    const date = new Date(ws); date.setDate(ws.getDate() + d);
    const isToday = date.getTime() === today.getTime();
    const dateStr = date.toISOString().slice(0,10);
    const dayTasks = scheduled.filter(s => s.start && s.start.slice(0,10) === dateStr);

    html += `<div class="week-col${isToday?' today':''}" style="flex:1; height:${colHeight}px; position:relative;">`;
    // Hour grid lines
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      html += `<div style="height:${PX_PER_HOUR}px; border-top:1px solid #f8f6ff;"></div>`;
    }
    // Task blocks
    dayTasks.forEach(s => {
      const start = new Date(s.start);
      const end = new Date(start.getTime() + s.dur * 60000);
      const startMin = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
      const durMin = s.dur;
      const top = startMin / 60 * PX_PER_HOUR;
      const h = durMin / 60 * PX_PER_HOUR;
      const color = getBlockColor(s.name);
      const timeStr = start.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) + ' - ' + end.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
      html += `<div class="week-block${s.done?' done':''}"
        style="top:${top}px; height:${Math.max(22,h)}px; background:${color}15; border-left-color:${color};"
        title="${s.name}\n${timeStr} (${s.dur}分钟)">
        <div class="wb-name">${s.name}</div>
        <div class="wb-time">${timeStr}</div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  document.getElementById('weekGrid').innerHTML = html;
}

// ── Keyboard shortcut: Space to pause/resume ──
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); if (running) togglePause(); }
});

// Init with file storage
async function boot() {
  await initFileStorage();
  renderAll();
  // If no file handle yet, load from localStorage (already done at top)
}
boot();
