

const Discord = require('discord.io'),
  inherits = require('inherits'),
  jsonfile = require('jsonfile'),
  path = require('path'),
  util = require('./../web/script/common/util'),
  {EventEmitter} = require('events');

inherits(Inbox, EventEmitter); // eslint-disable-line no-use-before-define

function Inbox (config) {
  EventEmitter.call(this);
  const bot = new Discord.Client({
    autorun: true,
    token: process.env.token
  });

  this.bot = bot;
  const self = this; // eslint-disable-line one-var
 
  bot.on('ready', bot.getAllUsers);

  bot.on('allUsers', () => {
    if (self.servers) {
      return;
    } // Don't re-initialize if reconnecting
    console.log(new Date(), `Logged in as: ${bot.username} - (${bot.id})`);
    const serverIDs = [],
      serverList = config.get('servers');

    self.servers = {};
    for (let i = 0; i < serverList.length; i++) {
      if (!bot.servers[serverList[i].id]) { // Skip unknown servers
        console.log('Unknown server ID:', serverList[i].id);
        continue;
      }
      const newServer = {
        discordID: serverList[i].id,
        name: serverList[i].alias || bot.servers[serverList[i].id].name
      };

      newServer.id = util.abbreviate(newServer.name, serverIDs);
      serverIDs.push(newServer.id);
      if (serverList[i].password) {
        newServer.password = serverList[i].password; 
      }
      if (serverList[i].ignoreChannels) {
        newServer.ignoreChannels = serverList[i].ignoreChannels; 
      }
      if (serverList[i].listenChannels) { 
        newServer.listenChannels = serverList[i].listenChannels; 
      }
      if (serverList[i].default) { 
        self.servers.default = newServer; 
      }
      self.servers[serverList[i].id] = newServer;
    }
    console.log('Connected to', Object.keys(self.servers).length - 1, 'server(s)');
    self.emit('connected');
    jsonfile.writeFileSync(path.join(__dirname, 'data/bot.json'), bot);

    bot.on('message', (user, userID, channelID, message) => {
      if (userID === bot.id) {
        return;
      }
      const channelName = bot.channels[channelID].name,
        serverID = bot.channels[channelID].guild_id;

      if (!self.servers || !self.servers[serverID]) { 
        return; 
      }
      if (self.servers[serverID].ignoreUsers && // Check if this user is ignored
                self.servers[serverID].ignoreUsers.indexOf(userID)) {
        return;
      }
      if (self.servers[serverID].ignoreChannels && // Check if this channel is ignored
                (self.servers[serverID].ignoreChannels.indexOf(channelName) >= 0 ||
                    self.servers[serverID].ignoreChannels.indexOf(channelID) >= 0)) { 
        return;
      }
      if (self.servers[serverID].listenChannels && // Check if this channel is listened to
                self.servers[serverID].listenChannels.indexOf(channelName) < 0 &&
                self.servers[serverID].listenChannels.indexOf(channelID) < 0) {
        return;
      }
      const messageObject = { // eslint-disable-line one-var
        type: 'message',
        servers: [serverID],
        data: {
          uid: userID,
          message: bot.fixMessage(message, serverID),
          channel: channelID
        }
      };

      self.emit('message', messageObject);
    });

  });
  bot.on('disconnect', () => {
    console.log('Bot disconnected, reconnecting...');
    setTimeout(() => {
      bot.connect(); // Auto reconnect after 5 seconds
    }, 5000);
  });
}

Inbox.prototype.getUsers = function (connectRequest) {
  let server = this.servers[connectRequest.server];

  if (!server) { // If requested server ID is not a Discord ID, check abbreviated IDs
    for (const sKey in this.servers) {
      if (!this.servers.hasOwnProperty(sKey)) { 
        continue; 
      }
      if (this.servers[sKey].id === connectRequest.server) {
        server = this.servers[sKey];
        break;
      }
    }
  }
  if (!server) {
    return 'unknown-server';
  }
  if (server.password && server.password !== connectRequest.password) {
    return 'bad-password'; 
  }
  const discordServer = this.bot.servers[server.discordID], // eslint-disable-line one-var
    users = {};

  for (const uid in discordServer.members) {
    if (!discordServer.members.hasOwnProperty(uid)) {
      continue;
    }
    const member = discordServer.members[uid];

    users[uid] = {
      id: member.id,
      username: member.nick || member.username,
      status: member.status
    };
    users[uid].roleColor = false;
    let rolePosition = -1;

    for (let i = 0; i < discordServer.members[uid].roles.length; i++) {
      const role = discordServer.roles[discordServer.members[uid].roles[i]];

      if (!role || !role.color || role.position < rolePosition) {
        continue;
      }
      users[uid].roleColor = `#${`00000${role.color.toString(16)}`.substr(-6)}`;
      rolePosition = role.position;
    }
  }
  
  return {
    server,
    userList: users
  };
};

Inbox.prototype.getServers = function () {
  const serverList = {};

  for (const sKey in this.servers) {
    if (!this.servers.hasOwnProperty(sKey)) { 
      continue;
    }
    const key = sKey === 'default' ? sKey : this.servers[sKey].id;

    serverList[key] = {
      id: this.servers[sKey].id,
      name: this.servers[sKey].name
    };
    if (this.servers[sKey].password) { 
      serverList[key].passworded = true; 
    }
  }
  
  return serverList;
};

module.exports = Inbox;