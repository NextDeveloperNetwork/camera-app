import net from "net";

export interface DvrFile {
  beginTime: string;
  endTime: string;
  fileName: string;
  fileLength: number;
  channel: number;
}

const DVR_HOST = process.env.DVR_HOST || "192.168.1.10";
const DVR_PORT = parseInt(process.env.DVR_PORT || "34567", 10);

export async function queryDvrFiles(
  channel: number,
  dateStr: string // YYYY-MM-DD
): Promise<DvrFile[]> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let sessionHex = "";
    let step = 0;
    let rawBuffer = "";
    const files: DvrFile[] = [];

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(files);
    }, 5000);

    socket.connect(DVR_PORT, DVR_HOST, () => {
      // Step 1: Login via Sofia / XMeye Protocol
      const loginPayload = Buffer.from(
        JSON.stringify({
          EncryptType: "NONE",
          LoginType: "DVRIP-Web",
          PassWord: "",
          UserName: "admin",
        }) + "\n"
      );
      const h = Buffer.alloc(20);
      h[0] = 0xff;
      h.writeUInt16LE(1000, 14); // 1000: LOGIN_REQ
      h.writeUInt32LE(loginPayload.length, 16);
      socket.write(Buffer.concat([h, loginPayload]));
    });

    socket.on("data", (chunk) => {
      if (step === 0) {
        const text = chunk.slice(20).toString();
        const match = text.match(/"SessionID"\s*:\s*"(0x[0-9a-fA-F]+)"/);
        if (match) {
          sessionHex = match[1];
          step = 1;

          // Step 2: Query recorded files on DVR for requested channel (DVR is 0-indexed: ch 4 is 3)
          const dvrChannelIndex = Math.max(0, channel - 1);
          const queryPayload = Buffer.from(
            JSON.stringify({
              Name: "OPFileQuery",
              OPFileQuery: {
                Channel: dvrChannelIndex,
                BeginTime: `${dateStr} 00:00:00`,
                EndTime: `${dateStr} 23:59:59`,
                Event: "*",
                Type: "h264",
              },
              SessionID: sessionHex,
            }) + "\n"
          );

          const qh = Buffer.alloc(20);
          qh[0] = 0xff;
          qh.writeUInt32LE(parseInt(sessionHex, 16), 4);
          qh.writeUInt16LE(1440, 14); // 1440: OPFileQuery
          qh.writeUInt32LE(queryPayload.length, 16);
          socket.write(Buffer.concat([qh, queryPayload]));
        }
      } else if (step === 1) {
        // Collect file query response chunks
        rawBuffer += chunk.toString();
        if (rawBuffer.includes("OPFileQuery")) {
          // Parse all file objects
          const regex =
            /\{\s*"BeginTime"\s*:\s*"([^"]+)",[^}]+?"EndTime"\s*:\s*"([^"]+)",[^}]+?"FileName"\s*:\s*"([^"]+)"/g;
          let m: RegExpExecArray | null;
          while ((m = regex.exec(rawBuffer)) !== null) {
            files.push({
              beginTime: m[1],
              endTime: m[2],
              fileName: m[3],
              fileLength: 0,
              channel,
            });
          }
          clearTimeout(timeout);
          socket.end();
          resolve(files);
        }
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      resolve(files);
    });
  });
}
