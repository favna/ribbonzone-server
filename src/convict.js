const convict = require('convict'),
  path = require('path');

const config = convict({ // eslint-disable-line one-var
  servers: [
    {
      id: {
        doc: 'The Discord server ID you want to simulate.',
        format: String,
        default: '123456789'
      },
      default: {
        doc: 'Indicates whether clients connect to this server by default. One server should have this set to true.',
        format: Boolean
      },
      alias: {
        doc: 'Optional, server selection box will show this instead of the actual server name.',
        format: String
      },
      password: {
        doc: 'Optional, clients will be required to enter this password to connect to this server.',
        format: String
      },
      ignoreChannels: {
        doc: 'Optional, list of text channel names or IDs you want to be ignored (cannot be used with listenChannels, case-sensitive).',
        format: Array
      },
      ignoreUsers: {
        doc: 'Optional, list of user IDs you want to be ignored (user ID means the long string of numbers, not username@1234).',
        format: Array
      },
      listenChannels: {
        doc: 'Optional, list of text channel names or IDs you do not want to ignore (cannot be used with ignoreChannels, case-sensitive).',
        format: Array
      }
    }
  ]
});

config.loadFile(path.join(__dirname, 'data/conf.json')); // Load configuration
config.validate(); // Perform validation

module.exports = config;