// SMTP exclusivo de pruebas: captura en memoria, nunca envía correo a internet.
import {createServer} from "node:net";
import {once} from "node:events";
export async function startLocalSMTP() {
 const messages=[];const sockets=new Set();let reject=0;
 const server=createServer(socket=>{
  sockets.add(socket);socket.on("close",()=>sockets.delete(socket));socket.on("error",()=>{});
  let buffer="",data=false,body=[],recipients=[];
  socket.write("220 local.test ESMTP\r\n");
  socket.on("data",chunk=>{
   buffer+=chunk.toString();
   while(buffer.includes("\r\n")) {
    const pos=buffer.indexOf("\r\n");const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);
    if (data) {
     if (line===".") {if (reject>0) {reject--;socket.write("550 local rejection\r\n");} else {messages.push({recipients:[...recipients],body:body.join("\r\n")});socket.write("250 accepted\r\n");}body=[];recipients=[];data=false;}
     else body.push(line.startsWith("..") ? line.slice(1) : line);
     continue;
    }
    const command=line.split(" ")[0].toUpperCase();
    if (["EHLO","HELO"].includes(command)) socket.write("250-local.test\r\n250 8BITMIME\r\n");
    else if(command==="RCPT") {recipients.push(line.replace(/^RCPT TO:/i,"").replace(/[<>]/g,"").trim());socket.write("250 ok\r\n");}
    else if(command==="DATA") {data=true;socket.write("354 end with dot\r\n");}
    else if(command==="QUIT") {socket.end("221 bye\r\n");}
    else if(command==="RSET") {body=[];recipients=[];socket.write("250 ok\r\n");}
    else socket.write("250 ok\r\n");
   }
  });
 });
 server.listen(0,"0.0.0.0");await once(server,"listening");
 return {messages,rejectNext:()=>{reject++;},port:server.address().port,close:()=>{for(const socket of sockets) socket.destroy();server.close();}};
}
