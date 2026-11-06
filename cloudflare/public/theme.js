// 本地时间 06:00–18:00 为日间；手动选择会持久保存在本机。
(()=>{let mode='auto';try{mode=localStorage.getItem('dawnsea-theme')||'auto';}catch{}const preview=new URLSearchParams(location.search).get('theme');if(['day','night'].includes(preview))mode=preview;const h=new Date().getHours();document.documentElement.dataset.theme=mode==='auto'?(h>=6&&h<18?'day':'night'):mode;})();
