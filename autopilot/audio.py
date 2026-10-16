import numpy as np, subprocess, sys, wave
SR=48000
def drone(dur,seed=1,base=55.0,heartbeat=None,hits=()):
    t=np.arange(int(dur*SR))/SR; r=np.random.default_rng(seed)
    x=np.zeros_like(t)
    for k,(f,a) in enumerate([(base,.5),(base*1.5,.22),(base*2,.18),(base*2.997,.07),(base*0.5,.35)]):
        lfo=1+0.004*np.sin(2*np.pi*(0.05+0.03*k)*t+r.random()*6)
        x+=a*np.sin(2*np.pi*f*np.cumsum(lfo)/SR)*(0.7+0.3*np.sin(2*np.pi*(0.07+0.02*k)*t+k))
    n=r.standard_normal(len(t)); 
    # brown-ish wind
    b=np.cumsum(n); b-=np.convolve(b,np.ones(4800)/4800,'same'); b/=np.abs(b).max()+1e-9
    x+=0.25*b*(0.6+0.4*np.sin(2*np.pi*0.04*t))
    if heartbeat:
        bpm,start,stop=heartbeat
        per=60/bpm; tt=start
        while tt<stop:
            for off,amp in ((0,1.0),(0.28,0.7)):
                i0=int((tt+off)*SR); L=int(0.18*SR)
                if i0+L<len(x):
                    tl=np.arange(L)/SR; env=np.exp(-tl*22)*(1-np.exp(-tl*400))
                    x[i0:i0+L]+=1.6*amp*np.sin(2*np.pi*(48+30*np.exp(-tl*30))*tl)*env
            tt+=per
    for h in hits:  # cinematic low boom
        i0=int(h*SR); L=int(3.0*SR)
        if i0+L<len(x):
            tl=np.arange(L)/SR; env=np.exp(-tl*1.6)*(1-np.exp(-tl*60))
            x[i0:i0+L]+=1.4*np.sin(2*np.pi*(38+25*np.exp(-tl*4))*tl)*env + 0.3*r.standard_normal(L)*np.exp(-tl*5)*0.3
    fade=np.minimum(1,np.minimum(t/2.0,(dur-t)/2.5)); x*=np.clip(fade,0,1)
    x/=np.abs(x).max()+1e-9
    st=np.stack([x,np.roll(x,int(0.011*SR))],1)*0.8
    return st
def write(path,st):
    a=(np.clip(st,-1,1)*32767).astype(np.int16)
    w=wave.open(path,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes()); w.close()
def mix(voice,music_wav,out,lead,dur,music_db=-17):
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',voice,'-i',music_wav,'-filter_complex',
      f'[0:a]aresample=48000,adelay={int(lead*1000)}|{int(lead*1000)},highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,equalizer=f=180:t=q:w=1:g=2.5,equalizer=f=3500:t=q:w=1.5:g=2,aecho=0.8:0.5:60:0.12,apad,atrim=0:{dur},asplit=2[v][sc];'
      f'[1:a]volume={music_db}dB,lowpass=f=2400,atrim=0:{dur}[m];[m][sc]sidechaincompress=threshold=0.04:ratio=5:attack=40:release=600[md];'
      f'[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:{dur}[o]','-map','[o]','-ar','48000','-ac','2',out],check=True)
