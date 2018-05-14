const path = require('path');

require('dotenv').config({path: path.join(__dirname, '.env')});
const Inbox = require(path.join(__dirname, 'inbox.js')), // eslint-disable-line one-var
  WebSock = require(path.join(__dirname, 'websock.js')),
  config = require(path.join(__dirname, 'convict.js'));

const inbox = new Inbox(config); // eslint-disable-line one-var

let webSock = null;

inbox.on('connected', () => {
  webSock = new WebSock( 
    (socket) => {
      socket.send(JSON.stringify({
        type: 'server-list',
        data: inbox.getServers()
      }));
    },
    (socket, connectRequest) => {
      const users = inbox.getUsers(connectRequest);

      if (users === 'unknown-server') {
        socket.send(JSON.stringify({
          type: 'error',
          data: {message: 'Sorry, couldn\'t connect to that Discord server.'}
        }));
      } else if (users === 'bad-password') {
        socket.send(JSON.stringify({
          type: 'error',
          data: {message: 'Sorry, wrong password for that Discord server.'}
        }));
        console.log('Client used wrong password to join server', connectRequest.server);
      } else {
        socket.discordServer = users.server.discordID;

        console.log('Client joined server', users.server.name);
        socket.send(JSON.stringify({ 
          type: 'server-join',
          data: {
            users: users.userList,
            request: connectRequest
          }
        }));
      }
    }
  );
  inbox.on('message', webSock.sendData.bind(webSock));
  inbox.on('presence', webSock.sendData.bind(webSock));
});