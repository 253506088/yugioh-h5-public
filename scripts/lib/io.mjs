import {writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function retry(fn){for(let i=0;i<6;i++){try{return await fn();}catch(error){if(!['EBUSY','EPERM','EACCES','UNKNOWN'].includes(error.code)||i===5)throw error;await pause(100*(i+1));}}}
// The previous complete file survives interruption. Failed temporary writes are retained for diagnosis.
export async function writeAtomic(file,data){await mkdir(dirname(file),{recursive:true});const temporary=file+'.tmp-'+randomUUID();await retry(()=>writeFile(temporary,data));await retry(()=>rename(temporary,file));}
