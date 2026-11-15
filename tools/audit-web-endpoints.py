import re,os,glob,json
root='apps/api/src'
idx=open(f'{root}/routes/index.ts').read()
imports={}
for m in re.finditer(r'import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s+"([^"]+)"',idx):
    if m.group(1): imports[m.group(1)]=(m.group(3),'default')
    if m.group(2):
        for n in m.group(2).split(','):
            n=n.strip().split(' as ')[-1].strip()
            if n: imports[n]=(m.group(3),n)
mounts=[(m.group(1),m.group(2)) for m in re.finditer(r'router\.use\("([^"]+)",\s*(\w+)\)',idx)]
backend=set()
def resolve(p):
    base=os.path.normpath(os.path.join(root,'routes',p))
    for ext in ('.ts','/index.ts'):
        if os.path.exists(base+ext): return base+ext
for prefix,name in mounts:
    if name not in imports: print('unresolved',prefix,name); continue
    path,sym=imports[name]
    f=resolve(path)
    if not f: print('unresolved file',prefix,name); continue
    src=open(f).read()
    if sym=='default':
        d=re.search(r'export default (\w+)',src); var=d.group(1) if d else 'router'
    else: var=sym
    for m in re.finditer(r'\b'+var+r'\.(get|post|put|patch|delete)\(\s*"([^"]*)"',src):
        pth=(prefix+('' if m.group(2)=='/' else m.group(2)))
        pth=re.sub(r':\w+','{}',pth).rstrip('/') or '/'
        backend.add((m.group(1).upper(),pth,f.split('/modules/')[-1]))
bset={(m,p) for m,p,_ in backend}
web=[]
for f in glob.glob('apps/web/src/**/*.ts*',recursive=True):
    s=open(f).read()
    for m in re.finditer(r'(?:API\.(get|post|put|patch|delete)(?:<[^()]*?>)?\(\s*|apiCall<[^()]*?>\(\{\s*method:\s*"(GET|POST|PUT|PATCH|DELETE)",\s*url:\s*)([`"\'])([^`"\']+)\3',s):
        meth=(m.group(1) or m.group(2)).upper(); url=m.group(4)
        url=re.sub(r'\$\{[^}]*\}','{}',url).split('?')[0].rstrip('/') or '/'
        web.append((meth,url,f.replace('apps/web/src/','')))
# also multi-line apiCall where method after url, and api objects using axios
missing=[]
for meth,url,f in web:
    if (meth,url) not in bset:
        missing.append((f,meth,url))
used={(m,u) for m,u,_ in web}
print('web calls found',len(web),'backend routes',len(backend))
print('\nWEB CALLS WITH NO MATCHING BACKEND ROUTE:')
for f,m,u in sorted(missing): print(f'  {f}: {m} {u}')
json.dump({'backend':sorted(backend),'web':web},open('/tmp/web-endpoint-audit.json','w'))
