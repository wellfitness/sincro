// ============================================================================
//  BACKUP / RESTORE — export full library (songs + scores + settings) as a
//  single ZIP, and import it back. Ships its own minimal ZIP encoder/decoder
//  in "store" mode (sin compresión), igual que los autosteppers standalone
//  (autostepper.html, gh-autostepper.html). Mantener los tres encoders ZIP
//  alineados si se tocan headers o end-of-central-directory.
// ============================================================================

async function exportBackupZip() {
  const status = document.getElementById('backupStatus');
  status.textContent = 'Empaquetando librería...';
  const songs = await dbAll();
  const enc = new TextEncoder();
  const files = [];
  // Per-song dump: audio + ssc + runs (puntuaciones arcade).
  // version=2 introduce el array `runs` (reemplaza al antiguo `scores` que
  // tenía 1 entry por chart sin nombre de jugador). Backups v1 siguen
  // importables — el reader ignora `scores` y deja la canción sin ranking.
  const meta = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    songs: []
  };
  for (const s of songs) {
    const folder = safeFn(s.title) + '_' + s.id;
    const audioName = folder + '/' + safeFn(s.title) + getExt(s.audioName || s.title + '.mp3');
    const sscName = folder + '/chart.ssc';
    const audioBytes = new Uint8Array(await s.audioBlob.arrayBuffer());
    files.push({ name: audioName, data: audioBytes });
    files.push({ name: sscName,  data: enc.encode(s.sscText) });
    // Solo runs SM — la DB es compartida con GH; si exportamos sin filtrar
    // metemos runs de guitarra en el backup de stepmania.
    const runs = filterRunsByGame(await dbRunsForSong(s.id), 'sm');
    // Strip campos regenerables al importar (id viene del autoincrement nuevo,
    // chartId y playerLower se recalculan en función del nuevo songId).
    meta.songs.push({
      id: s.id, title: s.title, artist: s.artist,
      audioPath: audioName, sscPath: sscName, audioName: s.audioName,
      bpm: s.bpm, offsetSec: s.offsetSec, duration: s.duration,
      sampleStart: s.sampleStart, charts: s.charts, addedAt: s.addedAt,
      runs: runs.map(({ id, songId, chartId, playerLower, ...rest }) => rest)
    });
  }
  files.push({ name: 'metadata.json', data: enc.encode(JSON.stringify(meta, null, 2)) });
  const zipBytes = makeZip(files);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stepmania-web-backup-${new Date().toISOString().slice(0,10)}.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status.innerHTML = `<span style="color:var(--color-success)">✓ Backup descargado (${(blob.size/1024/1024).toFixed(1)} MB · ${songs.length} canciones)</span>`;
}

// ----- Minimal ZIP reader (store mode only) ---------------------------------
// Reads the End of Central Directory at the end of the buffer, then walks the
// central directory to find each file's local header offset. Only supports
// uncompressed entries (compression method 0) — sufficient for backups
// created by our own makeZip.
function readZip(uint8) {
  const dv = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  // Find EOCD: scan backwards from end (max 64KB comment per spec)
  let eocdOffset = -1;
  for (let i = uint8.length - 22; i >= Math.max(0, uint8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('ZIP inválido: EOCD no encontrado');
  const numEntries = dv.getUint16(eocdOffset + 10, true);
  const cdSize     = dv.getUint32(eocdOffset + 12, true);
  const cdOffset   = dv.getUint32(eocdOffset + 16, true);
  const dec = new TextDecoder();
  const out = [];
  let p = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrupto: entrada CD inválida');
    const method  = dv.getUint16(p + 10, true);
    const sizeC   = dv.getUint32(p + 20, true);
    const sizeU   = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extLen  = dv.getUint16(p + 30, true);
    const cmtLen  = dv.getUint16(p + 32, true);
    const lhOff   = dv.getUint32(p + 42, true);
    const name    = dec.decode(uint8.subarray(p + 46, p + 46 + nameLen));
    if (method !== 0) throw new Error(`ZIP: ${name} usa compresión no soportada (método ${method})`);
    // Local header has its own variable-length name+extra fields
    const lhNameLen = dv.getUint16(lhOff + 26, true);
    const lhExtLen  = dv.getUint16(lhOff + 28, true);
    const dataStart = lhOff + 30 + lhNameLen + lhExtLen;
    out.push({ name, data: uint8.subarray(dataStart, dataStart + sizeU) });
    p += 46 + nameLen + extLen + cmtLen;
  }
  return out;
}

async function importBackupZip(file) {
  const status = document.getElementById('backupStatus');
  status.textContent = 'Leyendo ZIP...';
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries;
  try { entries = readZip(buf); }
  catch (e) { status.innerHTML = `<span style="color:var(--rosa-500)">✗ ${e.message}</span>`; return; }
  const dec = new TextDecoder();
  const metaEntry = entries.find(e => e.name === 'metadata.json');
  if (!metaEntry) { status.innerHTML = '<span style="color:var(--rosa-500)">✗ ZIP sin metadata.json</span>'; return; }
  let meta;
  try { meta = JSON.parse(dec.decode(metaEntry.data)); }
  catch (e) { status.innerHTML = '<span style="color:var(--rosa-500)">✗ metadata.json malformado</span>'; return; }
  // Restore settings (overwrite — backup is source of truth)
  if (meta.settings) {
    Object.assign(settings, meta.settings);
    saveSettings();
  }
  let imported = 0;
  for (const songMeta of meta.songs || []) {
    const audioEntry = entries.find(e => e.name === songMeta.audioPath);
    const sscEntry   = entries.find(e => e.name === songMeta.sscPath);
    if (!audioEntry || !sscEntry) continue;
    const audioBlob = new Blob([audioEntry.data]);
    const sscText = dec.decode(sscEntry.data);
    // Insert as new row (autoIncrement); ignore the original id to avoid
    // collisions. New id is what dbAdd returns.
    const newId = await dbAdd({
      title: songMeta.title, artist: songMeta.artist,
      audioBlob, audioName: songMeta.audioName,
      sscText,
      bpm: songMeta.bpm, offsetSec: songMeta.offsetSec,
      duration: songMeta.duration, sampleStart: songMeta.sampleStart,
      charts: songMeta.charts, addedAt: songMeta.addedAt || Date.now()
    });
    // Restaurar puntuaciones — formato v2 usa `runs[]`. Backups v1 traen
    // `scores[]` (sin nombre de jugador): los ignoramos por decisión del
    // producto (wipe limpio en la migración a v4). Si en el futuro se quiere
    // revivirlos, aquí va el loop convirtiendo cada score a un run con
    // playerName='Anónimo'.
    if (Array.isArray(songMeta.runs)) {
      for (const run of songMeta.runs) {
        const playerName = run.playerName || 'Anónimo';
        await dbRunAdd({
          ...run,
          gameType: 'sm',  // backup SM solo importa runs SM
          songId: newId,
          chartId: chartIdOf(newId, run.chartKey),
          playerName,
          playerLower: playerName.toLowerCase()
        });
      }
    } else if (Array.isArray(songMeta.scores) && songMeta.scores.length) {
      console.info(`backup v1: descartando ${songMeta.scores.length} scores antiguos de "${songMeta.title}" (sin nombre de jugador, ya no compatibles)`);
    }
    imported++;
    status.textContent = `Restaurando ${imported}/${(meta.songs||[]).length}...`;
  }
  status.innerHTML = `<span style="color:var(--color-success)">✓ ${imported} canciones restauradas</span>`;
  // Refresh UI if we're on library
  if (typeof refreshLibrary === 'function' && currentScreen === 'library') refreshLibrary();
}

// Bind hidden file input for import
document.getElementById('backupRestoreInput')?.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importBackupZip(f);
  e.target.value = '';
});
