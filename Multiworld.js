var player_names_addr = 0;
var save_context = 0x8011A5D0;
var player_names = {};
var oot = {ready:false};
var received_items = [];
var sent_items = {};
var room = {setup:false};
var consoleMode = 0;
var clients = {};
var sockets = [];
var currentMode = -1;

function inArray(val, array) {
  return array.indexOf(val) >= 0
}

function ootEncode(str, len) {
  var ret = [];
  for (var i=0; i<str.length && i<len; i++) {
    var c = str[i].charCodeAt(0);
    if (c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0)) c -= '0'.charCodeAt(0);
    else if (c >= 'A'.charCodeAt(0) && c <= 'Z'.charCodeAt(0)) c += 0x6A;
    else if (c >= 'a'.charCodeAt(0) && c <= 'z'.charCodeAt(0)) c += 0x64;
    else if (c == '.'.charCodeAt(0)) c = 0xEA;
    else if (c == '-'.charCodeAt(0)) c = 0xE4;
    else if (c == ' '.charCodeAt(0)) c = 0xDF;
    else continue;
    ret.push(c);
  }
  for (; i<len; i++) ret.push(0xDF);
  return ret;
}

function saveState() {
  try {
    var json = {
      received: received_items,
      sent: sent_items
    };
    fs.writefile(pj64.romInfo.filePath+'.mws', JSON.stringify(json));
  } catch (e) {
    console.log('Error: Unable to save multiworld state!');
  }
}

function loadState() {
  try {
    var json = JSON.parse(fs.readfile(pj64.romInfo.filePath+'.mws'));
    received_items = json.received;
    sent_items = json.sent;
  } catch (e) {
    received_items = [];
    sent_items = {};
  }
}

function itemToBizhawk(key, player, item, num) {
  return 'm:'+num+':i:'+item+',m:'+num+':k:'+key+',m:'+num+':f:'+oot.player_id+',m:'+num+':t:'+player;
}

function sendMessage(msg, exclude) {
  if (!room.setup) return;
  if (room.hosting) {
    for (var client in clients) {
      if (clients.hasOwnProperty(client)) {
        if (clients[client].socket == exclude) continue;
        clients[client].socket.write(msg+'\n');
      }
    }
  }
  else {
    room.socket.write(msg+'\n');
  }
}

function parseLine(line, socket) {
  var args = line.substring(1, line.length).split(',');
  if (line[0] == 'c') {
    if (args.length >= 2) {
      if (args[1] != 'd11dd7e66a422b020e3d16b58c5a4de71a6efadc') {
        console.log('Version mismatch!');
        socket.close();
      }
      else if (room.hosting) {
        socket.write('n'+room.name+','+room.name+','+oot.player_id+'\n');
        socket.write('r'+room.name+',i:0:1\n');
        return false;
      }
      else if (args.length >= 3) {
        room.id = args[2];
        sendMessage('c'+room.name+',d11dd7e66a422b020e3d16b58c5a4de71a6efadc');
        sendMessage('n'+room.name+','+room.name+','+oot.player_id);
        sendMessage('r'+room.name+',n:'+oot.player_id);
        sendItemCount();
      }
    }
  }
  if (line[0] == 'n') {
    if (args.length >= 3) {
      if (room.hosting && clients[args[1]]) {
        console.log('Name in use: '+args[1]);
        socket.close();
        return false;
      }
      clients[args[1]] = {
        socket: socket,
        name: args[1],
        num: args[2]
      };
    }
    if (room.hosting) {
      var list = ['l:'+room.name+':status:Ready,l:'+room.name+':num:'+oot.player_id];
      var others = '';
      for (var client in clients) {
        if (clients.hasOwnProperty(client)) {
          list.push('l:'+clients[client].name+':status:Ready,l:'+clients[client].name+':num:'+clients[client].num);
          others += 'r'+clients[client].name+',n:'+clients[client].num+'\n';
        }
      }
      sendMessage('l'+room.name+','+list.join(','));
      sendMessage('r'+room.name+',n:'+oot.player_id);
      if (others) socket.write(others);
      sendItemCount();
    }
    console.log(args[1]+' joined.');
  }
  if (line[0] == 'l') {
    console.log('Players:');
    for (var i = 1; i < args.length; i++) {
      var arg = args[i].split(':');
      if (arg.length == 4 && arg[2] == 'num') {
        clients[arg[1]] = {
          socket: socket,
          name: arg[1],
          num: arg[3]
        };
        console.log('P'+arg[3]+' '+arg[1]);
      }
    }
  }
  if (line[0] == 'p') {
    socket.pingTimeout = false;
    return false;
  }
  if (line[0] == 'q') {
    if (room.hosting) socket.close();
    else {
      if (clients[args[0]]) {
        delete player_names[clients[args[0]].num];
        delete clients[args[0]];
        writeNames();
      }
      console.log(args[1]+' disconnected.');
    }
    return false;
  }
  if (line[0] == 'r') {
    var r = {m:{}};
    var name = args[0];
    for (var i = 1; i < args.length; i++) {
      var arg = args[i].split(':');
      if (arg[0] == 'n') {
        if (room.hosting && player_names[parseInt(arg[1])]) {
          console.log('Player number in use: '+arg[1]);
          socket.close();
          return false;
        }
        player_names[parseInt(arg[1])] = name;
        if (!clients[name]) clients[name] = {
          socket: socket,
          name: name
        };
        clients[name].num = parseInt(arg[1]);
        writeName(arg[1], name);
      }
      if (arg[0] == 'c') {
        if (arg[1] == 'f' && arg[2] == oot.player_id) r.c = arg[3];
        if (arg[1] == 't') r.t = arg[2];
      }
      if (arg[0] == 'm') {
        if (!r.m[arg[1]]) r.m[arg[1]] = {};
        r.m[arg[1]][arg[2]] = arg[3]
      }
    }
    var items = {};
    for (var i in r.m) {
      if (r.m.hasOwnProperty(i)) {
        if (r.m[i].t != oot.player_id.toString()) continue;
        if (!items[r.m[i].f]) items[r.m[i].f] = {};
        items[r.m[i].f][r.m[i].k] = r.m[i].i;
      }
    }
    for (var i = 0; i < received_items.length; i++) {
      var item = received_items[i];
      if (items[item[1]]) delete items[item[1]][item[2]];
    }
    var updated = false;
    for (var player in items) {
      if (items.hasOwnProperty(player)) {
        for (var key in items[player]) {
          if (items[player].hasOwnProperty(key)) {
            received_items.push([parseInt(items[player][key]), player, key]);
            updated = true;
          }
        }
      }
    }
    if (updated) saveState();
    var countForPlayer = 0
    if (r.c == undefined) r.c = 0;
    if (oot.ready) {
      var items = [];
      for (var key in sent_items[r.t]) {
        if (sent_items[r.t].hasOwnProperty(key)) {
          items.push(itemToBizhawk(key, r.t, sent_items[r.t][key], items.length+1));
        }
      }
      if (items.length > r.c) sendMessage('r'+room.name+','+items.join(','));
    }
  }
  return true;
}

function setupRoom() {
  if (room.connecting) return;
  if (room.ready && oot.ready && !room.setup) {
    room.setup = true;
    clients = {};
    player_names = {};
    writeName(oot.player_id, room.name);
    if (room.hosting) {
      player_names[oot.player_id] = room.name;
      room.socket = new Server();
      room.socket.listen(room.port, '0.0.0.0');
      room.socket.on('connection', function(c) {
        var line = '';
        c.pingTimeout = false;
        sockets.push(c);
        c.write('c'+room.name+',d11dd7e66a422b020e3d16b58c5a4de71a6efadc,2,\n');
        c.on('data', function(data) {
          var d = data.toString();
          for (var i = 0; i < d.length; i++) {
            if (d[i] == '\n') {
              if (parseLine(line, c)) sendMessage(line, c);
              line = '';
            }
            else line += d[i]
          }
        });

        c.on('close', function() {
          for (var client in clients) {
            if (clients.hasOwnProperty(client)) {
              if (clients[client].socket == c) {
                sendMessage('q'+client+',q:', c);
                console.log(clients[client].name+' disconnected.');
                delete player_names[clients[client].num];
                const index = sockets.indexOf(clients[client].socket);
                delete clients[client];
                if (index > -1) {
                  sockets.splice(index, 1);
                }
                writeNames();
                break;
              }
            }
          }
        })
      });
    }
    else {
      room.connecting = true;
      room.socket = new Socket();
      room.socket.connect(room.port, room.host, function() {
        room.connecting = false;
        var line = '';
        room.socket.pingTimeout = false;
        sockets.push(room.socket);
        room.socket.on('data', function(data) {
          var d = data.toString();
          for (var i = 0; i < d.length; i++) {
            if (d[i] == '\n') {
              parseLine(line, room.socket);
              line = '';
            }
            else line += d[i]
          }
        });
        room.socket.on('close', function() {
          room.setup = false;
          room.id = 0;
          room.socket.close();
          room.count = 0;
          const index = sockets.indexOf(room.socket);
          if (index > -1) {
            sockets.splice(index, 1);
          }
          console.log('Disconnected');
        });
      });
    }
  }
}
setInterval(setupRoom, 5000);
setInterval(function () {
  for (var i = 0; i < sockets.length; i++) {
    var socket = sockets[i];
    if (socket.pingTimeout) socket.close();
    else {
      socket.write('p'+room.name+',\n');
      socket.pingTimeout = true;
    }
  }
}, 10000);

function initVars() {
  oot.ready = false;
  if (pj64.romInfo != null) {
    var rando = mem.u32[0x801C8464];
    if (rando != 0) {
      var coop = mem.u32[rando];
      oot = mem.bindvars({ready:true}, [
        [ coop + 0, 'protocol_version', u32 ],
        [ coop + 4, 'player_id', u8 ],
        // [ coop + 5, 'player_name_id', f32 ],
        [ coop + 6, 'incoming_player', u16 ],
        [ coop + 8, 'incoming_item', u16 ],
        [ coop + 12, 'outgoing_key', u32 ],
        [ coop + 16, 'outgoing_item', u16 ],
        [ coop + 18, 'outgoing_player', u16 ],
        [ save_context + 0x90, 'internal_count', u16 ]
      ]);
      player_names_addr = coop + 20;

      if (oot.protocol_version != 2) {
        console.log('This ROM is not compatible with this version of the co-op script.');
        oot.ready = false;
        return false;
      }
      loadState();
      setupRoom();
      writeNames();
      return true;
    }
  }
  return false;
}

function writeName(i, name) {
  name = ootEncode(name, 8);
  var addr = player_names_addr + (i)*8;
  for (var n=0; n<name.length; n++) {
    mem.u8[addr] = name[n];
    addr++;
  }
}

function writeNames() {
  for (var i = 1; i < 100; i++) {
    writeName(i, 'Player'+i);
  }
  for (var id in player_names) {
    if (player_names.hasOwnProperty(id)) {
      writeName(id, player_names[id]);
    }
  }
}

function sendItem(item, player, key) {
  if (!sent_items[player]) sent_items[player] = {};
  if (!sent_items[player][key]) {
    sent_items[player][key] = item;
    saveState();
    if (room.setup) sendMessage('r'+room.name+','+itemToBizhawk(key, player, item, 1));
  }
}

function getCurrentMode() {
  //0 N64 Logo
  //1 Title Screen
  //2 File Select
  //3 Normal Gameplay
  //4 Cutscene
  //5 Paused
  //6 Dying
  //7 Dying Menu Start
  //8 Dead

  var mode = -1;
  var logo_state = mem.u32[0x8011F200];
  if (logo_state == 0x802C5880 || logo_state == 0x00000000) {
    mode = 0;
  }
  else {
    var state_main = mem.u8[0x8011B92F];
    if (state_main == 1) mode = 1;
    else if (state_main == 2) mode = 2;
    else {
      var menu_state = mem.u8[0x801D8DD5];
      if (menu_state == 0) {
        if (mem.u32[0x801DB09C] & 0x000000F0 || mem.u16[0x8011a600] <= 0) mode = 6;
        else {
          if (mem.u8[0x8011B933] == 4) mode = 4;
          else mode = 3;
        }
      }
      else if ((0 < menu_state && menu_state < 9) || menu_state == 13 || menu_state == 18 || menu_state == 19) mode = 5;
      else if (menu_state == 9 || menu_state == 0xB) mode = 7;
      else mode = 8;
    }
  }
  return mode;
}

function sendItemCount() {
  if (oot.ready && room.setup) {
    var c = {};
    for (var i = 0; i < received_items.length; i++) {
      var item = received_items[i];
      if (!c[item[1]]) c[item[1]] = 0;
      c[item[1]]++;
    }
    var str = 'r'+room.name+',';
    var counts = ['c:f:'+oot.player_id+':1'];
    for (var player in c) {
      if (c.hasOwnProperty(player)) {
        counts.push('c:f:'+player+':'+c[player]);
      }
    }
    counts.push('c:t:'+oot.player_id);
    str += counts.join(',');
    sendMessage(str);
  }
}
setInterval(sendItemCount, 60000);

initVars();
setInterval(function () {
  currentMode = getCurrentMode();
  if (currentMode <= 2) {
    oot.ready = false;
    return;
  }
  if (!oot.ready && currentMode == 3) initVars();
  if (oot.ready) {
    if (oot.outgoing_key) {
      sendItem(oot.outgoing_item, oot.outgoing_player, oot.outgoing_key);
      oot.outgoing_key = 0;
      oot.outgoing_item = 0;
      oot.outgoing_player = 0;
    }
    if (currentMode == 3) {
      var shops = [0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x42, 0x4B];
      if (!inArray(mem.u16[0x801C8544] & 0x00FF, shops) && oot.incoming_item == 0) {
        if (oot.internal_count > received_items.length) oot.internal_count = received_items.length;
        if (oot.internal_count < received_items.length) {
          var item = received_items[oot.internal_count][0];
          if (item == 0) oot.internal_count++;
          else {
            oot.incoming_item = item;
            oot.incoming_player = oot.player_id;
          }
        }
      }
    }
  }
}, 50);

function setupRoomCfg() {
  console.clear();
  console.log('Please enter your name (8 characters max).');
  console.listen(function(input) {
    if (consoleMode == 0) {
      room.name = input.substr(0, 8);
      console.log('Hello '+room.name+'. Will you be hosting? [y/n]');
    }
    else if (consoleMode == 1) {
      if (inArray(input.toLowerCase(), ['y', 'yes'])) {
        room.hosting = true;
        console.log('Please enter the port to listen on.');
        consoleMode++;
      }
      else {
        room.hosting = false;
        console.log('Please enter the hostname or IP to connect to.');
      }
    }
    else if (consoleMode == 2) {
      room.host = input;
      console.log('Please enter the port to connect on.');
    }
    else if (consoleMode == 3) {
      room.port = parseInt(input);
      // console.log('Please enter the room password.');
      consoleMode = 5;
    }
    else if (consoleMode == 4) {
      room.pass = input;
      consoleMode++;
    }
    if (consoleMode == 5) {
      room.ready = true;
      console.clear();
      console.log(room);
      console.log('Room configured with the above settings!');
      console.listen(null);
      try {
        fs.writefile(pj64.scriptsDirectory+'Multiworld.cfg', JSON.stringify(room));
      } catch (e) {}
      setupRoom();
    }
    consoleMode++;
  });
}

try {
  var json = JSON.parse(fs.readfile(pj64.scriptsDirectory+'Multiworld.cfg'));
  console.clear();
  console.log(json);
  console.log('Previous settings found. Would you like to use them? [y/n]');
  console.listen(function(input) {
    if (inArray(input.toLowerCase(), ['y', 'yes'])) {
      room = json;
      console.log('Room configured with the above settings!');
      console.listen(null);
      setupRoom();
    }
    else setupRoomCfg();
  });
} catch (e) {
  setupRoomCfg();
}
