const net = require('net');

const client = net.connect(34567, '192.168.1.10', () => {
  const loginPayload = Buffer.from(JSON.stringify({
    EncryptType: 'NONE',
    LoginType: 'DVRIP-Web',
    PassWord: '',
    UserName: 'admin'
  }) + '\n');
  const h = Buffer.alloc(20);
  h[0] = 0xff;
  h.writeUInt16LE(1000, 14);
  h.writeUInt32LE(loginPayload.length, 16);
  client.write(Buffer.concat([h, loginPayload]));
});

let sessionHex = '';
let step = 0;

client.on('data', (d) => {
  if (step === 0) {
    const raw = d.slice(20).toString();
    const match = raw.match(/"SessionID"\s*:\s*"(0x[0-9a-fA-F]+)"/);
    if (match) {
      sessionHex = match[1];
      step = 1;

      const playPayload = Buffer.from(JSON.stringify({
        Name: 'OPPlayBack',
        OPPlayBack: {
          Action: 'Claim',
          Parameter: {
            Channel: 0,
            FileName: '/idea0/2026-09-02/001/00.30.00-00.35.00[R][@1e709][1].h264',
            PlayMode: 'ByFile',
            StreamType: 'Main',
            TransMode: 'TCP'
          }
        },
        SessionID: sessionHex
      }) + '\n');

      const qh = Buffer.alloc(20);
      qh[0] = 0xff;
      qh.writeUInt32LE(parseInt(sessionHex, 16), 4);
      qh.writeUInt16LE(1420, 14); // 1420: OPPlayBack
      qh.writeUInt32LE(playPayload.length, 16);
      client.write(Buffer.concat([qh, playPayload]));
    }
  } else if (step === 1) {
    console.log('MSG ID 1420 RESPONSE:', d.length, 'bytes');
    console.log(d.slice(20, 200).toString());
    step = 2;
  } else if (step === 2) {
    console.log('VIDEO CHUNK:', d.length, 'bytes');
    client.end();
  }
});

client.on('error', e => console.log('Err:', e.message));
setTimeout(() => { client.destroy(); process.exit(0); }, 5000);
