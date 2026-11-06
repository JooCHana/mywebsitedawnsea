const dialog=document.querySelector('#auth-dialog');
document.querySelectorAll('[data-auth]').forEach(link=>link.addEventListener('click',event=>{if(dialog?.showModal){event.preventDefault();dialog.showModal();}}));
function updateTheme(mode){try{localStorage.setItem('dawnsea-theme',mode);}catch{}const h=new Date().getHours();document.documentElement.dataset.theme=mode==='auto'?(h>=6&&h<18?'day':'night'):mode;document.querySelectorAll('[data-theme-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeMode===mode)));}
document.querySelectorAll('[data-theme-mode]').forEach(b=>b.addEventListener('click',()=>updateTheme(b.dataset.themeMode)));
setInterval(()=>{let mode='auto';try{mode=localStorage.getItem('dawnsea-theme')||'auto';}catch{}updateTheme(mode);},60000);
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);document.querySelector('#copy-status').textContent='抖音号已复制';}catch{document.querySelector('#copy-status').textContent='抖音号：'+b.dataset.copy;}}));
const path=location.pathname.replace(/\/$/,'')||'/';document.querySelectorAll('.side-nav a').forEach(a=>{if(a.getAttribute('href')===path)a.setAttribute('aria-current','page');});
