import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const bin=resolve('node_modules/wrangler/bin/wrangler.js');
function run(args,capture=false) {
 const r=spawnSync(process.execPath,[bin,...args],{stdio:capture?['inherit','pipe','inherit']:'inherit',encoding:'utf8'});
 if(r.status!==0)throw new Error('命令失败：wrangler '+args.join(' '));
 return r.stdout||'';
}
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8').replace(/^\uFEFF/,''));
run(['whoami']);
if(!config.d1_databases[0].database_id) {
 const output=run(['d1','list','--json'],true);
 const rows=JSON.parse(output.slice(output.indexOf('[')));
 let db=rows.find(x=>x.name==='dawnsea-db');
 if(!db){run(['d1','create','dawnsea-db']);const result=run(['d1','list','--json'],true);db=JSON.parse(result.slice(result.indexOf('['))).find(x=>x.name==='dawnsea-db');}
 if(!db)throw new Error('未能找到数据库，请检查账户。');
 config.d1_databases[0].database_id=db.uuid||db.id;
 writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
}
if(config.r2_buckets?.length){
 const buckets=run(['r2','bucket','list'],true);
 if(!buckets.includes('dawnsea-media'))run(['r2','bucket','create','dawnsea-media']);
}
run(['d1','migrations','apply','DB','--remote']);
console.log('D1 / R2 已准备好。下一步设置管理员密钥，再部署。');
