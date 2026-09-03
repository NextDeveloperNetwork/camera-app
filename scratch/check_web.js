const http = require('http');

http.get('http://192.168.1.10/', (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    console.log(d.slice(0, 1000));
  });
});
