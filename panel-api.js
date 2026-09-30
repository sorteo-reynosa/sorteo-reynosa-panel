// Las claves de Supabase se utilizan exclusivamente en el servidor.
export function installPanel(app) {
 const url=()=>process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
 async function sb(route, options={}) {
  if(!url()||!key()) throw new Error('Falta conectar Supabase en Vercel');
  const r=await fetch(url()+route,{...options,headers:{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  const data=await r.json(); if(!r.ok) throw new Error(data.message||'Error de Supabase'); return data;
 }
 const rpc=(fn,data)=>sb('/rest/v1/rpc/'+fn,{method:'POST',body:JSON.stringify(data)});
 const wrap=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){res.status(400).json({error:e.message});}};
 app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&req.headers.origin&&process.env.BASE_URL&&req.headers.origin!==new URL(process.env.BASE_URL).origin)return res.status(403).json({error:'Origen inválido'});next();});
 app.post('/api/admin/login',wrap(async(req,res)=>{
  const {email,password}=req.body||{};
  if(!process.env.ADMIN_EMAIL||String(email).toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase()) return res.status(401).json({error:'Acceso inválido'});
  const r=await fetch(url()+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key(),'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
  const d=await r.json();if(!r.ok||!d.access_token)return res.status(401).json({error:'Correo o contraseña incorrectos'});
  res.cookie('sr_admin',d.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production'||!!process.env.VERCEL,sameSite:'strict',maxAge:Math.min(d.expires_in||3600,3600)*1000,path:'/api/admin'});res.json({ok:true});
 }));
 app.post('/api/admin/logout',(req,res)=>{res.clearCookie('sr_admin',{path:'/api/admin'});res.json({ok:true});});
 app.use('/api/admin',wrap(async(req,res)=>{
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sr_admin='))?.slice(9);
  if(!token)return res.status(401).json({error:'Inicia sesión'});
  const r=await fetch(url()+'/auth/v1/user',{headers:{apikey:key(),Authorization:'Bearer '+decodeURIComponent(token)},signal:AbortSignal.timeout(15000)});
  const user=await r.json();if(!r.ok||!process.env.ADMIN_EMAIL||user.email?.toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase())return res.status(401).json({error:'Sesión vencida'});
  req.adminEmail=user.email;
  // Dispatch behind the authentication check.
  if(req.method==='GET'&&req.path==='/pedidos') {
   let all=[],offset=0;for(;;){const rows=await sb(`/rest/v1/sr_pedidos?select=*&order=creado.desc&limit=1000&offset=${offset}`);all.push(...rows);if(rows.length<1000)break;offset+=1000;}
   return res.json(all);
  }
  if(req.method==='POST'&&/^\/pedidos\/[0-9a-f-]{36}$/.test(req.path))return res.json(await rpc('sr_estado',{p_id:req.path.split('/')[2],p_estado:req.body.estado,p_admin:req.adminEmail}));
  return res.status(404).json({error:'Ruta no encontrada'});
 }));
 app.get('/api/disponibilidad',wrap(async(req,res)=>{
  const start=Number(req.query.start||0);if(!Number.isInteger(start)||start<0||start>99999)return res.status(400).json({error:'Página inválida'});
  res.json(await sb(`/rest/v1/sr_boletos?select=numero&numero=gte.${start}&numero=lt.${Math.min(start+100,100000)}`));
 }));
 app.post('/api/pedidos',wrap(async(req,res)=>{
  const b=req.body||{};if(!Array.isArray(b.tickets)||b.tickets.some(n=>!Number.isInteger(n)))return res.status(400).json({error:'Números inválidos'});
  const data=await rpc('sr_reservar',{p_nombre:String(b.name||''),p_telefono:String(b.phone||'').replace(/\D/g,''),p_correo:String(b.email||'').slice(0,254),p_tipo:b.tier,p_numeros:b.tickets});res.json(Array.isArray(data)?data[0]:data);
 }));
}
