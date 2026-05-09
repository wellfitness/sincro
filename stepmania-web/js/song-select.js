// ============================================================================
//  SONG SELECT — list/filter/sort songs, render diff screen with mods,
//  apply lane permutation modifiers (mirror/left/right/shuffle).
// ============================================================================

let selectedSong = null;
let selectedChart = null;
const activeMods = { mirror:false, left:false, right:false, shuffle:false, hidden:false, sudden:false, chartSpeed: 1.0 };
let _allSongsCache = [];

async function refreshSongs() {
  const songs = await dbAll();
  _allSongsCache = songs;
  document.getElementById('songsSubtitle').textContent = `${songs.length} canciones en tu librería`;
  // Attach best score to each song
  for (const s of songs) {
    const scores = await dbScoresForSong(s.id);
    s._bestGrade = scores.length ? scores.sort((a,b) => (b.score||0) - (a.score||0))[0] : null;
  }
  renderSongList();
}

function renderSongList() {
  const c = document.getElementById('songsContainer');
  if (!_allSongsCache.length) {
    c.innerHTML = '<p style="color:#aaa;text-align:center;padding:30px">No hay canciones. <button class="action-btn" onclick="goto(\'create\')">Crear charts</button></p>';
    return;
  }
  const q = (document.getElementById('songSearch')?.value || '').toLowerCase().trim();
  const sort = document.getElementById('songSort')?.value || 'addedAt-desc';
  let songs = _allSongsCache.filter(s => !q || s.title.toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q));
  const [field, dir] = sort.split('-');
  const mul = dir === 'desc' ? -1 : 1;
  songs.sort((a,b) => {
    let av = a[field], bv = b[field];
    if (typeof av === 'string') return av.localeCompare(bv) * mul;
    return ((av||0) - (bv||0)) * mul;
  });
  let html = `<div class="queue"><div class="queue-row header" style="grid-template-columns:1fr 90px 80px 80px 60px"><div>Canción</div><div>BPM</div><div>Duración</div><div>Best</div><div></div></div>`;
  for (const s of songs) {
    const grade = s._bestGrade ? `<span class="grade-pill grade-${s._bestGrade.grade}">${s._bestGrade.grade}</span>` : '<span style="color:#444">—</span>';
    html += `<div class="queue-row" style="cursor:pointer;grid-template-columns:1fr 90px 80px 80px 60px" onclick="selectSong(${s.id})">
      <div><div style="font-weight:700">${escapeHtml(s.title)}</div>
        <div style="color:#aaa;font-size:0.82em">${escapeHtml(s.artist||'—')} · ${s.charts.length} dif.</div></div>
      <div>${s.bpm.toFixed(0)}</div>
      <div>${formatTime(s.duration)}</div>
      <div>${grade}</div>
      <div><button class="icon-btn">▶</button></div>
    </div>`;
  }
  html += '</div>';
  c.innerHTML = html;
}

async function selectSong(id) {
  selectedSong = await dbGet(id);
  if (!selectedSong) return;
  goto('diff');
}
async function playSong(id) {
  selectedSong = await dbGet(id);
  if (!selectedSong) return;
  goto('diff');
}

async function renderDiffScreen() {
  if (!selectedSong) { goto('songs'); return; }
  document.getElementById('diffTitle').textContent = selectedSong.title;
  document.getElementById('diffSubtitle').textContent = (selectedSong.artist||'—') + ' · BPM ' + selectedSong.bpm.toFixed(0);
  const c = document.getElementById('diffsContainer');
  c.innerHTML = '';
  const scores = await dbScoresForSong(selectedSong.id);
  const scoreMap = Object.fromEntries(scores.map(s => [s.chartKey, s]));
  for (const chart of selectedSong.charts) {
    const el = document.createElement('div');
    el.className = 'queue-row';
    el.style.cursor = 'pointer';
    el.style.gridTemplateColumns = '1fr 60px 80px 70px';
    const sc = scoreMap[chart.key];
    const gradeCell = sc ? `<span class="grade-pill grade-${sc.grade}">${sc.grade}</span>` : '<span style="color:#444">—</span>';
    el.innerHTML = `<div><strong>${chart.name}</strong></div>
      <div style="color:#ffbe0b">★ ${chart.rating}</div>
      <div>${chart.count} pasos</div>
      <div>${gradeCell}</div>`;
    el.addEventListener('click', () => { selectedChart = chart; goto('play'); });
    c.appendChild(el);
  }
  // Init mods UI
  document.querySelectorAll('#modsContainer .mod-toggle').forEach(t => {
    const m = t.dataset.mod;
    t.classList.toggle('on', !!activeMods[m]);
    t.onclick = () => {
      activeMods[m] = !activeMods[m];
      // mirror/left/right/shuffle are mutually exclusive (one rotation/permutation at a time)
      if (['mirror','left','right','shuffle'].includes(m) && activeMods[m]) {
        for (const x of ['mirror','left','right','shuffle']) if (x !== m) activeMods[x] = false;
        document.querySelectorAll('#modsContainer .mod-toggle').forEach(other => {
          if (['mirror','left','right','shuffle'].includes(other.dataset.mod)) other.classList.toggle('on', !!activeMods[other.dataset.mod]);
        });
      }
      // hidden vs sudden mutually exclusive
      if ((m === 'hidden' && activeMods.hidden) || (m === 'sudden' && activeMods.sudden)) {
        if (m === 'hidden') { activeMods.sudden = false; document.querySelector('[data-mod="sudden"]').classList.remove('on'); }
        if (m === 'sudden') { activeMods.hidden = false; document.querySelector('[data-mod="hidden"]').classList.remove('on'); }
      }
      t.classList.toggle('on', activeMods[m]);
    };
  });
  const cs = document.getElementById('chartSpeed');
  cs.value = activeMods.chartSpeed;
  document.getElementById('chartSpeedVal').textContent = activeMods.chartSpeed.toFixed(1) + 'x';
  cs.oninput = e => {
    activeMods.chartSpeed = parseFloat(e.target.value);
    document.getElementById('chartSpeedVal').textContent = activeMods.chartSpeed.toFixed(1) + 'x';
  };
}

// Bind search/sort listeners once.
(function bindSongFilters() {
  const s = document.getElementById('songSearch');
  if (!s) return;
  s.addEventListener('input', renderSongList);
  document.getElementById('songSort').addEventListener('change', renderSongList);
})();

let _shufflePerm = [0,1,2,3];
function applyModsToLane(lane) {
  if (activeMods.mirror)  return [3,2,1,0][lane];
  if (activeMods.left)    return [1,3,0,2][lane];   // 90° CCW: lane permutation only
  if (activeMods.right)   return [2,0,3,1][lane];   // 90° CW
  if (activeMods.shuffle) return _shufflePerm[lane];
  return lane;
}
function rerollShuffle() {
  const a = [0,1,2,3];
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  _shufflePerm = a;
}
