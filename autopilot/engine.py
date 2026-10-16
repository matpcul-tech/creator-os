import numpy as np, cv2, json, subprocess, math, re, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H,FPS=1080,1920,30
FONT_MONT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'fonts','Montserrat-VariableFont_wght.ttf')
FONT_CINZEL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'fonts','Cinzel-VariableFont_wght.ttf')
def font(path,size,var=None):
    f=ImageFont.truetype(path,size)
    if var:
        try: f.set_variation_by_name(var)
        except Exception: pass
    return f
def load(path):
    im=cv2.imread(path,cv2.IMREAD_COLOR); return im.astype(np.float32)/255.0
def ease(x): x=min(max(x,0),1); return x*x*(3-2*x)
def kb(img,u,z0=1.0,z1=1.12,cx0=.5,cy0=.5,cx1=.5,cy1=.5):
    """Ken Burns: cover-fit img into WxH, zoom z0->z1, center moves. u in 0..1"""
    h,w=img.shape[:2]; s=max(W/w,H/h)
    e=ease(u)*0.0+u  # linear-ish motion keeps constant speed
    z=z0+(z1-z0)*e; cx=cx0+(cx1-cx0)*e; cy=cy0+(cy1-cy0)*e
    sc=s*z
    # visible window size in source px
    vw,vh=W/sc,H/sc
    x0=np.clip(cx*w-vw/2,0,w-vw); y0=np.clip(cy*h-vh/2,0,h-vh)
    M=np.float32([[sc,0,-x0*sc],[0,sc,-y0*sc]])
    return cv2.warpAffine(img,M,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)
def contain_on_blur(img,u,width=920,z0=1.0,z1=1.06,yc=.46):
    bg=kb(img,u,1.25,1.32); bg=cv2.GaussianBlur(bg,(0,0),40)*0.35
    h,w=img.shape[:2]; z=z0+(z1-z0)*u; sc=width/w*z
    M=np.float32([[sc,0,W/2-w*sc/2],[0,sc,H*yc-h*sc/2]])
    fg=cv2.warpAffine(img,M,(W,H),flags=cv2.INTER_AREA if sc<1 else cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0))
    mask=cv2.warpAffine(np.ones((h,w),np.float32),M,(W,H),flags=cv2.INTER_LINEAR)
    # soft shadow
    sh=cv2.GaussianBlur(mask,(0,0),30)[...,None]*0.7
    out=bg*(1-sh)
    return out*(1-mask[...,None])+fg*mask[...,None]
# ---------- grade ----------
_yy,_xx=np.mgrid[0:H,0:W].astype(np.float32)
_r=np.sqrt(((_xx-W/2)/(W*0.62))**2+((_yy-H/2)/(H*0.62))**2)
VIG=np.clip(1-0.75*_r**2.2,0.12,1)[...,None]
rng=np.random.default_rng(7)
GRAIN=[(rng.standard_normal((H//2,W//2)).astype(np.float32)) for _ in range(8)]
def grade(f,i,red=0.55,lift=0.0):
    # BGR float. desaturate a bit, push to blood red, crush blacks
    l=f.mean(axis=2,keepdims=True)
    f=f*(1-red*0.45)+l*red*0.45
    tint=np.array([0.55,0.62,1.18],np.float32)  # BGR
    f=f*((1-red)+red*tint)
    f=np.clip(f,0,1)
    f=f**1.12
    f=f*VIG
    g=cv2.resize(GRAIN[i%8],(W,H),interpolation=cv2.INTER_LINEAR)[...,None]
    f=f+g*0.028
    return np.clip(f+lift,0,1)
class Particles:
    def __init__(s,n=140,seed=3):
        r=np.random.default_rng(seed); s.p=r.random((n,2))*[W,H]; s.v=(r.random((n,2))-.5)*[0.6,0.6]+[0,-0.5]
        s.sz=r.random(n)*2.2+0.8; s.a=r.random(n)*0.5+0.2; s.ph=r.random(n)*6.28
    def draw(s,f,i):
        s.p+=s.v; s.p[:,1]%=H; s.p[:,0]%=W
        lay=np.zeros((H,W),np.float32)
        for (x,y),z,a,ph in zip(s.p,s.sz,s.a,s.ph):
            cv2.circle(lay,(int(x),int(y)),int(z),float(a*(0.6+0.4*math.sin(i/20+ph))),-1,cv2.LINE_AA)
        lay=cv2.GaussianBlur(lay,(0,0),1.6)[...,None]
        col=np.array([0.35,0.45,1.0],np.float32)
        return np.clip(f+lay*col*0.55,0,1)
# ---------- captions ----------
def chunk_words(words,maxw=3,maxc=17):
    chunks=[];cur=[]
    for w in words:
        cur.append(w)
        txt=' '.join(x[2] for x in cur)
        if len(cur)>=maxw or len(txt)>=maxc or re.search(r'[.,?!]$',w[2]):
            chunks.append(cur);cur=[]
    if cur: chunks.append(cur)
    return chunks
def cap_layers(words,offset,size=88):
    """returns list of (t0,t1,[(wt0,text)])"""
    out=[]
    ch=chunk_words(words)
    for k,c in enumerate(ch):
        t0=c[0][0]+offset; t1=(ch[k+1][0][0]+offset) if k+1<len(ch) else c[-1][1]+offset+0.6
        t1=min(t1,c[-1][1]+offset+0.9)
        out.append((t0,t1,[(w[0]+offset,w[2]) for w in c]))
    return out
CF=font(FONT_MONT,92,'ExtraBold')
def render_caption(f,t,caps,y=1330):
    for t0,t1,ws in caps:
        if t0<=t<t1: break
    else: return f
    shown=[w for wt,w in ws if wt<=t+0.02]
    if not shown: return f
    full=' '.join(w for _,w in ws).upper()
    img=Image.new('RGBA',(W,300),(0,0,0,0)); d=ImageDraw.Draw(img)
    fs=CF
    tw=d.textlength(full,font=fs)
    if tw>900:
        fs=font(FONT_MONT,int(92*900/tw),'ExtraBold'); tw=d.textlength(full,font=fs)
    x=(W-tw)/2; 
    for wt,w in ws:
        wu=w.upper()+' '
        if wt<=t+0.02:
            age=t-wt; a=int(255*min(1,age/0.08+0.4))
            d.text((x,150),wu,font=fs,fill=(255,255,255,a),stroke_width=7,stroke_fill=(0,0,0,a),anchor='lm')
        x+=d.textlength(wu,font=fs)
    # pop scale on chunk start
    pop=1+0.06*max(0,1-(t-t0)/0.12)
    arr=np.asarray(img).astype(np.float32)/255
    if pop>1.001:
        M=cv2.getRotationMatrix2D((W/2,150),0,pop); arr=cv2.warpAffine(arr,M,(W,300))
    # soft shadow
    sh=cv2.GaussianBlur(arr[...,3],(0,0),10)*0.55
    reg=f[y-150:y+150]
    reg*= (1-sh[...,None])
    rgb=arr[...,2::-1]; a=arr[...,3:4]
    f[y-150:y+150]=reg*(1-a)+rgb*a
    return f
def text_layer(lines):
    """lines: list of (text,fontobj,y,(r,g,b),tracking). returns RGBA float"""
    img=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    for txt,fo,y,col,tr in lines:
        if tr:
            ws=[d.textlength(ch,font=fo)+tr for ch in txt]; tot=sum(ws)-tr; x=(W-tot)/2
            for ch,w in zip(txt,ws): d.text((x,y),ch,font=fo,fill=col+(255,),anchor='lm'); x+=w
        else: d.text((W/2,y),txt,font=fo,fill=col+(255,),anchor='mm')
    a=np.asarray(img).astype(np.float32)/255
    glow=cv2.GaussianBlur(a,(0,0),14)
    return a,glow
def over(f,layer,alpha=1.0,glowcol=(0.15,0.15,0.9)):
    a,g=layer
    f=np.clip(f+g[...,3:4]*np.array(glowcol,np.float32)*0.6*alpha,0,1)
    rgb=a[...,2::-1]; m=a[...,3:4]*alpha
    return f*(1-m)+rgb*m
def encode(n,frames_fn,nframes,audio,out):
    p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',audio,
        '-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart',
        '-c:a','aac','-b:a','192k','-ar','48000','-shortest',out],stdin=subprocess.PIPE)
    for i in range(nframes):
        f=frames_fn(i)
        p.stdin.write((np.clip(f,0,1)*255+0.5).astype(np.uint8).tobytes())
        if i%150==0: print(n,i,flush=True)
    p.stdin.close(); p.wait()
def align(words,script):
    toks=script.split(); out=[]; j=0
    for w in words:
        while j<len(toks) and re.sub(r'[^\w-]','',toks[j]).lower()!=re.sub(r'[^\w-]','',w[2]).lower(): j+=1
        out.append((w[0],w[1],toks[j] if j<len(toks) else w[2])); j+=1
    return out
def envelope(mp3,lead,n):
    raw=subprocess.run(['ffmpeg','-loglevel','error','-i',mp3,'-ac','1','-ar','48000','-f','f32le','-'],capture_output=True).stdout
    a=np.frombuffer(raw,np.float32); hop=48000//FPS; e=np.zeros(n)
    off=int(lead*FPS)
    for k in range(min(n-off,len(a)//hop)): e[k+off]=np.sqrt((a[k*hop:(k+1)*hop]**2).mean())
    e=e/(e.max()+1e-9); return np.convolve(e,np.ones(3)/3,'same')
def glowline(layer):
    g1=cv2.GaussianBlur(layer,(0,0),4); g2=cv2.GaussianBlur(layer,(0,0),18); g3=cv2.GaussianBlur(layer,(0,0),50)
    return layer+g1*1.2+g2*1.0+g3*0.8
def xfade(a,b,u): return a*(1-u)+b*u
