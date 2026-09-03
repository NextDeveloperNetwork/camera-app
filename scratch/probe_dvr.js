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
  const raw = d.slice(20).toString();
  console.log('STEP', step, 'RAW:', raw.slice(0, 400));

  if (step === 0) {
    const idx = raw.indexOf('"SessionID"');
    if (idx !== -1) {
      const match = raw.match(/"SessionID"\s*:\s*"(0x[0-9a-fA-F]+)"/);
      if (match) {
        sessionHex = match[1];
        step = 1;

        // Query today's files
        const now = new Date();
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${mo}-${day}`;

        const queryPayload = Buffer.from(JSON.stringify({
          Name: 'OPFileQuery',
          OPFileQuery: {
            Channel: 3,
            BeginTime: `${dateStr} 00:00:00`,
            EndTime: `${dateStr} 23:59:59`,
            Event: '*',
            Type: 'h264'
          },
          SessionID: sessionHex
        }) + '\n');

        const qh = Buffer.alloc(20);
        qh[0] = 0xff;
        qh.writeUInt32LE(parseInt(sessionHex, 16), 4);
        qh.writeUInt16LE(1440, 14); // OPFileQuery
        qh.writeUInt32LE(queryPayload.length, 16);
        client.write(Buffer.concat([qh, queryPayload]));
      }
    }
  } else if (step === 1) {
    client.end();
  }
});

client.on('error', (e) => console.log('Error:', e.message));
setTimeout(() => { client.destroy(); process.exit(0); }, 5000);
