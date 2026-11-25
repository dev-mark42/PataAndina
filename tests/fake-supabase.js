/* Cliente Supabase FALSO en memoria, solo para probar la interfaz sin internet.
   Imita las reglas del esquema (solapamiento, domingos, horario, roles). */
(function () {
  const uuid = () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ Math.random() * 16 >> c / 4).toString(16));
  const db = window.__db = { profiles: window.__PROFILES || [], pets: [], appointment_requests: [], pet_medical_records: [], services_catalog: window.__SERVICES || [], codes: ['PATA-STAFF-2026'], users: window.__USERS || [] };
  let session = window.__SESSION || null; const listeners = [];
  const emit = (ev) => listeners.forEach(f => f(ev, session));
  const err = (message, code) => ({ message, code });
  const me = () => session && session.user.id;
  const myProfile = () => db.profiles.find(p => p.id === me());
  const isStaff = () => myProfile() && myProfile().role === 'staff';
  const dowLP = iso => new Date(new Date(iso).getTime() - 4 * 3600e3).getUTCDay();
  const mins = iso => { const d = new Date(new Date(iso).getTime() - 4 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  function embed(table, r) {
    r = { ...r };
    if (table === 'appointment_requests') { r.pet = db.pets.find(p => p.id === r.pet_id); r.service = db.services_catalog.find(s => s.id === r.service_id); r.owner = db.profiles.find(p => p.id === r.owner_id); }
    if (table === 'pets') r.owner = db.profiles.find(p => p.id === r.owner_id);
    return r;
  }
  function visible(table, r) {
    if (table === 'services_catalog') return true; if (!session) return false;
    if (isStaff()) return true;
    if (table === 'profiles') return r.id === me(); if (table === 'pets' || table === 'appointment_requests') return r.owner_id === me();
    if (table === 'pet_medical_records') return db.pets.some(p => p.id === r.pet_id && p.owner_id === me());
    return false;
  }
  function builder(table) {
    const b = { op: 'select', f: [], ord: null, single: false, payload: null };
    const run = async () => {
      let rows = db[table];
      if (b.op === 'insert') {
        const r = { id: uuid(), created_at: new Date().toISOString(), ...b.payload };
        if (table === 'pets' && r.owner_id !== me()) return { error: err('row-level security', '42501') };
        if (table === 'appointment_requests') {
          if (r.owner_id !== me()) return { error: err('row-level security', '42501') };
          const svc = db.services_catalog.find(s => s.id === r.service_id); const t = new Date(r.starts_at).getTime();
          r.ends_at = new Date(t + svc.duration_min * 60000).toISOString();
          if (t <= Date.now() + 30 * 60000) return { error: err('Elige un horario con al menos 30 minutos de anticipación', 'P0001') };
          if (dowLP(r.starts_at) === 0) return { error: err('La clínica no atiende los domingos', 'P0001') };
          const s = mins(r.starts_at), e = s + svc.duration_min; if (!((s >= 540 && e <= 780) || (s >= 840 && e <= 1080))) return { error: err('Horario fuera de atención', 'P0001') };
          if (db.appointment_requests.some(a => ['pendiente', 'confirmada'].includes(a.status) && t < Date.parse(a.ends_at) && Date.parse(r.ends_at) > Date.parse(a.starts_at))) return { error: err('conflicting key value violates exclusion constraint "no_overlap"', '23P01') };
          r.status = 'pendiente';
        }
        db[table].push(r); return { data: r, error: null };
      }
      rows = rows.filter(r => visible(table, r)); b.f.forEach(fn => rows = rows.filter(fn));
      if (b.op === 'update') { rows.forEach(r => Object.assign(r, b.payload)); return { data: rows, error: null }; }
      if (b.op === 'delete') { rows.forEach(r => { db[table].splice(db[table].indexOf(r), 1); if (table === 'pets') { db.appointment_requests = db.appointment_requests.filter(a => a.pet_id !== r.id); } }); return { data: null, error: null }; }
      if (b.ord) rows = [...rows].sort((x, y) => (x[b.ord.c] > y[b.ord.c] ? 1 : -1) * (b.ord.asc ? 1 : -1));
      rows = rows.map(r => embed(table, r));
      if (b.single) return rows[0] ? { data: rows[0], error: null } : { data: null, error: err('no rows', 'PGRST116') };
      return { data: rows, error: null };
    };
    const api = {
      select() { return api; }, insert(p) { b.op = 'insert'; b.payload = p; return api; }, update(p) { b.op = 'update'; b.payload = p; return api; }, delete() { b.op = 'delete'; return api; },
      eq(c, v) { b.f.push(r => r[c] === v); return api; }, in(c, v) { b.f.push(r => v.includes(r[c])); return api; },
      gte(c, v) { b.f.push(r => r[c] >= v); return api; }, lt(c, v) { b.f.push(r => r[c] < v); return api; },
      limit() { return api; }, order(c, o) { b.ord = { c, asc: !o || o.ascending !== false }; return api; }, single() { b.single = true; return api; },
      then(res, rej) { return run().then(res, rej); }
    };
    return api;
  }
  const rpc = {
    get_busy_slots: ({ p_day }) => ({ data: db.appointment_requests.filter(a => ['pendiente', 'confirmada'].includes(a.status)).filter(a => new Date(Date.parse(a.starts_at) - 4 * 3600e3).toISOString().slice(0, 10) === p_day).map(a => ({ starts_at: a.starts_at, ends_at: a.ends_at })), error: null }),
    cancel_my_appointment: ({ p_id }) => { const a = db.appointment_requests.find(x => x.id === p_id && x.owner_id === me()); if (!a) return { error: err('Cita no encontrada', 'P0001') }; a.status = 'cancelada'; return { error: null }; },
    staff_set_status: ({ p_id, p_status, p_note }) => { if (!isStaff()) return { error: err('Solo el personal', '42501') }; const a = db.appointment_requests.find(x => x.id === p_id); if (p_status === 'rechazada' && (!p_note || p_note.trim().length < 3)) return { error: err('Indica el motivo del rechazo', 'P0001') }; a.status = p_status; a.staff_note = p_note; return { error: null }; },
    staff_register_attention: p => { if (!isStaff()) return { error: err('Solo el personal', '42501') }; let pet = p.p_pet; if (p.p_appointment) { const a = db.appointment_requests.find(x => x.id === p.p_appointment); if (a.status !== 'confirmada') return { error: err('Solo se atiende una cita confirmada', 'P0001') }; a.status = 'completada'; pet = a.pet_id; } db.pet_medical_records.push({ id: uuid(), pet_id: pet, visit_date: new Date().toISOString().slice(0, 10), diagnosis: p.p_diagnosis, treatment: p.p_treatment, prescription: p.p_prescription, weight_kg: p.p_weight, next_visit: p.p_next }); return { error: null }; },
    activate_staff: ({ p_code }) => { const i = db.codes.indexOf(p_code.trim().toUpperCase()); if (i < 0) return { error: err('Código inválido o ya utilizado', 'P0001') }; db.codes.splice(i, 1); myProfile().role = 'staff'; return { data: true, error: null }; }
  };
  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe() { } } } }; },
          signInWithPassword: async ({ email, password }) => { const u = db.users.find(x => x.email === email && x.password === password); if (!u) return { error: err('Invalid login credentials') }; session = { user: { id: u.id, email } }; emit('SIGNED_IN'); return { data: { session }, error: null }; },
          signUp: async ({ email, password, options }) => { if (db.users.some(x => x.email === email)) return { data: { user: { identities: [] }, session: null }, error: null }; const id = uuid(); db.users.push({ id, email, password }); db.profiles.push({ id, full_name: options.data.full_name, phone: options.data.phone, address: null, role: 'tutor' }); window.__lastSignUp = options; return { data: { user: { id, identities: [{}] }, session: window.__AUTOCONFIRM ? (session = { user: { id, email } }) : null }, error: null }; },
          resetPasswordForEmail: async (email, o) => { window.__reset = { email, o }; return { error: null }; },
          updateUser: async ({ password }) => { if (password === 'Same1234') return { error: err('New password should be different from the old password.') }; window.__newPass = password; return { error: null }; },
          signOut: async () => { session = null; emit('SIGNED_OUT'); return { error: null }; }
        },
        from: builder, rpc: async (n, a) => rpc[n](a)
      };
    }
  };
  window.__fake = { setSession(s) { session = s; }, emit };
})();
