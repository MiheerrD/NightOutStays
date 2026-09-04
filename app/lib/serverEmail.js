const DEFAULT_FROM = 'NightOutStays <bookings@nightoutstay.com>';
const SITE = 'https://nightoutstay.com';

function esc(v=''){
  return String(v).replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
}

function shell({title,preheader='',bodyHtml,ctaLabel='',ctaUrl=''}){
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#303a44"><div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e7eaee;border-radius:18px;overflow:hidden"><tr><td style="background:#303a44;padding:22px 24px;color:#fff;font-size:22px;font-weight:900">NightOut<span style="color:#f00078">Stays</span></td></tr><tr><td style="padding:28px 24px"><h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#303a44">${esc(title)}</h1>${bodyHtml}${ctaLabel&&ctaUrl?`<p style="margin:24px 0 0"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#f00078;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px">${esc(ctaLabel)}</a></p>`:''}<p style="margin:26px 0 0;font-size:11px;line-height:1.5;color:#8a939c">NightOutStays transactional message. Please do not share payment links or OTPs with anyone.</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmail({to,subject,title,bodyHtml,ctaLabel='',ctaUrl='',preheader=''}){
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey || !to) return {sent:false,reason:!apiKey?'missing_api_key':'missing_recipient'};
  const from=process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:Array.isArray(to)?to:[to],subject,html:shell({title,preheader,bodyHtml,ctaLabel,ctaUrl})}),
    cache:'no-store'
  });
  const text=await response.text();
  let data={}; try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!response.ok) throw new Error(data?.message||data?.error||'Email provider rejected the message.');
  return {sent:true,id:data?.id||null};
}

export function bookingUrl(path=''){ return `${SITE}${path.startsWith('/')?path:`/${path}`}`; }
export function money(v){ return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`; }
export function date(v){ try{return new Date(`${v}T12:00:00`).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch{return String(v||'')} }
export { esc };
