/**
 * storage.js — capa de datos.
 * Guarda y lee las historias en localStorage del navegador.
 * Toda la app pasa por estas funciones; así, si mañana cambio
 * localStorage por una API o Firebase, solo modifico este archivo.
 */
const Storage = (() => {
  const KEY = 'gaia-board.stories';

  /** Lee todas las historias (READ). Si el dato está dañado, devuelve []. */
  function getAll() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveAll(stories) {
    localStorage.setItem(KEY, JSON.stringify(stories));
  }

  /** Agrega una historia nueva con id y fecha (CREATE). */
  function create(story) {
    const stories = getAll();
    const nueva = {
      ...story,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    stories.unshift(nueva);
    saveAll(stories);
    return nueva;
  }

  /** Reemplaza los campos de una historia existente (UPDATE). */
  function update(id, changes) {
    const stories = getAll().map(s =>
      s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s
    );
    saveAll(stories);
  }

  /** Borra una historia por id (DELETE). */
  function remove(id) {
    saveAll(getAll().filter(s => s.id !== id));
  }

  return { getAll, create, update, remove };
})();
