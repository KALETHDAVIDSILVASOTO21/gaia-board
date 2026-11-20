/**
 * app.js — lógica de interfaz.
 * Conecta el formulario, el listado y el diálogo de borrado con Storage.
 */
(() => {
  const $ = sel => document.querySelector(sel);

  const form = $('#story-form');
  const fields = {
    id: $('#story-id'), title: $('#title'), description: $('#description'),
    owner: $('#owner'), points: $('#points'), aiTool: $('#ai-tool'), status: $('#status'),
  };
  const dodChecks = [...document.querySelectorAll('[data-dod]')];
  const list = $('#story-list');
  const dialog = $('#confirm-dialog');
  let idToDelete = null;

  /* ---------- Utilidades ---------- */

  // Evita que el texto escrito por el usuario se interprete como HTML (XSS).
  const escapeHTML = txt => String(txt).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const usesAI = story => story.aiTool !== 'Ninguna';

  function readDod() {
    return Object.fromEntries(dodChecks.map(c => [c.dataset.dod, c.checked]));
  }

  function dodComplete(dod) {
    return Object.values(dod).every(Boolean);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- Validación (regla propia del proyecto) ---------- */

  function validate(data) {
    if (!data.title.trim()) return 'El título es obligatorio.';
    if (!data.description.trim()) return 'La descripción es obligatoria.';
    if (!data.owner.trim()) return 'Toda historia necesita un responsable humano.';
    // Regla GAIA: si se usó IA, no puede quedar "Hecho" sin la DoD completa.
    if (usesAI(data) && data.status === 'Hecho' && !dodComplete(data.dod)) {
      return 'Esta historia usó IA: completa la Definición de Hecho antes de marcarla como «Hecho».';
    }
    return '';
  }

  /* ---------- CREATE y UPDATE ---------- */

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      title: fields.title.value.trim(),
      description: fields.description.value.trim(),
      owner: fields.owner.value.trim(),
      points: Number(fields.points.value),
      aiTool: fields.aiTool.value,
      status: fields.status.value,
      dod: readDod(),
    };

    const error = validate(data);
    $('#form-error').textContent = error;
    if (error) return;

    if (fields.id.value) {
      Storage.update(fields.id.value, data);
      toast('Historia actualizada');
    } else {
      Storage.create(data);
      toast('Historia creada');
    }
    resetForm();
    render();
  });

  function startEdit(id) {
    const s = Storage.getAll().find(x => x.id === id);
    if (!s) return;
    fields.id.value = s.id;
    fields.title.value = s.title;
    fields.description.value = s.description;
    fields.owner.value = s.owner;
    fields.points.value = s.points;
    fields.aiTool.value = s.aiTool;
    fields.status.value = s.status;
    dodChecks.forEach(c => (c.checked = Boolean(s.dod?.[c.dataset.dod])));
    $('#form-title').textContent = 'Editar historia';
    $('#submit-btn').textContent = 'Guardar cambios';
    $('#cancel-btn').hidden = false;
    $('#form-error').textContent = '';
    toggleDod();
    fields.title.focus();
  }

  function resetForm() {
    form.reset();
    fields.id.value = '';
    $('#form-title').textContent = 'Nueva historia';
    $('#submit-btn').textContent = 'Guardar historia';
    $('#cancel-btn').hidden = true;
    $('#form-error').textContent = '';
    toggleDod();
  }

  $('#cancel-btn').addEventListener('click', resetForm);

  // La DoD solo se resalta cuando la historia usa IA.
  function toggleDod() {
    $('#dod-box').classList.toggle('active', fields.aiTool.value !== 'Ninguna');
  }
  fields.aiTool.addEventListener('change', toggleDod);

  /* ---------- DELETE ---------- */

  function askDelete(id) {
    const s = Storage.getAll().find(x => x.id === id);
    if (!s) return;
    idToDelete = id;
    $('#confirm-text').textContent = `Se eliminará «${s.title}». Esta acción no se puede deshacer.`;
    dialog.showModal();
  }

  $('#confirm-yes').addEventListener('click', () => {
    Storage.remove(idToDelete);
    if (fields.id.value === idToDelete) resetForm();
    idToDelete = null;
    dialog.close();
    toast('Historia eliminada');
    render();
  });
  $('#confirm-no').addEventListener('click', () => dialog.close());

  /* ---------- READ: listado, filtros y métricas ---------- */

  function filtered() {
    const q = $('#search').value.trim().toLowerCase();
    const st = $('#filter-status').value;
    const ai = $('#filter-ai').value;
    return Storage.getAll().filter(s =>
      (!q || s.title.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q)) &&
      (!st || s.status === st) &&
      (!ai || (ai === 'si' ? usesAI(s) : !usesAI(s)))
    );
  }

  function card(s) {
    const dodDone = s.dod ? Object.values(s.dod).filter(Boolean).length : 0;
    const aiBadge = usesAI(s)
      ? `<span class="badge ai">IA: ${escapeHTML(s.aiTool)}</span>
         <span class="badge ${dodDone === 5 ? 'ok' : 'warn'}">DoD ${dodDone}/5</span>`
      : '<span class="badge human">Sin IA</span>';
    const statusClass = { 'Por hacer': 'todo', 'En progreso': 'doing', 'Hecho': 'done' }[s.status];
    return `
      <li class="card">
        <div class="card-top">
          <span class="status ${statusClass}">${escapeHTML(s.status)}</span>
          <span class="points" title="Puntos de historia">${s.points} pts</span>
        </div>
        <h3>${escapeHTML(s.title)}</h3>
        <p>${escapeHTML(s.description)}</p>
        <div class="badges">${aiBadge}</div>
        <div class="card-foot">
          <span class="owner">Responsable: ${escapeHTML(s.owner)}</span>
          <div>
            <button class="btn small" data-edit="${s.id}">Editar</button>
            <button class="btn small danger" data-delete="${s.id}">Eliminar</button>
          </div>
        </div>
      </li>`;
  }

  function renderStats() {
    const all = Storage.getAll();
    const withAI = all.filter(usesAI);
    const pct = all.length ? Math.round((withAI.length / all.length) * 100) : 0;
    const done = all.filter(s => s.status === 'Hecho').length;
    $('#stats').innerHTML = `
      <div><strong>${all.length}</strong><span>historias</span></div>
      <div><strong>${pct}%</strong><span>con IA</span></div>
      <div><strong>${done}</strong><span>hechas</span></div>`;
  }

  function render() {
    const items = filtered();
    list.innerHTML = items.map(card).join('');
    $('#empty').hidden = items.length > 0;
    renderStats();
  }

  // Delegación de eventos: un solo listener para todos los botones de las tarjetas.
  list.addEventListener('click', e => {
    const editId = e.target.dataset.edit;
    const delId = e.target.dataset.delete;
    if (editId) startEdit(editId);
    if (delId) askDelete(delId);
  });

  ['#search', '#filter-status', '#filter-ai'].forEach(sel =>
    $(sel).addEventListener('input', render)
  );

  toggleDod();
  render();
})();
