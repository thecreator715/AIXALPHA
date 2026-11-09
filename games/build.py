import json
shell=open('shell.js').read()
G={'asteroids':('ASTEROIDS','Asteroids (Atari vector style)'),'breakout':('BREAKOUT','Breakout'),'snake':('SNAKE','Snake'),'pong':('PONG','Pong'),'invaders':('SPACE INVADERS','Space Invaders'),'tetris':('TETRIS','Tetris')}
out={}
for k,(title,name) in G.items():
    js=open(k+'.js').read()
    html='<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">\n<title>'+title+'</title>\n<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{display:block;background:#000}</style>\n</head>\n<body>\n<canvas id="c"></canvas>\n<script>\n'+shell+'\n'+js+'\n</script>\n</body>\n</html>\n'
    open('out_'+k+'.html','w').write(html); out[k]={'name':name,'html':html}
json.dump(out,open('gamedb.json','w'))
print({k:len(v['html']) for k,v in out.items()})
