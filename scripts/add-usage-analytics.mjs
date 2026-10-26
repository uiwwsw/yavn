import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';
import {usageTag,usageConfig} from './usage-config.mjs';
async function visit(root) { for (const e of await readdir(root,{withFileTypes:true})) { const p=join(root,e.name); if(e.isDirectory()) await visit(p); else if(e.name.endsWith('.html') && !/^(?:google|naver)[a-f0-9]+\.html$/.test(e.name) && !['404.html','outage.html','offline.html'].includes(e.name)) {const route='/'+relative('dist',p).split(sep).join('/').replace(/index\.html$/,'');if(!usageConfig.routes.some(r=>new RegExp(r.match).test(route)))continue;const html=await readFile(p,'utf8');if(!html.includes('data-usage-config'))await writeFile(p,html.includes('</head>')?html.replace('</head>',()=>usageTag()+'</head>'):html+'\n'+usageTag());} } }
await visit('dist');
