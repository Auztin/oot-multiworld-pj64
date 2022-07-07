var VERSION = '1.0.2';
var player_names_addr = 0;
var save_context = 0x8011A5D0;
var oot = {ready:false,currentMode:-1};
var consoleMode = 0;
var room = {};
var connection = null;
var changed = false;
var repairList = [];
var ganonStabbed = false;
var saveFile = '';

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
  if (!changed) return false;
  try {
    fs.writefile(saveFile, JSON.stringify(room));
    changed = false;
    return true;
  } catch (e) {
    console.log('Error: Unable to save multiworld state!');
    return false;
  }
}
setInterval(saveState, 1000);

function loadState() {
  try {
    saveFile = pj64.romInfo.filePath+'.mws';
    room = JSON.parse(fs.readfile(saveFile));
  } catch (e) {
    room = {
      server: 'mw.auztin.net',
      port: 9001,
      name: '',
      ids: {},
      sent: {},
      received: []
    };
  }
  console.clear();
  if (!room.server || !room.port || !room.name || !room.ids[oot.player_id]) {
    room.name = '';
    setupRoomCfg();
  }
}

function setupRoom() {
  if (connection) return;
  if (room.server && room.port && room.name && oot.ready && room.ids[oot.player_id]) {
    connection = new Socket();
    connection.connect(room.port, room.server, function() {
      connection.pingTimeout = false;
      var command = -1;
      var state = 0;
      var extra = null;
      var bytes = null
      var bytesNeeded = 0;
      connection.write(Buffer.concat([new Buffer([0x00, VERSION.length]), new Buffer(VERSION)]));
      connection.on('data', function (data) {
        for (var i = 0; i < data.length; i++) {
          if (command == -1) {
            command = data[i];
            state = 0;
          }
          else if (command == 0x00) {
            if (state == 0) {
              bytes = '';
              bytesNeeded = data[i];
              state = 1;
              if (bytesNeeded == 0) command = -1;
            }
            else if (state == 1) {
              bytes += String.fromCharCode(data[i]);
              bytesNeeded--;
              if (bytesNeeded == 0) {
                command = -1;
                if (bytes != VERSION) {
                  console.log('Version mismatch! You are running '+VERSION+' but server is '+bytes);
                  connection.close();
                  return;
                }
                else {
                  var crc = mem.u32[0xB0000010];
                  var CRC = [
                    (crc & 0xFF000000) >> 24,
                    (crc & 0x00FF0000) >> 16,
                    (crc & 0x0000FF00) >> 8,
                    (crc & 0x000000FF),
                  ];
                  crc = mem.u32[0xB0000014];
                  CRC.push((crc & 0xFF000000) >> 24)
                  CRC.push((crc & 0x00FF0000) >> 16)
                  CRC.push((crc & 0x0000FF00) >> 8)
                  CRC.push((crc & 0x000000FF))
                  CRC = new Buffer(CRC);
                  var cmd = new Buffer([
                    0x03,
                    room.name.length
                  ]);
                  connection.write(Buffer.concat([cmd, new Buffer(room.name), new Buffer([oot.player_id]), CRC]));
                }
              }
            }
          }
          else if (command == 0x03) {
            if (state == 0) {
              bytes = '';
              bytesNeeded = data[i];
              state = 1;
              if (bytesNeeded == 0) {
                command = -1;
                var name = 'Player'+oot.player_id;
                if (room.ids[oot.player_id]) name = room.ids[oot.player_id];
                connection.write(Buffer.concat([new Buffer([0x04, name.length]), new Buffer(name)]));
                connection.write(new Buffer([0x06, (room.received.length & 0xFF00) >> 8, (room.received.length & 0x00FF)]));
              }
            }
            else if (state == 1) {
              bytes += String.fromCharCode(data[i]);
              bytesNeeded--;
              if (bytesNeeded == 0) {
                console.log('Disconnecting: '+bytes);
                connection.close();
                changed = true;
                saveState();
                script.abort();
                return
              }
            }
          }
          else if (command == 0x04) {
            if (state == 0) {
              extra = [data[i]];
              state = 1;
            }
            else if (state == 1) {
              bytes = '';
              bytesNeeded = data[i] & ~128;
              extra.push(data[i] >> 7);
              state = 2;
              if (bytesNeeded == 0) command = -1;
            }
            else if (state == 2) {
              bytes += String.fromCharCode(data[i]);
              bytesNeeded--;
              if (bytesNeeded == 0) {
                command = -1
                if (room.ids[String(extra[0])] != bytes) {
                  room.ids[String(extra[0])] = bytes;
                  writeName(extra[0], bytes);
                  changed = true;
                }
                var logStr;
                if (extra[1]) logStr = '✓';
                else logStr = '✗';
                logStr += ' P'+extra[0]+' '+bytes;
                console.log(logStr);
              }
            }
          }
          else if (command == 0x05) {
            if (state == 0) {
              extra = [data[i]];
              bytes = 0;
              bytesNeeded = 3;
              state = 1;
            }
            else if (state == 1) {
              bytes = (bytes << 8) | data[i]
              bytesNeeded--;
              if (bytesNeeded == 0) {
                extra.push(bytes);
                state = 2;
              }
            }
            else if (state == 2) {
              command = -1;
              if (extra[0] == 0xFF && extra[1] == 0xFFFFFF) repairList.push(data[i]);
              else {
                var received = false;
                for (var item in room.received) {
                  item = room.received[item];
                  if (
                    item[0] == extra[0]
                    && item[1] == extra[1]
                    && item[2] == data[i]
                  ) {
                    received = true;
                    break;
                  }
                }
                if (!received) {
                  room.received.push([extra[0], extra[1], data[i]]);
                  changed = true;
                }
              }
            }
          }
          else if (command == 0x06) {
            if (state == 0) {
              bytes = data[i];
              state = 1;
            }
            else if (state == 1) {
              command = -1;
              bytes = (bytes << 8) | data[i];
              var count = 0;
              for (var id in room.sent) {
                count += Object.keys(room.sent[id]).length;
              }
              if (count > bytes) {
                for (var id in room.sent) {
                  for (var location in room.sent[id]) {
                    var locationBuffer = [
                      (location & 0xFF0000) >> 16,
                      (location & 0x00FF00) >> 8,
                      (location & 0x0000FF),
                    ];
                    connection.write(Buffer.concat([new Buffer([0x05, id]), new Buffer(locationBuffer), new Buffer([room.sent[id][location]])]));
                  }
                }
              }
            }
          }
          else {
            console.log('Unknown command: '+command);
            connection.close()
            return;
          }
          if (command == 0x01) {
            command = -1;
            connection.write(new Buffer([0x02]));
          }
          else if (command == 0x02) {
            command = -1;
            connection.pingTimeout = false;
          }
        }
      });
      connection.on('close', function() {
        connection = null;
        console.log('Disconnected');
      });
    });
  }
}
setInterval(setupRoom, 5000);
setInterval(function () {
  if (!connection) return;
  try {
    if (connection.pingTimeout) connection.close();
    else {
      connection.write(new Buffer([0x01]));
      connection.pingTimeout = true;
    }
  } catch (e) {
    try { connection.close(); } catch(e){}
    connection = null;
  }
}, 30000);

function initVars() {
  oot.ready = false;
  if (pj64.romInfo != null) {
    var rando = mem.u32[0x801C8464];
    if (rando != 0) {
      var coop = mem.u32[rando];
      oot = mem.bindvars({ready:true,currentMode:oot.currentMode}, [
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
      changed = true;
      if (!saveState()) {
        console.log('Unable to save Multiworld state!');
        console.log('Script cannot run without saving!');
        script.abort();
      }
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
    var id = String(i);
    if (room.ids[id]) writeName(i, room.ids[id]);
    else writeName(i, 'Player'+i);
  }
}

function sendItem(item, player, location) {
  player = String(player);
  var locationBuffer = [
    (location & 0xFF0000) >> 16,
    (location & 0x00FF00) >> 8,
    (location & 0x0000FF),
  ];
  location = '0x'+('000000'+location.hex()).substr(-6);
  if (!room.sent[player]) room.sent[player] = {};
  if (!room.sent[player][location]) {
    room.sent[player][location] = item;
    changed = true;
    connection.write(Buffer.concat([new Buffer([0x05, parseInt(player)]), new Buffer(locationBuffer), new Buffer([item])]));
  }
  else if (item == 0x7C) {
    connection.write(new Buffer([0x05, parseInt(player), 0xFF, 0xFF, 0xFF, item]));
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

setInterval(function () {
  oot.currentMode = getCurrentMode();
  if (oot.currentMode <= 2) {
    oot.ready = false;
    if (connection) {
      try {
        connection.close();
        console.log('Closing connection as no longer in game.');
        console.log('Will auto reconnect once in game again.');
      } catch(e){}
      connection = null;
    }
    return;
  }
  if (!oot.ready && oot.currentMode == 3) initVars();
  if (oot.ready) {
    if (oot.outgoing_key) {
      var id = oot.outgoing_player;
      var name = 'Player'+id;
      if (room.ids[String(id)]) name = room.ids[String(id)];
      writeName(id, name);
      sendItem(oot.outgoing_item, id, oot.outgoing_key);
      oot.outgoing_key = 0;
      oot.outgoing_item = 0;
      oot.outgoing_player = 0;
    }
    if (oot.currentMode == 3) {
      var shops = [0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x42, 0x4B];
      if (!inArray(mem.u16[0x801C8544] & 0x00FF, shops) && oot.incoming_item == 0) {
        if (oot.internal_count > room.received.length) oot.internal_count = room.received.length;
        if (oot.incoming_player == 0 && oot.incoming_item == 0) {
          if (oot.internal_count && repairList.length > 0) {
            var item = repairList.pop();
            oot.internal_count--;
            oot.incoming_player = oot.player_id;
            oot.incoming_item = item;
          }
          else if (oot.internal_count < room.received.length) {
            var id = room.received[oot.internal_count][0];
            var item = room.received[oot.internal_count][2];
            if (item == 0) oot.internal_count++;
            else {
              var name = 'Player'+id;
              if (room.ids[String(id)]) name = room.ids[String(id)];
              writeName(id, name);
              oot.incoming_player = oot.player_id;
              oot.incoming_item = item;
            }
          }
        }
      }
      if (!ganonStabbed && mem.u16[0x801C8544] == 0x004F) {
        var ganon = mem.u32[0x801CA11C];
        if (
             mem.u32[ganon + 0x144] == 0x06003B1C
          && mem.u32[ganon + 0x14C] == 0x428E0000
          && mem.u32[ganon + 0x150] == 0x42900000
          && mem.u32[ganon + 0x154] == 0x428E0000
        ) {
          ganonStabbed = true;
          if (connection) connection.write(new Buffer([0x05, 0x00, 0xFF, 0xFF, 0xFF, 0xFF]));
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
      room.ids[oot.player_id] = input.substr(0, 8);
      if (oot.ready) writeName(oot.player_id, room.ids[oot.player_id])
      console.log('Hello '+room.ids[oot.player_id]+'.');
      console.log('Would you like to use the default server? [y/n]');
    }
    else if (consoleMode == 1) {
      if (inArray(input.toLowerCase(), ['y', 'yes'])) {
        console.log('Please enter the room name.');
        console.log('Use your randomizer seed if possible.');
        console.log('Alphanumeric names only!');
        consoleMode = 3;
      }
      else {
        console.log('Please enter the hostname or IP to connect to.');
      }
    }
    else if (consoleMode == 2) {
      room.server = input;
      console.log('Please enter the port to connect on.');
    }
    else if (consoleMode == 3) {
      room.port = parseInt(input);
      console.log('Please enter the room name.');
      console.log('Use your randomizer seed if possible.');
      console.log('Alphanumeric names only!');
    }
    else if (consoleMode == 4) {
      room.name = input;
      consoleMode++;
    }
    if (consoleMode == 5) {
      console.clear();
      console.log('Room configured!');
      console.listen(null);
      changed = true;
      setupRoom();
    }
    consoleMode++;
  });
}

console.clear();
console.log('Please load the ROM and in game save.');
