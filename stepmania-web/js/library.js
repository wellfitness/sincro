// ============================================================================
//  LIBRARY UI — list/delete songs from IndexedDB, import .ssc/.sm + audio
//  pairs (best-effort name pairing). Uses parseSscOrSm from parser.js.
// ============================================================================

async function refreshLibrary() {
  const c = document.getElementById('libraryContainer');
  c.innerHTML = 'Cargando...';
  const songs = await dbAll();
  if (!songs.length) {
    c.innerHTML = '<p style="color:#aaa;text-align:center;padding:30px">Tu librería está vacía. <a href="#" onclick="goto(\'create\')" style="color:#ff006e">Crea tu primer chart</a> o <button class="icon-btn" onclick="document.getElementById(\'importInput\').click()">importa archivos</button>.</p>';
    return;
  }
  let html = `<div class="queue"><div class="queue-row header"><div>Canción</div><div>BPM</div><div>Duración</div><div>Charts</div><div>Acciones</div></div>`;
  for (const s of songs) {
    html += `<div class="queue-row">
      <div class="name"><div style="font-weight:600">${escapeHtml(s.title)}</div><div style="color:#888;font-size:0.78em">${escapeHtml(s.artist)}</div></div>
      <div>${s.bpm.toFixed(1)}</div>
      <div>${formatTime(s.duration)}</div>
      <div>${s.charts.length}</div>
      <div style="display:flex;gap:4px">
        <button class="icon-btn" onclick="playSong(${s.id})">▶</button>
        <button class="icon-btn danger" onclick="deleteSong(${s.id})">×</button>
      </div>
    </div>`;
  }
  html += '</div>';
  c.innerHTML = html;
}

async function deleteSong(id) {
  if (!confirm('¿Eliminar canción de la librería?')) return;
  await dbDelete(id);
  refreshLibrary();
}

document.getElementById('importInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  const audioFiles = files.filter(f => f.type.startsWith('audio/'));
  const sscFiles = files.filter(f => f.name.endsWith('.ssc') || f.name.endsWith('.sm'));
  if (sscFiles.length === 0 || audioFiles.length === 0) {
    alert('Selecciona al menos un .ssc/.sm y un audio juntos.');
    return;
  }
  // Pair them by name (best effort)
  for (const sFile of sscFiles) {
    const sscText = await sFile.text();
    const parsed = parseSscOrSm(sscText);
    const baseName = sFile.name.replace(/\.[^.]+$/, '');
    let audio = audioFiles.find(a => a.name.replace(/\.[^.]+$/, '') === baseName)
             || audioFiles.find(a => a.name === parsed.header.MUSIC)
             || audioFiles[0];
    const bpm = parseFloat((parsed.header.BPMS || '0=120').split('=')[1]) || 120;
    const offsetSec = -parseFloat(parsed.header.OFFSET || '0');
    const sampleStart = parseFloat(parsed.header.SAMPLESTART || '30');
    // Determine duration from audio
    const ctx2 = ensureAudioCtx();
    const arrayBuf = await audio.arrayBuffer();
    const decoded = await ctx2.decodeAudioData(arrayBuf.slice(0));
    await dbAdd({
      title: parsed.header.TITLE || baseName,
      artist: parsed.header.ARTIST || 'Unknown',
      audioBlob: audio,
      audioName: audio.name,
      sscText,
      bpm, offsetSec,
      duration: decoded.duration,
      sampleStart,
      charts: parsed.charts.map(c => ({
        name: c.DIFFICULTY || 'Edit',
        key: (c.DIFFICULTY || 'edit').toLowerCase(),
        rating: parseInt(c.METER || '1') || 1,
        count: (c.NOTES || '').split('\n').filter(r => r.length === 4 && r !== '0000').length
      })),
      addedAt: Date.now()
    });
  }
  alert(sscFiles.length + ' canción(es) importada(s).');
  refreshLibrary();
  e.target.value = '';
});
