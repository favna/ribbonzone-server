/* eslint-disable no-undef, no-use-before-define, no-unused-vars, sort-vars */

const Canvas = require('./script/engine/canvas.js'), // eslint-disable-line one-var, no-var, vars-on-top
  Decorator = require('./script/props/decorator.js'),
  Game = require('./script/engine/game.js'),
  Preloader = require('./script/engine/preloader.js'),
  Renderer = require('./script/engine/renderer.js'),
  UI = require('./script/ui/ui.js'),
  Users = require('./script/actors/users.js'),
  World = require('./script/environment/world.js'),
  bs = require('browser-storage'),
  util = require('./script/common/util.js'),
  webSocket = require('websocket-stream');

const packageInfo = JSON.parse(require('fs').readFileSync('./package.json')), // eslint-disable-line one-var
  {version} = packageInfo,
  preloader = new Preloader(initGame);

let game = null,
  ws = null;

function initGame (images) {
  game = new Game({step: 1000 / 60});
  game.renderer = new Renderer({
    game,
    images
  });
  const canvas = new Canvas({
    id: 'main',
    game,
    initialScale: 2,
    backgroundColor: '#181213'
  });

  game.renderer.addCanvas(canvas);
  game.bindCanvas(canvas);
  game.ui = new UI(game);

  initWebsocket();

  window.pause = function () {
    game.paused = true;
  };
  window.unpause = function () {
    game.paused = false;
  };
  window.game = game;
}

function initWebsocket () {
  let decorator = null,
    users = null,
    world = null;

  console.log('Initializing websocket on port', '2356');

  ws = webSocket(`ws://${'188.166.74.110'}:${'2356'}`);

  ws.on('data', (data) => {
    data = JSON.parse(data);
    if (decorator) {
      decorator.beacon.ping();
    }
    if (data.type === 'server-list') {
      game.servers = data.data;
      console.log('Got server list:', game.servers);

      game.ui.addButton({
        text: 'Server',
        top: 3,
        right: 3,
        onPress () {
          if (game.serverListPanel) {
            game.serverListPanel.remove();
            delete game.serverListPanel;

            return;
          }
          const JoinThisServer = function (server) {
            return function () {
              let params = `?s=${server.id}`;

              if (server.password) {
                params += `&p=${server.password}`;
              }
              if (server.passworded) {
                const submitPassword = function (pass) {
                  bs.setItem('dzone-default-server', JSON.stringify({
                    id: server.id,
                    password: pass
                  }));
                  server.password = pass;
                  if (window.location.protocol !== 'file:') {
                    window.history.pushState({
                      server: server.id,
                      password: server.password
                    },
                    server.id, window.location.pathname + params
                    );
                  }
                  joinServer(server);
                  game.passwordPromptPanel.remove();
                  delete game.passwordPromptPanel;
                };

                game.passwordPromptPanel = game.ui.addPanel({
                  left: 'auto',
                  top: 'auto',
                  w: 102,
                  h: 28
                });
                game.passwordPromptInput = game.ui.addInput({
                  left: 5,
                  top: 5,
                  w: 65,
                  h: 18,
                  parent: game.passwordPromptPanel,
                  onSubmit: submitPassword,
                  text: server.password ? server.password : ''
                });
                game.passwordPromptInput.focus();
                game.passwordPromptOK = game.ui.addButton({
                  text: 'OK',
                  right: 5,
                  top: 5,
                  w: 24,
                  h: 18,
                  parent: game.passwordPromptPanel,
                  onPress: game.passwordPromptInput.submit.bind(game.passwordPromptInput)
                });
              } else {
                bs.setItem('dzone-default-server', JSON.stringify({id: server.id}));
                if (window.location.protocol !== 'file:') {
                  window.history.pushState({
                    server: server.id,
                    password: server.password
                  },
                  server.id, window.location.pathname + params
                  );
                }
                joinServer(server);
              }
              game.serverListPanel.remove();
              delete game.serverListPanel;
            };
          };

          game.serverListPanel = game.ui.addPanel({
            left: 'auto',
            top: 'auto',
            w: 146,
            h: 28 + 21 * (Object.keys(game.servers).length - 2)
          });
          let button = null,
            serverButtonY = 0,
            widestButton = 136;

          for (const sKey in game.servers) {
            if (!game.servers.hasOwnProperty(sKey)) {
              continue;
            }
            if (sKey === 'default') {
              continue;
            }
            const server = game.servers[sKey],
              serverLock = game.servers[sKey].passworded ? ':icon-lock-small: ' : '';

            button = game.ui.addButton({
              text: serverLock + game.servers[sKey].name,
              left: 5,
              top: 5 + serverButtonY * 21,
              w: 136,
              h: 18,
              parent: game.serverListPanel,
              onPress: new JoinThisServer(server)
            });
            widestButton = Math.max(widestButton, button.textCanvas.width + 2);
            serverButtonY++;
          }
          game.serverListPanel.resize(widestButton + 10, game.serverListPanel.h);
          game.serverListPanel.resizeChildren(widestButton, button.h);
          game.serverListPanel.reposition();
        }
      });


      game.ui.addButton({ // Help button
        text: '?',
        bottom: 3,
        right: 3,
        w: 18,
        h: 18,
        onPress () {
          if (game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;

            return;
          }
          game.helpPanel = game.ui.addPanel({
            left: 'auto',
            top: 'auto',
            w: 200,
            h: 75
          });
          game.ui.addLabel({
            text: `D-Zone ${version}`,
            top: 5,
            left: 'auto',
            parent: game.helpPanel
          });
          game.ui.addLabel({
            text: packageInfo.description,
            top: 20,
            left: 2,
            maxWidth: 196,
            parent: game.helpPanel
          });
          game.ui.addLabel({
            text: ':icon-npm: View on npm',
            hyperlink: 'https://www.npmjs.com/package/d-zone',
            top: 50,
            left: 8,
            parent: game.helpPanel
          });
          game.ui.addLabel({
            text: ':icon-github: View on GitHub',
            hyperlink: 'https://github.com/vegeta897/d-zone',
            top: 50,
            right: 8,
            parent: game.helpPanel
          });
        }
      });
      const startupServer = getStartupServer();

      joinServer(startupServer);
    } else if (data.type === 'server-join') { // Initial server status
      game.reset();
      game.renderer.clear();
      const userList = data.data.users;

      world = new World(game, Math.round(3.3 * Math.sqrt(Object.keys(userList).length)));
      decorator = new Decorator(game, world);
      game.decorator = decorator;
      users = new Users(game, world);
      let params = `?s=${data.data.request.server}`;

      if (data.data.request.password) {
        params += `&p=${data.data.request.password}`;
      }
      if (window.location.protocol !== 'file:') {
        window.history.replaceState(
          data.data.request, data.data.request.server, window.location.pathname + params
        );
      }

      game.setMaxListeners(Object.keys(userList).length + 50);
      users.setMaxListeners(Object.keys(userList).length);
      for (const uid in userList) {
        if (!userList.hasOwnProperty(uid)) {
          continue;
        }

        if (!userList[uid].username) {
          continue;
        }
        users.addActor(userList[uid]);

      }
      console.log(`${Object.keys(users.actors).length.toString()} actors created`);
      game.renderer.canvases[0].onResize();
    } else if (data.type === 'presence') { // User status update
      if (!users.actors[data.data.uid]) {
        return;
      }
      users.actors[data.data.uid].updatePresence(data.data.status);
    } else if (data.type === 'message') { // Chatter
      users.queueMessage(data.data);
    } else if (data.type === 'error') {
      window.alert(data.data.message); // eslint-disable-line no-alert
      if (!game.world) {
        joinServer({id: 'default'});
      }
    }
  });
  ws.on('connect', () => {
    console.log('Websocket connected');
  });
  ws.on('disconnect', () => {
    console.log('Websocket disconnected');
  });
  ws.on('error', (err) => {
    console.log('error', err);
  });

  window.testMessage = function (message) {
    const channel = message ? message.channel : '1',
      msg = message ? message.text : 'hello, test message yo!',
      uid = message ? message.uid : users.actors[Object.keys(users.actors)[0]].uid;

    ws.emit('data', JSON.stringify({
      type: 'message',
      data: {
        uid,
        message: msg,
        channel
      }
    }));
  };
}

window.onpopstate = function (event) {
  const server = {id: event.state.server};

  if (event.state.password) {
    server.password = event.state.password;
  }
  joinServer(server);
};

function joinServer (server) {
  const connectionMessage = {
    type: 'connect',
    data: {server: server.id}
  };

  if (server.password) {
    connectionMessage.data.password = server.password;
  }
  console.log('Requesting to join server', server.id);
  ws.write(Buffer.from(JSON.stringify(connectionMessage)));
}

function getStartupServer () { // Get startup server, first checking URL params, then localstorage
  let startupServer = {id: util.getURLParameter('s')}; // Check URL params

  if (!startupServer.id) {
    startupServer = bs.getItem('dzone-default-server'); // Check localstorage
    if (startupServer) {
      startupServer = JSON.parse(startupServer);
    }
  }
  if (!startupServer /* || !game.servers[startupServer.id]*/) {
    startupServer = {id: 'default'};
  }
  if (util.getURLParameter('p')) {
    startupServer.password = util.getURLParameter('p');
  }

  return startupServer;
}