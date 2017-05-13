const WebSocket = require('ws');
const url = require('url');

var WebSocketServer = WebSocket.Server, wss = new WebSocketServer({
  port : 8002
});
var uuid = require('node-uuid');

var clients = [];

function wsSend(type, client_uuid, nickname, message) {
  for (var i = 0; i < clients.length; i++) {
    var clientSocket = clients[i].ws;
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        "type" : type,
        "id" : client_uuid,
        "nickname" : nickname,
        "message" : message
      }));
    }
  }
}


var clientIndex = 1;

function heartbeat() {
  this.isAlive = true;
}

wss.on('error', function(e) {
  console.log("error got error: [%s], [%s]", e.reason, e.code);
});

wss.on('connection', function(ws) {
  var client_uuid = uuid.v4();
  var nickname = "AnonymousUser" + clientIndex;
  clientIndex += 1;
  clients.push({
    "id" : client_uuid,
    "ws" : ws,
    "nickname" : nickname
  });
  console.log('client [%s] connected', client_uuid);
  console.log('client ip1 [%s] ', ws.upgradeReq.connection.remoteAddress);
  console.log('client ip2 [%s] ', ws.upgradeReq.headers['x-forwarded-for']);
  const location = url.parse(ws.upgradeReq.url, true);
  console.log('access_token [%s], cookie [%s] ',
    location.access_token, ws.upgradeReq.headers.cookie);
  // You might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)


  var connect_message = nickname + " has connected";
  
//      heart beat
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive == false) return ws.terminate();

      ws.isAlive = false;
      ws.ping('', false, true);
    });
  }, 30000);

  wsSend("notification", client_uuid, nickname, connect_message);
  ws.on('message', function(message) {
    if (message.indexOf('/nick') === 0) {
      var nickname_array = message.split(' ');
      if (nickname_array.length >= 2) {
        var old_nickname = nickname;
        nickname = nickname_array[1];
        var nickname_message = "Client " + old_nickname
            + " changed to " + nickname;
        wsSend("nick_update", client_uuid, nickname, nickname_message);
      }
    } else {
      wsSend("message", client_uuid, nickname, message);
    }
  });

  ws.on('error', function(e) {
    console.log("error happens: [%s], [%s]", e.reason, e.code);
  });

  var closeSocket = function(customMessage) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id == client_uuid) {
        var disconnect_message;
        if (customMessage) {
          disconnect_message = customMessage;
        } else {
          disconnect_message = nickname + " has disconnected";
        }
        wsSend("notification", client_uuid, nickname,
            disconnect_message);
        clients.splice(i, 1);
      }
    }
  }
  ws.on('close', function(e) {
    console.log("closing socket: [%s], [%s]", e.reason, e.code);
    closeSocket();
  });

  process.on('SIGINT', function() {
    console.log("Closing things");
    closeSocket('Server has disconnected');
    process.exit();
  });
});
