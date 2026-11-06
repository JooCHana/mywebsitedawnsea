const enc = new TextEncoder();
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const hex = data => [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('');
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async text => hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));
export async function hashPassword(password,salt=random()) {
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return `pbkdf2$100000$${salt}$${hex(bits)}`;
}
export async function verifyPassword(password,stored) {
 if(!/^pbkdf2\$100000\$[a-f0-9]{64}\$[a-f0-9]{64}$/.test(stored||'')) return false;
 const actual=await hashPassword(password,stored.split('$')[2]);
 let diff=actual.length^stored.length;
 for(let i=0;i<actual.length;i++) diff|=actual.charCodeAt(i)^stored.charCodeAt(i);
 return diff===0;
}
export function canRead(user,post) { return !!post && (post.visibility==='public'||user?.role==='admin'||(post.visibility==='members'&&!!user)); }
export function uploadType(bytes) {
 const starts=(list)=>list.every((v,i)=>bytes[i]===v);
 const word=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(starts([255,216,255])) return 'image/jpeg';
 if(starts([137,80,78,71,13,10,26,10])) return 'image/png';
 if(word(0,4)==='RIFF'&&word(8,12)==='WEBP')return 'image/webp';
 if(word(4,8)==='ftyp')return 'video/mp4';
 if(starts([26,69,223,163]))return 'video/webm';
 return null;
}
