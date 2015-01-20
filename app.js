var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

var userAmount = 0;
var historyData = [];
var reserveData = [];
var endTime = new Date().valueOf() + 172800000;
var bulletin;

for (var i = 0; i < 30; i++) {
  reserveData.push({applicant: null, strategy: null, status: '0', endTime: 0, reserveTime: 0, score: 0});
}

var syncTimer = 0;
setInterval(function () {
  var nowTime = getTime();
  for (var i = 0; i < reserveData.length; i++) {
    if (reserveData[i].endTime > 0 && reserveData[i].endTime < nowTime) {
      reserveData[i].applicant = null;
      reserveData[i].strategy = null;
      reserveData[i].endTime = 0;
      reserveData[i].reserveTime = 0;

      var obj = {
        time: nowTime,
        author: 'System',
        type: 'reserveExpired',
        index: i
      };
      historyData.push(obj);
      io.sockets.emit('reserveExpired', obj);
    }
  }

  syncTimer++;
  while (syncTimer == 60) {
    syncTimer = 0;
    io.sockets.emit('syncData', {endTime: endTime, serverTime: getTime(), reserveData: reserveData});
  }
}, 1000);

io.set('log level', 1);

io.on('connection', function (socket) {
  // console.log(socket.handshake);

  userAmount++;
  var client = {
    socket: socket,
    id: userAmount,
    name: '匿名' + userAmount,
    color: getColor()
  };

  socket.emit('open', {
    name: client.name,
    bulletin: bulletin,
    historyData: historyData,
    reserveData: reserveData,
    serverTime: getTime(),
    endTime: endTime ? endTime.valueOf() : null
  });

  var obj = { time: getTime(), color: client.color};
  obj['text'] = client.name;
  obj['author'] = 'System';
  obj['type'] = 'welcome';
  console.log(client.name + ' Connect');
  
  historyData.push(obj);

  socket.emit('system', obj);
  socket.broadcast.emit('system', obj);


  socket.on('message', function (data) {
    var obj = { time: getTime(), color: client.color};
    if (data.type == 'msg') {    
      obj['text'] = data.msg;
      obj['author'] = client.name;
      obj['type'] = 'message';
      console.log(client.name + ' say: ' + data.msg);
      historyData.push(obj);

      socket.emit('message', obj);
      socket.broadcast.emit('message', obj);
    }

    if (data.type == 'name') {
      obj['oldName'] = client.name;
      obj['newName'] = data.msg;
      obj['author'] = 'System';
      obj['type'] = 'changeName';

      console.log(client.name + ' changed name: ' + data.msg);
      client.name = data.msg;
      historyData.push(obj);

      socket.emit('system', obj);
      socket.broadcast.emit('system', obj);
    }

    if (data.type == 'reserveText') {
      if (data.textIndex == 0) {
        reserveData[data.opponentIndex - 1].applicant = data.msg;
      }
      if (data.textIndex == 1) {
        reserveData[data.opponentIndex - 1].strategy = data.msg;
      }

      var reserveTime = getTime();
      var reserveEndTime = getReserveEndTime(reserveTime);
      reserveData[data.opponentIndex - 1].reserveTime = reserveTime
      reserveData[data.opponentIndex - 1].endTime = reserveEndTime;

      obj['author'] = client.name;
      obj['opponentIndex'] = data.opponentIndex;
      obj['textIndex'] = data.textIndex;
      obj['text'] = data.msg;
      obj['endTime'] = reserveEndTime;
      obj['type'] = 'reserveText';

      console.log(client.name + ' changed reserve info. Opponent:' + data.opponentIndex + ', Text:' + data.textIndex + ' ' + data.msg);
      historyData.push(obj);

      socket.emit('reserveText', obj);
      socket.broadcast.emit('reserveText', obj);
    }

    if (data.type == 'reserveStatus') {
      if (data.value == '-1') {
        data.value = '0';
      }

      reserveData[data.index - 1].status = data.value;
      reserveData[data.index - 1].applicant = null;
      reserveData[data.index - 1].strategy = null;
      reserveData[data.index - 1].endTime = 0;
      reserveData[data.index - 1].score = parseInt(data.value == '4' ? 0 : data.value);

      obj['author'] = client.name;
      obj['index'] = data.index;
      obj['value'] = data.value;
      obj['endTime'] = 0;
      obj['type'] = 'reserveStatus';
      obj['totalScore'] = getTotalScore();

      console.log(client.name + ' changed reserve info. Opponent:' + data.index + ', Status:' + data.value);
      historyData.push(obj);

      socket.emit('reserveStatus', obj);
      socket.broadcast.emit('reserveStatus', obj);
    }

  });

  socket.on('disconnect', function () {  
    var obj = {
      time: getTime(),
      color: client.color,
      author: 'System',
      text: client.name,
      type: 'disconnect'
    };

    console.log(client.name + ' Disconnect');
    historyData.push(obj);
    
    socket.broadcast.emit('system', obj);
  });
});


app.configure(function () {
  app.set('port', process.env.PORT || 80);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.get('/', function (req, res) {
  res.sendfile('views/index.html');
});

app.get('/admin', function (req, res) {
  res.sendfile('views/admin.html');
});

app.post('/timecfg', function (req, res) {
  endTime = parseInt(req.body.endTime);
  var nowTime = getTime();
  for (var i = 0; i < reserveData.length; i++) {
    if (reserveData[i].endTime != 0) {
      reserveData[i].endTime = getReserveEndTime(reserveData[i].reserveTime);
    }
  }

  var obj = {
    time: getTime(),
    author: 'System',
    endTime: endTime,
    serverTime: getTime(),
    type: 'timeReset',
    reserveData: reserveData
  };
  historyData.push(obj);
  io.sockets.emit('timeReset', obj);

  res.send('New time: ' + new Date(endTime).toString() + '<br />timestamp: ' + endTime);
});

app.post('/bulletin', function (req, res) {
  bulletin = req.body.bulletin;
  io.sockets.emit('bulletin', {time: getTime(), bulletin: bulletin});
  res.send('Bulletin: ' + bulletin);
});

app.get('/historyData', function (req, res) {
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(historyData));
});

app.get('/reserveData', function (req, res) {
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(reserveData));
});

server.listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});

var getTime = function () {
  return new Date().valueOf();
}

var getColor = function () {
  var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'pink', 'red', 'green', 'orange', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}

var getReserveEndTime = function (reserveTime) {
  var timeDiff = endTime - reserveTime;
  var reserveEndTime;
  if (timeDiff >= 86400000) { reserveEndTime = endTime - 43200000;}
  else if (timeDiff < 86400000 && timeDiff >= 7200000) { reserveEndTime = endTime - timeDiff / 2;}
  else if (timeDiff < 7200000 && timeDiff >= 3600000) { reserveEndTime = endTime - 3600000;}
  else if (timeDiff < 3600000) { reserveEndTime = endTime;}
  return reserveEndTime;
}

var getTotalScore = function () {
  var sum = 0;
  for (var i = 0; i < reserveData.length; i++) {
    sum += reserveData[i].score;
  }
  return sum;
}