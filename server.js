import 'dotenv/config';
import express from 'express';
import { installPanel } from './panel-api.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '64kb' }));
app.disable('x-powered-by');
installPanel(app);
app.use(express.static(path.join(__dirname,'public')));

const PRICE_BY_TIER = Object.freeze({ Normal: 10, Doble: 25, Premium: 35 });

app.post('/api/create-preference', async (req,res) => {
  try {
    const {name,email,phone,tickets=[],tier='Normal',orderId} = req.body || {};
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({error:'Falta configurar MP_ACCESS_TOKEN en el servidor'});
    }

    if (!Object.prototype.hasOwnProperty.call(PRICE_BY_TIER, tier)) {
      return res.status(400).json({error:'Tipo de boleto inválido'});
    }
    if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 500) {
      return res.status(400).json({error:'Cantidad de boletos inválida'});
    }

    const normalizedTickets = [...new Set(tickets.map(n => Number(n)))];
    if (normalizedTickets.length !== tickets.length || normalizedTickets.some(n => !Number.isInteger(n) || n < 0 || n > 99999)) {
      return res.status(400).json({error:'Hay números de boleto inválidos o repetidos'});
    }

    if (!/^[0-9a-f-]{36}$/.test(String(orderId||'')) || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(400).json({error:'Primero guarda tu pedido'});
    }
    const savedResponse = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/sr_pedidos?id=eq.${orderId}&select=*`, {
      headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`},
      signal:AbortSignal.timeout(15000)
    });
    if (!savedResponse.ok) return res.status(503).json({error:'No se pudo verificar el pedido'});
    const saved = (await savedResponse.json())[0];
    if (!saved || saved.estado !== 'Pendiente' || saved.tipo !== tier || saved.nombre !== name || saved.telefono !== String(phone||'').replace(/\D/g,'') || saved.numeros.length !== normalizedTickets.length || saved.numeros.some(n=>!normalizedTickets.includes(n))) {
      return res.status(400).json({error:'El pedido no coincide o ya no está pendiente'});
    }

    // El precio se calcula en el servidor para que el cliente no pueda cambiar el total.
    const unitPrice = PRICE_BY_TIER[tier];
    const total = normalizedTickets.length * unitPrice;

    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = forwardedProto || 'https';
    const host = req.headers.host;
    const base = process.env.BASE_URL || `${proto}://${host}`;

    const ticketText = normalizedTickets.map(n => String(n).padStart(5,'0'));
    const orderRef = orderId || `SR-${Date.now()}`;
    const body = {
      items:[{
        id:'boletos-sorteo-001',
        title:`Boletos Sorteo #001 - ${tier}`,
        description:`Números: ${ticketText.join(', ')}`.slice(0,250),
        quantity:1,
        currency_id:'MXN',
        unit_price:total
      }],
      payer:{
        name:name||undefined,
        email:email||undefined,
        phone:phone?{number:String(phone)}:undefined
      },
      external_reference:orderRef,
      metadata:{tier,tickets:ticketText.join(','),buyer_phone:String(phone||'')},
      back_urls:{
        success:`${base}/?pago=aprobado`,
        pending:`${base}/?pago=pendiente`,
        failure:`${base}/?pago=fallido`
      },
      auto_return:'approved'
    };

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    });
    const data = await mp.json();
    if(!mp.ok) {
      return res.status(502).json({error:data.message||'Mercado Pago rechazó la preferencia'});
    }
    res.json({
      preference_id:data.id,
      checkout_url:process.env.MP_SANDBOX === 'true' ? data.sandbox_init_point : data.init_point,
      total
    });
  } catch(e){
    res.status(500).json({error:'Error interno al crear el pago'});
  }
});

app.listen(process.env.PORT || 3000,()=>console.log('Sorteo Reynosa listo'));
