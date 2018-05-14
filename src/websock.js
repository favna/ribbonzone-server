const dateFormat = require('dateformat');

function WebSock (onConnect, onJoinServer) {
  const WSServer = require('ws').Server, // eslint-disable-line no-mixed-requires, global-require
    wss = new WSServer({port: process.env.socketport});

  this.wss = wss;
  wss.on('connection', (socket) => {
    console.log(dateFormat(new Date(),
      'm/d h:MM:ss TT'), 'client connected to server, total:', wss.clients.length);
        
    onConnect(socket);
        
    socket.on('message', (data) => {
      data = JSON.parse(data);
      if (data.type === 'connect') { // Connection request from client
        onJoinServer(socket, data.data);
      }
    });
  });
}

WebSock.prototype.sendData = function (data) {
  this.wss.clients.forEach((client) => {
    if (client.readyState !== 1) {
      return;
    }
    if (data.servers.indexOf(client.discordServer) < 0) { 
      return;
    }
    client.send(JSON.stringify(data));
  });
};

module.exports = WebSock;