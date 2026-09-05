const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'SAMEORIGIN'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(self), payment=(self)'},
  {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains; preload'},
  {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://unpkg.com; connect-src 'self' https://gxwemplbykjxhezefykh.supabase.co wss://gxwemplbykjxhezefykh.supabase.co https://api.razorpay.com https://api.resend.com https://*.tile.openstreetmap.org; frame-src https://api.razorpay.com https://checkout.razorpay.com;"
  }
];
export default {async headers(){return[{source:'/:path*',headers:securityHeaders}]}};
