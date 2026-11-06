import {hashPassword} from '../src/security.js';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
let input='';
for await(const chunk of process.stdin)input+=chunk;
const password=input.replace(/[\r\n]+$/,'');
if(password.length<8||password.length>128)throw new Error('密码须为 8–128 位。');
const hash=await hashPassword(password);
if(process.argv.includes('--local')) {
 writeFileSync('.dev.vars','ADMIN_PASSWORD_HASH="'+hash+'"\n',{mode:0o600});
 console.log('本地管理员已配置。');
} else {
 const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put','ADMIN_PASSWORD_HASH'],{input:hash,encoding:'utf8'});
 // Only Wrangler status is printed, never the hash or the supplied password.
 if(result.status!==0){process.stderr.write(result.stderr||'Secret upload failed.');process.exit(1);}
 console.log('云端管理员初始化密钥已设置。');
}
