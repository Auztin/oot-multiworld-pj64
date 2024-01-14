var VERSION = '1.0.4';
var save_context = 0x8011A5D0;
var oot = {
  ready:false,
  currentMode:-1,
  player_names_addr:0,
  mw_progressive_items_state:0,
  version:'',
  time:'',
  worlds:0,
  hash:[],
  name:'',
  inventory:0
};
var consoleMode = 1;
var room = {};
var connection = null;
var connectionReady = false;
var changed = false;
var repairList = [];
var defeatedGanon = false;
var saveFile = '';

function inArray(val, array) {
  return array.indexOf(val) >= 0
}

var to_oot = [
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xE4,0xEA,0xDF,
  0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xAB,0xAC,0xAD,0xAE,0xAF,0xB0,0xB1,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,
  0xBA,0xBB,0xBC,0xBD,0xBE,0xBF,0xC0,0xC1,0xC2,0xC3,0xC4,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xC5,0xC6,0xC7,0xC8,0xC9,0xCA,0xCB,0xCC,0xCD,0xCE,0xCF,0xD0,0xD1,0xD2,0xD3,
  0xD4,0xD5,0xD6,0xD7,0xD8,0xD9,0xDA,0xDB,0xDC,0xDD,0xDE,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,
  0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF,0xDF
];
var from_oot = [
  '0','1','2','3','4','5','6','7','8','9',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ','A','B','C','D','E',
  'F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U',
  'V','W','X','Y','Z','a','b','c','d','e','f','g','h','i','j','k',
  'l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',' ',
  ' ',' ',' ',' ','-',' ',' ',' ',' ',' ','.',' ',' ',' ',' ',' ',
  ' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' '
];

function ootEncode(str, len) {
  var ret = [];
  for (var i=0; i<str.length && i<len; i++) ret.push(to_oot[str[i].charCodeAt(0)]);
  for (; i<len; i++) ret.push(0xDF);
  return ret;
}

function ootDecode(i, trim) {
  var ret = "";
  for (var shift = 0; shift <= 24; shift += 8) {
    var c = from_oot[(i >> shift) & 0xFF];
    if (trim && c == ' ') continue;
    ret = c+ret;
  }
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
      server: '',
      port: 0,
      name: '',
      ids: {},
      sent: {},
      received: [],
      inventory: {}
    };
  }
  console.clear();
  if (!room.server || !room.port || !room.ids[oot.player_id]) {
    setupRoomCfg();
  }
}

function setupRoom() {
  if (connection) return;
  if (room.server && room.port && oot.ready && room.ids[oot.player_id]) {
    connectionReady = false;
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
                  connection.write(Buffer.concat([
                    new Buffer([
                      0x03,
                      oot.version.length,
                      oot.time.length,
                      oot.worlds
                    ].concat(oot.hash)),
                    new Buffer(oot.version),
                    new Buffer(oot.time),
                    new Buffer([oot.player_id]),
                    new Buffer(CRC)
                  ]));
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
                var name = 'P'+oot.player_id;
                if (room.ids[oot.player_id]) name = room.ids[oot.player_id];
                connection.write(Buffer.concat([new Buffer([0x04, name.length]), new Buffer(name)]));
                connection.write(new Buffer([0x06, (room.received.length & 0xFF00) >> 8, (room.received.length & 0x00FF)]));
                connection.write(new Buffer([
                  0x07,
                  (oot.inventory & 0xFF000000) >> 24,
                  (oot.inventory & 0x00FF0000) >> 16,
                  (oot.inventory & 0x0000FF00) >> 8,
                  (oot.inventory & 0x000000FF),
                ]));
                connectionReady = true;
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
              bytes = data[i];
              state = 1;
              // extra = [data[i]];
              // bytes = 0;
              // bytesNeeded = 4;
              // state = 1;
            }
            else if (state == 1) {
              extra = [(bytes << 8) | data[i]];
              bytes = 0;
              bytesNeeded = 4;
              state = 2;
            }
            else if (state == 2) {
              bytes = ((bytes << 8) | data[i]) >>> 0;
              bytesNeeded--;
              if (bytesNeeded == 0) {
                extra.push(bytes);
                bytes = 0;
                bytesNeeded = 2;
                state = 3;
              }
            }
            else if (state == 3) {
              bytes = (bytes << 8) | data[i];
              bytesNeeded--;
              if (bytesNeeded == 0) {
                command = -1;
                if (extra[0] == 0xFFFF && extra[1] == 0xFFFFFFFF) repairList.push(bytes);
                else {
                  var received = false;
                  for (var item in room.received) {
                    item = room.received[item];
                    if (
                      item[0] == extra[0]
                      && item[1] == extra[1]
                      && item[2] == bytes
                    ) {
                      received = true;
                      break;
                    }
                  }
                  if (!received) {
                    room.received.push([extra[0], extra[1], bytes]);
                    changed = true;
                  }
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
                    var buffer = [
                      0x05,
                      (id & 0xFF00) >> 8,
                      (id & 0x00FF),
                      (location & 0xFF000000) >> 24,
                      (location & 0x00FF0000) >> 16,
                      (location & 0x0000FF00) >> 8,
                      (location & 0x000000FF),
                      (room.sent[id][location] & 0xFF00) >> 8,
                      (room.sent[id][location] & 0x00FF),
                    ]
                    connection.write(new Buffer(buffer));
                  }
                }
              }
            }
          }
          else if (command == 0x07) {
            if (state == 0) {
              bytes = data[i];
              state = 1;
              // extra = [data[i]];
              // bytes = 0;
              // bytesNeeded = 4;
              // state = 1;
            }
            else if (state == 1) {
              extra = [(bytes << 8) | data[i]];
              bytes = 0;
              bytesNeeded = 4;
              state = 2;
            }
            else if (state == 2) {
              bytes = ((bytes << 8) | data[i]) >>> 0;
              bytesNeeded--;
              if (bytesNeeded == 0) {
                command = -1;
                room.inventory[String(extra[0])] = bytes;
                changed = true;
                if (oot.mw_progressive_items_state) mem.u32[oot.mw_progressive_items_state+extra[0]*4] = bytes;
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
        connectionReady = false;
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
    connectionReady = false;
  }
}, 30000);

function initVars() {
  oot.ready = false;
  if (pj64.romInfo != null) {
    var rando = mem.u32[0x801C8464];
    if (rando != 0) {
      var coop = mem.u32[rando];
      oot = mem.bindvars({
        ready:true,
        currentMode:oot.currentMode,
        player_names_addr:0,
        mw_progressive_items_state:0,
        version:'',
        time:'',
        worlds:0,
        hash:[],
        name:'',
        inventory:0
      }, [
        [ coop + 0x0000, 'protocol_version', u32 ],
        [ coop + 0x0004, 'player_id', u8 ],
        // [ coop + 0x0005, 'player_name_id', u8 ],
        [ coop + 0x0006, 'incoming_player', u16 ],
        [ coop + 0x0008, 'incoming_item', u16 ],
        [ coop + 0x000A, 'mw_send_own_items', u8 ],
        [ coop + 0x000B, 'mw_progressive_items_enable', u8 ],
        [ coop + 0x000C, 'outgoing_key', u32 ],
        [ coop + 0x0010, 'outgoing_item', u16 ],
        [ coop + 0x0012, 'outgoing_player', u16 ],
        [ save_context + 0x90, 'internal_count', u16 ],
      ]);
      var cosmetic = mem.u32[rando+0x04];
      if (oot.protocol_version != 6 || mem.u32[cosmetic] != 0x1F073FE0) {
        console.clear();
        console.log('This ROM is not compatible with this version of the Multiworld script.');
        oot.ready = false;
        script.abort();
        return false;
      }
      oot.player_names_addr = coop + 0x14;
      oot.mw_progressive_items_state = coop + 0x81C;
      oot.name = ootDecode(mem.u32[save_context + 0x28], true);
      oot.name = ootDecode(mem.u32[save_context + 0x24], oot.name == '')+oot.name;
      for (var i = 0; i < 0x24; i++) {
        var c = mem.u8[cosmetic+0xAC+i];
        if (c == 0x00) break;
        oot.version += String.fromCharCode(c);
      }
      for (var i = 0; i < 0x24; i++) {
        var c = mem.u8[cosmetic+0xE0+i];
        if (c == 0x00) break;
        oot.time += String.fromCharCode(c);
      }
      var worlds = '';
      for (var i = 0; i < 0x10; i++) {
        var c = mem.u8[cosmetic+0xD0+i];
        if (c == 0x00) break;
        if (c == 0x20) {
          worlds = '';
          continue;
        }
        worlds += String.fromCharCode(c);
      }
      oot.worlds = +worlds;
      if (oot.worlds == 0) {
        console.clear();
        console.log('This is not a Multiworld ROM.');
        oot.ready = false;
        script.abort();
        return false;
      }
      oot.hash.push(mem.u8[coop + 0x0814]);
      oot.hash.push(mem.u8[coop + 0x0815]);
      oot.hash.push(mem.u8[coop + 0x0816]);
      oot.hash.push(mem.u8[coop + 0x0817]);
      oot.hash.push(mem.u8[coop + 0x0818]);
      oot.mw_send_own_items = 1;
      oot.mw_progressive_items_enable = 1;
      loadState();
      room.ids[oot.player_id] = oot.name;
      changed = true;
      if (!saveState()) {
        console.log('Unable to save Multiworld state!');
        console.log('Script cannot run without saving!');
        script.abort();
      }
      setupRoom();
      writePlayerData();
      return true;
    }
  }
  return false;
}

function writeName(i, name) {
  name = ootEncode(name, 8);
  var addr = oot.player_names_addr + (i)*8;
  for (var n=0; n<name.length; n++) {
    mem.u8[addr] = name[n];
    addr++;
  }
}

function writePlayerData() {
  for (var i = 1; i < 0xFF; i++) {
    var id = String(i);
    if (room.ids[id]) writeName(i, room.ids[id]);
    else writeName(i, 'P'+i);
    if (oot.mw_progressive_items_state && room.inventory[id]) mem.u32[oot.mw_progressive_items_state+id*4] = room.inventory[id];
  }
}

function sendItem(item, playerID, location) {
  var player = String(playerID);
  location = '0x'+('00000000'+location.hex()).substr(-8);
  if (!room.sent[player]) room.sent[player] = {};
  if (!room.sent[player][location]) {
    room.sent[player][location] = item;
    changed = true;
    var buffer = [
      0x05,
      (playerID & 0xFF00) >> 8,
      (playerID & 0x00FF),
      (location & 0xFF000000) >> 24,
      (location & 0x00FF0000) >> 16,
      (location & 0x0000FF00) >> 8,
      (location & 0x000000FF),
      (item & 0xFF00) >> 8,
      (item & 0x00FF),
    ]
    if (connectionReady) connection.write(new Buffer(buffer));
  }
  else if (item == 0x7C) {
    var buffer = [
      0x05,
      (playerID & 0xFF00) >> 8,
      (playerID & 0x00FF),
      0xFF,
      0xFF,
      0xFF,
      0xFF,
      (item & 0xFF00) >> 8,
      (item & 0x00FF),
    ]
    if (connectionReady) connection.write(new Buffer(buffer));
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
      connectionReady = false;
    }
    return;
  }
  if (!oot.ready && oot.currentMode == 3) initVars();
  if (oot.ready) {
    if (oot.outgoing_key) {
      var id = oot.outgoing_player;
      var name = 'P'+id;
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
              var name = 'P'+id;
              if (room.ids[String(id)]) name = room.ids[String(id)];
              writeName(id, name);
              oot.incoming_player = oot.player_id;
              oot.incoming_item = item;
            }
          }
        }
      }
      if (mem.u16[0x801C8544] == 0x004F && !defeatedGanon) {
        for (var actor = mem.u32[0x801CA11C]; actor; actor = mem.u32[actor+0x124]) {
          if (mem.u16[actor] == 0x017A && mem.s8[actor+0xAF] <= 0) {
            defeatedGanon = true;
            if (connectionReady) connection.write(new Buffer([0x05, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]));
          }
        }
      }
      if (oot.mw_progressive_items_state) {
        var inventory = 0;
        var val = mem.u8[0x8011A64D];
        inventory |= (val == 0x0A ? 1 : (val == 0x0B ? 2 : 0)) <<  0; // hookshot
        val = mem.u8[0x8011A673];
        inventory |=                       ((val & 0xC0) >> 6) <<  2; // strength
        inventory |=                       ((val & 0x18) >> 3) <<  4; // bomb bag
        inventory |=                       ((val & 0x03) >> 0) <<  6; // bow
        val = mem.u8[0x8011A672];
        inventory |=                       ((val & 0xC0) >> 6) <<  8; // slingshot
        inventory |=                       ((val & 0x30) >> 4) << 10; // wallet
        inventory |=                       ((val & 0x06) >> 1) << 12; // scale
        val = mem.u8[0x8011A671];
        inventory |=                       ((val & 0x30) >> 4) << 14; // nuts
        val = (val & 0x0E) >> 1;
        if (val == 5) val = 2;
        inventory |=                                       val << 16; // sticks
        inventory |=                        mem.u8[0x8011A602] << 18; // magic
        val = mem.u8[0x8011A64B];
        inventory |= (val == 0x07 ? 1 : (val == 0x08 ? 2 : 0)) << 20; // ocarina
        val = mem.u8[0x8011A64C];
        inventory |=                   ((val == 0x09) ? 1 : 0) << 22; // bombchu bag
        if (inventory != oot.inventory) {
          oot.inventory = inventory;
          if (connectionReady) connection.write(new Buffer([
            0x07,
            (inventory & 0xFF000000) >> 24,
            (inventory & 0x00FF0000) >> 16,
            (inventory & 0x0000FF00) >> 8,
            (inventory & 0x000000FF),
          ]));
        }
      }
    }
  }
}, 50);

function setupRoomCfg() {
  console.clear();
  console.log('Would you like to use the default server? [y/n]');
  console.listen(function(input) {
    // if (consoleMode == 0) {
    //   room.ids[oot.player_id] = input.substr(0, 8);
    //   if (oot.ready) writeName(oot.player_id, room.ids[oot.player_id])
    //   console.log('Hello '+room.ids[oot.player_id]+'.');
    //   console.log('Would you like to use the default server? [y/n]');
    // }
    if (consoleMode == 1) {
      if (inArray(input.toLowerCase(), ['y', 'yes'])) {
        // console.log('Please enter the room name.');
        // console.log('Use your randomizer seed if possible.');
        // console.log('Alphanumeric names only!');
        // consoleMode = 3;

        room.server = 'mw.auztin.net';
        room.port = 9001;
        consoleMode = 5;
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
      // console.log('Please enter the room name.');
      // console.log('Use your randomizer seed if possible.');
      // console.log('Alphanumeric names only!');
      consoleMode = 5;
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
