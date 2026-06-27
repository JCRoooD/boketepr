
import('node:fs').then(async fs => {
  const env = fs.readFileSync('C:/Users/juanc/Projects/boketepr/.env.local', 'utf8');
  for (const l of env.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. List what's there + who reported
  const { data: reports } = await svc.from('reports').select('id, user_id, geohash, severity, status, created_at, photo_url').order('created_at', { ascending: false });
  console.log('=== BEFORE ===');
  console.log('reports:', reports?.length);
  for (const r of reports ?? []) {
    console.log('  id=' + r.id, 'user=' + (r.user_id?.slice(0,8) ?? '(null)'), 'geohash=' + r.geohash, 'sev=' + r.severity, 'status=' + r.status, 'created=' + r.created_at);
  }
  const userIds = [...new Set(reports?.map(r => r.user_id).filter(Boolean) ?? [])];
  if (userIds.length) {
    const { data: profiles } = await svc.from('profiles').select('id, display_name').in('id', userIds);
    for (const p of profiles ?? []) console.log('  reporter:', p.id.slice(0,8), 'name=' + (p.display_name ?? '(none)'));
  }

  // 2. Delete each report's storage file (photos/<user_id>/...)
  let filesDeleted = 0;
  for (const r of reports ?? []) {
    if (!r.user_id || !r.photo_url) continue;
    // path = photos/<user_id>/<filename>  (extract from photo_url)
    const m = r.photo_url.match(/\/storage\/v1\/object\/public\/photos\/([^/]+)\/(.+)$/);
    if (m) {
      const path = `${m[1]}/${m[2]}`;
      const { error } = await svc.storage.from('photos').remove([path]);
      if (!error) filesDeleted++;
      else console.log('  storage remove error:', error.message);
    }
  }
  console.log('files deleted from storage:', filesDeleted);

  // 3. Delete the report rows themselves
  const { error: delErr } = await svc.from('reports').delete().in('id', reports.map(r => r.id));
  if (delErr) console.log('delete error:', delErr.message);
  else console.log('reports rows deleted:', reports.length);

  // 4. Verify
  const { count } = await svc.from('reports').select('*', { count: 'exact', head: true });
  console.log('=== AFTER ===');
  console.log('reports in DB:', count);
});
